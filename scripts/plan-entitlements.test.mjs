import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { transpileModule, ModuleKind, ScriptTarget } from "typescript";

const dataUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
let source = readFileSync(new URL("../lib/plan-entitlements.ts", import.meta.url), "utf8");
const runtimeUrl = dataUrl("export function planDocumentStore() { return globalThis.__planStore; }");
source = source.replaceAll('"@/lib/investigation-runtime"', JSON.stringify(runtimeUrl));
const moduleUrl = dataUrl(transpileModule(source, { compilerOptions: { module: ModuleKind.ESNext, target: ScriptTarget.ES2022 } }).outputText);
const plans = await import(moduleUrl);

test("plan access selects the highest active subscription and reports monthly usage", async () => {
  globalThis.__planStore = {
    async getEntitlements() {
      return [
        { userId: "user", plan: "pro", status: "cancelled", eventTimestamp: "2026-10-05T00:00:00.000Z" },
        { userId: "user", plan: "studio", status: "active", eventTimestamp: "2026-10-04T00:00:00.000Z" },
      ];
    },
    async getUsage() { return 12; },
  };
  const usage = await plans.getPlanUsage("user");
  assert.equal(usage.plan, "studio");
  assert.equal(usage.limit, 200);
  assert.equal(usage.maxPages, 30);
  assert.equal(usage.remaining, 188);
});

test("an expired or inactive subscription falls back to Free", async () => {
  globalThis.__planStore = {
    async getEntitlements() { return [{ userId: "user", plan: "pro", status: "on_hold", eventTimestamp: "2026-10-05T00:00:00.000Z" }]; },
    async getUsage() { return 3; },
  };
  const usage = await plans.getPlanUsage("user");
  assert.equal(usage.plan, "free");
  assert.equal(usage.remaining, 0);
});

test("verified Dodo subscription payloads persist the checkout user and plan", async () => {
  let saved;
  globalThis.__planStore = {
    async setEntitlement(record) { saved = record; },
  };
  await plans.syncDodoSubscription({
    type: "subscription.active",
    timestamp: new Date("2026-10-06T10:00:00.000Z"),
    data: {
      payload_type: "Subscription",
      subscription_id: "sub_123",
      product_id: "pdt_123",
      status: "active",
      customer: { email: "buyer@example.com" },
      metadata: { audifox_user_id: "user_123", audifox_plan: "pro" },
    },
  });
  assert.equal(saved.userId, "user_123");
  assert.equal(saved.plan, "pro");
  assert.equal(saved.status, "active");
});

test("checkout return reconciliation activates a verified test subscription", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.DODO_PAYMENTS_API_KEY;
  const originalEnvironment = process.env.DODO_PAYMENTS_ENVIRONMENT;
  let saved;
  process.env.DODO_PAYMENTS_API_KEY = "test_key";
  process.env.DODO_PAYMENTS_ENVIRONMENT = "test_mode";
  globalThis.fetch = async (url) => {
    assert.match(String(url), /^https:\/\/test\.dodopayments\.com\/subscriptions\/sub_/);
    return Response.json({
      subscription_id: "sub_checkout",
      product_id: "pdt_pro",
      status: "active",
      customer: { email: "buyer@example.com" },
      metadata: { audifox_user_id: "user_123", audifox_plan: "pro" },
    });
  };
  globalThis.__planStore = {
    async setEntitlement(record) { saved = record; },
    async getEntitlements() { return saved ? [saved] : []; },
    async getUsage() { return 0; },
  };
  try {
    const usage = await plans.reconcileDodoSubscription({ id: "user_123", email: "buyer@example.com" }, "sub_checkout");
    assert.equal(usage.plan, "pro");
    assert.equal(usage.limit, 50);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.DODO_PAYMENTS_API_KEY; else process.env.DODO_PAYMENTS_API_KEY = originalKey;
    if (originalEnvironment === undefined) delete process.env.DODO_PAYMENTS_ENVIRONMENT; else process.env.DODO_PAYMENTS_ENVIRONMENT = originalEnvironment;
  }
});

test("relogin imports existing active purchases by verified customer email", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.DODO_PAYMENTS_API_KEY;
  const originalEnvironment = process.env.DODO_PAYMENTS_ENVIRONMENT;
  const saved = [];
  process.env.DODO_PAYMENTS_API_KEY = "test_key";
  process.env.DODO_PAYMENTS_ENVIRONMENT = "test_mode";
  globalThis.fetch = async (url) => {
    const value = String(url);
    if (value.includes("/customers?")) return Response.json({ items: [{ customer_id: "cus_123", email: "buyer@example.com" }] });
    if (value.includes("/subscriptions?")) return Response.json({ items: [
      { subscription_id: "sub_pro", product_id: "pdt_pro", status: "active", customer: { email: "buyer@example.com" }, metadata: { audifox_plan: "pro" } },
      { subscription_id: "sub_studio", product_id: "pdt_studio", status: "active", customer: { email: "buyer@example.com" }, metadata: { audifox_plan: "studio" } },
    ] });
    throw new Error(`Unexpected Dodo URL: ${value}`);
  };
  globalThis.__planStore = {
    async getEntitlements() { return saved; },
    async setEntitlement(record) { saved.push(record); },
    async getUsage() { return 0; },
    async getLastSync() { return null; },
    async setLastSync() {},
  };
  try {
    const usage = await plans.getPlanUsageForUser({ id: "user_123", email: "buyer@example.com" });
    assert.equal(usage.plan, "studio");
    assert.equal(usage.limit, 200);
    assert.equal(saved.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.DODO_PAYMENTS_API_KEY; else process.env.DODO_PAYMENTS_API_KEY = originalKey;
    if (originalEnvironment === undefined) delete process.env.DODO_PAYMENTS_ENVIRONMENT; else process.env.DODO_PAYMENTS_ENVIRONMENT = originalEnvironment;
  }
});

test.after(() => { delete globalThis.__planStore; });
