import Link from "next/link";
import { ArrowRight, Bot, Check, FileSearch, Gauge, Globe2, LockKeyhole, Route, ShieldCheck, Sparkles } from "lucide-react";
import { GoogleSignIn } from "@/components/google-signin";
import { LandingReveal } from "@/components/landing-reveal";
import { Pricing, type PricingPlan } from "@/components/ui/pricing";
import Navbar from "@/components/ui/navbar-02";
import { UserProfileMenu } from "@/components/ui/user-profile-menu";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const user = await getSession();
  const pricingPlans: PricingPlan[] = [
    {
      id: "free",
      name: "FREE",
      price: "0",
      period: "month",
      features: ["3 investigations each month", "Up to 4 pages per investigation", "Evidence-backed findings", "Downloadable reports"],
      description: "For trying AudiFox on your own site.",
      buttonText: "Start free",
      href: user ? "/dashboard" : "/api/auth/google",
      isPopular: false,
    },
    {
      id: "pro",
      name: "PRO",
      price: "9",
      period: "month",
      features: ["50 investigations each month", "Up to 15 pages per investigation", "Journey and performance workflows", "Verification runs and report exports"],
      description: "For growing sites that need regular checks.",
      buttonText: "Choose Pro",
      href: "/checkout",
      isPopular: true,
    },
    {
      id: "studio",
      name: "STUDIO",
      price: "24",
      period: "month",
      features: ["200 investigations each month", "Up to 30 pages per investigation", "Five workspace members", "Priority investigation queue"],
      description: "For teams managing multiple websites.",
      buttonText: "Choose Studio",
      href: "/checkout",
      isPopular: false,
    },
  ];
  return (
    <div className="landing-page">
      <a className="skip-link" href="#main">Skip to content</a>
      {user ? (
        <header className="landing-nav">
          <Link className="brand" href="/" aria-label="AudiFox home"><span className="brand-mark" aria-hidden="true"><img src="/audifox-logo.png" alt="" width="40" height="40" /></span>AudiFox<span>.</span></Link>
          <nav aria-label="Main navigation"><a href="#how-it-works">How it works</a><a href="#capabilities">Capabilities</a><a href="#pricing">Pricing</a></nav>
          <UserProfileMenu user={user} />
        </header>
      ) : <Navbar />}
      <main id="main">
        <section className="landing-hero">
          <LandingReveal className="hero-copy" onLoad>
            <span className="landing-eyebrow"><Sparkles size={15} /> YOUR WEBSITE, UNDER INVESTIGATION</span>
            <h1>Find the friction.<br /><span>Fix what matters.</span></h1>
            <p>Meet the website agent that explores real visitor journeys, finds problems, and brings back the evidence to help you fix them.</p>
            {user ? <Link className="google-button" href="/dashboard">Go to your workspace <ArrowRight size={18} /></Link> : <GoogleSignIn />}
            <span className="signin-note"><LockKeyhole size={13} /> Sign in securely. Go straight to your workspace.</span>
            <div className="hero-benefits"><span><Check size={16} /> Evidence-backed findings</span><span><Check size={16} /> Safe, bounded exploration</span></div>
          </LandingReveal>
          <div className="product-preview" aria-label="Illustrative preview of an AudiFox investigation">
            <div className="preview-toolbar"><span><Bot size={17} /> Agent workspace</span><span className="preview-label">PRODUCT PREVIEW</span></div>
            <div className="preview-address"><Globe2 size={17} /><span>your-website.com</span><span className="preview-scope">PUBLIC WEB</span></div>
            <div className="preview-mission"><span className="preview-agent"><Bot size={26} /></span><div><small>INVESTIGATION PLAN</small><h2>A better journey starts here.</h2></div></div>
            <div className="preview-steps"><div><span>01</span><div><strong>Explore the important paths</strong><p>Understand the site and the visitor’s goal.</p></div><Check size={18} /></div><div><span>02</span><div><strong>Investigate the friction</strong><p>Check journeys, SEO, and page performance.</p></div><Check size={18} /></div><div><span>03</span><div><strong>Bring back the evidence</strong><p>Clear findings. Practical next steps.</p></div><FileSearch size={18} /></div></div>
            <div className="preview-evidence"><FileSearch size={20} /><div><strong>From “something feels off” to a verified finding.</strong><p>Expected behavior → observed behavior → recommended fix</p></div></div>
            <div className="preview-bottom"><ShieldCheck size={15} /> Safe mode enforced <span>No purchases. No form submissions.</span></div>
          </div>
        </section>
        <section className="landing-capabilities" id="capabilities" aria-labelledby="capabilities-heading">
          <LandingReveal className="section-intro"><span className="landing-eyebrow">LESS GUESSWORK. MORE CLARITY.</span><h2 id="capabilities-heading">One agent. Four ways to get answers.</h2><p>Choose the investigation your website needs.</p></LandingReveal>
          <div className="capability-grid">
            <LandingReveal delay={0}><article><span className="capability-icon"><Bot /></span><h3>Investigate your site</h3><p>Let the agent map your site and explore the paths that matter most.</p></article></LandingReveal>
            <LandingReveal delay={0.06}><article><span className="capability-icon"><Route /></span><h3>Test a visitor’s goal</h3><p>See whether someone can complete a task, and where the journey breaks.</p></article></LandingReveal>
            <LandingReveal delay={0.12}><article><span className="capability-icon"><Gauge /></span><h3>Uncover slowdowns</h3><p>Measure page performance and investigate likely causes of friction.</p></article></LandingReveal>
            <LandingReveal delay={0.18}><article><span className="capability-icon"><ShieldCheck /></span><h3>Verify your fixes</h3><p>Revisit a reported problem and check that the behavior has improved.</p></article></LandingReveal>
          </div>
        </section>
        <Pricing
          plans={pricingPlans}
          authenticated={Boolean(user)}
          title="Start small. Investigate deeper when you need to."
          description="Every plan keeps AudiFox in safe mode and brings back evidence you can act on."
        />
        <section className="landing-how" id="how-it-works" aria-labelledby="how-heading"><LandingReveal><span className="landing-eyebrow">FROM URL TO INSIGHT</span><h2 id="how-heading">Your next investigation<br />is three steps away.</h2><a href={user ? "/dashboard" : "/api/auth/google"} className="text-cta" target={user ? undefined : "_top"}>Open your workspace <ArrowRight size={18} /></a></LandingReveal><LandingReveal delay={0.1}><ol><li><span>1</span><div><h3>Sign in with Google</h3><p>Securely enter your AudiFox workspace.</p></div></li><li><span>2</span><div><h3>Give the agent a website</h3><p>Paste a public URL and choose a workflow.</p></div></li><li><span>3</span><div><h3>Turn findings into fixes</h3><p>Follow the investigation and review the evidence.</p></div></li></ol></LandingReveal></section>
      </main>
      <footer className="landing-footer"><Link className="brand" href="/"><span className="brand-mark" aria-hidden="true"><img src="/audifox-logo.png" alt="" width="32" height="32" /></span>AudiFox<span>.</span></Link><p>Evidence before claims. Safety before actions.</p><span>© {new Date().getFullYear()} AudiFox</span></footer>
    </div>
  );
}
