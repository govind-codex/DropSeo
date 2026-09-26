import type { Metadata } from "next";
import "./globals.css";
import "./landing.css";

export const metadata: Metadata = {
  title: "AudiFox Agent | Autonomous Website Intelligence",
  description: "A browser agent that explores websites, tests real journeys, collects evidence, and verifies fixes.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/audifox-logo.png",
    shortcut: "/audifox-logo.png",
    apple: "/audifox-logo.png",
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
