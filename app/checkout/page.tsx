import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CheckCircle2, CircleX, CreditCard, Settings2 } from "lucide-react";
import { getSession } from "@/lib/auth";
import { reconcileDodoSubscription } from "@/lib/plan-entitlements";

export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Payment status | AudiFox",
  description: "Review the status of your AudiFox checkout.",
};

type CheckoutPageProps = { searchParams: Promise<{ status?: string; subscription_id?: string }> };

const messages = {
  success: {
    icon: CheckCircle2,
    eyebrow: "CHECKOUT FINISHED",
    title: "Thanks for choosing AudiFox.",
    detail: "Dodo Payments is confirming the result of your checkout. You can return to your workspace now.",
  },
  active: {
    icon: CheckCircle2,
    eyebrow: "PLAN ACTIVATED",
    title: "Your AudiFox plan is ready.",
    detail: "Your subscription was verified and your new investigation limits are now available.",
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
  const { status, subscription_id: subscriptionId } = await searchParams;
  let resolvedStatus = status;
  let reconciliationError = "";
  if ((status === "active" || status === "succeeded" || status === "success") && subscriptionId) {
    const user = await getSession();
    if (user) {
      try {
        await reconcileDodoSubscription(user, subscriptionId);
        resolvedStatus = "active";
      } catch (error) {
        reconciliationError = error instanceof Error ? error.message : "Your subscription is still being confirmed.";
      }
    }
  }
  const message = messages[resolvedStatus as keyof typeof messages] ?? (status === "succeeded" ? messages.success : messages.error);
  const Icon = message.icon;

  return (
    <main className="payment-page">
      <section className="payment-card" aria-labelledby="payment-title">
        <Link className="brand" href="/" aria-label="AudiFox home"><span className="brand-mark" aria-hidden="true"><Image src="/audifox-logo.png" alt="" width={40} height={40} /></span>AudiFox<span>.</span></Link>
        <span className="payment-icon" aria-hidden="true"><Icon /></span>
        <span className="payment-eyebrow">{message.eyebrow}</span>
        <h1 id="payment-title">{message.title}</h1>
        <p>{reconciliationError || message.detail}</p>
        <div className="payment-actions">
          <Link className="google-button" href="/dashboard">Open workspace <ArrowRight size={18} /></Link>
          <Link className="back-link" href="/#pricing">Back to pricing</Link>
        </div>
      </section>
    </main>
  );
}
