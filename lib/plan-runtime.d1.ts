import type { PlanDocumentStore, StoredPlanEntitlement } from "./investigation-runtime";

export function d1PlanStore(db: D1Database): PlanDocumentStore {
  return {
    async getEntitlements(userId) {
      const { results } = await db.prepare("SELECT data FROM plan_entitlements WHERE user_id=? ORDER BY event_timestamp DESC").bind(userId).all<{ data: string }>();
      return results.map((row) => JSON.parse(row.data) as StoredPlanEntitlement);
    },
    async setEntitlement(record) {
      await db.prepare("INSERT INTO plan_entitlements (subscription_id,user_id,event_timestamp,data) VALUES (?,?,?,?) ON CONFLICT(subscription_id) DO UPDATE SET event_timestamp=excluded.event_timestamp,data=excluded.data WHERE plan_entitlements.user_id=excluded.user_id AND plan_entitlements.event_timestamp<=excluded.event_timestamp")
        .bind(record.subscriptionId, record.userId, record.eventTimestamp, JSON.stringify(record)).run();
    },
    async getUsage(userId, period) {
      const row = await db.prepare("SELECT count FROM plan_usage WHERE user_id=? AND period=?").bind(userId, period).first<{ count: number }>();
      return row?.count || 0;
    },
    async reserveUsage(userId, email, period, limit) {
      await db.prepare("INSERT INTO plan_usage (user_id,period,email,count) VALUES (?,?,?,0) ON CONFLICT(user_id,period) DO NOTHING").bind(userId, period, email).run();
      const row = await db.prepare("UPDATE plan_usage SET count=count+1,email=? WHERE user_id=? AND period=? AND count<? RETURNING count").bind(email, userId, period, limit).first<{ count: number }>();
      return row?.count ?? null;
    },
    async releaseUsage(userId, period) {
      await db.prepare("UPDATE plan_usage SET count=count-1 WHERE user_id=? AND period=? AND count>0").bind(userId, period).run();
    },
    async getLastSync(userId) {
      const row = await db.prepare("SELECT synced_at FROM plan_sync WHERE user_id=?").bind(userId).first<{ synced_at: string }>();
      return row?.synced_at || null;
    },
    async setLastSync(userId, email) {
      await db.prepare("INSERT INTO plan_sync (user_id,email,synced_at) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET email=excluded.email,synced_at=excluded.synced_at").bind(userId, email, new Date().toISOString()).run();
    },
  };
}
