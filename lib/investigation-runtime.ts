import { env } from "cloudflare:workers";
export type InvestigationDocumentStore = {
  save(record: unknown): Promise<void>;
  get(userId: string, id: string): Promise<unknown | null>;
  list(userId: string): Promise<unknown[]>;
};
export type StoredPlanEntitlement = {
  userId: string; email: string; plan: "pro" | "studio"; status: string; subscriptionId: string; productId: string;
  nextBillingDate?: string; pastDueEndsAt?: string; eventTimestamp: string; updatedAt: string;
};
export type PlanDocumentStore = {
  getEntitlements(userId: string): Promise<StoredPlanEntitlement[]>;
  setEntitlement(record: StoredPlanEntitlement): Promise<void>;
  getUsage(userId: string, period: string): Promise<number>;
  reserveUsage(userId: string, email: string, period: string, limit: number): Promise<number | null>;
  releaseUsage(userId: string, period: string): Promise<void>;
};
export function investigationDatabase(): D1Database | null { return env.DB || null; }
export function investigationDocumentStore(): InvestigationDocumentStore | null { return null; }
export function planDocumentStore(): PlanDocumentStore | null { return null; }
