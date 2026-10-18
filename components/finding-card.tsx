"use client";
import { formatInvestigationDate } from "@/lib/date-format";
import { AlertTriangle, Check, Eye, FlaskConical, RefreshCw, ArrowRight } from "lucide-react";
import type { Finding } from "@/lib/finding-presentation";
import findingStyles from "./finding-card.module.css";
export function FindingCard({ finding, onVerify, disabled }: { finding: Finding; disabled: boolean; onVerify: (finding: Finding) => void }) {
  const severity = finding.severity.toLowerCase();
  const severityLabel = severity.charAt(0).toUpperCase() + severity.slice(1);
  const severityClass = severity === "high" || severity === "critical" ? findingStyles.high : severity === "medium" ? findingStyles.medium : severity === "resolved" ? findingStyles.resolved : "";
  return (
    <article id={`finding-${finding.id}`} className={findingStyles.card} data-visible="true">
      <header className={findingStyles.header}>
        <div className={findingStyles.status}>
          <span className={`${findingStyles.severityPill} ${severityClass}`}><AlertTriangle aria-hidden="true" />{severityLabel} priority</span>
          <span className={findingStyles.category}>{finding.category}</span>
        </div>
        <h3>{finding.title}</h3>
        <span className={findingStyles.confidence} data-confidence={finding.confidence}><i aria-hidden="true" />{finding.confidence === "hypothesis" ? "Unverified theory" : finding.confidence === "verified" ? "Observed check · fix not yet verified" : "Unverified"}</span>
        <div className={`affected-urls ${findingStyles.urls}`}><strong>Affected URL</strong>{finding.affectedUrls?.length ? finding.affectedUrls.map((url) => <a key={url} href={url} target="_blank" rel="noopener noreferrer">{url}</a>) : <p>Not recorded in this investigation.</p>}</div>
      </header>
      <div className={findingStyles.panels}>
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
      </div>
      <details className={`finding-evidence ${findingStyles.evidence}`}><summary aria-label={`Open evidence for ${finding.title}`}>View supporting evidence</summary>{finding.evidence?.length ? finding.evidence.map((item, index) => <section key={index}><a href={item.url} target="_blank" rel="noopener noreferrer">{item.url}</a><p>{item.detail}</p>{item.capturedAt && <small>Recorded {formatInvestigationDate(item.capturedAt)}</small>}{item.image && <img src={item.image} alt={`Evidence for ${finding.title} at ${item.url}`} />}</section>) : <p>No supporting artifact was saved for this finding. Evidence source: {finding.evidenceType || "not recorded"}. Treat this as unverified until reproduced.</p>}</details>
      <div className={findingStyles.footer}>
        <span className={findingStyles.evidenceLabel}><Eye aria-hidden="true" />Evidence source <strong>{finding.evidenceType}</strong></span>
        {finding.verificationSupported && <button type="button" disabled={disabled} onClick={() => onVerify(finding)} aria-label={`Verify fix for ${finding.title}`}>
          <RefreshCw aria-hidden="true" />
          <span><strong>Verify this fix</strong><small>Run the same check again</small></span>
          <ArrowRight className={findingStyles.verifyArrow} aria-hidden="true" />
        </button>}
      </div>
    </article>
  );
}
