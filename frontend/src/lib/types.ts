export const CARD_BRANDS = ["Visa", "Mastercard", "JCB", "Amex"] as const;

export type CardBrand = (typeof CARD_BRANDS)[number];

export interface Merchant {
  id: string;
  name: string;
  category: string;
  isActive: boolean;
}

export interface RecommendationBreakdownItem {
  kind: "general" | "merchant";
  label: string;
  annualSpendYen: number;
  rewardRatePct: number;
  estimatedRewardYen: number;
}

export interface Recommendation {
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

export interface MerchantBenefitRate {
  merchantId: string;
  rewardRatePct: number;
  note: string;
  isActive: boolean;
}

export interface AdminCard {
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
  username: string;
  displayName: string;
}

export interface ImportResponse {
  importedCount: number;
}

export const ANNUAL_FEE_OPTIONS = [
  { value: "0", label: "無料のみ" },
  { value: "5000", label: "5,000円以下" },
  { value: "10000", label: "10,000円以下" },
  { value: "none", label: "制限なし" }
] as const;
