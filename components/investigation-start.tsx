"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { intentDestination, validateWebsiteUrl } from "@/lib/investigation-intent";

export function InvestigationStart({ authenticated }: { authenticated: boolean }) {
  const [url, setUrl] = useState("");
  const [workflow, setWorkflow] = useState("autonomous");
  const [goal, setGoal] = useState("");
  const [error, setError] = useState("");
  const [errorField, setErrorField] = useState("hero-url");
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const restore = window.setTimeout(() => { try { const draft = JSON.parse(sessionStorage.getItem("audifox-intent") || "null"); if (draft) { setUrl(draft.url); setWorkflow(draft.workflow); setGoal(draft.goal); } } catch {} }, 0);
    const reset = () => setPending(false);
    window.addEventListener("pageshow", reset);
    return () => { window.clearTimeout(restore); window.removeEventListener("pageshow", reset); };
  }, []);
  return <form className="start-form" noValidate onSubmit={(event) => {
    event.preventDefault();
    let invalidField = "hero-url";
    try {
      const intent = { url: validateWebsiteUrl(url), workflow: workflow as "autonomous" | "journey" | "performance", goal: goal.trim() };
      invalidField = "hero-task";
      if (workflow === "journey" && !intent.goal) throw new Error("Describe the visitor goal you want to investigate.");
      try { sessionStorage.setItem("audifox-intent", JSON.stringify(intent)); } catch {}
      setError(""); setPending(true);
      window.location.assign(authenticated ? intentDestination(intent) : `/api/auth/google?${new URLSearchParams(intent)}`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Check your website address."); setErrorField(invalidField); document.getElementById(invalidField)?.focus(); }
  }}>
    <div className="start-fields">
    <div className="start-field"><label htmlFor="hero-url">Website URL</label>
    <input id="hero-url" type="text" inputMode="url" autoComplete="url" placeholder="https://yourwebsite.com" value={url} onChange={(event) => { setUrl(event.target.value); setError(""); }} aria-invalid={Boolean(error) && errorField === "hero-url"} aria-describedby="start-help start-error" disabled={pending} /></div>
    <div className="start-field"><label htmlFor="hero-goal">Investigation goal</label>
    <select id="hero-goal" value={workflow} onChange={(event) => setWorkflow(event.target.value)} disabled={pending}><option value="autonomous">Find website friction</option><option value="journey">Test a visitor goal</option><option value="performance">Investigate performance</option></select></div>
    {workflow === "journey" && <div className="start-field start-task-field"><label htmlFor="hero-task">What should a visitor be able to do?</label><input id="hero-task" value={goal} maxLength={500} aria-invalid={Boolean(error) && errorField === "hero-task"} aria-describedby="start-error" onChange={(event) => { setGoal(event.target.value); setError(""); }} placeholder="Find the right plan" disabled={pending} /></div>}
    <button className="google-button" disabled={pending}>{pending ? "Continuing…" : "Investigate my website"}<ArrowRight size={18} aria-hidden="true" /></button>
    </div>

    <p id="start-error" role="alert" className="form-error">{error}</p>
    <div className="start-card-footer">
    <p id="start-help">{authenticated ? "Continue in your workspace." : "Choose your goal, then sign in with Google. Your inputs stay with you."}</p>
    <Link className="text-cta" href="/sample-report">View sample report <ArrowRight size={16} aria-hidden="true" /></Link>
    </div>
  </form>;
}
