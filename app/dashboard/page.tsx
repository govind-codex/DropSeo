import { redirect } from "next/navigation";
import AgentWorkspace from "@/components/agent-workspace";
import { readInvestigationIntent } from "@/lib/investigation-intent";
import { listInvestigations, investigationSummary } from "@/lib/investigations";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Workspace | AudiFox Agent" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await getSession();
  if (!user) redirect("/login");
  const params = await searchParams;
  const intent = readInvestigationIntent(new URLSearchParams(params));
  let recent: ReturnType<typeof investigationSummary>[] = [];
  let historyError = false;
  try { recent = (await listInvestigations(user.id)).map(investigationSummary); } catch { historyError = true; }
  return <AgentWorkspace key={user.id} user={user} initialIntent={intent} autoStart={params.continue === "1"} recent={recent} historyError={historyError} />;
}
