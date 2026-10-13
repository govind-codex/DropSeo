import { notFound, redirect } from "next/navigation";
import AgentWorkspace from "@/components/agent-workspace";
import { getSession } from "@/lib/auth";
import { getInvestigation } from "@/lib/investigations";
export const dynamic = "force-dynamic";
export const metadata = { title: "Investigation | AudiFox" };
export default async function InvestigationPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSession(); if (!user) redirect("/login");
  const record = await getInvestigation(user.id, (await params).id);
  if (!record) notFound();
  const investigation = { ...record, userId: undefined };
  const verificationEngineAvailable = Boolean(record.result?.browserIntelligence) === (Boolean(process.env.AGENT_WORKER_URL?.trim()) && process.env.AGENT_BROWSER_MODE !== "portable");
  return <AgentWorkspace key={record.id} user={user} investigation={investigation} verificationEngineAvailable={verificationEngineAvailable} />;
}

