import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

const groups = [
  { title: "Product", links: [{ label: "How it works", href: "#how-it-works" }, { label: "Capabilities", href: "#capabilities" }, { label: "Pricing", href: "#pricing" }] },
  { title: "Explore", links: [{ label: "Sample report", href: "/sample-report" }, { label: "Your workspace", href: "/dashboard" }, { label: "Investigate a site", href: "#hero-url" }] },
  { title: "Support", links: [{ label: "Help center", href: "/help" }, { label: "Contact us", href: "/contact" }, { label: "Account settings", href: "/settings" }] },
  { title: "Legal", links: [{ label: "Privacy", href: "/privacy" }, { label: "Terms", href: "/terms" }] },
];

export function LandscapeFooter() {
  return <footer className="landscape-footer" aria-label="AudiFox footer">
    <div className="landscape-footer-content">
      <div className="landscape-footer-brand">
        <Link className="brand" href="/" aria-label="AudiFox home"><span className="brand-mark" aria-hidden="true"><img src="/audifox-logo.png" alt="" width="40" height="40" /></span>AudiFox<span>.</span></Link>
        <p>A clearer path for every visitor.<br />Evidence to help you find your next fix.</p>
        <a className="landscape-footer-start" href="#hero-url">Start with your website <ArrowUpRight size={15} aria-hidden="true" /></a>
      </div>
      <div className="landscape-footer-links">{groups.map((group) => <nav key={group.title} aria-label={`Footer ${group.title}`}><h2>{group.title}</h2><ul>{group.links.map((link) => <li key={link.href}><Link href={link.href}>{link.label}</Link></li>)}</ul></nav>)}</div>
    </div>
    <div className="landscape-footer-bottom"><span>&copy; {new Date().getFullYear()} AudiFox</span><span>Evidence before claims. Safety before actions.</span></div>
  </footer>;
}
