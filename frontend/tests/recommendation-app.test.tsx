import React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RecommendationApp } from "@/components/recommendation-app";

describe("RecommendationApp", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("loads merchants and renders recommendation results after submit", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            merchants: [
              { id: "amazon", name: "Amazon", category: "EC", isActive: true },
              { id: "seven-eleven", name: "セブン-イレブン", category: "コンビニ", isActive: true }
            ]
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            recommendations: [
              {
                cardId: "card-1",
                cardName: "Top Card",
                issuer: "Issuer",
                supportedBrands: ["Visa"],
                annualFeeYen: 0,
                estimatedAnnualRewardYen: 12000,
                estimatedNetBenefitYen: 12000,
                matchedMerchants: ["Amazon"],
                reasonSummary: "Amazon で優待還元があります。実質メリットは年間 12,000 円です。",
                breakdown: [
                  {
                    kind: "general",
                    label: "一般利用",
                    annualSpendYen: 360000,
                    rewardRatePct: 1.0,
                    estimatedRewardYen: 3600
                  }
                ]
              },
              {
                cardId: "card-2",
                cardName: "Second Card",
                issuer: "Issuer",
                supportedBrands: ["Visa"],
                annualFeeYen: 500,
                estimatedAnnualRewardYen: 9000,
                estimatedNetBenefitYen: 8500,
                matchedMerchants: [],
                reasonSummary: "一般利用でも安定して使いやすい構成です。",
                breakdown: []
              },
              {
                cardId: "card-3",
                cardName: "Third Card",
                issuer: "Issuer",
                supportedBrands: ["Visa"],
                annualFeeYen: 1000,
                estimatedAnnualRewardYen: 8000,
                estimatedNetBenefitYen: 7000,
                matchedMerchants: [],
                reasonSummary: "一般利用でも安定して使いやすい構成です。",
                breakdown: []
              }
            ]
          }),
          { status: 200 }
        )
      );

    vi.stubGlobal("fetch", fetchMock);

    render(<RecommendationApp />);

    await screen.findByRole("button", { name: "Amazon" });

    const spendInput = screen.getByLabelText("月額利用額");
    await userEvent.clear(spendInput);
    await userEvent.type(spendInput, "100000");
    const form = screen.getAllByRole("button", { name: "おすすめを診断" })[0].closest(
      "form"
    ) as HTMLFormElement;

    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    await screen.findByRole("heading", { name: "Top Card" });
    expect(screen.getByText("Second Card")).toBeInTheDocument();
    expect(screen.getByText("Third Card")).toBeInTheDocument();

    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/recommendations",
      expect.objectContaining({
        method: "POST"
      })
    );
  });

  it("shows the empty state when the API returns no recommendations", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            merchants: [{ id: "amazon", name: "Amazon", category: "EC", isActive: true }]
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            recommendations: []
          }),
          { status: 200 }
        )
      );

    vi.stubGlobal("fetch", fetchMock);

    render(<RecommendationApp />);

    await screen.findByRole("button", { name: "Amazon" });
    const form = screen.getAllByRole("button", { name: "おすすめを診断" })[0].closest(
      "form"
    ) as HTMLFormElement;

    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    await waitFor(() => {
      expect(
        screen.getByText("指定したブランドや年会費条件に一致するカードが見つかりませんでした。")
      ).toBeInTheDocument();
    });
  });

  it("allows integer yen amounts without step mismatch", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          merchants: [{ id: "amazon", name: "Amazon", category: "EC", isActive: true }]
        }),
        { status: 200 }
      )
    );

    vi.stubGlobal("fetch", fetchMock);

    render(<RecommendationApp />);

    const spendInput = await screen.findByLabelText("月額利用額");
    expect(spendInput).toHaveAttribute("min", "1");
    expect(spendInput).toHaveAttribute("step", "1");
  });

  it("shows a catalog setup message when no merchants are available", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          merchants: []
        }),
        { status: 200 }
      )
    );

    vi.stubGlobal("fetch", fetchMock);

    render(<RecommendationApp />);

    await waitFor(() => {
      expect(
        screen.getByText("公開用の店舗データがまだ登録されていません。先にカタログを取り込んでください。")
      ).toBeInTheDocument();
    });
  });
});
