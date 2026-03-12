"use client";

import React, { type FormEvent, useEffect, useState } from "react";
import { fetchJson } from "@/lib/fetch-json";
import { formatYen } from "@/lib/format";
import {
  ANNUAL_FEE_OPTIONS,
  CARD_BRANDS,
  type CardBrand,
  type Merchant,
  type Recommendation
} from "@/lib/types";

type MerchantGroups = Record<string, Merchant[]>;

function groupMerchantsByCategory(merchants: Merchant[]): MerchantGroups {
  return merchants.reduce<MerchantGroups>((groups, merchant) => {
    const current = groups[merchant.category] ?? [];
    current.push(merchant);
    groups[merchant.category] = current;
    return groups;
  }, {});
}

export function RecommendationApp() {
  const [monthlySpendYen, setMonthlySpendYen] = useState("80000");
  const [preferredBrands, setPreferredBrands] = useState<CardBrand[]>(["Visa"]);
  const [selectedMerchantIds, setSelectedMerchantIds] = useState<string[]>(["amazon", "seven-eleven"]);
  const [annualFeeLimit, setAnnualFeeLimit] = useState<string>("10000");
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoadingMerchants, setIsLoadingMerchants] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  useEffect(() => {
    let isCurrent = true;

    const loadMerchants = async () => {
      try {
        const data = await fetchJson<{ merchants: Merchant[] }>("/api/merchants");

        if (!isCurrent) {
          return;
        }

        setMerchants(data.merchants);
      } catch (error) {
        if (!isCurrent) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : "店舗一覧の取得に失敗しました。");
      } finally {
        if (isCurrent) {
          setIsLoadingMerchants(false);
        }
      }
    };

    void loadMerchants();

    return () => {
      isCurrent = false;
    };
  }, []);

  const merchantGroups = groupMerchantsByCategory(merchants);

  function toggleBrand(brand: CardBrand): void {
    setPreferredBrands((current) =>
      current.includes(brand) ? current.filter((value) => value !== brand) : [...current, brand]
    );
  }

  function toggleMerchant(merchantId: string): void {
    setSelectedMerchantIds((current) =>
      current.includes(merchantId)
        ? current.filter((value) => value !== merchantId)
        : [...current, merchantId]
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const data = await fetchJson<{ recommendations: Recommendation[] }>("/api/recommendations", {
        method: "POST",
        body: JSON.stringify({
          monthlySpendYen: Number(monthlySpendYen),
          preferredBrands,
          merchantIds: selectedMerchantIds,
          annualFeeLimitYen: annualFeeLimit === "none" ? null : Number(annualFeeLimit)
        })
      });

      setRecommendations(data.recommendations);
      setHasSubmitted(true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "診断に失敗しました。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Card Fit Finder</p>
          <h1>使い方に合わせて、カード候補を3枚まで自動提案</h1>
          <p className="lede">
            月額利用、国際ブランド、よく使う店舗、年会費の上限から年間実質メリットを推定します。
          </p>
        </div>
        <div className="hero-note">
          <p>初期データはサンプルです。</p>
          <p>管理画面からカード条件と店舗特典を上書きできます。</p>
        </div>
      </section>

      <section className="content-grid">
        <form className="card-panel form-panel" onSubmit={handleSubmit}>
          <div className="panel-heading">
            <h2>診断条件</h2>
            <p>最小入力で使い分けられるよう、総額と利用先だけを聞きます。</p>
          </div>

          <label className="field">
            <span>月額利用額</span>
            <input
              type="number"
              min="1"
              step="1"
              value={monthlySpendYen}
              onChange={(event) => setMonthlySpendYen(event.target.value)}
              placeholder="80000"
            />
          </label>

          <fieldset className="field-group">
            <legend>希望する国際ブランド</legend>
            <div className="choice-row">
              {CARD_BRANDS.map((brand) => (
                <label className="checkbox-pill" key={brand}>
                  <input
                    type="checkbox"
                    checked={preferredBrands.includes(brand)}
                    onChange={() => toggleBrand(brand)}
                  />
                  <span>{brand}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="field-group">
            <legend>年会費の上限</legend>
            <div className="choice-row">
              {ANNUAL_FEE_OPTIONS.map((option) => (
                <label className="radio-pill" key={option.value}>
                  <input
                    type="radio"
                    name="annualFeeLimit"
                    value={option.value}
                    checked={annualFeeLimit === option.value}
                    onChange={(event) => setAnnualFeeLimit(event.target.value)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="field-group">
            <legend>よく使う店舗</legend>
            {isLoadingMerchants ? (
              <p className="inline-status">店舗一覧を読み込み中です。</p>
            ) : (
              <div className="merchant-groups">
                {Object.entries(merchantGroups).map(([category, categoryMerchants]) => (
                  <div className="merchant-group" key={category}>
                    <p className="merchant-group-title">{category}</p>
                    <div className="chip-row">
                      {categoryMerchants.map((merchant) => {
                        const isSelected = selectedMerchantIds.includes(merchant.id);

                        return (
                          <button
                            type="button"
                            key={merchant.id}
                            className={isSelected ? "chip chip-active" : "chip"}
                            aria-pressed={isSelected}
                            onClick={() => toggleMerchant(merchant.id)}
                          >
                            {merchant.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </fieldset>

          <button className="primary-button" type="submit" disabled={isSubmitting || isLoadingMerchants}>
            {isSubmitting ? "診断中..." : "おすすめを診断"}
          </button>

          {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
        </form>

        <section className="card-panel result-panel">
          <div className="panel-heading">
            <h2>診断結果</h2>
            <p>年間の推定還元額から年会費を差し引いた実質メリット順で表示します。</p>
          </div>

          {!hasSubmitted ? (
            <div className="empty-state">
              <p>条件を入力すると、候補カードと理由がここに表示されます。</p>
            </div>
          ) : recommendations.length === 0 ? (
            <div className="empty-state">
              <p>指定したブランドや年会費条件に一致するカードが見つかりませんでした。</p>
            </div>
          ) : (
            <div className="recommendation-list">
              {recommendations.map((recommendation, index) => (
                <article className="recommendation-card" key={recommendation.cardId}>
                  <div className="recommendation-header">
                    <div>
                      <p className="rank-label">#{index + 1}</p>
                      <h3>{recommendation.cardName}</h3>
                      <p className="muted-text">{recommendation.issuer}</p>
                    </div>
                    <div className="metric-stack">
                      <div>
                        <span className="metric-label">推定年間還元</span>
                        <strong>{formatYen(recommendation.estimatedAnnualRewardYen)} 円</strong>
                      </div>
                      <div>
                        <span className="metric-label">実質メリット</span>
                        <strong>{formatYen(recommendation.estimatedNetBenefitYen)} 円</strong>
                      </div>
                    </div>
                  </div>

                  <div className="badge-row">
                    {recommendation.supportedBrands.map((brand) => (
                      <span className="badge" key={brand}>
                        {brand}
                      </span>
                    ))}
                    <span className="badge badge-muted">
                      年会費 {formatYen(recommendation.annualFeeYen)} 円
                    </span>
                  </div>

                  <p className="reason-text">{recommendation.reasonSummary}</p>

                  {recommendation.matchedMerchants.length > 0 ? (
                    <p className="matched-text">
                      特典一致: {recommendation.matchedMerchants.join(" / ")}
                    </p>
                  ) : null}

                  <div className="breakdown-table">
                    {recommendation.breakdown.map((item) => (
                      <div className="breakdown-row" key={`${recommendation.cardId}-${item.label}`}>
                        <span>{item.label}</span>
                        <span>{formatYen(item.annualSpendYen)} 円</span>
                        <span>{item.rewardRatePct.toFixed(1)}%</span>
                        <strong>{formatYen(item.estimatedRewardYen)} 円</strong>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
