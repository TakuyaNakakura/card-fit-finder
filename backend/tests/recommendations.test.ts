import { describe, expect, it } from "vitest";
import { recommendCards } from "../src/recommendations.js";
import { seedCards, seedMerchants } from "../src/seed-data.js";
import { type CardRecord } from "../src/types.js";

describe("recommendCards", () => {
  it("filters by preferred brand and annual fee limit", () => {
    const recommendations = recommendCards(seedCards, seedMerchants, {
      monthlySpendYen: 50000,
      preferredBrands: ["Amex"],
      merchantIds: ["apple"],
      annualFeeLimitYen: 7000
    });

    expect(recommendations[0]?.cardId).toBe("smartlife-amex");
    expect(recommendations.every((item) => item.supportedBrands.includes("Amex"))).toBe(true);
  });

  it("applies merchant-specific reward rates with weighted spend distribution", () => {
    const [topCard] = recommendCards(seedCards, seedMerchants, {
      monthlySpendYen: 100000,
      preferredBrands: [],
      merchantIds: ["amazon", "rakuten-ichiba"],
      annualFeeLimitYen: null
    });

    expect(topCard?.cardId).toBe("point-core-standard");
    expect(topCard?.breakdown.find((item) => item.label === "Amazon")?.annualSpendYen).toBe(420000);
    expect(topCard?.matchedMerchants).toContain("Amazon");
  });

  it("uses annual fee as the tie breaker when net benefit is the same", () => {
    const cards: CardRecord[] = [
      {
        id: "high-fee",
        name: "High Fee",
        issuer: "Test",
        description: "Test",
        annualFeeYen: 1000,
        baseRewardRatePct: 1.0,
        supportedBrands: ["Visa"],
        isActive: true,
        merchantBenefitRates: []
      },
      {
        id: "low-fee",
        name: "Low Fee",
        issuer: "Test",
        description: "Test",
        annualFeeYen: 0,
        baseRewardRatePct: 1.0,
        supportedBrands: ["Visa"],
        isActive: true,
        merchantBenefitRates: []
      }
    ];
    const merchants = [{ id: "amazon", name: "Amazon", category: "EC", isActive: true }];

    const recommendations = recommendCards(cards, merchants, {
      monthlySpendYen: 0 + 100000,
      preferredBrands: ["Visa"],
      merchantIds: [],
      annualFeeLimitYen: null
    });

    expect(recommendations[0]?.cardId).toBe("low-fee");
  });

  it("returns no results when no card matches the preferred brands", () => {
    const recommendations = recommendCards(seedCards, seedMerchants, {
      monthlySpendYen: 30000,
      preferredBrands: ["Amex"],
      merchantIds: ["amazon"],
      annualFeeLimitYen: 1000
    });

    expect(recommendations).toHaveLength(0);
  });
});
