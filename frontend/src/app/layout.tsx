import type { Metadata } from "next";
import React, { type ReactNode } from "react";
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
            <a href="/admin">管理</a>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
