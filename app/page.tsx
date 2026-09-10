"use client";

import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleHelp,
  Code2,
  Download,
  FlaskConical,
  Globe2,
  Lightbulb,
  Loader2,
  ScanLine,
  Search,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type CheckItem = { name: string; pass: boolean; detail: string; fix: string; category: string };
type AiAnalysis = {
  summary: string;
  verdict: string;
  quickWins: Array<{
    title: string;
    why: string;
    action: string;
    impact: "High" | "Medium" | "Low";
    effort: "Quick" | "Moderate" | "Project";
  }>;
  searchUpgrade: {
    title: string;
    metaDescription: string;
    keywordThemes: string[];
    contentGap: string;
    schemaSuggestion: string;
  };
  performanceStory: { diagnosis: string; likelyBottlenecks: string[]; nextTest: string };
  growthExperiment: { name: string; hypothesis: string; steps: string[]; successMetric: string };
  confidence: "High" | "Medium" | "Low";
};
type Report = {
  url: string;
  title: string;
  description: string;
  score: number;
  checks: CheckItem[];
  ttfb: number;
  load: number;
  bytes: number;
  images: number;
  scripts: number;
  styles: number;
  date: string;
  ai: AiAnalysis | null;
  aiError?: string | null;
};

const example: Report = {
  url: "https://example.com/",
  title: "Example website — A better place to start",
  description: "An illustrative report showing how Sitepulse turns website checks into a clear action plan.",
  score: 80,
  ttfb: 342,
  load: 486,
  bytes: 68420,
  images: 18,
  scripts: 7,
  styles: 3,
  date: "",
  checks: [
    { name: "Page title", pass: true, detail: "A unique page title is present.", category: "Content", fix: "" },
    { name: "Meta description", pass: true, detail: "A descriptive page summary is present.", category: "Content", fix: "" },
    { name: "Main heading", pass: true, detail: "1 H1 heading found.", category: "Content", fix: "" },
    { name: "Image alternative text", pass: false, detail: "4 of 18 images are missing alt attributes.", category: "Accessibility", fix: "Add descriptive alt text to informative images. Use an empty alt attribute for decorative images." },
    { name: "Canonical URL", pass: false, detail: "No canonical link found.", category: "Technical", fix: "Add a canonical link in the page head to identify the preferred URL." },
    { name: "Mobile viewport", pass: true, detail: "Viewport metadata present.", category: "Technical", fix: "" },
    { name: "Search indexing", pass: true, detail: "No noindex directive found.", category: "Technical", fix: "" },
    { name: "Secure connection", pass: true, detail: "Page served over HTTPS.", category: "Technical", fix: "" },
    { name: "Social sharing metadata", pass: true, detail: "Open Graph title and description present.", category: "Content", fix: "" },
    { name: "Document language", pass: true, detail: "English language declared.", category: "Accessibility", fix: "" },
  ],
  ai: {
    summary: "The page covers the technical essentials, but its search identity is still too broad. Tightening image accessibility and canonical signals would make the page easier to understand for people and crawlers.",
    verdict: "Strong foundation, blurry search promise — make the page unmistakably about one valuable outcome.",
    quickWins: [
      { title: "Own one search promise", why: "The title is descriptive but not specific enough to a searcher's goal.", action: "Lead the title and H1 with the primary outcome, then support it with one concrete differentiator.", impact: "High", effort: "Quick" },
      { title: "Complete the image story", why: "Four images provide no context to screen readers or image search.", action: "Write concise alt text that explains the useful information each image contributes.", impact: "Medium", effort: "Quick" },
      { title: "Declare the preferred URL", why: "Without a canonical, duplicate URL variants may compete for the same signals.", action: "Add a self-referencing canonical to the page head.", impact: "Medium", effort: "Quick" },
    ],
    searchUpgrade: {
      title: "A Clearer Website Audit | Example",
      metaDescription: "See the SEO and performance signals that matter, understand what is holding your page back, and leave with a focused action plan.",
      keywordThemes: ["website audit", "SEO analysis", "page performance"],
      contentGap: "Add a short proof section showing what improves after a user acts on the audit.",
      schemaSuggestion: "Use WebApplication schema only if the page represents a working software product.",
    },
    performanceStory: {
      diagnosis: "The HTML response looks lean enough for a quick first delivery, while the image count is the clearest area to validate in a real browser trace.",
      likelyBottlenecks: ["Image format and dimensions may affect the largest visual element.", "Third-party scripts may delay interaction after the HTML arrives."],
      nextTest: "Run mobile Lighthouse and compare LCP element timing with the request waterfall.",
    },
    growthExperiment: {
      name: "Outcome-first snippet test",
      hypothesis: "A title and description centered on the visitor's desired outcome will earn more qualified clicks.",
      steps: ["Publish the proposed search snippet.", "Annotate the change date in Search Console.", "Compare 28-day query-level CTR against the previous period."],
      successMetric: "Higher non-brand organic CTR without a drop in average qualified position.",
    },
    confidence: "Medium",
  },
};

