import { Checkout } from "@dodopayments/nextjs";
import { NextRequest, NextResponse } from "next/server";
import { authConfig, getSession, validMutationOrigin } from "@/lib/auth";
import { dodoCheckoutConfig, isDodoCheckoutUrl, isDodoPlan } from "@/lib/dodo";

export const runtime = "nodejs";

function checkoutFailure(request: NextRequest, status: string, httpStatus = 400) {
  if (request.headers.get("accept")?.includes("application/json")) {
    return NextResponse.json({ error: status }, { status: httpStatus });
  }
  return NextResponse.redirect(`${authConfig().origin}/checkout?status=${encodeURIComponent(status)}`, 303);
}

export async function POST(request: NextRequest) {
  if (!validMutationOrigin(request)) return new NextResponse("Invalid request origin.", { status: 403 });

  const user = await getSession();
  if (!user) {
    if (request.headers.get("accept")?.includes("application/json")) {
      return NextResponse.json({ error: "authentication" }, { status: 401 });
    }
    return NextResponse.redirect(`${authConfig().origin}/api/auth/google`, 303);
  }

  let plan: FormDataEntryValue | null;
  try {
    plan = (await request.formData()).get("plan");
  } catch {
    return checkoutFailure(request, "invalid-plan");
  }
  if (!isDodoPlan(plan)) return checkoutFailure(request, "invalid-plan");

  const config = dodoCheckoutConfig(plan);
  if (!config) return checkoutFailure(request, "configuration", 503);
  const returnUrl = new URL(config.returnUrl);
  // Dodo appends the authoritative status and subscription_id after checkout.
  // Remove stale placeholders to avoid duplicate query parameters.
  returnUrl.searchParams.delete("status");
  returnUrl.searchParams.delete("subscription_id");
  const normalizedReturnUrl = returnUrl.toString();

  const checkoutRequest = new NextRequest(request.url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      product_cart: [{ product_id: config.productId, quantity: 1 }],
      customer: { email: user.email, name: user.name },
      metadata: { audifox_user_id: user.id, audifox_plan: plan },
      return_url: normalizedReturnUrl,
      cancel_url: `${authConfig().origin}/checkout?status=cancelled`,
      customization: { theme: "light", theme_config: { pay_button_text: `Subscribe to ${plan === "pro" ? "Pro" : "Studio"}` } },
      feature_flags: { allow_discount_code: true },
    }),
  });

  try {
    const response = await Checkout({
      bearerToken: config.bearerToken,
      environment: config.environment,
      returnUrl: normalizedReturnUrl,
      type: "session",
    })(checkoutRequest);

    if (!response.ok) return checkoutFailure(request, "error", 502);
    const data = (await response.json()) as { checkout_url?: unknown };
    if (!isDodoCheckoutUrl(data.checkout_url)) return checkoutFailure(request, "error", 502);
    if (request.headers.get("accept")?.includes("application/json")) {
      return NextResponse.json({ checkoutUrl: data.checkout_url }, { headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.redirect(data.checkout_url, 303);
  } catch {
    return checkoutFailure(request, "error", 502);
  }
}
