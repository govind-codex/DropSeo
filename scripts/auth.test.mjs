import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { transpileModule, ModuleKind, ScriptTarget } from "typescript";
import { exportJWK, generateKeyPair, SignJWT } from "jose";

// Load the real TS helpers/routes in memory with only request-context cookies
// replaced. No secrets, servers, or source files are written by these tests.
const cookieValues = new Map();
globalThis.__dropseoTestCookies = cookieValues;
const joseUrl = import.meta.resolve("jose");
const nextServerUrl = import.meta.resolve("next/server.js");
async function load(relativePath, authUrl) {
  let source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
  source = source.replace(/import \{ cookies \} from "next\/headers";/g, "const cookies = async () => ({ get: name => { const value = globalThis.__dropseoTestCookies.get(name); return value ? { value } : undefined; } });");
  source = source.replace(/from "jose"/g, `from ${JSON.stringify(joseUrl)}`).replace(/from "next\/server"/g, `from ${JSON.stringify(nextServerUrl)}`);
  if (authUrl) source = source.replace(/from "@\/lib\/auth"/g, `from ${JSON.stringify(authUrl)}`);
  const js = transpileModule(source, { compilerOptions: { module: ModuleKind.ESNext, target: ScriptTarget.ES2022 } }).outputText;
  const url = `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`;
  return { url, module: await import(url) };
}

