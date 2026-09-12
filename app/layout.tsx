import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DropSeo Agent | Autonomous Website Intelligence",
  description: "A browser agent that explores websites, tests real journeys, collects evidence, and verifies fixes.",
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
