import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

export type AuthUser = { id: string; name: string; email: string };
export const SESSION_COOKIE = "dropseo-session";
export const FLOW_COOKIE = "dropseo-oauth";
const ISSUER = "dropseo";

export function authConfig() {
  const origin = process.env.AUTH_URL || (process.env.NODE_ENV !== "production" ? "http://localhost:3000" : "");
  if (!origin) throw new Error("AUTH_URL is required in production.");
  const url = new URL(origin);
  if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) throw new Error("AUTH_URL must use HTTPS.");
  if (url.pathname !== "/" || url.search || url.hash || url.username || url.password) throw new Error("AUTH_URL must be an origin without a path.");
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32 || secret.startsWith("replace_with")) throw new Error("AUTH_SECRET must contain at least 32 random characters.");
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret || clientId.startsWith("replace_with") || clientSecret.startsWith("replace_with")) throw new Error("Google OAuth credentials are missing.");
  return { origin: url.origin, secure: url.protocol === "https:", secret: new TextEncoder().encode(secret), clientId, clientSecret, callbackUrl: `${url.origin}/api/auth/google/callback` };
}

export function cookieOptions(maxAge: number) {
  return { httpOnly: true, secure: authConfig().secure, sameSite: "lax" as const, path: "/", maxAge };
}

export async function signAuthToken(payload: Record<string, unknown>, audience: "session" | "oauth", seconds: number) {
  return new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setIssuer(ISSUER).setAudience(audience).setIssuedAt().setExpirationTime(Math.floor(Date.now() / 1000) + seconds).sign(authConfig().secret);
}

export async function readAuthToken(token: string, audience: "session" | "oauth") {
  const { payload } = await jwtVerify(token, authConfig().secret, { issuer: ISSUER, audience, algorithms: ["HS256"], requiredClaims: ["exp", "iat"] });
  return payload;
}

export async function getSession(): Promise<AuthUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const payload = await readAuthToken(token, "session");
    if (typeof payload.sub !== "string" || typeof payload.name !== "string" || typeof payload.email !== "string") return null;
    return { id: payload.sub, name: payload.name, email: payload.email };
  } catch { return null; }
}

export function validMutationOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  // JSON endpoints cannot be submitted by cross-origin HTML forms. Browsers
  // provide Origin; non-browser clients still need a valid signed session.
  if (!origin) return true;
  try { return origin === authConfig().origin; } catch { return false; }
}
