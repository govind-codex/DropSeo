import { redirect } from "next/navigation";
import AgentWorkspace from "@/components/agent-workspace";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Workspace | AudiFox Agent" };

export default async function DashboardPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  return <AgentWorkspace key={user.id} user={user} />;
}
