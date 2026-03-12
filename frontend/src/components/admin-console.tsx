"use client";

import React, { type FormEvent, useEffect, useState } from "react";
import { fetchJson } from "@/lib/fetch-json";
import { formatYen } from "@/lib/format";
import {
  CARD_BRANDS,
  type AdminCard,
  type AdminUser,
  type CardBrand,
  type Merchant,
  type MerchantBenefitRate
} from "@/lib/types";

interface MerchantDraft {
  id: string;
  name: string;
  category: string;
  isActive: boolean;
}

interface BenefitDraft extends Omit<MerchantBenefitRate, "rewardRatePct"> {
  rewardRatePct: string;
}

interface CardDraft {
  id: string;
  name: string;
  issuer: string;
  description: string;
  annualFeeYen: string;
  baseRewardRatePct: string;
  supportedBrands: CardBrand[];
  isActive: boolean;
  merchantBenefitRates: BenefitDraft[];
}

const EMPTY_MERCHANT_DRAFT: MerchantDraft = {
  id: "",
  name: "",
  category: "EC",
  isActive: true
};

const EMPTY_CARD_DRAFT: CardDraft = {
  id: "",
  name: "",
  issuer: "",
  description: "",
  annualFeeYen: "0",
  baseRewardRatePct: "1.0",
  supportedBrands: ["Visa"],
  isActive: true,
  merchantBenefitRates: []
};

function createCardDraft(card: AdminCard): CardDraft {
  return {
    id: card.id,
    name: card.name,
    issuer: card.issuer,
    description: card.description,
    annualFeeYen: String(card.annualFeeYen),
    baseRewardRatePct: String(card.baseRewardRatePct),
    supportedBrands: card.supportedBrands,
    isActive: card.isActive,
    merchantBenefitRates: card.merchantBenefitRates.map((benefit) => ({
      ...benefit,
      rewardRatePct: String(benefit.rewardRatePct)
    }))
  };
}

