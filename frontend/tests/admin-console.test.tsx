import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminConsole } from "@/components/admin-console";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

describe("AdminConsole", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("logs in and creates a merchant", async () => {
    let merchantCreated = false;

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";

      if (url === "/api/admin/merchants" && method === "GET") {
        if (!merchantCreated && fetchMock.mock.calls.length === 1) {
          return new Response(JSON.stringify({ message: "Authentication required." }), { status: 401 });
        }

        return jsonResponse({
          merchants: merchantCreated
            ? [
                {
                  id: "test-merchant",
                  name: "Test Merchant",
                  category: "EC",
                  isActive: true
                }
              ]
            : [],
          user: {
            username: "admin",
            displayName: "Test Admin"
          }
        });
      }

      if (url === "/api/admin/cards" && method === "GET") {
        return jsonResponse({
          cards: [],
          user: {
            username: "admin",
            displayName: "Test Admin"
          }
        });
      }

      if (url === "/api/admin/login" && method === "POST") {
        return jsonResponse({
          user: {
            username: "admin",
            displayName: "Test Admin"
          }
        });
      }

      if (url === "/api/admin/merchants" && method === "POST") {
        merchantCreated = true;
        return jsonResponse(
          {
            merchant: {
              id: "test-merchant",
              name: "Test Merchant",
              category: "EC",
              isActive: true
            }
          },
          201
        );
      }

      if (url === "/api/admin/logout" && method === "POST") {
        return new Response(null, { status: 204 });
      }

      return jsonResponse({ message: `Unexpected request: ${method} ${url}` }, 500);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<AdminConsole />);

    await screen.findByRole("heading", { name: "管理者ログイン" });

    await userEvent.type(screen.getByLabelText("ユーザー名"), "admin");
    await userEvent.type(screen.getByLabelText("パスワード"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "ログイン" }));

    await screen.findByRole("heading", { name: "店舗マスタ" });

    await userEvent.type(screen.getByLabelText("店舗名"), "Test Merchant");
    await userEvent.clear(screen.getByLabelText("カテゴリ"));
    await userEvent.type(screen.getByLabelText("カテゴリ"), "EC");
    await userEvent.click(screen.getByRole("button", { name: "店舗を作成" }));

    await waitFor(() => {
      expect(screen.getByText("Test Merchant")).toBeInTheDocument();
    });
  });
});
