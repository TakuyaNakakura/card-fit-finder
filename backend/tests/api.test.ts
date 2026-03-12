import { describe, expect, it } from "vitest";
import { createHandlers, writeErrorResponse } from "../src/app.js";
import { buildSeededMemoryStore } from "./helpers.js";

function createMockResponse() {
  return {
    statusCode: 200,
    headers: {} as Record<string, string | string[]>,
    body: null as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
    send(payload?: unknown) {
      this.body = payload ?? null;
      return this;
    },
    setHeader(name: string, value: string | string[]) {
      this.headers[name.toLowerCase()] = value;
      return this;
    },
    getHeader(name: string) {
      return this.headers[name.toLowerCase()];
    }
  };
}

async function invokeHandler(
  handler: (request: never, response: never) => Promise<void> | void,
  options?: { body?: unknown; cookie?: string }
): Promise<ReturnType<typeof createMockResponse>> {
  const response = createMockResponse();
  const request = {
    body: options?.body,
    headers: {
      cookie: options?.cookie
    }
  };

  try {
    await handler(request as never, response as never);
  } catch (error) {
    writeErrorResponse(error, response as never);
  }

  return response;
}

describe("backend API", () => {
  it("validates recommendation input", async () => {
    const store = await buildSeededMemoryStore();
    const handlers = createHandlers({ store, sessionSecret: "test-secret" });

    const response = await invokeHandler(handlers.postRecommendations, {
      body: {
        monthlySpendYen: 0,
        preferredBrands: [],
        merchantIds: [],
        annualFeeLimitYen: null
      }
    });

    expect(response.statusCode).toBe(400);
  });

  it("rejects admin routes without authentication", async () => {
    const store = await buildSeededMemoryStore();
    const handlers = createHandlers({ store, sessionSecret: "test-secret" });
    const response = await invokeHandler(handlers.listAdminCards);

    expect(response.statusCode).toBe(401);
  });

  it("supports admin login and merchant CRUD", async () => {
    const store = await buildSeededMemoryStore();
    const handlers = createHandlers({ store, sessionSecret: "test-secret" });

    const loginResponse = await invokeHandler(handlers.adminLogin, {
      body: {
        username: "admin",
        password: "password123"
      }
    });

    expect(loginResponse.statusCode).toBe(200);
    const sessionCookie = loginResponse.headers["set-cookie"];
    expect(sessionCookie).toBeTruthy();

    const createMerchantResponse = await invokeHandler(handlers.createAdminMerchant, {
      cookie: Array.isArray(sessionCookie) ? sessionCookie[0] : String(sessionCookie),
      body: {
        name: "Test Store",
        category: "EC",
        isActive: true
      }
    });

    expect(createMerchantResponse.statusCode).toBe(201);
    expect((createMerchantResponse.body as { merchant: { id: string } }).merchant.id).toBe("test-store");

    const updateMerchantResponse = await invokeHandler(handlers.updateAdminMerchant, {
      cookie: Array.isArray(sessionCookie) ? sessionCookie[0] : String(sessionCookie),
      body: {
        id: "test-store",
        name: "Test Store Updated",
        category: "EC",
        isActive: false
      }
    });

    expect(updateMerchantResponse.statusCode).toBe(200);
    expect(
      (updateMerchantResponse.body as { merchant: { isActive: boolean } }).merchant.isActive
    ).toBe(false);
  });

  it("supports card CRUD after login", async () => {
    const store = await buildSeededMemoryStore();
    const handlers = createHandlers({ store, sessionSecret: "test-secret" });

    const loginResponse = await invokeHandler(handlers.adminLogin, {
      body: {
        username: "admin",
        password: "password123"
      }
    });
    const sessionCookie = loginResponse.headers["set-cookie"];

    const createCardResponse = await invokeHandler(handlers.createAdminCard, {
      cookie: Array.isArray(sessionCookie) ? sessionCookie[0] : String(sessionCookie),
      body: {
        name: "Local Test Card",
        issuer: "Tester",
        description: "Created in tests",
        annualFeeYen: 0,
        baseRewardRatePct: 1.5,
        supportedBrands: ["Visa"],
        isActive: true,
        merchantBenefitRates: [
          {
            merchantId: "amazon",
            rewardRatePct: 2.0,
            note: "Test rate",
            isActive: true
          }
        ]
      }
    });

    expect(createCardResponse.statusCode).toBe(201);
    expect((createCardResponse.body as { card: { id: string } }).card.id).toBe("local-test-card");

    const updateCardResponse = await invokeHandler(handlers.updateAdminCard, {
      cookie: Array.isArray(sessionCookie) ? sessionCookie[0] : String(sessionCookie),
      body: {
        id: "local-test-card",
        name: "Local Test Card",
        issuer: "Tester",
        description: "Updated",
        annualFeeYen: 500,
        baseRewardRatePct: 1.4,
        supportedBrands: ["Visa", "JCB"],
        isActive: false,
        merchantBenefitRates: []
      }
    });

    expect(updateCardResponse.statusCode).toBe(200);
    expect(
      (updateCardResponse.body as { card: { annualFeeYen: number; isActive: boolean } }).card
        .annualFeeYen
    ).toBe(500);
    expect(
      (updateCardResponse.body as { card: { annualFeeYen: number; isActive: boolean } }).card
        .isActive
    ).toBe(false);
  });
});
