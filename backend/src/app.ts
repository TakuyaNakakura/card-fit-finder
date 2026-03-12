import express, { type NextFunction, type Request, type Response } from "express";
import { ZodError, z } from "zod";
import {
  clearSessionCookie,
  createSessionCookie,
  createSessionToken,
  readSessionToken,
  verifyPassword,
  verifySessionToken
} from "./auth.js";
import { recommendCards } from "./recommendations.js";
import { CARD_BRANDS, type CardBrand, type CardRecord, type DataStore, type Merchant } from "./types.js";
import { slugify } from "./utils.js";

const cardBrandSchema = z.enum(CARD_BRANDS);
const normalizedCardBrandSchema = z.preprocess(
  (value) => (typeof value === "string" ? normalizeCardBrand(value) : value),
  cardBrandSchema
);
const normalizedMerchantIdSchema = z.preprocess(
  (value) => (typeof value === "string" ? normalizeMerchantId(value) : value),
  z.string().min(1)
);

const CARD_BRAND_ALIASES: Record<string, CardBrand> = {
  visa: "Visa",
  mastercard: "Mastercard",
  "master card": "Mastercard",
  jcb: "JCB",
  amex: "Amex",
  "american express": "Amex"
};

const MERCHANT_ID_ALIASES: Record<string, string> = {
  "7-eleven": "seven-eleven",
  enecos: "eneos",
  biccamera: "bic-camera"
};

const IMPORT_MERCHANT_DEFAULTS: Record<string, { name: string; category: string; isActive: boolean }> = {
  "yahoo-shopping": {
    name: "Yahoo!ショッピング",
    category: "EC",
    isActive: true
  },
  jre: {
    name: "JRE MALL",
    category: "EC",
    isActive: true
  },
  "target-convenience-and-restaurants": {
    name: "対象コンビニ・飲食店",
    category: "優待",
    isActive: true
  }
};

function normalizeCardBrand(value: string): string {
  const normalized = value.trim();
  return CARD_BRAND_ALIASES[normalized.toLowerCase()] ?? normalized;
}

function normalizeMerchantId(value: string): string {
  const normalized = value.trim();
  return MERCHANT_ID_ALIASES[normalized.toLowerCase()] ?? normalized;
}

function buildImportedMerchant(merchantId: string): Merchant | null {
  const defaults = IMPORT_MERCHANT_DEFAULTS[merchantId];

  if (!defaults) {
    return null;
  }

  return {
    id: merchantId,
    name: defaults.name,
    category: defaults.category,
    isActive: defaults.isActive
  };
}

const recommendationSchema = z.object({
  monthlySpendYen: z.number().int().positive(),
  preferredBrands: z.array(cardBrandSchema).default([]),
  merchantIds: z.array(z.string().min(1)).default([]),
  annualFeeLimitYen: z.number().int().nonnegative().nullable()
});

const merchantSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1),
  category: z.string().min(1),
  isActive: z.boolean().default(true)
});

const merchantBenefitSchema = z.object({
  merchantId: normalizedMerchantIdSchema,
  rewardRatePct: z.number().nonnegative(),
  note: z.string().max(160).default(""),
  isActive: z.boolean().default(true)
});

const cardSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1),
  issuer: z.string().min(1),
  description: z.string().min(1),
  annualFeeYen: z.number().int().nonnegative(),
  baseRewardRatePct: z.number().nonnegative(),
  supportedBrands: z.array(normalizedCardBrandSchema).min(1),
  isActive: z.boolean().default(true),
  merchantBenefitRates: z.array(merchantBenefitSchema).default([])
});

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

const merchantImportSchema = z.union([
  z.array(merchantSchema).min(1),
  z.object({
    merchants: z.array(merchantSchema).min(1)
  })
]);

const cardImportSchema = z.union([
  z.array(cardSchema).min(1),
  z.object({
    cards: z.array(cardSchema).min(1)
  })
]);

export interface AppDependencies {
  store: DataStore;
  sessionSecret: string;
}

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
  }
}

export interface AppHandlers {
  health: (request: Request, response: Response) => void;
  listMerchants: (request: Request, response: Response) => Promise<void>;
  postRecommendations: (request: Request, response: Response) => Promise<void>;
  adminLogin: (request: Request, response: Response) => Promise<void>;
  adminLogout: (request: Request, response: Response) => void;
  listAdminMerchants: (request: Request, response: Response) => Promise<void>;
  createAdminMerchant: (request: Request, response: Response) => Promise<void>;
  updateAdminMerchant: (request: Request, response: Response) => Promise<void>;
  importAdminMerchants: (request: Request, response: Response) => Promise<void>;
  listAdminCards: (request: Request, response: Response) => Promise<void>;
  createAdminCard: (request: Request, response: Response) => Promise<void>;
  updateAdminCard: (request: Request, response: Response) => Promise<void>;
  importAdminCards: (request: Request, response: Response) => Promise<void>;
}

