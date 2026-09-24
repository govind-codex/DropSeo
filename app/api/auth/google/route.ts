import { NextResponse } from "next/server";
import { base64url } from "jose";
import { authConfig, cookieOptions, FLOW_COOKIE, signAuthToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  let config: ReturnType<typeof authConfig>;
  try { config = authConfig(); }
  catch { return NextResponse.redirect(new URL("/login?error=configuration", request.url), { headers: { "Cache-Control": "no-store" } }); }
  const state = base64url.encode(crypto.getRandomValues(new Uint8Array(32)));
  const nonce = base64url.encode(crypto.getRandomValues(new Uint8Array(32)));
  const verifier = base64url.encode(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = base64url.encode(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.callbackUrl, response_type: "code", scope: "openid email profile", state, nonce, code_challenge: challenge, code_challenge_method: "S256", prompt: "select_account" }).toString();
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set(FLOW_COOKIE, await signAuthToken({ state, nonce, verifier }, "oauth", 600), cookieOptions(600));
  return response;
}
