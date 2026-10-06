import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Globe2, History } from "lucide-react";
import { UserProfileMenu } from "@/components/ui/user-profile-menu";
import { getSession } from "@/lib/auth";
import { investigationSummary, listInvestigations } from "@/lib/investigations";

export const dynamic = "force-dynamic";
export const metadata = { title: "My Investigations | AudiFox" };

export default async function InvestigationsPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  let investigations: ReturnType<typeof investigationSummary>[] = [];
  let error = false;

  try {
    investigations = (await listInvestigations(user.id)).map(investigationSummary);
  } catch {
    error = true;
  }

  return (
    <div className="agent-app">
      <header className="topbar">
        <Link className="brand" href="/dashboard">
          <img src="/audifox-logo.png" width="40" height="40" alt="" />
          AudiFox<span>.</span>
        </Link>
        <Link className="product-name" href="/dashboard">Agent workspace</Link>
        <UserProfileMenu className="ml-auto" user={user} />
      </header>

      <main className="agent-main">
        <section className="saved-heading">
          <div>
            <span className="eyebrow"><History size={14} /> WEBSITE MEMORY</span>
            <h1>My Investigations</h1>
            <p>Revisit your evidence and verify fixes after making changes.</p>
          </div>
          <Link className="run-button" href="/dashboard">New investigation <ArrowRight /></Link>
        </section>

        {error ? (
          <div className="agent-error" role="alert">
            <div>
              <strong>History is unavailable</strong>
              <p>Your saved investigations could not be loaded.</p>
              <Link href="/investigations">Try again</Link>
            </div>
          </div>
        ) : investigations.length ? (
          <div className="investigation-list">
            {investigations.map((run) => (
              <Link className="investigation-row" key={run.id} href={`/investigations/${run.id}`}>
                <span className="history-icon"><Globe2 /></span>
                <div>
                  <strong>{run.url}</strong>
                  <p>{String(run.outcome)}</p>
                  <small>{new Date(run.createdAt).toLocaleString()} · {run.workflow}{run.referenceId ? " · Verification" : ""}</small>
                </div>
                <span className={`history-status ${run.status}`}>
                  {run.status === "running" ? "In progress" : run.status === "error" ? "Interrupted" : "Completed"}
                </span>
                <span>{run.findings} findings</span>
                <ArrowRight aria-hidden="true" />
              </Link>
            ))}
          </div>
        ) : (
          <section className="history-empty">
            <History size={32} />
            <h2>No investigations yet</h2>
            <p>Launch an investigation to start building your history.</p>
            <Link className="run-button" href="/dashboard">Start investigating <ArrowRight /></Link>
          </section>
        )}
      </main>
    </div>
  );
}