test("Google authentication safeguards and complete callback", async (t) => {
  const envKeys = ["NODE_ENV", "AUTH_URL", "AUTH_SECRET", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "VERCEL_PROJECT_PRODUCTION_URL"];
  const savedEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  Object.assign(process.env, { NODE_ENV: "test", AUTH_URL: "http://localhost:3000", AUTH_SECRET: "a-test-only-secret-at-least-32-characters-long", GOOGLE_CLIENT_ID: "test-client.apps.googleusercontent.com", GOOGLE_CLIENT_SECRET: "test-client-secret" });
  const { module: auth, url: authUrl } = await load("../lib/auth.ts");
  const { module: start } = await load("../app/api/auth/google/route.ts", authUrl);
  const { module: callback } = await load("../app/api/auth/google/callback/route.ts", authUrl);
  const { module: logout } = await load("../app/api/auth/logout/route.ts", authUrl);
  try {
    await t.test("missing configuration fails closed", () => {
      delete process.env.AUTH_SECRET;
      assert.throws(() => auth.authConfig());
      process.env.AUTH_SECRET = "a-test-only-secret-at-least-32-characters-long";
    });
    await t.test("production rejects an insecure origin", () => {
      process.env.NODE_ENV = "production";
      assert.throws(() => auth.authConfig());
      process.env.NODE_ENV = "test";
    });
    await t.test("production uses Vercel's canonical project URL when AUTH_URL is absent", () => {
      process.env.NODE_ENV = "production";
      delete process.env.AUTH_URL;
      process.env.VERCEL_PROJECT_PRODUCTION_URL = "dropseo.example.com";
      const config = auth.authConfig();
      assert.equal(config.origin, "https://dropseo.example.com");
      assert.equal(config.callbackUrl, "https://dropseo.example.com/api/auth/google/callback");
      delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
      process.env.AUTH_URL = "http://localhost:3000";
      process.env.NODE_ENV = "test";
    });
    await t.test("production still fails closed without a trusted origin", () => {
      process.env.NODE_ENV = "production";
      delete process.env.AUTH_URL;
      delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
      assert.throws(() => auth.authConfig(), /AUTH_URL is required/);
      process.env.AUTH_URL = "http://localhost:3000";
      process.env.NODE_ENV = "test";
    });
    await t.test("session signature, expiration, and audience are enforced", async () => {
      const session = await auth.signAuthToken({ sub: "google-user-123", name: "Test User", email: "test@example.com" }, "session", 300);
      cookieValues.set(auth.SESSION_COOKIE, session);
      assert.equal((await auth.getSession()).id, "google-user-123");
      await assert.rejects(() => auth.readAuthToken(session, "oauth"));
      const parts = session.split(".");
      parts[1] = Buffer.from(JSON.stringify({ sub: "attacker", name: "Attacker", email: "attacker@example.com" })).toString("base64url");
      cookieValues.set(auth.SESSION_COOKIE, parts.join("."));
      assert.equal(await auth.getSession(), null);
      cookieValues.set(auth.SESSION_COOKIE, await auth.signAuthToken({ sub: "expired", name: "Expired", email: "test@example.com" }, "session", -10));
      assert.equal(await auth.getSession(), null);
      cookieValues.clear();
    });
    await t.test("authorization starts with identity-only scopes, PKCE, and HttpOnly state", async () => {
      const response = await start.GET(new Request("http://localhost:3000/api/auth/google"));
      const location = new URL(response.headers.get("location"));
      assert.equal(location.origin, "https://accounts.google.com");
      assert.equal(location.searchParams.get("scope"), "openid email profile");
      assert.equal(location.searchParams.get("code_challenge_method"), "S256");
      assert.equal(location.searchParams.get("redirect_uri"), "http://localhost:3000/api/auth/google/callback");
      assert.match(response.headers.get("set-cookie"), /HttpOnly/i);
      assert.match(response.headers.get("set-cookie"), /SameSite=lax/i);
      cookieValues.set(auth.FLOW_COOKIE, response.cookies.get(auth.FLOW_COOKIE).value);
      const flow = await auth.readAuthToken(cookieValues.get(auth.FLOW_COOKIE), "oauth");
      assert.equal(flow.state, location.searchParams.get("state"));
      const digest = Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(flow.verifier))).toString("base64url");
      assert.equal(digest, location.searchParams.get("code_challenge"));
    });
    await t.test("callback rejects missing and mismatched state", async () => {
      for (const suffix of ["?code=example", "?code=example&state=wrong"]) {
        const response = await callback.GET(new Request(`http://localhost:3000/api/auth/google/callback${suffix}`));
        assert.match(response.headers.get("location"), /error=expired$/);
        assert.equal(response.cookies.get(auth.SESSION_COOKIE), undefined);
      }
    });
    const flow = await auth.readAuthToken(cookieValues.get(auth.FLOW_COOKIE), "oauth");
    await t.test("Google cancellation returns a retry state", async () => {
      const response = await callback.GET(new Request(`http://localhost:3000/api/auth/google/callback?error=access_denied&state=${flow.state}`));
      assert.match(response.headers.get("location"), /error=cancelled$/);
    });
    const { privateKey, publicKey } = await generateKeyPair("RS256");
    const jwk = await exportJWK(publicKey);
    let nonce = flow.nonce;
    let verifiedEmail = true;
    globalThis.fetch = async (url, options) => {
      if (String(url).includes("oauth2.googleapis.com/token")) {
        assert.equal(options.body.get("code_verifier"), flow.verifier);
        const id_token = await new SignJWT({ nonce, email: "test@example.com", email_verified: verifiedEmail, name: "Test User" }).setProtectedHeader({ alg: "RS256", kid: "test-key" }).setIssuer("https://accounts.google.com").setAudience(process.env.GOOGLE_CLIENT_ID).setSubject("google-user-123").setIssuedAt().setExpirationTime("5m").sign(privateKey);
        return Response.json({ id_token });
      }
      if (String(url).includes("googleapis.com/oauth2/v3/certs")) return Response.json({ keys: [{ ...jwk, kid: "test-key", alg: "RS256", use: "sig" }] });
      throw new Error("Unexpected external request in test");
    };
    const callbackRequest = () => new Request(`http://localhost:3000/api/auth/google/callback?code=test-code&state=${flow.state}`);
    await t.test("verified Google identity renders the workspace via a signed session", async () => {
      const response = await callback.GET(callbackRequest());
      assert.equal(response.headers.get("location"), "http://localhost:3000/dashboard");
      const session = response.cookies.get(auth.SESSION_COOKIE);
      assert.ok(session);
      cookieValues.set(auth.SESSION_COOKIE, session.value);
      assert.deepEqual(await auth.getSession(), { id: "google-user-123", name: "Test User", email: "test@example.com" });
      assert.equal(response.cookies.get(auth.FLOW_COOKIE).value, "");
    });
    await t.test("callback rejects a different nonce and unverified email", async () => {
      nonce = "wrong-nonce";
      assert.match((await callback.GET(callbackRequest())).headers.get("location"), /error=failed$/);
      nonce = flow.nonce;
      verifiedEmail = false;
      assert.match((await callback.GET(callbackRequest())).headers.get("location"), /error=failed$/);
    });
    await t.test("sign-out rejects cross-origin POST and clears cookies on same-origin POST", async () => {
      const bad = await logout.POST(new Request("http://localhost:3000/api/auth/logout", { method: "POST", headers: { origin: "https://attacker.example" } }));
      assert.equal(bad.status, 403);
      const good = await logout.POST(new Request("http://localhost:3000/api/auth/logout", { method: "POST", headers: { origin: "http://localhost:3000" } }));
      assert.equal(good.status, 303);
      assert.equal(good.headers.get("location"), "http://localhost:3000/");
      assert.equal(good.cookies.get(auth.SESSION_COOKIE).value, "");
    });
  } finally {
    for (const key of envKeys) { if (savedEnv[key] === undefined) delete process.env[key]; else process.env[key] = savedEnv[key]; }
    globalThis.fetch = originalFetch;
    delete globalThis.__dropseoTestCookies;
  }
});
