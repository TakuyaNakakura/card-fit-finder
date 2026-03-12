import { z } from "zod";
import { CARD_BRANDS, type CardBrand, type CardRecord, type Merchant } from "./types.js";
import { slugify } from "./utils.js";

export const cardBrandSchema = z.enum(CARD_BRANDS);

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

export function normalizeCardBrand(value: string): string {
  const normalized = value.trim();
  return CARD_BRAND_ALIASES[normalized.toLowerCase()] ?? normalized;
}

export function normalizeMerchantId(value: string): string {
  const normalized = value.trim();
  return MERCHANT_ID_ALIASES[normalized.toLowerCase()] ?? normalized;
}

export function buildImportedMerchant(merchantId: string): Merchant | null {
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

function ensureUniqueMerchantBenefitRows(card: CardRecord): void {
  const uniqueMerchantIds = new Set(card.merchantBenefitRates.map((row) => row.merchantId));

  if (uniqueMerchantIds.size !== card.merchantBenefitRates.length) {
    throw new Error("Merchant benefit rows must be unique by merchantId.");
  }
}

export function parseMerchantBody(input: unknown): Merchant {
  const parsed = merchantSchema.parse(input);

  return {
    id: parsed.id ? normalizeMerchantId(parsed.id) : slugify(parsed.name),
    name: parsed.name,
    category: parsed.category,
    isActive: parsed.isActive
  };
}

export function parseCardBody(input: unknown): CardRecord {
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

export function parseMerchantImportBody(input: unknown): Merchant[] {
  const parsed = merchantImportSchema.parse(input);
  const merchants = Array.isArray(parsed) ? parsed : parsed.merchants;
  return merchants.map((merchant) => parseMerchantBody(merchant));
}

export function parseCardImportBody(input: unknown): CardRecord[] {
  const parsed = cardImportSchema.parse(input);
  const cards = Array.isArray(parsed) ? parsed : parsed.cards;
  return cards.map((card) => parseCardBody(card));
}

export function ensureUniqueRecordIds<T extends { id: string }>(
  records: T[],
  resourceName: string
): void {
  const seenIds = new Set<string>();

  for (const record of records) {
    if (seenIds.has(record.id)) {
      throw new Error(`${resourceName} import contains duplicate id: ${record.id}`);
    }

    seenIds.add(record.id);
  }
}

export function resolveMissingCardImportMerchants(
  cards: CardRecord[],
  merchants: Merchant[]
): Merchant[] {
  const merchantIds = new Set(merchants.map((merchant) => merchant.id));
  const missingMerchants = new Map<string, Merchant>();

  for (const card of cards) {
    for (const benefit of card.merchantBenefitRates) {
      if (!merchantIds.has(benefit.merchantId)) {
        const importedMerchant = buildImportedMerchant(benefit.merchantId);

        if (!importedMerchant) {
          throw new Error(
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
