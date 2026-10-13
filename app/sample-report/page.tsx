"use client";
import Link from "next/link";
import { ResourcePage } from "@/components/resource-page";
import { FindingCard } from "@/components/finding-card";
import type { Finding } from "@/lib/finding-presentation";
const finding: Finding = { id: "sample-heading", title: "Main heading structure is unclear", category: "Accessibility", severity: "medium", expected: "The pricing page has one descriptive main heading so visitors can identify its purpose.", observed: "The example document contains two H1 headings: 'Our plans' and 'Get started'.", recommendation: "Keep 'Our plans' as the page H1. Use an H2 for 'Get started', then recheck the document heading outline.", confidence: "verified", evidenceType: "Illustrative document check", affectedUrls: ["https://example.com/pricing"], evidence: [{ url: "https://example.com/pricing", detail: "Illustrative HTML evidence: <h1>Our plans</h1> … <h1>Get started</h1>. H1 count: 2. This constructed example was not collected from example.com." }], verificationSupported: false };
export default function SampleReport() {
  return <ResourcePage title="Sample investigation report"><p className="policy-notice">Illustrative data. This report is a constructed example, not a real investigation of example.com. All observations, priorities and evidence below are examples.</p><p>Goal: help a visitor understand available plans. Example scope: one pricing page document. Interactive checkout was not tested.</p><FindingCard finding={finding} disabled onVerify={() => {}} /><p>Verification status: example observed check; no fix has been verified. Verify fix is unavailable on sample content.</p><Link className="run-button" href="/#hero-url">Investigate your website</Link></ResourcePage>;
}
