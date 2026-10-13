import Link from "next/link";
import { TrustLinks } from "./trust-links";
export function ResourcePage({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="agent-app"><a className="skip-link" href="#resource-main">Skip to content</a><header className="topbar"><Link className="brand" href="/">AudiFox<span>.</span></Link><Link href="/dashboard">Workspace</Link></header><main id="resource-main" className="resource-page"><h1>{title}</h1>{children}</main><footer className="agent-footer"><TrustLinks /></footer></div>;
}
