"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Loader2, ShieldCheck } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CheckoutFormProps = {
  plan: "pro" | "studio";
  label: string;
  featured?: boolean;
};

const errorMessages: Record<string, string> = {
  configuration: "Checkout is unavailable right now. Please try again later.",
  "invalid-plan": "This plan is no longer available. Please choose another plan.",
  error: "We couldn't open secure checkout. Please try again.",
};

function isSecureCheckoutUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "dodopayments.com" || url.hostname.endsWith(".dodopayments.com"));
  } catch {
    return false;
  }
}

export function CheckoutForm({ plan, label, featured = false }: CheckoutFormProps) {
  const [phase, setPhase] = useState<"idle" | "creating" | "redirecting">("idle");
  const [error, setError] = useState("");
  const busyRef = useRef(false);

  useEffect(() => {
    const reset = () => {
      busyRef.current = false;
      setPhase("idle");
    };
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  async function openCheckout(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current) return;
    busyRef.current = true;
    setError("");
    setPhase("creating");

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch("/api/payments/checkout", {
        method: "POST",
        body: new FormData(event.currentTarget),
        headers: { Accept: "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({ error: "error" })) as { checkoutUrl?: unknown; error?: string };
      if (response.status === 401) {
        window.location.assign("/api/auth/google");
        return;
      }
      if (!response.ok) throw new Error(errorMessages[data.error ?? ""] ?? errorMessages.error);
      if (!isSecureCheckoutUrl(data.checkoutUrl)) throw new Error(errorMessages.error);

      setPhase("redirecting");
      window.location.assign(data.checkoutUrl);
    } catch (caught) {
      const reason = caught instanceof Error ? caught.message : "";
      setError(caught instanceof Error && caught.name === "AbortError"
        ? "Checkout is taking too long. Please try again."
        : Object.values(errorMessages).includes(reason) ? reason : "We couldn't connect to checkout. Please try again.");
      setPhase("idle");
      busyRef.current = false;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  const busy = phase !== "idle";
  return (
    <form action="/api/payments/checkout" method="post" className="mt-auto" onSubmit={openCheckout}>
      <input type="hidden" name="plan" value={plan} />
      <button
        type="submit"
        disabled={busy}
        aria-describedby={error ? `checkout-error-${plan}` : undefined}
        className={cn(
          buttonVariants({ variant: featured ? "default" : "outline", size: "lg" }),
          "h-12 w-full rounded-lg text-base font-bold transition-transform hover:-translate-y-0.5",
          featured && "bg-[#087c68] text-white hover:bg-[#076b5a]",
        )}
      >
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        {phase === "creating" ? "Preparing checkout…" : phase === "redirecting" ? "Redirecting securely…" : label}
      </button>
      {busy && (
        <div className="checkout-progress" role="status" aria-live="polite">
          <ShieldCheck size={15} aria-hidden="true" />
          <span>{phase === "creating" ? "Creating your secure checkout session" : "Opening Dodo Payments"}</span>
          <ArrowUpRight size={14} aria-hidden="true" />
        </div>
      )}
      {error && <p className="checkout-form-error" id={`checkout-error-${plan}`} role="alert">{error}</p>}
    </form>
  );
}
