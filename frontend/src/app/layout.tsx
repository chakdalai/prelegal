import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Mutual NDA creator — Prelegal",
  description:
    "Fill in a few key terms and download a completed Common Paper Mutual Non-Disclosure Agreement.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-stone-100 text-stone-900 antialiased">{children}</body>
    </html>
  );
}
