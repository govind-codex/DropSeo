import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { transpileModule, ModuleKind, ScriptTarget } from "typescript";
import { ownerContext, ownerMemoryDirectory } from "../agent/owner-context.mjs";
import { DatabaseSync } from "node:sqlite";

const dataUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
async function load(path, replacements = {}) {
  let source = readFileSync(new URL(path, import.meta.url), "utf8");
  for (const [name, url] of Object.entries(replacements)) source = source.replaceAll(`"${name}"`, JSON.stringify(url));
  const url = dataUrl(transpileModule(source, { compilerOptions: { module: ModuleKind.ESNext, target: ScriptTarget.ES2022 } }).outputText);
  return { url, module: await import(url) };
}

test("persistent history, ownership, and repeated verification", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "audifox-history-"));
  const keys = ["NODE_ENV", "NEXT_RUNTIME", "INVESTIGATIONS_DEV_DIR", "AGENT_WORKER_URL", "CLOUDFLARE_ACCOUNT_ID", "INVESTIGATIONS_D1_ID", "INVESTIGATIONS_D1_TOKEN"];
  const savedEnv = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, { NODE_ENV: "test", NEXT_RUNTIME: "nodejs", INVESTIGATIONS_DEV_DIR: directory });
  delete process.env.AGENT_WORKER_URL;
  delete process.env.INVESTIGATIONS_D1_TOKEN;
  const store = await load("../lib/investigations.ts", { "@/lib/investigation-runtime": dataUrl("export function investigationDatabase() { return null; } export function investigationDocumentStore() { return null; }") });
  const comparison = await load("../lib/investigation-comparison.ts");
  const authUrl = dataUrl("export async function getSession() { return globalThis.__historyUser; } export function validMutationOrigin() { return globalThis.__historyOrigin !== false; }");
  const analyzerUrl = dataUrl(`export async function analyzeAuthenticatedWebsite(request) {
    const { url } = await request.json();
    await new Promise(resolve => setTimeout(resolve, 10));
    return Response.json({ url, title: "Test website", score: 80, checks: globalThis.__historyChecks, ttfb: 30, load: 50, images: 1, scripts: 1, styles: 1, links: [] });
  }`);
  const replacements = { "@/lib/auth": authUrl, "@/lib/investigations": store.url, "@/lib/investigation-comparison": comparison.url, "@/lib/website-analysis": analyzerUrl };
  const detail = (await load("../app/api/investigations/[id]/route.ts", replacements)).module;
  const list = (await load("../app/api/investigations/route.ts", replacements)).module;
  const run = (await load("../app/api/agent/run/route.ts", replacements)).module;
  const post = (body) => run.POST(new Request("http://localhost/api/agent/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
  const get = (id) => detail.GET(new Request("http://localhost/api/investigations"), { params: Promise.resolve({ id }) });
  const check = (name, pass) => ({ name, pass, detail: "Measured evidence", fix: "Correct implementation", category: "Technical" });
  let original;
  try {
    await t.test("all endpoints require a session", async () => {
      globalThis.__historyUser = null;
      assert.equal((await list.GET()).status, 401);
      assert.equal((await get(crypto.randomUUID())).status, 401);
      assert.equal((await post({ url: "https://example.com" })).status, 401);
    });
    globalThis.__historyUser = { id: "alice", name: "Alice", email: "alice@example.com" };
    await t.test("completed runs retain every event and the complete result", async () => {
      globalThis.__historyChecks = [check("Title", false), check("Language", false)];
      const response = await post({ url: "https://example.com/", workflow: "autonomous" });
      assert.equal(response.status, 200);
      const id = response.headers.get("X-Investigation-ID");
      assert.equal((await store.module.getInvestigation("alice", id)).status, "running");
      const events = (await response.text()).trim().split("\n").map(JSON.parse);
      original = await store.module.getInvestigation("alice", id);
      assert.equal(original.status, "completed", original.error);
      assert.deepEqual(original.events, events.slice(1));
      assert.deepEqual(original.result, events.at(-1).result);
      assert.ok(original.events.some((event) => event.type === "snapshot"));
      assert.ok(original.events.some((event) => event.type === "profile"));
    });
    await t.test("other users cannot list, read, or verify an ID", async () => {
      globalThis.__historyUser = { id: "bob", name: "Bob", email: "bob@example.com" };
      assert.deepEqual((await (await list.GET()).json()).investigations, []);
      assert.equal((await get(original.id)).status, 404);
      assert.equal((await get("../../outside")).status, 404);
      assert.equal((await post({ workflow: "verify", investigationId: original.id })).status, 404);
    });
    globalThis.__historyUser = { id: "alice", name: "Alice", email: "alice@example.com" };
    await t.test("cross-site mutations are rejected", async () => {
      globalThis.__historyOrigin = false;
      assert.equal((await post({ url: "https://example.com" })).status, 403);
      globalThis.__historyOrigin = true;
    });
    await t.test("verification compares against the original and ignores a supplied target", async () => {
      globalThis.__historyChecks = [check("Title", true), check("Language", false), check("Canonical", false)];
      const response = await post({ workflow: "verify", investigationId: original.id, url: "https://attacker.example/" });
      const events = (await response.text()).trim().split("\n").map(JSON.parse);
      const saved = await store.module.getInvestigation("alice", response.headers.get("X-Investigation-ID"));
      assert.equal(saved.url, original.url);
      assert.equal(saved.referenceId, original.id);
      const issues = events.at(-1).result.comparison.issues;
      assert.equal(issues.find((issue) => issue.finding.title === "Title").status, "Fixed");
      assert.equal(issues.find((issue) => issue.finding.title === "Language").status, "Still present");
      assert.equal(issues.find((issue) => issue.finding.title === "Canonical").status, "Newly detected");
      const repeated = await post({ workflow: "verify", investigationId: saved.id });
      await repeated.text();
      assert.equal((await store.module.getInvestigation("alice", repeated.headers.get("X-Investigation-ID"))).referenceId, original.id);
      assert.deepEqual((await store.module.getInvestigation("alice", original.id)).result, original.result);
    });
    await t.test("disconnecting a client retains the completed run", async () => {
      const response = await post({ url: "https://example.com/", workflow: "autonomous" });
      const id = response.headers.get("X-Investigation-ID");
      await response.body.cancel();
      let saved;
      for (let attempt = 0; attempt < 100; attempt++) {
        saved = await store.module.getInvestigation("alice", id);
        if (saved.status !== "running") break;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      assert.equal(saved.status, "completed", saved.error);
      assert.ok(saved.result.findings.length);
    });
    await t.test("missing passing evidence remains unverified", () => {
      const result = comparison.module.compareInvestigations(original, { findings: [], checkEvidence: [] });
      assert.ok(result.issues.every((issue) => issue.status === "Unverified"));
    });
    await t.test("concurrent worker contexts isolate memory directories", async () => {
      const directories = await Promise.all(["alice", "bob"].map((owner) => ownerContext.run(owner, async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return ownerMemoryDirectory("memory");
      })));
      assert.notEqual(directories[0], directories[1]);
      assert.equal(directories[0], ownerContext.run("alice", () => ownerMemoryDirectory("memory")));
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
    for (const [key, value] of Object.entries(savedEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    delete globalThis.__historyUser; delete globalThis.__historyOrigin; delete globalThis.__historyChecks;
  }
});

test("D1 SQL persists separate evidence events and filters every query by owner", async () => {
  const database = new DatabaseSync(":memory:");
  const { readdir } = await import("node:fs/promises");
  for (const file of (await readdir(new URL("../drizzle/", import.meta.url))).filter((file) => file.endsWith(".sql")).sort()) {
    database.exec(readFileSync(new URL(`../drizzle/${file}`, import.meta.url), "utf8"));
  }
  globalThis.__historyD1 = { prepare(query) { return { bind(...params) { return { async all() { return { results: database.prepare(query).all(...params) }; } }; } }; } };
  const runtime = process.env.NEXT_RUNTIME;
  delete process.env.NEXT_RUNTIME;
  const cloudflareUrl = dataUrl("export function investigationDatabase() { return globalThis.__historyD1; } export function investigationDocumentStore() { return null; }");
  const { module: store } = await load("../lib/investigations.ts", { "@/lib/investigation-runtime": cloudflareUrl });
  try {
    const record = { id: crypto.randomUUID(), userId: "alice", url: "https://example.com/", workflow: "autonomous", goal: "", status: "running", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), events: [{ type: "activity", title: "Started" }] };
    await store.saveInvestigation(record);
    record.events.push({ type: "snapshot", image: "data:image/jpeg;base64,test", url: record.url });
    record.result = { outcome: "Complete", findings: [{ id: "issue", title: "Title missing" }], diagnosis: { summary: "Detailed analysis" } };
    record.status = "completed";
    await store.saveInvestigation(record);
    await store.saveInvestigation(record);
    const saved = await store.getInvestigation("alice", record.id);
    assert.deepEqual(saved.events, record.events);
    assert.deepEqual(saved.result, record.result);
    assert.equal(await store.getInvestigation("bob", record.id), null);
    assert.deepEqual(await store.listInvestigations("bob"), []);
    await store.saveInvestigation({ ...record, userId: "bob", result: { outcome: "Tampered" } });
    assert.equal((await store.getInvestigation("alice", record.id)).result.outcome, "Complete");
    assert.equal(database.prepare("SELECT count(*) AS total FROM investigation_events").get().total, 2);
  } finally {
    database.close(); delete globalThis.__historyD1;
    if (runtime === undefined) delete process.env.NEXT_RUNTIME; else process.env.NEXT_RUNTIME = runtime;
  }
});

test("production refuses ephemeral investigation storage by default", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousOverride = process.env.INVESTIGATIONS_ALLOW_EPHEMERAL;
  process.env.NODE_ENV = "production";
  delete process.env.INVESTIGATIONS_ALLOW_EPHEMERAL;
  const runtimeUrl = dataUrl("export function investigationDatabase() { return null; } export function investigationDocumentStore() { return null; }");
  const { module: store } = await load("../lib/investigations.ts", { "@/lib/investigation-runtime": runtimeUrl });
  try {
    await assert.rejects(() => store.listInvestigations("alice"), /Persistent investigation storage is not configured/);
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousNodeEnv;
    if (previousOverride === undefined) delete process.env.INVESTIGATIONS_ALLOW_EPHEMERAL; else process.env.INVESTIGATIONS_ALLOW_EPHEMERAL = previousOverride;
  }
});

test("document storage persists and isolates MongoDB-style investigation records", async () => {
  const records = new Map();
  globalThis.__historyDocuments = {
    async save(record) { records.set(record.id, structuredClone(record)); },
    async get(userId, id) { const record = records.get(id); return record?.userId === userId ? structuredClone(record) : null; },
    async list(userId) { return [...records.values()].filter((record) => record.userId === userId).map((record) => ({ ...structuredClone(record), events: [] })); },
  };
  const runtimeUrl = dataUrl("export function investigationDatabase() { return null; } export function investigationDocumentStore() { return globalThis.__historyDocuments; }");
  const { module: store } = await load("../lib/investigations.ts", { "@/lib/investigation-runtime": runtimeUrl });
  try {
    const record = { id: crypto.randomUUID(), userId: "alice", url: "https://example.com/", workflow: "autonomous", goal: "", status: "running", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), events: [{ type: "finding", title: "Stored" }] };
    await store.saveInvestigation(record);
    assert.equal((await store.getInvestigation("alice", record.id)).events.length, 1);
    assert.equal(await store.getInvestigation("bob", record.id), null);
    assert.equal((await store.listInvestigations("alice")).length, 1);
    assert.equal((await store.listInvestigations("bob")).length, 0);
  } finally { delete globalThis.__historyDocuments; }
});

