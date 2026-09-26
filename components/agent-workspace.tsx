"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  Check,
  ChevronRight,
  CircleStop,
  Download,
  Eye,
  FileSearch,
  FlaskConical,
  Gauge,
  Globe2,
  History,
  Loader2,
  LockKeyhole,
  MousePointer2,
  Play,
  RefreshCw,
  Route,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  TriangleAlert,
  Zap,
} from "lucide-react";

type Workflow = "autonomous" | "journey" | "performance" | "verify";
type ActivityItem = { id: string; at: string; status: "running" | "complete" | "warning" | "blocked"; title: string; detail: string };
type Finding = { id: string; category: string; severity: string; title: string; expected: string; observed: string; recommendation: string; confidence: string; evidenceType: string; workflowId?: string };
type Profile = { siteType: string; purpose: string; primaryJourney: string; plan: string[] };
type Result = { runId: string; workflow: Workflow; goal: string; outcome: string; visitedPages: string[]; actions: Array<Record<string, unknown>>; performance: { ttfb: number; domContentLoaded: number; load: number; resources: number; vitals: { lcp: number; cls: number; longTasks: number } }; findings: Finding[]; browserIntelligence?: { mode: "reused" | "explored" | "playwright-fallback"; regressionDetected: boolean; webcmd: { available: boolean; version: string | null }; workflow: { id: string; name: string; status: string; successRate: number; steps: number } | null }; safety: { blockedActions: number }; durationMs: number };
type RecentRun = { runId: string; url: string; workflow: Workflow; outcome: string; findings: number; completedAt: string };

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    return new URL(trimmed).toString();
  } catch {
    try {
      return new URL(`https://${trimmed}`).toString();
    } catch {
      return trimmed;
    }
  }
}

function hostnameFor(value: string) {
  const normalized = normalizeUrl(value);
  if (!normalized) return "Unknown site";
  try {
    return new URL(normalized).hostname || "Unknown site";
  } catch {
    return value.trim() || "Unknown site";
  }
}

