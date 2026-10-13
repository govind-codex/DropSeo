import Link from "next/link";
export function TrustLinks() {
  return <nav className="trust-links" aria-label="Policies and support"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/help">Help</Link><Link href="/contact">Contact</Link></nav>;
}
