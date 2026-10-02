import { investigationDatabase } from "@/lib/investigation-runtime";
export type Investigation = {
  id: string; userId: string; url: string; workflow: string; goal: string;
  status: "running" | "completed" | "error"; createdAt: string; updatedAt: string;
  referenceId?: string; findingCount?: number; events: Record<string, unknown>[]; result?: Record<string, unknown>; error?: string;
};

// Hosted Sites use their native D1 binding. Next deployments can use the same
// durable database through the Cloudflare API; disk storage is development-only.
async function sql(query: string, params: string[]) {
  const db = investigationDatabase();
  if (db) return (await db.prepare(query).bind(...params).all()).results as Array<{ data: string }>;
  const { CLOUDFLARE_ACCOUNT_ID: account, INVESTIGATIONS_D1_ID: id, INVESTIGATIONS_D1_TOKEN: token } = process.env;
  if (account && id && token) {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/d1/database/${id}/query`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ sql: query, params }), cache: "no-store",
    });
    const body = await response.json() as { success: boolean; result: Array<{ results: Array<{ data: string }> }> };
    if (!response.ok || !body.success) throw new Error("Investigation storage is unavailable.");
    return body.result[0].results;
  }
  if (process.env.NODE_ENV === "production") throw new Error("Persistent investigation storage is not configured.");
  return null;
}
async function localDirectory() {
  const { mkdir } = await import("node:fs/promises");
  const { resolve } = await import("node:path");
  const directory = resolve(/* turbopackIgnore: true */ process.env.INVESTIGATIONS_DEV_DIR || ".data/investigations");
  await mkdir(directory, { recursive: true });
  return directory;
}
const savedEventCounts = new WeakMap<Investigation, number>();
export async function saveInvestigation(record: Investigation) {
  record.updatedAt = new Date().toISOString();
  record.findingCount = record.events.filter((event) => event.type === "finding").length;
  const { events, ...metadata } = record;
  const rows = await sql("INSERT INTO investigations (id, user_id, created_at, updated_at, data) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET updated_at=excluded.updated_at, data=excluded.data WHERE investigations.user_id=excluded.user_id", [record.id, record.userId, record.createdAt, record.updatedAt, JSON.stringify(metadata)]);
  if (rows !== null) {
    for (let sequence = savedEventCounts.get(record) || 0; sequence < events.length; sequence++) {
      await sql("INSERT INTO investigation_events (investigation_id, sequence, data) SELECT ?, ?, ? WHERE EXISTS (SELECT 1 FROM investigations WHERE id=? AND user_id=?) ON CONFLICT(investigation_id, sequence) DO NOTHING", [record.id, String(sequence), JSON.stringify(events[sequence]), record.id, record.userId]);
    }
    savedEventCounts.set(record, events.length);
    return;
  }
  const { writeFile, rename } = await import("node:fs/promises");
  const directory = await localDirectory();
  const target = `${directory}/${record.id}.json`;
  const temporary = `${target}.${crypto.randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(record));
  for (let attempt = 0; ; attempt++) {
    try { await rename(temporary, target); break; }
    catch (error) {
      if (attempt >= 5 || !["EPERM", "EACCES", "EBUSY"].includes((error as NodeJS.ErrnoException).code || "")) throw error;
      await new Promise((resolve) => setTimeout(resolve, 10 * 2 ** attempt));
    }
  }
}
export async function getInvestigation(userId: string, id: string): Promise<Investigation | null> {
  if (!/^[a-f0-9-]{36}$/i.test(id)) return null;
  const rows = await sql("SELECT data FROM investigations WHERE id=? AND user_id=?", [id, userId]);
  if (rows !== null) {
    if (!rows[0]) return null;
    const events = await sql("SELECT e.data FROM investigation_events e JOIN investigations i ON i.id=e.investigation_id WHERE i.id=? AND i.user_id=? ORDER BY e.sequence", [id, userId]);
    return { ...JSON.parse(rows[0].data), events: (events || []).map((row) => JSON.parse(row.data)) };
  }
  const { readFile } = await import("node:fs/promises");
  try {
    const record = JSON.parse(await readFile(`${await localDirectory()}/${id}.json`, "utf8")) as Investigation;
    return record.userId === userId ? record : null;
  } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
}
export async function listInvestigations(userId: string): Promise<Investigation[]> {
  const rows = await sql("SELECT data FROM investigations WHERE user_id=? ORDER BY created_at DESC", [userId]);
  if (rows !== null) return rows.map((row) => ({ ...JSON.parse(row.data), events: [] }));
  const { readdir } = await import("node:fs/promises");
  const names = await readdir(await localDirectory());
  const records = await Promise.all(names.filter((name) => name.endsWith(".json")).map((name) => getInvestigation(userId, name.slice(0, -5))));
  return records.filter((record): record is Investigation => Boolean(record)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export function investigationSummary(record: Investigation) {
  return { id: record.id, url: record.url, workflow: record.workflow, status: record.status, createdAt: record.createdAt,
    referenceId: record.referenceId, outcome: record.result?.outcome || record.error || "Investigation in progress", findings: Array.isArray(record.result?.findings) ? record.result.findings.length : record.findingCount ?? record.events.filter((event) => event.type === "finding").length };
}
