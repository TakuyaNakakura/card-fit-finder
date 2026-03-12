import express, { type NextFunction, type Request, type Response } from "express";
import { ZodError, z } from "zod";
import {
  cardBrandSchema,
  ensureUniqueRecordIds,
  parseCardBody,
  parseCardImportBody,
  parseMerchantBody,
  parseMerchantImportBody,
  resolveMissingCardImportMerchants
} from "./catalog-import.js";
import {
  clearSessionCookie,
  createSessionCookie,
  createSessionToken,
  readSessionToken,
  verifyPassword,
  verifySessionToken
} from "./auth.js";
import { LoginAttemptLimiter } from "./login-attempts.js";
import { recommendCards } from "./recommendations.js";
import { type DataStore } from "./types.js";

const recommendationSchema = z.object({
  monthlySpendYen: z.number().int().positive(),
  preferredBrands: z.array(cardBrandSchema).default([]),
  merchantIds: z.array(z.string().min(1)).default([]),
  annualFeeLimitYen: z.number().int().nonnegative().nullable()
});

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

export interface AppDependencies {
  store: DataStore;
  sessionSecret: string;
  secureCookies?: boolean;
  adminConsoleEnabled?: boolean;
  loginAttemptLimiter?: LoginAttemptLimiter;
}

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly headers: Record<string, string> = {}
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

function getClientAddress(request: Request): string {
  const forwardedFor = request.headers["x-forwarded-for"];

  if (typeof forwardedFor === "string" && forwardedFor.length > 0) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return request.ip || request.socket?.remoteAddress || "unknown";
}

function getLoginAttemptKey(request: Request, username: string): string {
  return `${getClientAddress(request)}:${username.trim().toLowerCase()}`;
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

export function createHandlers({
  store,
  sessionSecret,
  secureCookies = false,
  loginAttemptLimiter = new LoginAttemptLimiter()
}: AppDependencies): AppHandlers {
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
      const loginAttemptKey = getLoginAttemptKey(request, input.username);
      const loginAttemptStatus = loginAttemptLimiter.check(loginAttemptKey);

      if (!loginAttemptStatus.allowed) {
        throw new HttpError(429, "Too many login attempts. Try again later.", {
          "Retry-After": String(loginAttemptStatus.retryAfterSeconds)
        });
      }

      const adminUser = await store.findAdminUserByUsername(input.username);

      if (!adminUser || !adminUser.isActive || !verifyPassword(input.password, adminUser.passwordHash)) {
        const failureStatus = loginAttemptLimiter.recordFailure(loginAttemptKey);

        if (!failureStatus.allowed) {
          throw new HttpError(429, "Too many login attempts. Try again later.", {
            "Retry-After": String(failureStatus.retryAfterSeconds)
          });
        }

        throw new HttpError(401, "Invalid admin credentials.");
      }

      loginAttemptLimiter.reset(loginAttemptKey);
      const token = createSessionToken(adminUser.username, sessionSecret);
      response.setHeader("Set-Cookie", createSessionCookie(token, { secure: secureCookies }));
      response.json({
        user: {
          username: adminUser.username,
          displayName: adminUser.displayName
        }
      });
    },

    adminLogout(_request, response) {
      response.setHeader("Set-Cookie", clearSessionCookie({ secure: secureCookies }));
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
    for (const [headerName, headerValue] of Object.entries(error.headers)) {
      response.setHeader(headerName, headerValue);
    }

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
  const adminConsoleEnabled = dependencies.adminConsoleEnabled ?? true;

  app.set("trust proxy", true);
  app.use(express.json());

  app.get("/api/health", handlers.health);
  app.get("/api/merchants", asyncRoute(handlers.listMerchants));
  app.post("/api/recommendations", asyncRoute(handlers.postRecommendations));

  if (adminConsoleEnabled) {
    app.use("/api/admin", (_request, response, next) => {
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("Pragma", "no-cache");
      next();
    });
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
  } else {
    app.use("/api/admin", (_request, response) => {
      response.status(404).json({ message: "Not found." });
    });
  }

  app.use("/api", (_request, response) => {
    response.status(404).json({ message: "Not found." });
  });

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    writeErrorResponse(error, response);
  });

  return app;
}
