import { Loader2, ShieldCheck } from "lucide-react";

export default function CheckoutLoading() {
  return (
    <main className="payment-page">
      <section className="payment-card payment-card-loading" role="status" aria-live="polite">
        <span className="payment-secure"><ShieldCheck size={14} aria-hidden="true" /> Secure checkout</span>
        <span className="payment-icon"><Loader2 className="spin" aria-hidden="true" /></span>
        <span className="payment-eyebrow">CHECKING PAYMENT</span>
        <h1>Confirming your checkout…</h1>
        <p>We&apos;re checking your payment status and updating your plan.</p>
        <div className="payment-loading-track"><span /></div>
      </section>
    </main>
  );
}
