"use client"

import NumberFlow from "@number-flow/react"
import { motion, useReducedMotion } from "framer-motion"
import { Check, Star } from "lucide-react"
import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import { useMediaQuery } from "@/hooks/use-media-query"
import { cn } from "@/lib/utils"

export interface PricingPlan {
  id: "free" | "pro" | "studio"
  name: string
  price: string
  period: string
  features: string[]
  description: string
  buttonText: string
  href: string
  isPopular: boolean
}

interface PricingProps {
  plans: PricingPlan[]
  authenticated?: boolean
  title?: string
  description?: string
}

export function Pricing({
  plans,
  authenticated = false,
  title = "Simple, transparent pricing",
  description = "Choose the plan that works for you.\nEvery plan includes evidence-backed investigations and safe, bounded exploration.",
}: PricingProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)")
  const prefersReducedMotion = useReducedMotion()

  return (
    <section
      id="pricing"
      aria-labelledby="pricing-heading"
      className="scroll-mt-5 overflow-hidden bg-[radial-gradient(circle_at_12%_0,#126c5b_0,transparent_30%),linear-gradient(145deg,#073d34,#052d27)] px-5 py-16 text-white sm:px-10 sm:py-20"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto mb-10 max-w-3xl space-y-4 text-center">
          <span className="text-xs font-bold tracking-[0.18em] text-[#84dfbd]">
            FLEXIBLE PLANS. CLEAR LIMITS.
          </span>
          <h2 id="pricing-heading" className="text-3xl font-bold tracking-tight sm:text-5xl">
            {title}
          </h2>
          <p className="whitespace-pre-line text-base leading-7 text-[#c5e0d7] sm:text-lg">
            {description}
          </p>
        </div>

        <div className="grid grid-cols-1 items-stretch gap-5 md:grid-cols-3">
          {plans.map((plan, index) => (
            <motion.article
              key={plan.id}
              initial={prefersReducedMotion ? false : { y: 28, opacity: 0 }}
              whileInView={{
                y: isDesktop && plan.isPopular ? -14 : 0,
                opacity: 1,
                scale: isDesktop && !plan.isPopular ? 0.97 : 1,
              }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.55, delay: prefersReducedMotion ? 0 : index * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                "relative flex min-w-0 flex-col rounded-2xl border bg-white p-6 text-left text-[#163d34] shadow-[0_18px_50px_#001b1626] sm:p-7",
                plan.isPopular ? "border-2 border-[#62d3aa] shadow-[0_24px_60px_#001b1640]" : "border-[#d6e8e1]"
              )}
            >
              {plan.isPopular && (
                <div className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full bg-[#087c68] px-2.5 py-1 text-xs font-bold text-white">
                  <Star className="size-3.5 fill-current" aria-hidden="true" />
                  Popular
                </div>
              )}

              <div className="flex flex-1 flex-col">
                <p className="pr-20 text-sm font-bold tracking-[0.14em] text-[#087c68]">{plan.name}</p>
                <p className="mt-3 min-h-12 text-sm leading-6 text-[#627a71]">{plan.description}</p>

                <div className="mt-6 flex items-end gap-2">
                  <span className="text-5xl font-bold tracking-[-0.06em] text-[#0b2e27]">
                    <NumberFlow
                      value={Number(plan.price)}
                      format={{ style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }}
                      transformTiming={{ duration: prefersReducedMotion ? 0 : 500, easing: "ease-out" }}
                      willChange={!prefersReducedMotion}
                      className="tabular-nums"
                    />
                  </span>
                  <span className="pb-1 text-sm font-semibold text-[#6a8179]">/ {plan.period}</span>
                </div>
                <p className="mt-2 text-xs text-[#71867e]">{plan.id === "free" ? "Free forever" : "Billed monthly"}</p>

                <ul className="my-6 flex flex-col gap-3 border-t border-[#dfeae6] pt-6">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm leading-6 text-[#49665c]">
                      <Check className="mt-1 size-4 shrink-0 text-[#087c68]" aria-hidden="true" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {plan.id === "free" || !authenticated ? (
                  <Link
                    href={plan.id === "free" ? plan.href : "/api/auth/google"}
                    target={!authenticated ? "_top" : undefined}
                    className={cn(
                      buttonVariants({ variant: plan.isPopular ? "default" : "outline", size: "lg" }),
                      "mt-auto h-12 w-full rounded-lg text-base font-bold transition-transform hover:-translate-y-0.5",
                      plan.isPopular && "bg-[#087c68] text-white hover:bg-[#076b5a]"
                    )}
                  >
                    {plan.id === "free" || authenticated ? plan.buttonText : `Sign in to choose ${plan.name}`}
                  </Link>
                ) : (
                  <form action="/api/payments/checkout" method="post" className="mt-auto">
                    <input type="hidden" name="plan" value={plan.id} />
                    <button
                      type="submit"
                      className={cn(
                        buttonVariants({ variant: plan.isPopular ? "default" : "outline", size: "lg" }),
                        "h-12 w-full rounded-lg text-base font-bold transition-transform hover:-translate-y-0.5",
                        plan.isPopular && "bg-[#087c68] text-white hover:bg-[#076b5a]"
                      )}
                    >
                      {plan.buttonText}
                    </button>
                  </form>
                )}
              </div>
            </motion.article>
          ))}
        </div>

        <p className="mx-auto mt-7 text-center text-xs leading-5 text-[#a9cfc1]">
          Taxes may apply based on your location. Cancel paid plans anytime.
        </p>
      </div>
    </section>
  )
}