function loadRecentRuns(): RecentRun[] {
  if (typeof window === "undefined") return [];
  try {
    const currentRuns = localStorage.getItem("dropseo-runs");
    const legacyRuns = localStorage.getItem("sitepulse-runs");
    const stored = JSON.parse(currentRuns || legacyRuns || "[]");
    if (!currentRuns && legacyRuns) localStorage.setItem("dropseo-runs", legacyRuns);
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

const workflows: Array<{ id: Workflow; icon: React.ReactNode; name: string; description: string }> = [
  { id: "autonomous", icon: <Bot />, name: "Investigate", description: "Map the site, choose important paths and test what matters." },
  { id: "journey", icon: <Route />, name: "Complete a goal", description: "Attempt a visitor task and recover when the path breaks." },
  { id: "performance", icon: <Gauge />, name: "Performance detective", description: "Measure the real page and investigate likely causes." },
  { id: "verify", icon: <RefreshCw />, name: "Verify a fix", description: "Replay a previous problem and compare the behavior." },
];

export default function AgentWorkspace({ user }: { user: { name: string; email: string } }) {
  const [url, setUrl] = useState("");
  const [workflow, setWorkflow] = useState<Workflow>("autonomous");
  const [goal, setGoal] = useState("");
  const [status, setStatus] = useState<"idle" | "running" | "completed" | "error">("idle");
  const [error, setError] = useState("");
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [snapshot, setSnapshot] = useState("");
  const [snapshotUrl, setSnapshotUrl] = useState("");
  const [findings, setFindings] = useState<Finding[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [recentRuns, setRecentRuns] = useState<RecentRun[]>([]);
  const [progress, setProgress] = useState(0);
  const [completionPending, setCompletionPending] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setRecentRuns(loadRecentRuns()));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const progressTarget = completionPending || status === "completed" ? 100 : status === "running" ? Math.min(88, 12 + activities.length * 7) : 0;

  useEffect(() => {
    if (progress === progressTarget) return;
    const timer = window.setTimeout(() => {
      setProgress((current) => {
        const distance = progressTarget - current;
        if (Math.abs(distance) <= 1) return progressTarget;
        return current + Math.sign(distance) * Math.max(1, Math.ceil(Math.abs(distance) * 0.12));
      });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [progress, progressTarget]);

  useEffect(() => {
    if (!completionPending || progress < 99 || status !== "running") return;
    const frame = window.requestAnimationFrame(() => {
      setProgress(100);
      setCompletionPending(false);
      setStatus("completed");
    });
    return () => window.cancelAnimationFrame(frame);
  }, [completionPending, progress, status]);

  async function startRun(event?: React.FormEvent, override?: { workflow: Workflow; goal: string; workflowId?: string }) {
    event?.preventDefault();
    const activeWorkflow = override?.workflow || workflow;
    const activeGoal = override?.goal ?? goal;
    setWorkflow(activeWorkflow);
    setGoal(activeGoal);
    setProgress(0);
    setCompletionPending(false);
    setStatus("running");
    setError("");
    setActivities([]);
    setProfile(null);
    setSnapshot("");
    setSnapshotUrl("");
    setFindings([]);
    setResult(null);
    try {
      const response = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, workflow: activeWorkflow, goal: activeGoal, workflowId: override?.workflowId, maxActions: 10, maxPages: 4 }),
      });
      if (response.status === 401) {
        window.location.assign("/login?error=expired");
        return;
      }
      if (!response.ok || !response.body) {
        const raw = await response.text().catch(() => "");
        let message = "The live analysis service could not start this run.";
        try {
          const payload = JSON.parse(raw) as { error?: string };
          if (payload.error) message = payload.error;
        } catch {
          if (response.status) message = `The live analysis service returned HTTP ${response.status}. Please try again.`;
        }
        throw new Error(message);
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) if (line.trim()) handleEvent(JSON.parse(line));
        if (done) break;
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The run failed unexpectedly.");
      setCompletionPending(false);
      setStatus("error");
    }
  }

  function handleEvent(event: Record<string, unknown>) {
    if (event.type === "activity") setActivities((items) => [...items, { id: `${String(event.at)}-${items.length}`, at: String(event.at), status: event.status as ActivityItem["status"], title: String(event.title), detail: String(event.detail) }]);
    if (event.type === "profile") setProfile(event.profile as Profile);
    if (event.type === "snapshot") { setSnapshot(String(event.image)); setSnapshotUrl(String(event.url)); }
    if (event.type === "finding") setFindings((items) => [...items, event.finding as Finding]);
    if (event.type === "error") { setError(String(event.error)); setCompletionPending(false); setStatus("error"); }
    if (event.type === "complete") {
      const completed = event.result as Result;
      setResult(completed);
      setCompletionPending(true);
      setFindings(completed.findings);
      const completedUrl = completed.visitedPages[0] || normalizeUrl(url);
      setRecentRuns((current) => {
        const next: RecentRun[] = [{ runId: completed.runId, url: completedUrl, workflow: completed.workflow, outcome: completed.outcome, findings: completed.findings.length, completedAt: new Date().toISOString() }, ...current].slice(0, 5);
        localStorage.setItem("dropseo-runs", JSON.stringify(next));
        return next;
      });
    }
  }

  function verifyFinding(finding: Finding) {
    window.scrollTo({ top: 0, behavior: "smooth" });
    startRun(undefined, { workflow: "verify", goal: `${finding.title}. Expected behavior: ${finding.expected}`, workflowId: finding.workflowId });
  }

  function exportReport() {
    if (!result) return;
    const blob = new Blob([JSON.stringify({ ...result, profile }, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `audifox-agent-${result.runId.slice(0, 8)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <div className="agent-app">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="AudiFox home"><span className="brand-mark" aria-hidden="true"><img src="/audifox-logo.png" alt="" width="40" height="40" /></span>AudiFox<span>.</span></Link>
        <div className="product-name"><Bot size={15} /> Agent workspace</div>
        <div className="safe-badge"><ShieldCheck size={15} /> Safe mode enforced</div>
        <div className="workspace-account"><span className="avatar" aria-hidden="true">{user.name.slice(0, 1).toUpperCase()}</span><span className="account-name" title={user.email}>{user.name}</span><form action="/api/auth/logout" method="post"><button className="signout-button" type="submit">Sign out</button></form></div>
      </header>

      <main className="agent-main">
        <section className="mission-control">
          <div className="mission-copy"><span className="eyebrow"><Sparkles size={13} /> AUTONOMOUS WEBSITE INTELLIGENCE</span><h1>Give the agent a website.<br /><em>Watch it find the truth.</em></h1><p>It explores, acts, recovers from failures, collects evidence and verifies outcomes in a real browser.</p></div>
          <form className="launcher" onSubmit={startRun}>
            <label htmlFor="target-url">Website to investigate</label>
            <div className="url-row"><Globe2 size={20} /><input id="target-url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://your-website.com" required disabled={status === "running"} /><span>PUBLIC WEB</span></div>
            <fieldset><legend>Choose an agent workflow</legend><div className="workflow-grid">{workflows.map((item) => <button type="button" key={item.id} className={`workflow-card ${workflow === item.id ? "selected" : ""}`} onClick={() => setWorkflow(item.id)} disabled={status === "running"}><span className="workflow-icon">{item.icon}</span><span><strong>{item.name}</strong><small>{item.description}</small></span><span className="radio-dot" /></button>)}</div></fieldset>
            {(workflow === "journey" || workflow === "verify") && <label className="goal-field" htmlFor="agent-goal"><span>{workflow === "verify" ? "Behavior to verify" : "Visitor goal"}</span><textarea id="agent-goal" value={goal} onChange={(event) => setGoal(event.target.value)} placeholder={workflow === "verify" ? "The pricing CTA should open signup" : "Find the cheapest plan without creating an account"} required /></label>}
            <div className="launch-footer"><div className="limits"><span><MousePointer2 size={14} /> 10 actions</span><span><FileSearch size={14} /> 4 pages</span><span><LockKeyhole size={14} /> No submissions</span></div><button className="run-button" disabled={status === "running"}>{status === "running" ? <Loader2 className="spin" /> : <Play />} {status === "running" ? "Agent running…" : "Launch agent"}<ArrowRight /></button></div>
          </form>
        </section>

        {error && <div className="agent-error" role="alert"><TriangleAlert /><div><strong>Run interrupted</strong><p>{error}</p></div></div>}

        <section className={`workspace ${status}`} aria-live="polite">
          <div className="workspace-bar"><div><span className={`status-pulse ${status}`} /> <strong>{status === "idle" ? "Agent ready" : status === "running" ? "Investigation in progress" : status === "completed" ? "Investigation complete" : "Agent stopped"}</strong></div><div className="progress-track"><span style={{ width: `${progress}%` }} /></div><span>{progress}%</span></div>
          <div className="workspace-grid">
            <aside className="plan-panel"><div className="panel-title"><Target size={17} /> Investigation plan</div>{profile ? <><div className="site-profile"><span>{profile.siteType}</span><strong>{profile.primaryJourney}</strong><p>{profile.purpose}</p></div><ol className="plan-list">{profile.plan.map((step, index) => <li key={step} className={index < Math.max(1, Math.ceil(activities.length / 3)) ? "done" : ""}><span>{index < Math.max(1, Math.ceil(activities.length / 3)) ? <Check /> : index + 1}</span>{step}</li>)}</ol></> : <div className="empty-panel"><Bot /><strong>{status === "running" ? "Reading the website…" : "Waiting for a mission"}</strong><p>The adaptive plan will appear after the agent understands the site.</p></div>}<div className="guardrails"><ShieldCheck /><div><strong>Guardrails active</strong><p>Same-domain navigation, sensitive-field protection and consequential-action blocking.</p></div></div></aside>

            <section className="browser-panel"><div className="browser-chrome"><div className="browser-dots"><i /><i /><i /></div><div className="address"><LockKeyhole size={12} />{snapshotUrl || "Evidence will appear here"}</div><span>LIVE</span></div><div className="viewport">{snapshot ? <img src={snapshot} alt={`Browser evidence captured at ${snapshotUrl}`} /> : <div className="viewport-empty"><Eye /><strong>Verified page evidence</strong><p>Screenshots appear when a browser worker is connected; live HTML evidence appears in the report below.</p></div>}<div className="scan-line" /></div><div className="evidence-footer"><span><Eye size={14} /> Latest evidence</span><span>{snapshot ? "Screenshot captured" : status === "completed" ? "HTML evidence captured" : "Waiting for evidence"}</span></div></section>

            <aside className="activity-panel"><div className="panel-title"><Activity size={17} /> Agent activity <span>{activities.length}</span></div><div className="activity-feed">{activities.length ? activities.map((item, index) => <article key={item.id}><span className={`activity-icon ${item.status}`}>{item.status === "complete" ? <Check /> : item.status === "running" ? <Loader2 className="spin" /> : item.status === "blocked" ? <CircleStop /> : <AlertTriangle />}</span><div><strong>{item.title}</strong><p>{item.detail}</p><small>Step {index + 1}</small></div></article>) : <div className="empty-panel compact"><Zap /><strong>Observe → plan → act</strong><p>Concise actions and observations appear here without exposing private chain-of-thought.</p></div>}</div></aside>
          </div>
        </section>

        {(status === "completed" || findings.length > 0) && <section className="results"><div className="results-heading"><div><span className="eyebrow"><Search size={13} /> EVIDENCE-BACKED REPORT</span><h2>{result?.outcome || "Findings collected during the run"}</h2><p>{result ? `${result.visitedPages.length} pages · ${result.actions.length} evidence actions · ${(result.durationMs / 1000).toFixed(1)} seconds` : "Findings appear as they are verified."}</p></div>{result && <button className="export-button" onClick={exportReport}><Download /> Export evidence report</button>}</div>
          {result && <div className="metric-grid"><Metric icon={<Gauge />} label="LCP observed" value={result.performance.vitals.lcp ? `${(result.performance.vitals.lcp / 1000).toFixed(2)}s` : "—"} /><Metric icon={<Zap />} label="Response start" value={`${(result.performance.ttfb / 1000).toFixed(2)}s`} /><Metric icon={<FileSearch />} label="Resources" value={String(result.performance.resources)} /><Metric icon={<ShieldCheck />} label="Blocked actions" value={String(result.safety.blockedActions)} /></div>}
          <div className="findings-list">{findings.length ? findings.map((finding) => <article className="finding-card" key={finding.id}><div className="finding-severity"><span className={finding.severity}>{finding.severity}</span><small>{finding.category} · {finding.confidence}</small></div><div className="finding-body"><h3>{finding.title}</h3><div className="expect-grid"><div><span>EXPECTED</span><p>{finding.expected}</p></div><div><span>OBSERVED</span><p>{finding.observed}</p></div></div><div className="fix"><FlaskConical /><div><span>RECOMMENDED FIX</span><p>{finding.recommendation}</p></div></div></div><div className="finding-actions"><span><Eye /> {finding.evidenceType}</span><button onClick={() => verifyFinding(finding)}><RefreshCw /> Verify fix</button></div></article>) : <div className="no-findings"><Check /><strong>No material issues were verified in this bounded run.</strong></div>}</div>
        </section>}

        {recentRuns.length > 0 && <section className="history-section"><div className="results-heading"><div><span className="eyebrow"><History size={13} /> WEBSITE MEMORY</span><h2>Recent investigations</h2></div></div><div className="history-list">{recentRuns.map((run) => <article key={run.runId}><span className="history-icon"><Globe2 /></span><div><strong>{hostnameFor(run.url || "")}</strong><p>{run.outcome}</p></div><span>{run.workflow}</span><b>{run.findings} findings</b><small>{new Date(run.completedAt).toLocaleString()}</small><ChevronRight /></article>)}</div></section>}
      </main>
      <footer className="agent-footer"><span><img className="agent-footer-logo" src="/audifox-logo.png" alt="" width="22" height="22" /> AudiFox Agent</span><p>Bounded autonomy · Evidence before claims · Consequential actions blocked</p></footer>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="metric"><span>{icon}</span><div><small>{label}</small><strong>{value}</strong></div></div>;
}
