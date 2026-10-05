"use client"

import { Pricing, type PricingPlan } from "@/components/ui/pricing"

const demoPlans: PricingPlan[] = [
  {
    id: "free",
    name: "FREE",
    price: "0",
    yearlyPrice: "0",
    period: "month",
    features: ["3 investigations each month", "Up to 4 pages per investigation", "Evidence-backed findings", "Downloadable reports"],
    description: "For trying AudiFox on your own site.",
    buttonText: "Start free",
    href: "/dashboard",
    isPopular: false,
  },
  {
    id: "pro",
    name: "PRO",
    price: "9",
    yearlyPrice: "7",
    period: "month",
    features: ["50 investigations each month", "Up to 15 pages per investigation", "Journey and performance workflows", "Verification runs and report exports"],
    description: "For growing sites that need regular checks.",
    buttonText: "Choose Pro",
    href: "/checkout",
    isPopular: true,
  },
  {
    id: "studio",
    name: "STUDIO",
    price: "24",
    yearlyPrice: "19",
    period: "month",
    features: ["200 investigations each month", "Up to 30 pages per investigation", "Five workspace members", "Priority investigation queue"],
    description: "For teams managing multiple websites.",
    buttonText: "Choose Studio",
    href: "/checkout",
    isPopular: false,
  },
]

export function PricingBasic() {
  return <Pricing plans={demoPlans} />
}
