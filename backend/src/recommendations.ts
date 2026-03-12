import {
  type CardRecord,
  type Merchant,
  type RecommendationRequest,
  type RecommendationResult
} from "./types.js";
import { formatYen } from "./utils.js";

function roundYen(value: number): number {
  return Math.round(value);
}

function intersects<T>(left: T[], right: T[]): boolean {
  return left.some((value) => right.includes(value));
}

function buildReasonSummary(
  card: CardRecord,
  matchedMerchants: string[],
  preferredBrands: RecommendationRequest["preferredBrands"],
  netBenefitYen: number
): string {
  const merchantPart =
    matchedMerchants.length > 0
      ? `${matchedMerchants.slice(0, 2).join("、")}で優待還元があります。`
      : "一般利用でも安定して使いやすい構成です。";

  const brandPart =
    preferredBrands.length > 0
      ? `希望ブランドでは ${card.supportedBrands
          .filter((brand) => preferredBrands.includes(brand))
          .join(" / ")} に対応します。`
      : "";

  return `${merchantPart}${brandPart}実質メリットは年間 ${formatYen(
    netBenefitYen
  )} 円です。`;
}

export function recommendCards(
  cards: CardRecord[],
  merchants: Merchant[],
  input: RecommendationRequest
): RecommendationResult[] {
  const merchantMap = new Map(merchants.map((merchant) => [merchant.id, merchant]));
  const annualSpendYen = input.monthlySpendYen * 12;
  const selectedMerchantIds = input.merchantIds.filter((merchantId) =>
    merchantMap.has(merchantId)
  );
  const perMerchantSpendYen =
    selectedMerchantIds.length > 0 ? (annualSpendYen * 0.7) / selectedMerchantIds.length : 0;
  const generalSpendYen = selectedMerchantIds.length > 0 ? annualSpendYen * 0.3 : annualSpendYen;

  const recommendations = cards
    .filter((card) => card.isActive)
    .filter((card) =>
      input.annualFeeLimitYen === null ? true : card.annualFeeYen <= input.annualFeeLimitYen
    )
    .filter((card) =>
      input.preferredBrands.length === 0
        ? true
        : intersects(card.supportedBrands, input.preferredBrands)
    )
    .map((card) => {
      const breakdown = [];
      const matchedMerchants: string[] = [];
      const generalRewardYen = roundYen((generalSpendYen * card.baseRewardRatePct) / 100);

      breakdown.push({
        kind: "general" as const,
        label: "一般利用",
        annualSpendYen: roundYen(generalSpendYen),
        rewardRatePct: card.baseRewardRatePct,
        estimatedRewardYen: generalRewardYen
      });

      let merchantRewardYenTotal = 0;

      for (const merchantId of selectedMerchantIds) {
        const merchant = merchantMap.get(merchantId);

        if (!merchant) {
          continue;
        }

        const benefit = card.merchantBenefitRates.find(
          (rate) => rate.merchantId === merchantId && rate.isActive
        );
        const rewardRatePct = benefit?.rewardRatePct ?? card.baseRewardRatePct;
        const estimatedRewardYen = roundYen((perMerchantSpendYen * rewardRatePct) / 100);

        if (benefit && rewardRatePct > card.baseRewardRatePct) {
          matchedMerchants.push(merchant.name);
        }

        merchantRewardYenTotal += estimatedRewardYen;
        breakdown.push({
          kind: "merchant" as const,
          label: merchant.name,
          annualSpendYen: roundYen(perMerchantSpendYen),
          rewardRatePct,
          estimatedRewardYen
        });
      }

      const estimatedAnnualRewardYen = generalRewardYen + merchantRewardYenTotal;
      const estimatedNetBenefitYen = estimatedAnnualRewardYen - card.annualFeeYen;

      return {
        cardId: card.id,
        cardName: card.name,
        issuer: card.issuer,
        supportedBrands: card.supportedBrands,
        annualFeeYen: card.annualFeeYen,
        estimatedAnnualRewardYen,
        estimatedNetBenefitYen,
        matchedMerchants,
        reasonSummary: buildReasonSummary(
          card,
          matchedMerchants,
          input.preferredBrands,
          estimatedNetBenefitYen
        ),
        breakdown
      };
    })
    .sort((left, right) => {
      if (right.estimatedNetBenefitYen !== left.estimatedNetBenefitYen) {
        return right.estimatedNetBenefitYen - left.estimatedNetBenefitYen;
      }

      if (left.annualFeeYen !== right.annualFeeYen) {
        return left.annualFeeYen - right.annualFeeYen;
      }

      return left.cardId.localeCompare(right.cardId);
    });

  return recommendations.slice(0, 3);
}
