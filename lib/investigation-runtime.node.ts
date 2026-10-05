import { MongoClient, type Db } from "mongodb";

type StoredInvestigation = {
  _id: string;
  id: string;
  userId: string;
  createdAt: string;
  [key: string]: unknown;
};

type StoredEvent = {
  investigationId: string;
  sequence: number;
  data: Record<string, unknown>;
};

type StoredPlanUsage = {
  _id: string;
  userId: string;
  email: string;
  period: string;
  count: number;
  createdAt: string;
  updatedAt?: string;
};

export type StoredPlanEntitlement = {
  userId: string;
  email: string;
  plan: "pro" | "studio";
  status: string;
  subscriptionId: string;
  productId: string;
  nextBillingDate?: string;
  pastDueEndsAt?: string;
  eventTimestamp: string;
  updatedAt: string;
};

export type PlanDocumentStore = {
  getEntitlements(userId: string): Promise<StoredPlanEntitlement[]>;
  setEntitlement(record: StoredPlanEntitlement): Promise<void>;
  getUsage(userId: string, period: string): Promise<number>;
  reserveUsage(userId: string, email: string, period: string, limit: number): Promise<number | null>;
  releaseUsage(userId: string, period: string): Promise<void>;
};

export type InvestigationDocumentStore = {
  save(record: unknown): Promise<void>;
  get(userId: string, id: string): Promise<unknown | null>;
  list(userId: string): Promise<unknown[]>;
};

let databasePromise: Promise<Db> | null = null;
let indexesPromise: Promise<void> | null = null;

function mongoStorageError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error("MongoDB investigation storage error:", message);
  if (/SSL|TLS|alert internal|ERR_SSL/i.test(message)) {
    return new Error("Could not establish a secure MongoDB connection. Verify the Atlas SRV connection string and Atlas Network Access settings.");
  }
  if (/auth|authentication|bad auth/i.test(message)) {
    return new Error("MongoDB authentication failed. Verify the database username and password in MONGODB_URI.");
  }
  if (/ENOTFOUND|querySrv|DNS/i.test(message)) {
    return new Error("The MongoDB cluster address could not be resolved. Copy the current Atlas SRV connection string into MONGODB_URI.");
  }
  return new Error("MongoDB investigation storage is temporarily unavailable.");
}

function mongoDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return null;
  if (!databasePromise) {
    const client = new MongoClient(uri, {
      appName: "audifox-vercel",
      maxIdleTimeMS: 5_000,
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 10_000,
    });
    databasePromise = client.connect()
      .then((connected) => connected.db(process.env.MONGODB_DATABASE || "dropseo"))
      .catch(async (error) => {
        databasePromise = null;
        indexesPromise = null;
        await client.close().catch(() => undefined);
        throw error;
      });
  }
  return databasePromise;
}

async function withMongoErrors<T>(operation: () => Promise<T>) {
  try { return await operation(); }
  catch (error) { throw mongoStorageError(error); }
}

async function initializeDatabase(db: Db) {
  if (!indexesPromise) indexesPromise = Promise.all([
    db.collection<StoredInvestigation>("investigations").createIndex({ userId: 1, createdAt: -1 }),
    db.collection<StoredEvent>("investigation_events").createIndex({ investigationId: 1, sequence: 1 }, { unique: true }),
    db.collection("plan_usage").createIndex({ userId: 1, period: 1 }, { unique: true }),
    db.collection("plan_entitlements").createIndex({ userId: 1, eventTimestamp: -1 }),
  ]).then(() => undefined).catch((error) => { indexesPromise = null; throw error; });
  await indexesPromise;
}

