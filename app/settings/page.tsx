import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { ResourcePage } from "@/components/resource-page";
import { TrustLinks } from "@/components/trust-links";
export const dynamic = "force-dynamic";
export default async function SettingsPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  return <ResourcePage title="Account settings"><p>Signed in as {user.name} ({user.email}).</p><h2>Policies and support</h2><TrustLinks /><p>Your investigations are retained without automatic expiry. Self-service deletion is not available. <Link href="/contact">Request deletion from support</Link>.</p><h2>Plan and usage</h2><p><Link href="/dashboard">View current usage in your workspace</Link> or <Link href="/#pricing">compare plans</Link>.</p><form action="/api/auth/logout" method="post"><button className="run-button">Sign out</button></form></ResourcePage>;
}
