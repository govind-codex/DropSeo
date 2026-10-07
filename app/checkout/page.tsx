import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CheckCircle2, CircleX, CreditCard, RefreshCw, Settings2, ShieldCheck } from "lucide-react";
import { getSession } from "@/lib/auth";
import { reconcileDodoSubscription } from "@/lib/plan-entitlements";

export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Payment status | AudiFox",
  description: "Review the status of your AudiFox checkout.",
};

type CheckoutPageProps = { searchParams: Promise<{ status?: string; subscription_id?: string }> };

const messages = {
  pending: {
    icon: CreditCard,
    tone: "pending",
    eyebrow: "PAYMENT PROCESSING",
    title: "We're confirming your plan.",
    detail: "Checkout finished, but your subscription has not been verified yet. This usually updates shortly.",
  },
  active: {
    icon: CheckCircle2,
    tone: "success",
    eyebrow: "PLAN ACTIVATED",
    title: "Your AudiFox plan is ready.",
    detail: "Your subscription was verified and your new investigation limits are now available.",
  },
  cancelled: {
    icon: CircleX,
    tone: "neutral",
    eyebrow: "CHECKOUT CANCELLED",
    title: "Checkout was cancelled.",
    detail: "Your current plan has not changed. You can return to pricing whenever you are ready.",
  },
  configuration: {
    icon: Settings2,
    tone: "error",
    eyebrow: "SETUP REQUIRED",
    title: "Checkout is unavailable.",
    detail: "Payments are not connected yet. Please try again later.",
  },
  "invalid-plan": {
    icon: CircleX,
    tone: "error",
    eyebrow: "PLAN NOT FOUND",
    title: "That plan is not available.",
    detail: "Return to pricing and choose one of the available AudiFox plans.",
  },
  error: {
    icon: CreditCard,
    tone: "error",
    eyebrow: "CHECKOUT UNAVAILABLE",
    title: "We could not open checkout.",
    detail: "Please try again in a moment. No payment has been made.",
  },
  overview: {
    icon: CreditCard,
    tone: "neutral",
    eyebrow: "BILLING & PLANS",
    title: "Choose the right plan for your work.",
    detail: "Review available plans and start a secure checkout when you're ready.",
  },
} as const;

export default async function CheckoutPage({ searchParams }: CheckoutPageProps) {
  const { status, subscription_id: subscriptionId } = await searchParams;
  let resolvedStatus = status === "success" || status === "succeeded" || status === "active" ? "pending" : status ?? "overview";
  if ((status === "active" || status === "succeeded" || status === "success") && subscriptionId) {
    const user = await getSession();
    if (user) {
      try {
        const usage = await reconcileDodoSubscription(user, subscriptionId);
        if (usage.subscriptionStatus === "active") resolvedStatus = "active";
      } catch { /* Webhook confirmation may still be in progress. */ }
    }
  }
  const message = messages[resolvedStatus as keyof typeof messages] ?? messages.error;
  const Icon = message.icon;
  const pending = resolvedStatus === "pending";
  const active = resolvedStatus === "active";
  const primaryHref = active || (pending && !subscriptionId) ? "/dashboard" : pending ? `/checkout?status=success&subscription_id=${encodeURIComponent(subscriptionId!)}` : "/#pricing";
  const primaryLabel = active || (pending && !subscriptionId) ? "Open workspace" : pending ? "Check status again" : "View plans";

  return (
    <main className="payment-page">
      <section className="payment-card" data-tone={message.tone} aria-labelledby="payment-title">
        <div className="payment-card-top">
          <Link className="brand" href="/" aria-label="AudiFox home"><span className="brand-mark" aria-hidden="true"><Image src="/audifox-logo.png" alt="" width={40} height={40} /></span>AudiFox<span>.</span></Link>
          <span className="payment-secure"><ShieldCheck size={14} aria-hidden="true" /> Secure checkout</span>
        </div>
        <span className="payment-icon" aria-hidden="true"><Icon /></span>
        <span className="payment-eyebrow" role="status">{message.eyebrow}</span>
        <h1 id="payment-title">{message.title}</h1>
        <p>{message.detail}</p>
        {pending && <div className="payment-notice"><span className="payment-notice-pulse" aria-hidden="true" /><div><strong>Confirmation in progress</strong><span>You can check again here. Your plan will also update when the payment provider confirms it.</span></div></div>}
        {active && <div className="payment-notice"><CheckCircle2 size={18} aria-hidden="true" /><div><strong>Ready to investigate</strong><span>Your upgraded limits are available in the workspace.</span></div></div>}
        <div className="payment-actions">
          {pending && subscriptionId
            ? <a className="google-button" href={primaryHref}><RefreshCw size={17} aria-hidden="true" />{primaryLabel}</a>
            : <Link className="google-button" href={primaryHref}>{primaryLabel}<ArrowRight size={18} aria-hidden="true" /></Link>}
          <Link className="back-link" href={active || pending ? "/dashboard" : "/"}>{active || pending ? "Go to workspace" : "Back to home"}</Link>
        </div>
        <p className="payment-help">Payments are handled securely by Dodo Payments. AudiFox never sees your card details.</p>
      </section>
    </main>
  );
}