export default function Home() {
  const [url, setUrl] = useState("");
  const [report, setReport] = useState<Report>(example);
  const [demo, setDemo] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("overview");
  const [filter, setFilter] = useState("all");
  const failed = report.checks.filter((check) => !check.pass);
  const passed = report.checks.length - failed.length;

  async function analyze(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = (await response.json()) as Report & { error?: string };
      if (!response.ok) throw new Error(data.error);
      setReport(data);
      setDemo(false);
      setTab(data.ai ? "ai" : "overview");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Analysis failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function download() {
    const blob = new Blob([JSON.stringify({ ...report, illustrative: demo }, null, 2)], { type: "application/json" });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `sitepulse-${new URL(report.url).hostname}.json`;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  }

  function checklist(items: CheckItem[]) {
    return (
      <div className="checklist">
        {items.map((check) => (
          <details key={check.name}>
            <summary>
              <span className={`check-icon ${check.pass ? "good" : "warn"}`}>
                {check.pass ? <Check size={16} /> : <AlertTriangle size={16} />}
              </span>
              <span className="check-name">{check.name}<small>{check.category}</small></span>
              <span className={`badge ${check.pass ? "good" : "warn"}`}>{check.pass ? "Passed" : "Needs attention"}</span>
              <ChevronDown size={16} />
            </summary>
            <div className="check-detail">
              <p>{check.detail}</p>
              {!check.pass && <p><strong>Recommended fix:</strong> {check.fix}</p>}
            </div>
          </details>
        ))}
      </div>
    );
  }

  return (
    <div className="app">
      <header>
        <a className="brand" href="/" aria-label="Sitepulse home"><span className="brand-icon"><Activity size={23} /></span>sitepulse<span className="brand-dot">.</span></a>
        <span className="header-label">Website intelligence</span>
        <a className="header-help" href="#methodology"><CircleHelp size={17} /> How it works</a>
        <div className="avatar">SP</div>
      </header>
      <main>
        <div className="heading-row">
          <div><div className="eyebrow">YOUR WEBSITE, UNDERSTOOD</div><h1>A clearer picture of your website.</h1><p>Measured signals, interpreted by AI, turned into your next best moves.</p></div>
          <span className="workspace-tag"><Sparkles size={16} /> Gemini strategist</span>
        </div>
        <form onSubmit={analyze} className="audit-form">
          <Globe2 size={21} />
          <label className="sr-only" htmlFor="website">Website URL</label>
          <input id="website" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="Enter your website URL" required disabled={loading} />
          <span className="public-label">Public websites</span>
          <button className="primary" disabled={loading}>{loading ? <Loader2 className="spin" size={17} /> : <Sparkles size={17} />} {loading ? "Reading & reasoning…" : "Analyze with AI"}{!loading && <ArrowRight size={16} />}</button>
        </form>
        {error && <div role="alert" className="error"><AlertTriangle size={18} />{error}</div>}

        <section className="report" aria-busy={loading}>
          <div className="report-top">
            <div className="domain"><span className="domain-icon"><Globe2 size={23} /></span><div><h2>{new URL(report.url).hostname} <ArrowUpRight size={16} /></h2><span>{demo ? "Explore an illustrative AI report before running your audit." : `Analyzed ${new Date(report.date).toLocaleString()} · Single page audit`}</span></div></div>
            <div className="report-actions">{demo && <span className="demo-badge">Example report</span>}<button className="secondary" onClick={download} disabled={loading}><Download size={16} /> Export report</button></div>
          </div>

          {loading ? (
            <div className="loading-state" role="status"><Loader2 size={28} className="spin" /><h3>Building your strategy…</h3><p>Reading the page, checking its signals, and asking Gemini to prioritize the opportunities.</p><div className="skeleton-grid">{[1, 2, 3, 4].map((number) => <Skeleton key={number} className="h-36 w-full rounded-xl" />)}</div></div>
          ) : (
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList variant="line" className="report-tabs">
                <TabsTrigger value="overview"><Activity /> Overview</TabsTrigger>
                <TabsTrigger value="ai"><Sparkles /> AI strategy</TabsTrigger>
                <TabsTrigger value="seo"><Search /> SEO <span className="tab-count">{report.checks.length}</span></TabsTrigger>
                <TabsTrigger value="performance"><Zap /> Performance</TabsTrigger>
              </TabsList>
              <TabsContent value="overview">
                <div className="score-grid">
                  <div className="score-card lead"><div className="card-label">SEO health <Search size={16} /></div><div className="score-body"><div><strong>{report.score}<em>/ 100</em></strong><span className="score-caption">{report.score >= 90 ? "Looking healthy" : report.score >= 60 ? "Room to improve" : "Needs attention"}</span></div><div className="ring" style={{ "--score": `${report.score}%` } as React.CSSProperties}><Check size={22} /></div></div><p>{passed} of {report.checks.length} checks passed</p></div>
                  <Metric title="Server response" value={(report.ttfb / 1000).toFixed(2)} unit="s" icon={<Zap size={16} />} caption="Time to response headers" />
                  <Metric title="HTML page weight" value={(report.bytes / 1024).toFixed(1)} unit="KB" icon={<Code2 size={16} />} caption="Uncompressed page HTML" />
                  <Metric title="Opportunities" value={String(failed.length).padStart(2, "0")} icon={<ScanLine size={16} />} caption="Actionable SEO improvements" />
                </div>
                <div className="overview-grid">
                  <section className="panel"><div className="panel-heading"><div><h3>Make your next move count</h3><p>Your highest-priority opportunities, in one place.</p></div><span className="count-label">{failed.length} to improve</span></div>{failed.length ? checklist(failed) : <div className="success-empty"><Check /> All checks passed. Your page has the essentials covered.</div>}<button className="text-button" onClick={() => setTab("seo")}>View all SEO checks <ArrowRight size={16} /></button></section>
                  <section className="panel health-panel"><div className="panel-heading"><h3>Audit breakdown</h3><span className="muted">{report.checks.length} checks</span></div><div className="health-number">{passed}<span>checks passed</span><span className="healthy-tag">{report.score}%</span></div><div className="segments">{report.checks.map((check, index) => <span key={index} className={check.pass ? "pass-segment" : "warning-segment"} />)}</div><div className="legend"><span><i className="green-dot" />Passed <b>{passed}</b></span><span><i className="orange-dot" />Needs attention <b>{failed.length}</b></span></div><div className="health-note"><span className="note-icon"><Activity size={20} /></span><p>Small improvements add up.<br /><strong>Start with your page essentials.</strong></p></div></section>
                </div>
                <section className="performance-strip"><div className="strip-icon ai-icon"><Sparkles size={22} /></div><div><h3>Let Gemini connect the dots</h3><p>Turn checks and page content into a practical, prioritized strategy.</p></div><button className="secondary" onClick={() => setTab("ai")}>Open AI strategy <ArrowUpRight size={16} /></button></section>
              </TabsContent>

              <TabsContent value="ai">
                {report.ai ? <AiStrategy ai={report.ai} /> : <section className="panel ai-unavailable"><AlertTriangle size={24} /><div><h3>AI strategy is unavailable</h3><p>{report.aiError || "The measured audit is still ready in the other tabs. Try the analysis again shortly."}</p></div></section>}
              </TabsContent>

              <TabsContent value="seo">
                <section className="panel seo-panel"><div className="panel-heading"><div><h3>SEO checks</h3><p>Inspect the signals found in your page’s HTML.</p></div><label className="filter">Show <Select value={filter} onValueChange={setFilter}><SelectTrigger aria-label="Filter SEO checks"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All checks</SelectItem><SelectItem value="issues">Needs attention</SelectItem><SelectItem value="passed">Passed</SelectItem></SelectContent></Select></label></div>{checklist(report.checks.filter((check) => filter === "all" || (filter === "issues" ? !check.pass : check.pass)))}{filter === "issues" && !failed.length && <p className="success-empty">No issues found in these checks.</p>}</section>
                <section className="panel search-preview"><h3>Current search preview</h3><p className="preview-url">{report.url}</p><h4>{report.title || "No page title found"}</h4><p>{report.description || "No meta description found."}</p><small>Illustrative preview. Search engines may display different text.</small></section>
              </TabsContent>

              <TabsContent value="performance">
                <div className="score-grid"><Metric title="Response headers" value={(report.ttfb / 1000).toFixed(2)} unit="s" icon={<Zap size={16} />} caption="Measured from the audit server" /><Metric title="HTML download" value={(report.load / 1000).toFixed(2)} unit="s" icon={<Download size={16} />} caption="Total fetch time, including headers" /><Metric title="HTML size" value={(report.bytes / 1024).toFixed(1)} unit="KB" icon={<Code2 size={16} />} caption="Decoded response body" /><Metric title="Images" value={String(report.images)} icon={<Globe2 size={16} />} caption="Image elements in page HTML" /></div>
                <section className="panel resources"><h3>Page resource inventory</h3><p>Referenced resources found in the original HTML.</p>{[["Images", report.images], ["External scripts", report.scripts], ["Stylesheets", report.styles]].map(([label, number]) => <div className="resource-row" key={label}><span>{label}</span><Progress value={Math.min(100, Number(number) / Math.max(1, report.images, report.scripts, report.styles) * 100)} /><b>{number}</b></div>)}<div className="measurement-note"><Zap size={22} /><p><strong>A server-side snapshot</strong><br />These timings describe a single HTML fetch, not a browser page load. JavaScript is not executed and resources are not downloaded. Core Web Vitals and Lighthouse scores require a browser-based test.</p></div></section>
              </TabsContent>
            </Tabs>
          )}
        </section>
        <footer id="methodology"><span><Activity size={16} /> Built for a healthier web.</span><p>Measured HTML signals · Gemini interpretation · No browser rendering{demo ? " · Sample data" : ""}</p></footer>
      </main>
    </div>
  );
}

function AiStrategy({ ai }: { ai: AiAnalysis }) {
  return (
    <div className="ai-layout">
      <section className="ai-hero">
        <div className="ai-kicker"><Sparkles size={15} /> Gemini strategy · {ai.confidence} confidence</div>
        <h3>{ai.verdict}</h3>
        <p>{ai.summary}</p>
      </section>
      <section className="panel ai-section">
        <div className="panel-heading"><div><h3>Priority moves</h3><p>Ordered by likely impact and effort.</p></div><Target size={20} /></div>
        <div className="wins-grid">{ai.quickWins.map((win, index) => <article className="win-card" key={win.title}><div className="win-top"><span className="win-number">0{index + 1}</span><span className={`impact ${win.impact.toLowerCase()}`}>{win.impact} impact</span><span className="effort">{win.effort}</span></div><h4>{win.title}</h4><p>{win.why}</p><div className="action"><ArrowRight size={15} /><span>{win.action}</span></div></article>)}</div>
      </section>
      <div className="ai-columns">
        <section className="panel ai-section search-upgrade"><div className="panel-heading"><div><h3>Search snippet upgrade</h3><p>AI-written from this page’s actual content.</p></div><Search size={20} /></div><div className="snippet"><span>Suggested title · {ai.searchUpgrade.title.length} chars</span><h4>{ai.searchUpgrade.title}</h4><p>{ai.searchUpgrade.metaDescription}</p></div><div className="theme-list">{ai.searchUpgrade.keywordThemes.map((theme) => <span key={theme}>{theme}</span>)}</div><InsightRow label="Content gap" value={ai.searchUpgrade.contentGap} /><InsightRow label="Structured data" value={ai.searchUpgrade.schemaSuggestion} /></section>
        <section className="panel ai-section"><div className="panel-heading"><div><h3>Performance story</h3><p>Hypotheses grounded in the measured snapshot.</p></div><Zap size={20} /></div><p className="diagnosis">{ai.performanceStory.diagnosis}</p><ul>{ai.performanceStory.likelyBottlenecks.map((item) => <li key={item}>{item}</li>)}</ul><div className="next-test"><Lightbulb size={18} /><div><strong>Validate next</strong><p>{ai.performanceStory.nextTest}</p></div></div></section>
      </div>
      <section className="experiment"><div className="experiment-icon"><FlaskConical size={23} /></div><div className="experiment-copy"><span>GROWTH EXPERIMENT</span><h3>{ai.growthExperiment.name}</h3><p>{ai.growthExperiment.hypothesis}</p></div><ol>{ai.growthExperiment.steps.map((step) => <li key={step}>{step}</li>)}</ol><div className="success-metric"><span>Success looks like</span><strong>{ai.growthExperiment.successMetric}</strong></div></section>
    </div>
  );
}

function InsightRow({ label, value }: { label: string; value: string }) {
  return <div className="insight-row"><span>{label}</span><p>{value}</p></div>;
}

function Metric({ title, value, unit, icon, caption }: { title: string; value: string; unit?: string; icon: React.ReactNode; caption: string }) {
  return <div className="score-card"><div className="card-label">{title}{icon}</div><div className="score-body"><strong>{value}<em>{unit}</em></strong></div><p>{caption}</p></div>;
}