export function AdminConsole() {
  const [authState, setAuthState] = useState<"checking" | "logged-out" | "logged-in">("checking");
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(null);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [cards, setCards] = useState<AdminCard[]>([]);
  const [loginUsername, setLoginUsername] = useState("admin");
  const [loginPassword, setLoginPassword] = useState("");
  const [merchantDraft, setMerchantDraft] = useState<MerchantDraft>(EMPTY_MERCHANT_DRAFT);
  const [cardDraft, setCardDraft] = useState<CardDraft>(EMPTY_CARD_DRAFT);
  const [selectedMerchantId, setSelectedMerchantId] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function loadProtectedData(): Promise<void> {
    setErrorMessage(null);

    try {
      const merchantsResponse = await fetch("/api/admin/merchants", {
        credentials: "same-origin"
      });

      if (merchantsResponse.status === 401) {
        setAuthState("logged-out");
        setCurrentUser(null);
        return;
      }

      const merchantsData = (await merchantsResponse.json()) as {
        merchants: Merchant[];
        user: AdminUser;
      };
      const cardsData = await fetchJson<{ cards: AdminCard[]; user: AdminUser }>("/api/admin/cards");

      setMerchants(merchantsData.merchants);
      setCards(cardsData.cards);
      setCurrentUser(cardsData.user);
      setAuthState("logged-in");
    } catch (error) {
      setAuthState("logged-out");
      setErrorMessage(error instanceof Error ? error.message : "管理データの取得に失敗しました。");
    }
  }

  useEffect(() => {
    void loadProtectedData();
  }, []);

  function resetMerchantDraft(): void {
    setSelectedMerchantId(null);
    setMerchantDraft(EMPTY_MERCHANT_DRAFT);
  }

  function resetCardDraft(): void {
    setSelectedCardId(null);
    setCardDraft(EMPTY_CARD_DRAFT);
  }

  function toggleCardBrand(brand: CardBrand): void {
    setCardDraft((current) => ({
      ...current,
      supportedBrands: current.supportedBrands.includes(brand)
        ? current.supportedBrands.filter((value) => value !== brand)
        : [...current.supportedBrands, brand]
    }));
  }

  function updateBenefitRow(
    index: number,
    field: keyof BenefitDraft,
    value: string | boolean
  ): void {
    setCardDraft((current) => ({
      ...current,
      merchantBenefitRates: current.merchantBenefitRates.map((benefit, benefitIndex) =>
        benefitIndex === index ? { ...benefit, [field]: value } : benefit
      )
    }));
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      await fetchJson<{ user: AdminUser }>("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({
          username: loginUsername,
          password: loginPassword
        })
      });

      setLoginPassword("");
      await loadProtectedData();
      setStatusMessage("管理画面にログインしました。");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "ログインに失敗しました。");
    }
  }

  async function handleLogout(): Promise<void> {
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      await fetchJson<null>("/api/admin/logout", {
        method: "POST"
      });
      setAuthState("logged-out");
      setCurrentUser(null);
      setStatusMessage("ログアウトしました。");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "ログアウトに失敗しました。");
    }
  }

  async function handleMerchantSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);
    setIsSaving(true);

    try {
      await fetchJson<{ merchant: Merchant }>("/api/admin/merchants", {
        method: selectedMerchantId ? "PUT" : "POST",
        body: JSON.stringify({
          id: merchantDraft.id || undefined,
          name: merchantDraft.name,
          category: merchantDraft.category,
          isActive: merchantDraft.isActive
        })
      });

      await loadProtectedData();
      resetMerchantDraft();
      setStatusMessage("店舗データを保存しました。");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "店舗データの保存に失敗しました。");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCardSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);
    setIsSaving(true);

    try {
      await fetchJson<{ card: AdminCard }>("/api/admin/cards", {
        method: selectedCardId ? "PUT" : "POST",
        body: JSON.stringify({
          id: cardDraft.id || undefined,
          name: cardDraft.name,
          issuer: cardDraft.issuer,
          description: cardDraft.description,
          annualFeeYen: Number(cardDraft.annualFeeYen),
          baseRewardRatePct: Number(cardDraft.baseRewardRatePct),
          supportedBrands: cardDraft.supportedBrands,
          isActive: cardDraft.isActive,
          merchantBenefitRates: cardDraft.merchantBenefitRates.map((benefit) => ({
            merchantId: benefit.merchantId,
            rewardRatePct: Number(benefit.rewardRatePct),
            note: benefit.note,
            isActive: benefit.isActive
          }))
        })
      });

      await loadProtectedData();
      resetCardDraft();
      setStatusMessage("カードデータを保存しました。");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "カードデータの保存に失敗しました。");
    } finally {
      setIsSaving(false);
    }
  }

  if (authState === "checking") {
    return (
      <main className="page-shell admin-shell">
        <section className="card-panel">
          <h1>管理画面を確認しています</h1>
          <p className="inline-status">認証状態を読み込み中です。</p>
        </section>
      </main>
    );
  }

  if (authState === "logged-out") {
    return (
      <main className="page-shell admin-shell">
        <section className="card-panel auth-panel">
          <div className="panel-heading">
            <h1>管理者ログイン</h1>
            <p>カードデータ、店舗候補、優待還元率を更新します。</p>
          </div>

          <form className="stack-form" onSubmit={handleLogin}>
            <label className="field">
              <span>ユーザー名</span>
              <input
                type="text"
                value={loginUsername}
                onChange={(event) => setLoginUsername(event.target.value)}
              />
            </label>

            <label className="field">
              <span>パスワード</span>
              <input
                type="password"
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
              />
            </label>

            <button className="primary-button" type="submit">
              ログイン
            </button>
          </form>

          {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
          {statusMessage ? <p className="success-text">{statusMessage}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell admin-shell">
      <section className="hero-panel admin-hero">
        <div className="hero-copy">
          <p className="eyebrow">Admin Console</p>
          <h1>カード条件と優待ロジックを手動で管理</h1>
          <p className="lede">
            現在のログイン: {currentUser?.displayName ?? currentUser?.username}
          </p>
        </div>
        <button className="secondary-button" type="button" onClick={handleLogout}>
          ログアウト
        </button>
      </section>

      {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
      {statusMessage ? <p className="success-text">{statusMessage}</p> : null}

      <section className="admin-grid">
        <div className="card-panel admin-column">
          <div className="panel-heading panel-heading-inline">
            <div>
              <h2>店舗マスタ</h2>
              <p>公開候補の一覧とカテゴリを更新します。</p>
            </div>
            <button className="secondary-button" type="button" onClick={resetMerchantDraft}>
              新規
            </button>
          </div>

          <div className="catalog-list">
            {merchants.map((merchant) => (
              <button
                key={merchant.id}
                type="button"
                className="catalog-item"
                onClick={() => {
                  setSelectedMerchantId(merchant.id);
                  setMerchantDraft({
                    id: merchant.id,
                    name: merchant.name,
                    category: merchant.category,
                    isActive: merchant.isActive
                  });
                }}
              >
                <div>
                  <strong>{merchant.name}</strong>
                  <span>{merchant.category}</span>
                </div>
                <span className={merchant.isActive ? "status-tag" : "status-tag status-tag-muted"}>
                  {merchant.isActive ? "公開中" : "停止中"}
                </span>
              </button>
            ))}
          </div>

          <form className="stack-form" onSubmit={handleMerchantSubmit}>
            <label className="field">
              <span>店舗名</span>
              <input
                type="text"
                value={merchantDraft.name}
                onChange={(event) =>
                  setMerchantDraft((current) => ({ ...current, name: event.target.value }))
                }
              />
            </label>

            <label className="field">
              <span>カテゴリ</span>
              <input
                type="text"
                value={merchantDraft.category}
                onChange={(event) =>
                  setMerchantDraft((current) => ({ ...current, category: event.target.value }))
                }
              />
            </label>

            <label className="toggle-row">
              <input
                type="checkbox"
                checked={merchantDraft.isActive}
                onChange={(event) =>
                  setMerchantDraft((current) => ({ ...current, isActive: event.target.checked }))
                }
              />
              <span>公開対象にする</span>
            </label>

            <button className="primary-button" type="submit" disabled={isSaving}>
              {selectedMerchantId ? "店舗を更新" : "店舗を作成"}
            </button>
          </form>
        </div>

        <div className="card-panel admin-column">
          <div className="panel-heading panel-heading-inline">
            <div>
              <h2>カードカタログ</h2>
              <p>年会費、基本還元率、ブランド、店舗別優待を更新します。</p>
            </div>
            <button className="secondary-button" type="button" onClick={resetCardDraft}>
              新規
            </button>
          </div>

          <div className="catalog-list card-catalog-list">
            {cards.map((card) => (
              <button
                key={card.id}
                type="button"
                className="catalog-item"
                onClick={() => {
                  setSelectedCardId(card.id);
                  setCardDraft(createCardDraft(card));
                }}
              >
                <div>
                  <strong>{card.name}</strong>
                  <span>
                    {card.issuer} / 年会費 {formatYen(card.annualFeeYen)} 円 / 基本還元{" "}
                    {card.baseRewardRatePct.toFixed(1)}%
                  </span>
                </div>
                <span className={card.isActive ? "status-tag" : "status-tag status-tag-muted"}>
                  {card.isActive ? "公開中" : "停止中"}
                </span>
              </button>
            ))}
          </div>

          <form className="stack-form" onSubmit={handleCardSubmit}>
            <label className="field">
              <span>カード名</span>
              <input
                type="text"
                value={cardDraft.name}
                onChange={(event) =>
                  setCardDraft((current) => ({ ...current, name: event.target.value }))
                }
              />
            </label>

            <label className="field">
              <span>発行会社</span>
              <input
                type="text"
                value={cardDraft.issuer}
                onChange={(event) =>
                  setCardDraft((current) => ({ ...current, issuer: event.target.value }))
                }
              />
            </label>

            <label className="field">
              <span>説明文</span>
              <textarea
                value={cardDraft.description}
                onChange={(event) =>
                  setCardDraft((current) => ({ ...current, description: event.target.value }))
                }
                rows={3}
              />
            </label>

            <div className="field-grid">
              <label className="field">
                <span>年会費 (円)</span>
                <input
                  type="number"
                  min="0"
                  value={cardDraft.annualFeeYen}
                  onChange={(event) =>
                    setCardDraft((current) => ({ ...current, annualFeeYen: event.target.value }))
                  }
                />
              </label>

              <label className="field">
                <span>基本還元率 (%)</span>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={cardDraft.baseRewardRatePct}
                  onChange={(event) =>
                    setCardDraft((current) => ({
                      ...current,
                      baseRewardRatePct: event.target.value
                    }))
                  }
                />
              </label>
            </div>

            <fieldset className="field-group">
              <legend>対応ブランド</legend>
              <div className="choice-row">
                {CARD_BRANDS.map((brand) => (
                  <label className="checkbox-pill" key={brand}>
                    <input
                      type="checkbox"
                      checked={cardDraft.supportedBrands.includes(brand)}
                      onChange={() => toggleCardBrand(brand)}
                    />
                    <span>{brand}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="toggle-row">
              <input
                type="checkbox"
                checked={cardDraft.isActive}
                onChange={(event) =>
                  setCardDraft((current) => ({ ...current, isActive: event.target.checked }))
                }
              />
              <span>公開対象にする</span>
            </label>

            <div className="benefit-editor">
              <div className="panel-heading panel-heading-inline compact-heading">
                <div>
                  <h3>店舗別優待</h3>
                  <p>対象店舗ごとの還元率を登録します。</p>
                </div>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() =>
                    setCardDraft((current) => ({
                      ...current,
                      merchantBenefitRates: [
                        ...current.merchantBenefitRates,
                        {
                          merchantId: merchants[0]?.id ?? "",
                          rewardRatePct: current.baseRewardRatePct,
                          note: "",
                          isActive: true
                        }
                      ]
                    }))
                  }
                >
                  行を追加
                </button>
              </div>

              {cardDraft.merchantBenefitRates.length === 0 ? (
                <p className="inline-status">店舗別優待は未設定です。</p>
              ) : (
                <div className="benefit-list">
                  {cardDraft.merchantBenefitRates.map((benefit, index) => (
                    <div className="benefit-row" key={`${benefit.merchantId}-${index}`}>
                      <label className="field">
                        <span>店舗</span>
                        <select
                          value={benefit.merchantId}
                          onChange={(event) =>
                            updateBenefitRow(index, "merchantId", event.target.value)
                          }
                        >
                          {merchants.map((merchant) => (
                            <option key={merchant.id} value={merchant.id}>
                              {merchant.name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="field">
                        <span>還元率 (%)</span>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={benefit.rewardRatePct}
                          onChange={(event) =>
                            updateBenefitRow(index, "rewardRatePct", event.target.value)
                          }
                        />
                      </label>

                      <label className="field">
                        <span>メモ</span>
                        <input
                          type="text"
                          value={benefit.note}
                          onChange={(event) => updateBenefitRow(index, "note", event.target.value)}
                        />
                      </label>

                      <label className="toggle-row small-toggle">
                        <input
                          type="checkbox"
                          checked={benefit.isActive}
                          onChange={(event) => updateBenefitRow(index, "isActive", event.target.checked)}
                        />
                        <span>有効</span>
                      </label>

                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() =>
                          setCardDraft((current) => ({
                            ...current,
                            merchantBenefitRates: current.merchantBenefitRates.filter(
                              (_value, benefitIndex) => benefitIndex !== index
                            )
                          }))
                        }
                      >
                        削除
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button className="primary-button" type="submit" disabled={isSaving}>
              {selectedCardId ? "カードを更新" : "カードを作成"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
