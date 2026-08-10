import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Prelegal",
  description: "Draft legal agreements from templates.",
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
