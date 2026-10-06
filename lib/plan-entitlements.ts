import { planDocumentStore, type StoredPlanEntitlement } from "@/lib/investigation-runtime";

export type PlanId = "free" | "pro" | "studio";

export const PLAN_LIMITS = {
  free: { name: "Free", investigationsPerMonth: 3, maxPages: 4 },
  pro: { name: "Pro", investigationsPerMonth: 50, maxPages: 15 },
  studio: { name: "Studio", investigationsPerMonth: 200, maxPages: 30 },
} as const satisfies Record<PlanId, { name: string; investigationsPerMonth: number; maxPages: number }>;

export type PlanUsage = {
  plan: PlanId;
  planName: string;
  status: string;
  used: number;
  limit: number;
  remaining: number;
  maxPages: number;
  period: string;
  resetsAt: string;
};

type SubscriptionPayload = {
  type?: string;
  timestamp?: string | Date;
  data?: {
    payload_type?: string;
    subscription_id?: string;
    product_id?: string;
    status?: string;
    next_billing_date?: string;
    past_due_ends_at?: string | null;
    customer?: { email?: string };
    metadata?: Record<string, string | number | boolean>;
  };
};

type DodoSubscriptionData = NonNullable<SubscriptionPayload["data"]>;

const developmentEntitlements = new Map<string, StoredPlanEntitlement>();
const developmentUsage = new Map<string, number>();

function monthPeriod(now = new Date()) {
  return now.toISOString().slice(0, 7);
}

function nextMonth(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
}

function isPaidPlan(value: unknown): value is Exclude<PlanId, "free"> {
  return value === "pro" || value === "studio";
}

function planFromProduct(productId: string | undefined) {
  if (!productId) return null;
  if (productId === process.env.DODO_PRO_PRODUCT_ID) return "pro" as const;
  if (productId === process.env.DODO_STUDIO_PRODUCT_ID) return "studio" as const;
  return null;
}

function entitlementIsActive(entitlement: StoredPlanEntitlement | null, now = new Date()) {
  if (!entitlement) return false;
  if (entitlement.status === "active") return true;
  return entitlement.status === "past_due" && Boolean(entitlement.pastDueEndsAt) && new Date(entitlement.pastDueEndsAt!).getTime() > now.getTime();
}

function requireStore() {
  const store = planDocumentStore();
  if (store) return store;
  if (process.env.NODE_ENV === "production") throw new Error("MONGODB_URI is required to enforce plan usage in production.");
  return null;
}

async function entitlementFor(userId: string) {
  const store = requireStore();
  const entitlements = store ? await store.getEntitlements(userId) : [...developmentEntitlements.values()].filter((item) => item.userId === userId);
  const active = entitlements.filter((item) => entitlementIsActive(item));
  return active.find((item) => item.plan === "studio") || active.find((item) => item.plan === "pro") || entitlements.sort((a, b) => b.eventTimestamp.localeCompare(a.eventTimestamp))[0] || null;
}

export async function getPlanUsage(userId: string): Promise<PlanUsage> {
  const now = new Date();
  const period = monthPeriod(now);
  const entitlement = await entitlementFor(userId);
  const plan: PlanId = entitlementIsActive(entitlement, now) ? entitlement!.plan : "free";
  const limits = PLAN_LIMITS[plan];
  const store = requireStore();
  const used = store ? await store.getUsage(userId, period) : developmentUsage.get(`${userId}:${period}`) || 0;
  return {
    plan,
    planName: limits.name,
    status: entitlement?.status || "free",
    used,
    limit: limits.investigationsPerMonth,
    remaining: Math.max(0, limits.investigationsPerMonth - used),
    maxPages: limits.maxPages,
    period,
    resetsAt: nextMonth(now),
  };
}

export async function reserveInvestigation(userId: string, email: string) {
  const usage = await getPlanUsage(userId);
  const store = requireStore();
  const key = `${userId}:${usage.period}`;
  let used: number | null;
  if (store) used = await store.reserveUsage(userId, email, usage.period, usage.limit);
  else {
    const current = developmentUsage.get(key) || 0;
    used = current >= usage.limit ? null : current + 1;
    if (used !== null) developmentUsage.set(key, used);
  }
  if (used === null) return { allowed: false as const, usage: { ...usage, used: usage.limit, remaining: 0 } };
  return { allowed: true as const, usage: { ...usage, used, remaining: Math.max(0, usage.limit - used) } };
}

export async function releaseInvestigation(userId: string, period: string) {
  const store = requireStore();
  if (store) return await store.releaseUsage(userId, period);
  const key = `${userId}:${period}`;
  developmentUsage.set(key, Math.max(0, (developmentUsage.get(key) || 0) - 1));
}

export async function syncDodoSubscription(value: unknown) {
  const payload = value as SubscriptionPayload;
  if (!payload.type?.startsWith("subscription.") || payload.data?.payload_type !== "Subscription") return;
  const timestamp = payload.timestamp instanceof Date ? payload.timestamp.toISOString() : payload.timestamp || new Date().toISOString();
  await persistDodoSubscription(payload.data, timestamp);
}

async function persistDodoSubscription(data: DodoSubscriptionData, timestamp: string, expectedUser?: { id: string; email: string }) {
  const metadataPlan = data.metadata?.audifox_plan;
  const plan = isPaidPlan(metadataPlan) ? metadataPlan : planFromProduct(data.product_id);
  const metadataUserId = data.metadata?.audifox_user_id;
  const customerEmail = data.customer?.email?.toLowerCase();
  const userId = typeof metadataUserId === "string" && metadataUserId ? metadataUserId : expectedUser && customerEmail === expectedUser.email.toLowerCase() ? expectedUser.id : undefined;
  if (!plan || typeof userId !== "string" || !userId || !data.subscription_id || !data.product_id || !data.status) {
    throw new Error("Dodo subscription webhook is missing the AudiFox user, plan, or subscription fields.");
  }
  if (expectedUser && userId !== expectedUser.id) throw new Error("This subscription does not belong to the signed-in AudiFox account.");
  const record: StoredPlanEntitlement = {
    userId,
    email: data.customer?.email || "",
    plan,
    status: data.status,
    subscriptionId: data.subscription_id,
    productId: data.product_id,
    nextBillingDate: data.next_billing_date,
    pastDueEndsAt: data.past_due_ends_at || undefined,
    eventTimestamp: timestamp,
    updatedAt: new Date().toISOString(),
  };
  const store = requireStore();
  if (store) await store.setEntitlement(record);
  else developmentEntitlements.set(record.subscriptionId, record);
}

export async function reconcileDodoSubscription(user: { id: string; email: string }, subscriptionId: string) {
  if (!/^sub_[A-Za-z0-9_-]+$/.test(subscriptionId)) throw new Error("The checkout returned an invalid subscription ID.");
  const bearerToken = process.env.DODO_PAYMENTS_API_KEY?.trim();
  if (!bearerToken || bearerToken.startsWith("replace_with")) throw new Error("Dodo Payments is not configured.");
  const environment = process.env.DODO_PAYMENTS_ENVIRONMENT === "live_mode" ? "live" : "test";
  const response = await fetch(`https://${environment}.dodopayments.com/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    headers: { Authorization: `Bearer ${bearerToken}`, Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Dodo Payments could not verify this subscription.");
  const data = await response.json() as DodoSubscriptionData;
  await persistDodoSubscription(data, new Date().toISOString(), user);
  return await getPlanUsage(user.id);
}
