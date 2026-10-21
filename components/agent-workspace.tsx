"use client";
import { formatInvestigationDate } from "@/lib/date-format";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Investigation } from "@/lib/investigations";
import type { Comparison } from "@/lib/investigation-comparison";
import type { PlanUsage } from "@/lib/plan-entitlements";
import { FindingCard } from "./finding-card";
import findingGridStyles from "./finding-grid.module.css";
import { TrustLinks } from "./trust-links";
import { prepareReportFindings, sortFindings, type Finding } from "@/lib/finding-presentation";
import { validateWebsiteUrl, type InvestigationIntent } from "@/lib/investigation-intent";
import type { investigationSummary } from "@/lib/investigations";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  Check,
  CircleStop,
  Download,
  Eye,
  FileSearch,
  Gauge,
  Globe2,
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
import { UserProfileMenu } from "@/components/ui/user-profile-menu";
import { exportInvestigationPdf } from "@/lib/report-pdf";
type Workflow = "autonomous" | "journey" | "performance" | "verify";
type ActivityItem = { id: string; at: string; status: "running" | "complete" | "warning" | "blocked"; title: string; detail: string };
type Profile = { siteType: string; purpose: string; primaryJourney: string; plan: string[] };
type Result = { verifiedAt?: string; completedAt?: string; comparison?: Comparison; runId: string; workflow: Workflow; goal: string; outcome: string; visitedPages: string[]; actions: Array<Record<string, unknown>>; performance: { ttfb: number; domContentLoaded: number; load: number; resources: number; vitals: { lcp: number; cls: number; longTasks: number } }; findings: Finding[]; browserIntelligence?: { mode: "reused" | "explored" | "playwright-fallback"; regressionDetected: boolean; webcmd: { available: boolean; version: string | null }; workflow: { id: string; name: string; status: string; successRate: number; steps: number } | null }; safety: { blockedActions: number }; durationMs: number };
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
];
export default function AgentWorkspace({ user, investigation, initialIntent, autoStart, recent = [], historyError = false, verificationEngineAvailable = true }: { user: { name: string; email: string }; investigation?: Omit<Investigation, "userId">; initialIntent?: InvestigationIntent | null; autoStart?: boolean; recent?: ReturnType<typeof investigationSummary>[]; historyError?: boolean; verificationEngineAvailable?: boolean }) {
  const initialReport = investigation?.result ? prepareReportFindings({ ...investigation.result }, investigation.events) as unknown as Result : null;
  const initialSnapshot = investigation?.events.filter((event) => event.type === "snapshot" && /^data:image\/(jpeg|png|webp);base64,/.test(String(event.image))).at(-1);
  const [url, setUrl] = useState(investigation?.url || initialIntent?.url || "");
  const [workflow, setWorkflow] = useState<Workflow>((investigation?.workflow as Workflow) || initialIntent?.workflow || "autonomous");
  const [goal, setGoal] = useState(investigation?.goal || initialIntent?.goal || "");
  const [status, setStatus] = useState<"idle" | "queued" | "running" | "completed" | "failed" | "error">(investigation?.status === "error" ? "failed" : investigation?.status || "idle");
  const [error, setError] = useState(investigation?.error || "");
  const [activities, setActivities] = useState<ActivityItem[]>((investigation?.events || []).filter((event) => event.type === "activity").map((event, index) => ({ id: `saved-${index}`, at: String(event.at), status: event.status as ActivityItem["status"], title: String(event.title), detail: String(event.detail) })));
  const [profile, setProfile] = useState<Profile | null>((investigation?.events.filter((event) => event.type === "profile").at(-1)?.profile as Profile) || null);
  const [snapshot, setSnapshot] = useState(String(initialSnapshot?.image || ""));
  const [snapshotUrl, setSnapshotUrl] = useState(String(initialSnapshot?.url || ""));
  const [findings, setFindings] = useState<Finding[]>(initialReport?.findings || (investigation?.events.filter((event) => event.type === "finding").map((event) => event.finding as Finding)) || []);
  const [result, setResult] = useState<Result | null>(initialReport);
  const [investigationId, setInvestigationId] = useState(investigation?.id || "");
  const eventCount = useRef(investigation?.events.length || 0);
  const [urlError, setUrlError] = useState("");
  const [connectionError, setConnectionError] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [confidenceFilter, setConfidenceFilter] = useState("all");
  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoStart && initialIntent && !autoStarted.current) {
      autoStarted.current = true;
      window.history.replaceState(null, "", "/dashboard");
      try { sessionStorage.removeItem("audifox-intent"); } catch {}
      (document.getElementById("investigation-launcher") as HTMLFormElement | null)?.requestSubmit();
    }
  }, [autoStart, initialIntent]);
  const [startingVerification, setStartingVerification] = useState(false);
  const [pdfExporting, setPdfExporting] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const [planUsage, setPlanUsage] = useState<PlanUsage | null>(null);
  const [planUsageError, setPlanUsageError] = useState("");
  const [planUsageLoading, setPlanUsageLoading] = useState(true);
  const loadPlanUsage = useCallback(async () => {
    setPlanUsageLoading(true);
    try {
      const response = await fetch("/api/usage", { cache: "no-store" });
      if (!response.ok) throw new Error("Usage unavailable");
      setPlanUsage(await response.json() as PlanUsage); setPlanUsageError("");
    } catch { setPlanUsageError("Plan usage could not be loaded. The server still checks your allowance before accepting an investigation."); }
    finally { setPlanUsageLoading(false); }
  }, []);
  useEffect(() => {
    let active = true;
    void fetch("/api/usage", { cache: "no-store" }).then(async (response) => {
      if (response.ok && active) setPlanUsage(await response.json() as PlanUsage);
      else if (active) setPlanUsageError("Plan usage could not be loaded. The server still checks your allowance before accepting an investigation.");
    }).catch(() => { if (active) setPlanUsageError("Plan usage could not be loaded. Reconnect and retry."); }).finally(() => { if (active) setPlanUsageLoading(false); });
    return () => { active = false; };
  }, []);
  const handleEvent = useCallback((event: Record<string, unknown>) => {
    if (event.type === "saved") setInvestigationId(String(event.investigationId));
    if (event.type === "activity") setActivities((items) => [...items, { id: `${String(event.at)}-${items.length}`, at: String(event.at), status: event.status as ActivityItem["status"], title: String(event.title), detail: String(event.detail) }]);
    if (event.type === "profile") setProfile(event.profile as Profile);
    if (event.type === "snapshot" && /^data:image\/(jpeg|png|webp);base64,/.test(String(event.image))) { setSnapshot(String(event.image)); setSnapshotUrl(String(event.url)); }
    if (event.type === "finding") setFindings((items) => [...items, event.finding as Finding]);
    if (event.type === "error") { setError(String(event.error)); setStatus("error"); }
    if (event.type === "complete") {
      const completed = prepareReportFindings(event.result as Record<string, unknown>) as unknown as Result;
      setResult(completed);
      setStatus("completed");
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
      if (saved.result) { const report = prepareReportFindings(saved.result, saved.events) as unknown as Result; setResult(report); setFindings(report.findings); }
      setStatus(saved.status === "error" ? "failed" : saved.status); setConnectionError("");
      if (saved.error) setError(saved.error);
    }
    restore(investigation);
    let refreshing = false;
    const timer = window.setInterval(async () => {
      if (!active || refreshing) return;
      refreshing = true;
      try {
        const response = await fetch(`/api/investigations/${investigation.id}`, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
        if (response.status === 401) { window.location.assign("/login?error=expired"); return; }
        if (!response.ok) throw new Error("Unable to refresh this investigation. Reopen it to retry.");
        const saved = await response.json() as Omit<Investigation, "userId">;
        if (active) restore(saved);
        if (!["running", "queued"].includes(saved.status)) window.clearInterval(timer);
      } catch { if (active) setConnectionError("Connection lost. Your saved investigation continues on the server. Reconnecting automatically."); }
      finally { refreshing = false; }
    }, 3000);
    if (!["running", "queued"].includes(investigation.status)) window.clearInterval(timer);
    return () => { active = false; window.clearInterval(timer); };
    // Saved events are replayed into the same interface as a live stream.
  }, [investigation, handleEvent]);
  async function startRun(event?: React.FormEvent, override?: { workflow: Workflow; goal: string; workflowId?: string; findingId?: string }) {
    event?.preventDefault();
    if (["running", "queued"].includes(status) || startingVerification) return;
    if (investigation) {
      setStartingVerification(true);
      try {
        const response = await fetch("/api/agent/run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workflow: "verify", investigationId: investigation.referenceId || investigation.id, findingId: override?.findingId }) });
        if (!response.ok) { const body = await response.json() as { error?: string; usage?: PlanUsage }; if (body.usage) setPlanUsage(body.usage); throw new Error(body.error || "Verification could not start."); }
        void loadPlanUsage();
        const id = response.headers.get("X-Investigation-ID");
        // The server continues saving the verification after navigation.
        if (id) window.location.assign(`/investigations/${id}`);
        else throw new Error("Verification could not be saved. Check your history before retrying.");
      } catch (caught) { setError(caught instanceof Error ? caught.message : "Verification could not start."); setStartingVerification(false); }
      return;
    }
    const activeWorkflow = override?.workflow || workflow;
    const activeGoal = override?.goal ?? goal;
    if (activeWorkflow === "journey" && !activeGoal.trim()) { setUrlError("Describe the visitor goal before starting."); document.getElementById("agent-goal")?.focus(); return; }
    setWorkflow(activeWorkflow);
    setGoal(activeGoal);
    let validatedUrl: string;
    try { validatedUrl = validateWebsiteUrl(url); setUrlError(""); }
    catch (caught) { setUrlError(caught instanceof Error ? caught.message : "Check your URL."); document.getElementById("target-url")?.focus(); return; }

    setStatus("queued");
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
        body: JSON.stringify({ url: validatedUrl, workflow: activeWorkflow, goal: activeGoal, investigationId, findingId: override?.findingId }),
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
      const id = response.headers.get("X-Investigation-ID");
      if (!id) throw new Error("The investigation could not be saved. Check your history before retrying.");
      window.location.assign(`/investigations/${id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The run failed unexpectedly.");

      setStatus("error");
    }
  }
  function verifyFinding(finding: Finding) {
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    const findingId = result?.comparison ? result.comparison.issues.find((issue) => issue.finding.title === finding.title && issue.finding.category === finding.category && issue.status !== "Newly detected")?.finding.id : finding.id;
    if (!findingId) { setError("This finding is not part of the original investigation. Start a new investigation to check it."); return; }
    startRun(undefined, { workflow: "verify", goal: `${finding.title}. Expected behavior: ${finding.expected}`, workflowId: finding.workflowId, findingId });
  }
  async function exportReport() {
    if (!result || pdfExporting) return;
    setPdfExporting(true);
    setPdfError("");
    try {
      await exportInvestigationPdf({ result, profile, targetUrl: investigation?.url || url, investigationId, createdAt: investigation?.createdAt });
    } catch (caught) {
      setPdfError(caught instanceof Error ? caught.message : "PDF could not be created. Please try again.");
    } finally {
      setPdfExporting(false);
    }
  }
  const visibleFindings = sortFindings(findings).filter((finding) => (severityFilter === "all" || finding.severity === severityFilter) && (confidenceFilter === "all" || finding.confidence === confidenceFilter));
  return (
    <div className="agent-app">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="AudiFox home"><span className="brand-mark" aria-hidden="true"><img src="/audifox-logo.png" alt="" width="40" height="40" /></span>AudiFox<span>.</span></Link>
        <div className="safe-badge"><ShieldCheck size={15} /> Safe mode enforced</div>
        <UserProfileMenu user={user} />
      </header>
      <a className="skip-link" href="#workspace-main">Skip to content</a>
      <main className="agent-main" id="workspace-main">
        {!investigation && <section className="dashboard-overview" aria-label="Investigation overview"><div className="results-heading"><div><h2>{historyError ? "Your workspace" : recent.length ? "Your investigations" : "Start your first investigation"}</h2><p>{recent.length ? `${recent.length} saved investigations ? ${recent.reduce((total, run) => total + run.attention, 0)} observed findings needing attention across all saved reports, including verification runs.` : "1. Enter a public website. 2. Choose a goal. 3. Review the evidence and next steps."}</p></div><a className="run-button" href="#investigation-launcher">New investigation <ArrowRight /></a></div>{historyError ? <p role="alert">History could not be loaded. <Link href="/dashboard">Retry</Link></p> : recent.slice(0, 5).map((run) => <Link className="saved-run-link" key={run.id} href={`/investigations/${run.id}`}><strong>{run.url}</strong><span className={`history-status ${run.status}`}>{run.status}</span><span>{run.attention} findings needing attention</span></Link>)}<Link href="/investigations">View all investigations</Link>{recent.some((run) => run.attention > 0) && <div className="attention-list"><h3>Observed findings to review</h3>{recent.slice(0, 5).flatMap((run) => run.attentionFindings.slice(0, 3).map((finding) => <Link key={`${run.id}-${finding.id}`} href={`/investigations/${run.id}#finding-${finding.id}`}><strong>{finding.severity} ? {finding.title}</strong><span>{run.url}</span></Link>))}</div>}</section>}
        {investigation ? <section className="saved-heading"><div><Link href="/investigations">Back to My Investigations</Link><h1>{hostnameFor(investigation.url)}</h1><p>{formatInvestigationDate(investigation.createdAt)} | {investigation.workflow} | {status}</p></div><div className="saved-actions"><Link className="run-button" href="/dashboard">New investigation <ArrowRight /></Link>{verificationEngineAvailable && result?.findings.some((finding) => finding.verificationSupported) && <button className="run-button" disabled={["running", "queued"].includes(status) || startingVerification || planUsage?.remaining === 0} onClick={() => startRun(undefined, { workflow: "verify", goal })}><RefreshCw />{startingVerification ? "Starting verification..." : "Verify supported checks"}</button>}</div></section> : <section className="mission-control">
          <div className="mission-copy"><span className="eyebrow"><Sparkles size={13} /> AUTONOMOUS WEBSITE INTELLIGENCE</span><h1>Give the agent a website.<br /><em>Watch it find the truth.</em></h1><p>Choose a bounded investigation. Document analysis is available; interactive journeys and screenshots require a connected browser worker.</p>{planUsage && <PlanUsageCard usage={planUsage} />}{planUsageLoading && <p role="status">Loading plan allowance...</p>}{planUsageError && <div className="form-error" role="alert"><p>{planUsageError}</p><button type="button" className="text-cta" onClick={loadPlanUsage} disabled={planUsageLoading}>Retry plan usage</button></div>}</div>
          <form className="launcher" id="investigation-launcher" onSubmit={startRun} noValidate>
            <label htmlFor="target-url">Website to investigate</label>
            <div className="url-row"><Globe2 size={20} /><input id="target-url" value={url} onChange={(event) => { setUrl(event.target.value); setUrlError(""); }} aria-invalid={Boolean(urlError)} aria-describedby="url-error" inputMode="url" autoComplete="url" placeholder="https://your-website.com" required disabled={["running", "queued"].includes(status)} /><span>PUBLIC WEB</span></div>
            <p id="url-error" role="alert" className="form-error">{urlError}</p><fieldset><legend>Choose an investigation goal</legend><div className="workflow-grid">{workflows.map((item) => <button type="button" key={item.id} className={`workflow-card ${workflow === item.id ? "selected" : ""}`} onClick={() => setWorkflow(item.id)} aria-pressed={workflow === item.id} disabled={["running", "queued"].includes(status)}><span className="workflow-icon">{item.icon}</span><span><strong>{item.name}</strong><small>{item.description}</small></span><span className="radio-dot" /></button>)}</div></fieldset>
            {(workflow === "journey" || workflow === "verify") && <label className="goal-field" htmlFor="agent-goal"><span>{workflow === "verify" ? "Behavior to verify" : "Visitor goal"}</span><textarea id="agent-goal" maxLength={500} aria-describedby="url-error" value={goal} onChange={(event) => setGoal(event.target.value)} placeholder={workflow === "verify" ? "The pricing CTA should open signup" : "Find the cheapest plan without creating an account"} required /></label>}
            <div className="launch-footer"><div className="limits"><span><MousePointer2 size={14} /> Bounded browsing</span><span><FileSearch size={14} /> {planUsage ? `${planUsage.maxPages} pages` : "Plan page limit"}</span><span><LockKeyhole size={14} /> No submissions</span></div><button className="run-button" disabled={["running", "queued"].includes(status) || planUsage?.remaining === 0}>{["running", "queued"].includes(status) ? <Loader2 className="spin" /> : <Play />} {["running", "queued"].includes(status) ? "Agent running…" : planUsage?.remaining === 0 ? "Monthly limit reached" : "Investigate my website"}<ArrowRight /></button></div>
          </form>
        </section>}
        {connectionError && <p className="connection-notice" role="status">{connectionError}</p>}
        {error && <div className="agent-error" role="alert"><TriangleAlert /><div><strong>Run interrupted</strong><p>{error}</p><Link href={`/dashboard?${new URLSearchParams({ url, workflow: workflow === "verify" ? "autonomous" : workflow, goal })}`}>Retry as a new investigation</Link><p>Check <Link href="/investigations">saved history</Link> before retrying an interrupted start.</p></div></div>}
        <section className={`workspace ${status}`} >
          <div className="workspace-bar"><div role="status"><span className={`status-pulse ${status}`} aria-hidden="true" /> <strong>{status === "idle" ? "Ready to investigate" : status === "queued" ? "Investigation queued" : status === "running" ? "Investigation running" : status === "completed" ? "Investigation completed" : "Investigation failed"}</strong></div>{status === "completed" && <a href="#report">Open report <ArrowRight size={16} /></a>}{investigationId && <Link href={`/investigations/${investigationId}`}>Saved investigation</Link>}</div>
          <div className="workspace-grid">
            <aside className="plan-panel"><div className="panel-title"><Target size={17} /> Investigation plan</div>{profile ? <><div className="site-profile"><span>{profile.siteType}</span><strong>{profile.primaryJourney}</strong><p>{profile.purpose}</p></div><ul className="plan-list">{profile.plan.map((step) => <li key={step}>{step}</li>)}</ul><small>Proposed plan. Completion is recorded in the activity log.</small></> : <div className="empty-panel"><Bot /><strong>{status === "queued" ? "Waiting for an investigation worker" : status === "running" ? "Investigation in progress" : status === "idle" ? "Choose a website to begin" : "No proposed plan was recorded"}</strong><p>Only plans emitted by the investigator appear here.</p></div>}<div className="guardrails"><ShieldCheck /><div><strong>Guardrails active</strong><p>Same-domain navigation, sensitive-field protection and consequential-action blocking.</p></div></div></aside>
            <section className="browser-panel"><div className="browser-chrome"><div className="browser-dots"><i /><i /><i /></div><div className="address"><LockKeyhole size={12} />{snapshotUrl || "Evidence will appear here"}</div><span>RECORDED</span></div><div className="viewport">{snapshot ? <img src={snapshot} alt={`Browser evidence captured at ${snapshotUrl}`} /> : <div className="viewport-empty"><Eye /><strong>No saved screenshot</strong><p>Screenshots appear when a browser worker is connected; live HTML evidence appears in the report below.</p></div>}</div><div className="evidence-footer"><span><Eye size={14} /> Latest evidence</span><span>{snapshot ? "Screenshot captured" : status === "completed" ? "HTML evidence captured" : "Waiting for evidence"}</span></div></section>
            <aside className="activity-panel"><div className="panel-title"><Activity size={17} /> Agent activity <span>{activities.length}</span></div><div className="activity-feed">{activities.length ? activities.map((item) => <article key={item.id}><span className={`activity-icon ${item.status}`}>{item.status === "complete" ? <Check /> : item.status === "running" ? <Loader2 className="spin" /> : item.status === "blocked" ? <CircleStop /> : <AlertTriangle />}</span><div><strong>{item.title}</strong><p>{item.detail}</p><small>{formatInvestigationDate(item.at)} ? {item.status}</small></div></article>) : <div className="empty-panel compact"><Zap /><strong>Observe → plan → act</strong><p>Concise actions and observations appear here without exposing private chain-of-thought.</p></div>}</div></aside>
          </div>
        </section>
        {result?.comparison && <section className="verification-results"><div className="results-heading"><div><span className="eyebrow">VERIFICATION COMPARISON</span><h2>Changes since the original investigation</h2><p>Verification recorded {formatInvestigationDate(result.verifiedAt || investigation?.createdAt || "")}. The original evidence is preserved.</p><Link href={`/investigations/${result.comparison.referenceId}`}>Open original investigation</Link></div></div><div className="comparison-grid">{["Fixed", "Still present", "Newly detected", "Unverified"].map((state) => <section key={state}><h3>{state} <span>{result.comparison!.issues.filter((issue) => issue.status === state).length}</span></h3>{result.comparison!.issues.filter((issue) => issue.status === state).map((issue) => <article key={issue.finding.id}><strong>{issue.finding.title}</strong><p>{issue.detail}</p></article>)}</section>)}</div></section>}
        {(status === "completed" || findings.length > 0) && <section className="results" id="report"><div className="results-heading"><div><span className="eyebrow"><Search size={13} /> EVIDENCE-BACKED REPORT</span><h2>{result?.outcome || "Findings collected during the run"}</h2><p>{result ? `${result.visitedPages.length} pages · ${result.actions.length} evidence actions · ${(result.durationMs / 1000).toFixed(1)} seconds` : "Findings appear as they are verified."}</p></div>{result && <div className="report-export"><button className="export-button" onClick={exportReport} disabled={pdfExporting}>{pdfExporting ? <Loader2 className="spin" /> : <Download />} {pdfExporting ? "Preparing PDF…" : "Export PDF"}</button>{pdfError && <span role="alert">{pdfError}</span>}</div>}</div>
          {result && <div className="metric-grid"><Metric icon={<Gauge />} label="LCP observed" value={result.performance.vitals.lcp ? `${(result.performance.vitals.lcp / 1000).toFixed(2)}s` : "—"} /><Metric icon={<Zap />} label="Response start" value={`${(result.performance.ttfb / 1000).toFixed(2)}s`} /><Metric icon={<FileSearch />} label="Resources" value={String(result.performance.resources)} /><Metric icon={<ShieldCheck />} label="Blocked actions" value={String(result.safety.blockedActions)} /></div>}
          <div className="report-filters"><div><label htmlFor="finding-priority">Priority</label><select id="finding-priority" value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)}><option value="all">All priorities</option>{["critical", "high", "medium", "low", "info", "resolved"].map((severity) => <option key={severity}>{severity}</option>)}</select></div><div><label htmlFor="finding-confidence">Verification</label><select id="finding-confidence" value={confidenceFilter} onChange={(event) => setConfidenceFilter(event.target.value)}><option value="all">All findings</option><option value="verified">Observed checks</option><option value="hypothesis">Unverified theories</option></select></div><span role="status">{visibleFindings.length} findings shown</span></div>
          <div className={`findings-list ${findingGridStyles.grid}`}>{visibleFindings.length ? visibleFindings.map((finding) => <FindingCard finding={{ ...finding, verificationSupported: finding.verificationSupported && verificationEngineAvailable }} key={finding.id} disabled={["running", "queued"].includes(status) || startingVerification || !result || planUsage?.remaining === 0} onVerify={verifyFinding} />) : <div className="no-findings"><Check /><strong>{findings.length ? "No findings match these filters. Try another priority or verification level." : "No material issues were verified in this bounded run."}</strong></div>}</div>
        </section>}
      </main>
      <footer className="agent-footer"><span><img className="agent-footer-logo" src="/audifox-logo.png" alt="" width="22" height="22" /> AudiFox Agent</span><p>Bounded autonomy · Evidence before claims · Consequential actions blocked</p><TrustLinks /></footer>
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
      <p>Resets {formatInvestigationDate(usage.resetsAt)}. Accepted runs, including queued runs, verification and failures, count toward usage.</p>
      {usage.plan === "studio" ? <span className="plan-current"><Check size={13} /> {action}</span> : <Link href="/#pricing">{action} <ArrowRight size={13} /></Link>}
    </section>
  );
}
