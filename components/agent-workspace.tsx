"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Investigation } from "@/lib/investigations";
import type { Comparison } from "@/lib/investigation-comparison";
import type { PlanUsage } from "@/lib/plan-entitlements";
import findingStyles from "./finding-card.module.css";
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
type Result = { comparison?: Comparison; runId: string; workflow: Workflow; goal: string; outcome: string; visitedPages: string[]; actions: Array<Record<string, unknown>>; performance: { ttfb: number; domContentLoaded: number; load: number; resources: number; vitals: { lcp: number; cls: number; longTasks: number } }; findings: Finding[]; browserIntelligence?: { mode: "reused" | "explored" | "playwright-fallback"; regressionDetected: boolean; webcmd: { available: boolean; version: string | null }; workflow: { id: string; name: string; status: string; successRate: number; steps: number } | null }; safety: { blockedActions: number }; durationMs: number };
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
const workflows: Array<{ id: Workflow; icon: React.ReactNode; name: string; description: string }> = [
  { id: "autonomous", icon: <Bot />, name: "Investigate", description: "Map the site, choose important paths and test what matters." },
  { id: "journey", icon: <Route />, name: "Complete a goal", description: "Attempt a visitor task and recover when the path breaks." },
  { id: "performance", icon: <Gauge />, name: "Performance detective", description: "Measure the real page and investigate likely causes." },
  { id: "verify", icon: <RefreshCw />, name: "Verify a fix", description: "Replay a previous problem and compare the behavior." },
];
export default function AgentWorkspace({ user, investigation }: { user: { name: string; email: string }; investigation?: Omit<Investigation, "userId"> }) {
  const [url, setUrl] = useState(investigation?.url || "");
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
  const [investigationId, setInvestigationId] = useState(investigation?.id || "");
  const eventCount = useRef(0);
  const [progress, setProgress] = useState(0);
  const [completionPending, setCompletionPending] = useState(false);
  const [startingVerification, setStartingVerification] = useState(false);
  const [planUsage, setPlanUsage] = useState<PlanUsage | null>(null);
  const loadPlanUsage = useCallback(async () => {
    const response = await fetch("/api/usage", { cache: "no-store" });
    if (response.ok) setPlanUsage(await response.json() as PlanUsage);
  }, []);
  useEffect(() => {
    let active = true;
    void fetch("/api/usage", { cache: "no-store" }).then(async (response) => {
      if (response.ok && active) setPlanUsage(await response.json() as PlanUsage);
    });
    return () => { active = false; };
  }, []);
  const handleEvent = useCallback((event: Record<string, unknown>) => {
    if (event.type === "saved") setInvestigationId(String(event.investigationId));
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
    }
  }, []);
  useEffect(() => {
    if (!investigation) return;
    let active = true;
    function restore(saved: Omit<Investigation, "userId">) {
      for (const event of saved.events.slice(eventCount.current)) handleEvent(event);
      eventCount.current = saved.events.length;
      setWorkflow(saved.workflow as Workflow); setGoal(saved.goal); setUrl(saved.url);
      if (saved.result) { setResult(saved.result as Result); setFindings((saved.result as Result).findings); }
      setStatus(saved.status); setCompletionPending(false);
      if (saved.status === "completed") setProgress(100);
      if (saved.error) setError(saved.error);
    }
    restore(investigation);
    const timer = window.setInterval(async () => {
      if (!active) return;
      try {
        const response = await fetch(`/api/investigations/${investigation.id}`, { cache: "no-store" });
        if (response.status === 401) { window.location.assign("/login?error=expired"); return; }
        if (!response.ok) throw new Error("Unable to refresh this investigation. Reopen it to retry.");
        const saved = await response.json() as Omit<Investigation, "userId">;
        if (active) restore(saved);
        if (saved.status !== "running") window.clearInterval(timer);
      } catch (error) { if (active) setError(error instanceof Error ? error.message : "Unable to refresh investigation."); }
    }, 3000);
    if (investigation.status !== "running") window.clearInterval(timer);
    return () => { active = false; window.clearInterval(timer); };
    // Saved events are replayed into the same interface as a live stream.
  }, [investigation, handleEvent]);
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
  async function startRun(event?: React.FormEvent, override?: { workflow: Workflow; goal: string; workflowId?: string; findingId?: string }) {
    event?.preventDefault();
    if (status === "running" || startingVerification) return;
    if (investigation) {
      setStartingVerification(true);
      try {
        const response = await fetch("/api/agent/run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workflow: "verify", investigationId: investigation.referenceId || investigation.id, findingId: override?.findingId }) });
        if (!response.ok) { const body = await response.json() as { error?: string; usage?: PlanUsage }; if (body.usage) setPlanUsage(body.usage); throw new Error(body.error || "Verification could not start."); }
        void loadPlanUsage();
        const id = response.headers.get("X-Investigation-ID");
        // The server continues saving the verification after navigation.
        if (id) window.location.assign(`/investigations/${id}`);
      } catch (caught) { setError(caught instanceof Error ? caught.message : "Verification could not start."); setStartingVerification(false); }
      return;
    }
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
        body: JSON.stringify({ url, workflow: activeWorkflow, goal: activeGoal, investigationId, findingId: override?.findingId }),
      });
      if (response.status === 401) {
        window.location.assign("/login?error=expired");
        return;
      }
      if (!response.ok || !response.body) {
        const raw = await response.text().catch(() => "");
        let message = "The live analysis service could not start this run.";
        try {
          const payload = JSON.parse(raw) as { error?: string; usage?: PlanUsage };
          if (payload.usage) setPlanUsage(payload.usage);
          if (payload.error) message = payload.error;
        } catch {
          if (response.status) message = `The live analysis service returned HTTP ${response.status}. Please try again.`;
        }
        throw new Error(message);
      }
      void loadPlanUsage();
      setInvestigationId(response.headers.get("X-Investigation-ID") || "");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) if (line.trim()) handleEvent(JSON.parse(line));
        if (done) { if (buffer.trim()) handleEvent(JSON.parse(buffer)); break; }
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The run failed unexpectedly.");
      setCompletionPending(false);
      setStatus("error");
    }
  }
  function verifyFinding(finding: Finding) {
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    startRun(undefined, { workflow: "verify", goal: `${finding.title}. Expected behavior: ${finding.expected}`, workflowId: finding.workflowId, findingId: result?.comparison ? result.comparison.issues.find((issue) => issue.finding.title === finding.title && issue.status !== "Newly detected")?.finding.id : finding.id });
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
        <Link className="product-name" href="/dashboard"><Bot size={15} /> Agent workspace</Link><Link className="history-nav" href="/investigations"><History size={15} /> My Investigations</Link>
        <div className="safe-badge"><ShieldCheck size={15} /> Safe mode enforced</div>
        <div className="workspace-account"><span className="avatar" aria-hidden="true">{user.name.slice(0, 1).toUpperCase()}</span><span className="account-name" title={user.email}>{user.name}</span><form action="/api/auth/logout" method="post"><button className="signout-button" type="submit">Sign out</button></form></div>
      </header>
      <main className="agent-main">
        {investigation ? <section className="saved-heading"><div><Link href="/investigations">Back to My Investigations</Link><h1>{hostnameFor(investigation.url)}</h1><p>{new Date(investigation.createdAt).toLocaleString()} | {investigation.workflow} | {status}</p></div><button className="run-button" disabled={status === "running" || startingVerification || !result || planUsage?.remaining === 0} onClick={() => startRun(undefined, { workflow: "verify", goal: investigation.goal })}><RefreshCw /> Verify Fix</button></section> : <section className="mission-control">
          <div className="mission-copy"><span className="eyebrow"><Sparkles size={13} /> AUTONOMOUS WEBSITE INTELLIGENCE</span><h1>Give the agent a website.<br /><em>Watch it find the truth.</em></h1><p>It explores, acts, recovers from failures, collects evidence and verifies outcomes in a real browser.</p>{planUsage && <PlanUsageCard usage={planUsage} />}</div>
          <form className="launcher" onSubmit={startRun}>
            <label htmlFor="target-url">Website to investigate</label>
            <div className="url-row"><Globe2 size={20} /><input id="target-url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://your-website.com" required disabled={status === "running"} /><span>PUBLIC WEB</span></div>
            <fieldset><legend>Choose an agent workflow</legend><div className="workflow-grid">{workflows.map((item) => <button type="button" key={item.id} className={`workflow-card ${workflow === item.id ? "selected" : ""}`} onClick={() => setWorkflow(item.id)} disabled={status === "running"}><span className="workflow-icon">{item.icon}</span><span><strong>{item.name}</strong><small>{item.description}</small></span><span className="radio-dot" /></button>)}</div></fieldset>
            {(workflow === "journey" || workflow === "verify") && <label className="goal-field" htmlFor="agent-goal"><span>{workflow === "verify" ? "Behavior to verify" : "Visitor goal"}</span><textarea id="agent-goal" value={goal} onChange={(event) => setGoal(event.target.value)} placeholder={workflow === "verify" ? "The pricing CTA should open signup" : "Find the cheapest plan without creating an account"} required /></label>}
            <div className="launch-footer"><div className="limits"><span><MousePointer2 size={14} /> 10 actions</span><span><FileSearch size={14} /> {planUsage?.maxPages || 4} pages</span><span><LockKeyhole size={14} /> No submissions</span></div><button className="run-button" disabled={status === "running" || planUsage?.remaining === 0}>{status === "running" ? <Loader2 className="spin" /> : <Play />} {status === "running" ? "Agent running…" : planUsage?.remaining === 0 ? "Monthly limit reached" : "Launch agent"}<ArrowRight /></button></div>
          </form>
        </section>}
        {error && <div className="agent-error" role="alert"><TriangleAlert /><div><strong>Run interrupted</strong><p>{error}</p></div></div>}
        <section className={`workspace ${status}`} aria-live="polite">
          <div className="workspace-bar"><div><span className={`status-pulse ${status}`} /> <strong>{status === "idle" ? "Agent ready" : status === "running" ? "Investigation in progress" : status === "completed" ? "Investigation complete" : "Agent stopped"}</strong></div><div className="progress-track"><span style={{ width: `${progress}%` }} /></div><span>{progress}%</span></div>
          <div className="workspace-grid">
            <aside className="plan-panel"><div className="panel-title"><Target size={17} /> Investigation plan</div>{profile ? <><div className="site-profile"><span>{profile.siteType}</span><strong>{profile.primaryJourney}</strong><p>{profile.purpose}</p></div><ol className="plan-list">{profile.plan.map((step, index) => <li key={step} className={index < Math.max(1, Math.ceil(activities.length / 3)) ? "done" : ""}><span>{index < Math.max(1, Math.ceil(activities.length / 3)) ? <Check /> : index + 1}</span>{step}</li>)}</ol></> : <div className="empty-panel"><Bot /><strong>{status === "running" ? "Reading the website…" : "Waiting for a mission"}</strong><p>The adaptive plan will appear after the agent understands the site.</p></div>}<div className="guardrails"><ShieldCheck /><div><strong>Guardrails active</strong><p>Same-domain navigation, sensitive-field protection and consequential-action blocking.</p></div></div></aside>
            <section className="browser-panel"><div className="browser-chrome"><div className="browser-dots"><i /><i /><i /></div><div className="address"><LockKeyhole size={12} />{snapshotUrl || "Evidence will appear here"}</div><span>LIVE</span></div><div className="viewport">{snapshot ? <img src={snapshot} alt={`Browser evidence captured at ${snapshotUrl}`} /> : <div className="viewport-empty"><Eye /><strong>Verified page evidence</strong><p>Screenshots appear when a browser worker is connected; live HTML evidence appears in the report below.</p></div>}<div className="scan-line" /></div><div className="evidence-footer"><span><Eye size={14} /> Latest evidence</span><span>{snapshot ? "Screenshot captured" : status === "completed" ? "HTML evidence captured" : "Waiting for evidence"}</span></div></section>
            <aside className="activity-panel"><div className="panel-title"><Activity size={17} /> Agent activity <span>{activities.length}</span></div><div className="activity-feed">{activities.length ? activities.map((item, index) => <article key={item.id}><span className={`activity-icon ${item.status}`}>{item.status === "complete" ? <Check /> : item.status === "running" ? <Loader2 className="spin" /> : item.status === "blocked" ? <CircleStop /> : <AlertTriangle />}</span><div><strong>{item.title}</strong><p>{item.detail}</p><small>Step {index + 1}</small></div></article>) : <div className="empty-panel compact"><Zap /><strong>Observe → plan → act</strong><p>Concise actions and observations appear here without exposing private chain-of-thought.</p></div>}</div></aside>
          </div>
        </section>
        {result?.comparison && <section className="verification-results"><div className="results-heading"><div><span className="eyebrow">VERIFICATION COMPARISON</span><h2>Changes since the original investigation</h2><Link href={`/investigations/${result.comparison.referenceId}`}>Open original investigation</Link></div></div><div className="comparison-grid">{["Fixed", "Still present", "Newly detected", "Unverified"].map((state) => <section key={state}><h3>{state} <span>{result.comparison!.issues.filter((issue) => issue.status === state).length}</span></h3>{result.comparison!.issues.filter((issue) => issue.status === state).map((issue) => <article key={issue.finding.id}><strong>{issue.finding.title}</strong><p>{issue.detail}</p></article>)}</section>)}</div></section>}
        {(status === "completed" || findings.length > 0) && <section className="results"><div className="results-heading"><div><span className="eyebrow"><Search size={13} /> EVIDENCE-BACKED REPORT</span><h2>{result?.outcome || "Findings collected during the run"}</h2><p>{result ? `${result.visitedPages.length} pages · ${result.actions.length} evidence actions · ${(result.durationMs / 1000).toFixed(1)} seconds` : "Findings appear as they are verified."}</p></div>{result && <button className="export-button" onClick={exportReport}><Download /> Export evidence report</button>}</div>
          {result && <div className="metric-grid"><Metric icon={<Gauge />} label="LCP observed" value={result.performance.vitals.lcp ? `${(result.performance.vitals.lcp / 1000).toFixed(2)}s` : "—"} /><Metric icon={<Zap />} label="Response start" value={`${(result.performance.ttfb / 1000).toFixed(2)}s`} /><Metric icon={<FileSearch />} label="Resources" value={String(result.performance.resources)} /><Metric icon={<ShieldCheck />} label="Blocked actions" value={String(result.safety.blockedActions)} /></div>}
          <div className="findings-list">{findings.length ? findings.map((finding) => <FindingCard finding={finding} key={finding.id} disabled={status === "running" || startingVerification || !result} onVerify={verifyFinding} />) : <div className="no-findings"><Check /><strong>No material issues were verified in this bounded run.</strong></div>}</div>
        </section>}
        {!investigation && <section className="history-section"><div className="results-heading"><div><span className="eyebrow"><History size={13} /> WEBSITE MEMORY</span><h2>Recent investigations</h2><p>Your investigations are saved automatically in your account.</p></div><Link className="export-button" href="/investigations">My Investigations <ChevronRight /></Link></div>{investigationId && <Link className="saved-run-link" href={`/investigations/${investigationId}`}>Open this saved investigation <ChevronRight /></Link>}</section>}
      </main>
      <footer className="agent-footer"><span><img className="agent-footer-logo" src="/audifox-logo.png" alt="" width="22" height="22" /> AudiFox Agent</span><p>Bounded autonomy · Evidence before claims · Consequential actions blocked</p></footer>
    </div>
  );
}
function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="metric"><span>{icon}</span><div><small>{label}</small><strong>{value}</strong></div></div>;
}
function PlanUsageCard({ usage }: { usage: PlanUsage }) {
  const usedPercent = usage.limit ? Math.min(100, Math.round((usage.used / usage.limit) * 100)) : 0;
  const action = usage.plan === "free" ? "Explore paid plans" : usage.plan === "pro" ? "Upgrade to Studio" : "Highest access enabled";
  return (
    <section className="plan-usage" data-plan={usage.plan} aria-label={`${usage.planName} plan usage`}>
      <div className="plan-usage-heading"><div><span>{usage.planName} plan</span><small>{usage.plan === "free" ? "Starter access" : usage.plan === "pro" ? "Professional access" : "Team access"}</small></div><strong>{usage.remaining} investigation{usage.remaining === 1 ? "" : "s"} left</strong></div>
      <div className="usage-track" role="progressbar" aria-label="Monthly investigations used" aria-valuemin={0} aria-valuemax={usage.limit} aria-valuenow={usage.used}><span style={{ width: `${usedPercent}%` }} /></div>
      <p><b>{usage.used} of {usage.limit}</b> used this month <i /> up to <b>{usage.maxPages} pages</b> each</p>
      {usage.plan === "studio" ? <span className="plan-current"><Check size={13} /> {action}</span> : <Link href="/#pricing">{action} <ArrowRight size={13} /></Link>}
    </section>
  );
}
function FindingCard({ finding, onVerify, disabled }: { finding: Finding; disabled: boolean; onVerify: (finding: Finding) => void }) {
  const cardRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const severity = finding.severity.toLowerCase();
  const severityLabel = severity.charAt(0).toUpperCase() + severity.slice(1);
  const severityClass = severity === "high" ? findingStyles.high : severity === "medium" ? findingStyles.medium : severity === "resolved" ? findingStyles.resolved : "";
  useEffect(() => {
    const card = cardRef.current;
    if (!card || window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
      setIsVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setIsVisible(true);
      observer.disconnect();
    }, { threshold: 0.16, rootMargin: "0px 0px -6% 0px" });
    observer.observe(card);
    return () => observer.disconnect();
  }, []);
  return (
    <article ref={cardRef} className={findingStyles.card} data-visible={isVisible}>
      <div className={findingStyles.header}>
        <div className={findingStyles.status}>
          <span className={`${findingStyles.severityPill} ${severityClass}`}><AlertTriangle aria-hidden="true" />{severityLabel} priority</span>
          <span className={findingStyles.category}>{finding.category}</span>
          <span className={findingStyles.confidence}><i aria-hidden="true" />{finding.confidence}</span>
        </div>
        <h3>{finding.title}</h3>
      </div>
      <div className={findingStyles.compare} aria-label="Expected and observed behavior">
        <section className={`${findingStyles.comparisonPanel} ${findingStyles.expected}`}>
          <span className={findingStyles.comparisonLabel}><Check aria-hidden="true" />Expected</span>
          <p>{finding.expected}</p>
        </section>
        <section className={`${findingStyles.comparisonPanel} ${findingStyles.observed}`}>
          <span className={findingStyles.comparisonLabel}><Eye aria-hidden="true" />What AudiFox found</span>
          <p>{finding.observed}</p>
        </section>
      </div>
      <div className={findingStyles.fix}>
        <span className={findingStyles.fixIcon} aria-hidden="true"><FlaskConical /></span>
        <div><span>Recommended next step</span><p>{finding.recommendation}</p></div>
      </div>
      <div className={findingStyles.footer}>
        <span className={findingStyles.evidenceLabel}><Eye aria-hidden="true" />Evidence source <strong>{finding.evidenceType}</strong></span>
        <button type="button" disabled={disabled} onClick={() => onVerify(finding)} aria-label={`Verify fix for ${finding.title}`}>
          <RefreshCw aria-hidden="true" />
          <span><strong>Verify this fix</strong><small>Run the same check again</small></span>
          <ArrowRight className={findingStyles.verifyArrow} aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}