function ensureUniqueMerchantBenefitRows(card: CardRecord): void {
  const uniqueMerchantIds = new Set(card.merchantBenefitRates.map((row) => row.merchantId));

  if (uniqueMerchantIds.size !== card.merchantBenefitRates.length) {
    throw new HttpError(400, "Merchant benefit rows must be unique by merchantId.");
  }
}

function parseMerchantBody(input: unknown): Merchant {
  const parsed = merchantSchema.parse(input);

  return {
    id: parsed.id ?? slugify(parsed.name),
    name: parsed.name,
    category: parsed.category,
    isActive: parsed.isActive
  };
}

function parseCardBody(input: unknown): CardRecord {
  const parsed = cardSchema.parse(input);
  const card: CardRecord = {
    id: parsed.id ?? slugify(parsed.name),
    name: parsed.name,
    issuer: parsed.issuer,
    description: parsed.description,
    annualFeeYen: parsed.annualFeeYen,
    baseRewardRatePct: parsed.baseRewardRatePct,
    supportedBrands: parsed.supportedBrands,
    isActive: parsed.isActive,
    merchantBenefitRates: parsed.merchantBenefitRates
  };

  ensureUniqueMerchantBenefitRows(card);
  return card;
}

function parseMerchantImportBody(input: unknown): Merchant[] {
  const parsed = merchantImportSchema.parse(input);
  const merchants = Array.isArray(parsed) ? parsed : parsed.merchants;
  return merchants.map((merchant) => parseMerchantBody(merchant));
}

function parseCardImportBody(input: unknown): CardRecord[] {
  const parsed = cardImportSchema.parse(input);
  const cards = Array.isArray(parsed) ? parsed : parsed.cards;
  return cards.map((card) => parseCardBody(card));
}

function ensureUniqueRecordIds<T extends { id: string }>(records: T[], resourceName: string): void {
  const seenIds = new Set<string>();

  for (const record of records) {
    if (seenIds.has(record.id)) {
      throw new HttpError(400, `${resourceName} import contains duplicate id: ${record.id}`);
    }

    seenIds.add(record.id);
  }
}

function resolveMissingCardImportMerchants(cards: CardRecord[], merchants: Merchant[]): Merchant[] {
  const merchantIds = new Set(merchants.map((merchant) => merchant.id));
  const missingMerchants = new Map<string, Merchant>();

  for (const card of cards) {
    for (const benefit of card.merchantBenefitRates) {
      if (!merchantIds.has(benefit.merchantId)) {
        const importedMerchant = buildImportedMerchant(benefit.merchantId);

        if (!importedMerchant) {
          throw new HttpError(
            400,
            `Unknown merchantId in card import: ${benefit.merchantId}. Import merchants first or fix the JSON file.`
          );
        }

        missingMerchants.set(importedMerchant.id, importedMerchant);
        merchantIds.add(importedMerchant.id);
      }
    }
  }

  return Array.from(missingMerchants.values());
}

async function requireAdmin(
  request: Request,
  store: DataStore,
  sessionSecret: string
): Promise<{ username: string }> {
  const sessionToken = readSessionToken(request.headers.cookie);
  const payload = verifySessionToken(sessionToken, sessionSecret);

  if (!payload) {
    throw new HttpError(401, "Authentication required.");
  }

  const adminUser = await store.findAdminUserByUsername(payload.username);

  if (!adminUser || !adminUser.isActive) {
    throw new HttpError(401, "Authentication required.");
  }

  return { username: adminUser.username };
}

