import type { Metadata } from "next";
import React, { type ReactNode } from "react";
import { isAdminConsoleEnabled } from "@/lib/server-flags";
import "./globals.css";

export const metadata: Metadata = {
  title: "Card Fit Finder",
  description: "利用額と店舗条件から最適なクレジットカード候補を診断する MVP"
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  const adminConsoleEnabled = isAdminConsoleEnabled();

  return (
    <html lang="ja">
      <body>
        <header className="topbar">
          <a className="brandmark" href="/">
            <span className="brandmark-accent">CF</span>
            <span>Card Fit Finder</span>
          </a>
          <nav className="topnav">
            <a href="/">診断</a>
            {adminConsoleEnabled ? <a href="/admin">管理</a> : null}
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
