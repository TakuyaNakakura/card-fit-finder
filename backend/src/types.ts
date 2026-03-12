export const CARD_BRANDS = ["Visa", "Mastercard", "JCB", "Amex"] as const;

export type CardBrand = (typeof CARD_BRANDS)[number];

export interface Merchant {
  id: string;
  name: string;
  category: string;
  isActive: boolean;
}

export interface MerchantBenefitRate {
  merchantId: string;
  rewardRatePct: number;
  note: string;
  isActive: boolean;
}

export interface CardRecord {
  id: string;
  name: string;
  issuer: string;
  description: string;
  annualFeeYen: number;
  baseRewardRatePct: number;
  supportedBrands: CardBrand[];
  isActive: boolean;
  merchantBenefitRates: MerchantBenefitRate[];
}

export interface AdminUser {
  id: string;
  username: string;
  displayName: string;
  passwordHash: string;
  isActive: boolean;
}

export interface RecommendationRequest {
  monthlySpendYen: number;
  preferredBrands: CardBrand[];
  merchantIds: string[];
  annualFeeLimitYen: number | null;
}

export interface RecommendationBreakdownItem {
  kind: "general" | "merchant";
  label: string;
  annualSpendYen: number;
  rewardRatePct: number;
  estimatedRewardYen: number;
}

export interface RecommendationResult {
  cardId: string;
  cardName: string;
  issuer: string;
  supportedBrands: CardBrand[];
  annualFeeYen: number;
  estimatedAnnualRewardYen: number;
  estimatedNetBenefitYen: number;
  matchedMerchants: string[];
  reasonSummary: string;
  breakdown: RecommendationBreakdownItem[];
}

export interface DataStore {
  listPublicMerchants(): Promise<Merchant[]>;
  listAdminMerchants(): Promise<Merchant[]>;
  createMerchant(merchant: Merchant): Promise<Merchant>;
  updateMerchant(merchant: Merchant): Promise<Merchant>;
  upsertMerchant(merchant: Merchant): Promise<Merchant>;
  listActiveCards(): Promise<CardRecord[]>;
  listAdminCards(): Promise<CardRecord[]>;
  createCard(card: CardRecord): Promise<CardRecord>;
  updateCard(card: CardRecord): Promise<CardRecord>;
  upsertCard(card: CardRecord): Promise<CardRecord>;
  findAdminUserByUsername(username: string): Promise<AdminUser | null>;
  upsertAdminUser(user: AdminUser): Promise<AdminUser>;
}