export function createHandlers({ store, sessionSecret }: AppDependencies): AppHandlers {
  return {
    health(_request, response) {
      response.json({ ok: true });
    },

    async listMerchants(_request, response) {
      const merchants = await store.listPublicMerchants();
      response.json({ merchants });
    },

    async postRecommendations(request, response) {
      const input = recommendationSchema.parse(request.body);
      const [cards, merchants] = await Promise.all([
        store.listActiveCards(),
        store.listPublicMerchants()
      ]);

      response.json({
        recommendations: recommendCards(cards, merchants, input)
      });
    },

    async adminLogin(request, response) {
      const input = loginSchema.parse(request.body);
      const adminUser = await store.findAdminUserByUsername(input.username);

      if (!adminUser || !adminUser.isActive || !verifyPassword(input.password, adminUser.passwordHash)) {
        throw new HttpError(401, "Invalid admin credentials.");
      }

      const token = createSessionToken(adminUser.username, sessionSecret);
      response.setHeader("Set-Cookie", createSessionCookie(token));
      response.json({
        user: {
          username: adminUser.username,
          displayName: adminUser.displayName
        }
      });
    },

    adminLogout(_request, response) {
      response.setHeader("Set-Cookie", clearSessionCookie());
      response.status(204).send();
    },

    async listAdminMerchants(request, response) {
      const admin = await requireAdmin(request, store, sessionSecret);
      const merchants = await store.listAdminMerchants();
      response.json({ merchants, user: admin });
    },

    async createAdminMerchant(request, response) {
      await requireAdmin(request, store, sessionSecret);
      const merchant = parseMerchantBody(request.body);
      const created = await store.createMerchant(merchant);
      response.status(201).json({ merchant: created });
    },

    async updateAdminMerchant(request, response) {
      await requireAdmin(request, store, sessionSecret);
      const merchant = parseMerchantBody(request.body);
      const updated = await store.updateMerchant(merchant);
      response.json({ merchant: updated });
    },

    async importAdminMerchants(request, response) {
      await requireAdmin(request, store, sessionSecret);
      const merchants = parseMerchantImportBody(request.body);
      ensureUniqueRecordIds(merchants, "Merchant");

      for (const merchant of merchants) {
        await store.upsertMerchant(merchant);
      }

      response.json({ importedCount: merchants.length });
    },

    async listAdminCards(request, response) {
      const admin = await requireAdmin(request, store, sessionSecret);
      const cards = await store.listAdminCards();
      response.json({ cards, user: admin });
    },

    async createAdminCard(request, response) {
      await requireAdmin(request, store, sessionSecret);
      const card = parseCardBody(request.body);
      const created = await store.createCard(card);
      response.status(201).json({ card: created });
    },

    async updateAdminCard(request, response) {
      await requireAdmin(request, store, sessionSecret);
      const card = parseCardBody(request.body);
      const updated = await store.updateCard(card);
      response.json({ card: updated });
    },

    async importAdminCards(request, response) {
      await requireAdmin(request, store, sessionSecret);
      const cards = parseCardImportBody(request.body);
      ensureUniqueRecordIds(cards, "Card");

      const merchants = await store.listAdminMerchants();
      const missingMerchants = resolveMissingCardImportMerchants(cards, merchants);

      for (const merchant of missingMerchants) {
        await store.upsertMerchant(merchant);
      }

      for (const card of cards) {
        await store.upsertCard(card);
      }

      response.json({ importedCount: cards.length });
    }
  };
}

export function writeErrorResponse(error: unknown, response: Response): void {
  if (error instanceof ZodError) {
    response.status(400).json({
      message: "Invalid request payload.",
      issues: error.issues
    });
    return;
  }

  if (error instanceof HttpError) {
    response.status(error.statusCode).json({ message: error.message });
    return;
  }

  if (error instanceof Error) {
    const statusCode =
      error.message.startsWith("Merchant not found:") || error.message.startsWith("Card not found:")
        ? 404
        : error.message.includes("duplicate key")
          ? 409
          : 400;
    response.status(statusCode).json({ message: error.message });
    return;
  }

  response.status(500).json({ message: "Unexpected server error." });
}

function asyncRoute(
  handler: (request: Request, response: Response) => Promise<void>
): (request: Request, response: Response, next: NextFunction) => void {
  return (request, response, next) => {
    void Promise.resolve(handler(request, response)).catch(next);
  };
}

export function createApp(dependencies: AppDependencies) {
  const app = express();
  const handlers = createHandlers(dependencies);

  app.use(express.json());

  app.get("/api/health", handlers.health);
  app.get("/api/merchants", asyncRoute(handlers.listMerchants));
  app.post("/api/recommendations", asyncRoute(handlers.postRecommendations));
  app.post("/api/admin/login", asyncRoute(handlers.adminLogin));
  app.post("/api/admin/logout", handlers.adminLogout);
  app.get("/api/admin/merchants", asyncRoute(handlers.listAdminMerchants));
  app.post("/api/admin/merchants", asyncRoute(handlers.createAdminMerchant));
  app.put("/api/admin/merchants", asyncRoute(handlers.updateAdminMerchant));
  app.post("/api/admin/import/merchants", asyncRoute(handlers.importAdminMerchants));
  app.get("/api/admin/cards", asyncRoute(handlers.listAdminCards));
  app.post("/api/admin/cards", asyncRoute(handlers.createAdminCard));
  app.put("/api/admin/cards", asyncRoute(handlers.updateAdminCard));
  app.post("/api/admin/import/cards", asyncRoute(handlers.importAdminCards));

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    writeErrorResponse(error, response);
  });

  return app;
}