export function planDocumentStore(): PlanDocumentStore | null {
  const pendingDatabase = mongoDatabase();
  if (!pendingDatabase) return null;
  return {
    async getEntitlements(userId) { return await withMongoErrors(async () => {
      const db = await pendingDatabase;
      await initializeDatabase(db);
      const records = await db.collection<StoredPlanEntitlement & { _id: string }>("plan_entitlements").find({ userId }).sort({ eventTimestamp: -1 }).toArray();
      return records.map(({ _id, ...entitlement }) => { void _id; return entitlement; });
    }); },
    async setEntitlement(record) { return await withMongoErrors(async () => {
      const db = await pendingDatabase;
      await initializeDatabase(db);
      const collection = db.collection<StoredPlanEntitlement & { _id: string }>("plan_entitlements");
      await collection.updateOne({ _id: record.subscriptionId }, { $setOnInsert: { _id: record.subscriptionId } }, { upsert: true });
      await collection.updateOne(
        { _id: record.subscriptionId, $or: [{ eventTimestamp: { $lte: record.eventTimestamp } }, { eventTimestamp: { $exists: false } }] },
        { $set: record },
      );
    }); },
    async getUsage(userId, period) { return await withMongoErrors(async () => {
      const db = await pendingDatabase;
      await initializeDatabase(db);
      const record = await db.collection<StoredPlanUsage>("plan_usage").findOne({ userId, period });
      return Math.max(0, Number(record?.count || 0));
    }); },
    async reserveUsage(userId, email, period, limit) { return await withMongoErrors(async () => {
      const db = await pendingDatabase;
      await initializeDatabase(db);
      const collection = db.collection<StoredPlanUsage>("plan_usage");
      const _id = `${userId}:${period}`;
      await collection.updateOne(
        { _id },
        { $setOnInsert: { _id, userId, email, period, count: 0, createdAt: new Date().toISOString() } },
        { upsert: true },
      );
      const reserved = await collection.findOneAndUpdate(
        { _id, count: { $lt: limit } },
        { $inc: { count: 1 }, $set: { email, updatedAt: new Date().toISOString() } },
        { returnDocument: "after" },
      );
      return reserved ? Number(reserved.count) : null;
    }); },
    async releaseUsage(userId, period) { return await withMongoErrors(async () => {
      const db = await pendingDatabase;
      await initializeDatabase(db);
      await db.collection<StoredPlanUsage>("plan_usage").updateOne(
        { _id: `${userId}:${period}`, count: { $gt: 0 } },
        { $inc: { count: -1 }, $set: { updatedAt: new Date().toISOString() } },
      );
    }); },
  };
}

export function investigationDatabase(): D1Database | null { return null; }

export function investigationDocumentStore(): InvestigationDocumentStore | null {
  const pendingDatabase = mongoDatabase();
  if (!pendingDatabase) return null;
  return {
    async save(value) { return await withMongoErrors(async () => {
      const record = value as Record<string, unknown> & { id: string; userId: string; createdAt: string; events: Record<string, unknown>[] };
      const db = await pendingDatabase;
      await initializeDatabase(db);
      const { events, ...metadata } = record;
      await db.collection<StoredInvestigation>("investigations").updateOne(
        { _id: record.id, userId: record.userId },
        { $set: metadata },
        { upsert: true },
      );
      if (events.length) await db.collection<StoredEvent>("investigation_events").bulkWrite(events.map((data, sequence) => ({
        updateOne: {
          filter: { investigationId: record.id, sequence },
          update: { $setOnInsert: { investigationId: record.id, sequence, data } },
          upsert: true,
        },
      })), { ordered: false });
    }); },
    async get(userId, id) { return await withMongoErrors(async () => {
      const db = await pendingDatabase;
      await initializeDatabase(db);
      const record = await db.collection<StoredInvestigation>("investigations").findOne({ _id: id, userId });
      if (!record) return null;
      const events = await db.collection<StoredEvent>("investigation_events").find({ investigationId: id }).sort({ sequence: 1 }).toArray();
      const { _id, ...metadata } = record;
      void _id;
      return { ...metadata, events: events.map((event) => event.data) };
    }); },
    async list(userId) { return await withMongoErrors(async () => {
      const db = await pendingDatabase;
      await initializeDatabase(db);
      const records = await db.collection<StoredInvestigation>("investigations").find({ userId }).sort({ createdAt: -1 }).toArray();
      return records.map(({ _id, ...record }) => { void _id; return { ...record, events: [] }; });
    }); },
  };
}
