import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { authConfig, cookieOptions, FLOW_COOKIE, readAuthToken, SESSION_COOKIE, signAuthToken } from "@/lib/auth";

export const dynamic = "force-dynamic";
// Google's default JWKS timeout in jose is 5 seconds. Some networks take
// longer to complete the TLS handshake, so keep both Google requests within
// an explicit, bounded window rather than rejecting an otherwise valid login.
const GOOGLE_REQUEST_TIMEOUT_MS = 30_000;
const googleKeys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
  { timeoutDuration: GOOGLE_REQUEST_TIMEOUT_MS },
);

export async function GET(request: Request) {
  let config: ReturnType<typeof authConfig>;
  try { config = authConfig(); }
  catch { return NextResponse.redirect(new URL("/login?error=configuration", request.url), { headers: { "Cache-Control": "no-store" } }); }

  function failure(reason: string) {
    const response = NextResponse.redirect(new URL(`/login?error=${reason}`, config.origin));
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.cookies.set(FLOW_COOKIE, "", cookieOptions(0));
    return response;
  }

  const params = new URL(request.url).searchParams;
  const state = params.get("state");
  const token = (await cookies()).get(FLOW_COOKIE)?.value;
  if (!state || !token) return failure("expired");
  let flow: Awaited<ReturnType<typeof readAuthToken>>;
  try {
    flow = await readAuthToken(token, "oauth");
    if (flow.state !== state || typeof flow.verifier !== "string" || typeof flow.nonce !== "string") return failure("expired");
  } catch { return failure("expired"); }
  if (params.get("error")) return failure(params.get("error") === "access_denied" ? "cancelled" : "failed");
  const code = params.get("code");
  if (!code) return failure("failed");

  try {
    const exchange = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: config.callbackUrl, grant_type: "authorization_code", code_verifier: flow.verifier as string }),
      cache: "no-store", signal: AbortSignal.timeout(GOOGLE_REQUEST_TIMEOUT_MS),
    });
    if (!exchange.ok) return failure("failed");
    const tokens = await exchange.json() as { id_token?: string };
    if (!tokens.id_token) return failure("failed");
    const { payload } = await jwtVerify(tokens.id_token, googleKeys, { issuer: ["https://accounts.google.com", "accounts.google.com"], audience: config.clientId, algorithms: ["RS256"], requiredClaims: ["sub", "exp", "iat", "nonce", "email"] });
    if (payload.nonce !== flow.nonce || payload.email_verified !== true || typeof payload.sub !== "string" || typeof payload.email !== "string" || (payload.azp && payload.azp !== config.clientId)) return failure("failed");
    const name = typeof payload.name === "string" && payload.name.trim() ? payload.name : payload.email.split("@")[0];
    const response = NextResponse.redirect(new URL("/dashboard", config.origin));
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.cookies.set(FLOW_COOKIE, "", cookieOptions(0));
    response.cookies.set(SESSION_COOKIE, await signAuthToken({ sub: payload.sub, name, email: payload.email }, "session", 60 * 60 * 24 * 7), cookieOptions(60 * 60 * 24 * 7));
    return response;
  } catch { return failure("failed"); }
}
