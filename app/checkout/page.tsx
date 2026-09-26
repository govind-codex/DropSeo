import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CheckCircle2, CircleX, CreditCard, Settings2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Payment status | AudiFox",
  description: "Review the status of your AudiFox checkout.",
};

type CheckoutPageProps = { searchParams: Promise<{ status?: string }> };

const messages = {
  success: {
    icon: CheckCircle2,
    eyebrow: "CHECKOUT FINISHED",
    title: "Thanks for choosing AudiFox.",
    detail: "Dodo Payments is confirming the result of your checkout. You can return to your workspace now.",
  },
  cancelled: {
    icon: CircleX,
    eyebrow: "CHECKOUT CANCELLED",
    title: "No payment was made.",
    detail: "Your current plan has not changed. You can return to pricing whenever you are ready.",
  },
  configuration: {
    icon: Settings2,
    eyebrow: "SETUP REQUIRED",
    title: "Dodo Payments is not connected yet.",
    detail: "The site owner needs to add the Dodo API key, return URL, and product IDs before checkout can open.",
  },
  "invalid-plan": {
    icon: CircleX,
    eyebrow: "PLAN NOT FOUND",
    title: "That plan is not available.",
    detail: "Return to pricing and choose one of the available AudiFox plans.",
  },
  error: {
    icon: CreditCard,
    eyebrow: "CHECKOUT UNAVAILABLE",
    title: "We could not open checkout.",
    detail: "Please try again in a moment. No payment has been made.",
  },
} as const;

export default async function CheckoutPage({ searchParams }: CheckoutPageProps) {
  const { status } = await searchParams;
  const message = messages[status as keyof typeof messages] ?? messages.error;
  const Icon = message.icon;

  return (
    <main className="payment-page">
      <section className="payment-card" aria-labelledby="payment-title">
        <Link className="brand" href="/" aria-label="AudiFox home"><span className="brand-mark" aria-hidden="true"><Image src="/audifox-logo.png" alt="" width={40} height={40} /></span>AudiFox<span>.</span></Link>
        <span className="payment-icon" aria-hidden="true"><Icon /></span>
        <span className="payment-eyebrow">{message.eyebrow}</span>
        <h1 id="payment-title">{message.title}</h1>
        <p>{message.detail}</p>
        <div className="payment-actions">
          <Link className="google-button" href="/dashboard">Open workspace <ArrowRight size={18} /></Link>
          <Link className="back-link" href="/#pricing">Back to pricing</Link>
        </div>
      </section>
    </main>
  );
}
