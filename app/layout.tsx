import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sitepulse | SEO & Performance Analytics",
  description: "Understand your website's SEO health and performance with actionable page audits.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
