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
import { CARD_BRANDS, type CardRecord, type DataStore, type Merchant } from "./types.js";
import { slugify } from "./utils.js";

const cardBrandSchema = z.enum(CARD_BRANDS);

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
  merchantId: z.string().min(1),
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
  supportedBrands: z.array(cardBrandSchema).min(1),
  isActive: z.boolean().default(true),
  merchantBenefitRates: z.array(merchantBenefitSchema).default([])
});

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

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
  listAdminCards: (request: Request, response: Response) => Promise<void>;
  createAdminCard: (request: Request, response: Response) => Promise<void>;
  updateAdminCard: (request: Request, response: Response) => Promise<void>;
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
  app.get("/api/admin/cards", asyncRoute(handlers.listAdminCards));
  app.post("/api/admin/cards", asyncRoute(handlers.createAdminCard));
  app.put("/api/admin/cards", asyncRoute(handlers.updateAdminCard));

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    writeErrorResponse(error, response);
  });

  return app;
}
