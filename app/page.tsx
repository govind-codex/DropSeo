import Link from "next/link";
import { Activity, ArrowRight, Bot, Check, FileSearch, Gauge, Globe2, LockKeyhole, Route, ShieldCheck, Sparkles } from "lucide-react";
import { GoogleSignIn } from "@/components/google-signin";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const user = await getSession();
  return (
    <div className="landing-page">
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="landing-nav">
        <Link className="brand" href="/" aria-label="DropSeo home"><span className="brand-mark"><Activity size={21} /></span>DropSeo<span>.</span></Link>
        <nav aria-label="Main navigation"><a href="#how-it-works">How it works</a><a href="#capabilities">Capabilities</a></nav>
        <a className="nav-signin" href={user ? "/dashboard" : "/api/auth/google"} target={user ? undefined : "_top"}>{user ? "Workspace" : "Sign in"} <ArrowRight size={16} /></a>
      </header>
      <main id="main">
        <section className="landing-hero">
          <div className="hero-copy">
            <span className="landing-eyebrow"><Sparkles size={15} /> YOUR WEBSITE, UNDER INVESTIGATION</span>
            <h1>Find the friction.<br /><span>Fix what matters.</span></h1>
            <p>Meet the website agent that explores real visitor journeys, finds problems, and brings back the evidence to help you fix them.</p>
            {user ? <Link className="google-button" href="/dashboard">Go to your workspace <ArrowRight size={18} /></Link> : <GoogleSignIn />}
            <span className="signin-note"><LockKeyhole size={13} /> Sign in securely. Go straight to your workspace.</span>
            <div className="hero-benefits"><span><Check size={16} /> Evidence-backed findings</span><span><Check size={16} /> Safe, bounded exploration</span></div>
          </div>
          <div className="product-preview" aria-label="Illustrative preview of a DropSeo investigation">
            <div className="preview-toolbar"><span><Bot size={17} /> Agent workspace</span><span className="preview-label">PRODUCT PREVIEW</span></div>
            <div className="preview-address"><Globe2 size={17} /><span>your-website.com</span><span className="preview-scope">PUBLIC WEB</span></div>
            <div className="preview-mission"><span className="preview-agent"><Bot size={26} /></span><div><small>INVESTIGATION PLAN</small><h2>A better journey starts here.</h2></div></div>
            <div className="preview-steps"><div><span>01</span><div><strong>Explore the important paths</strong><p>Understand the site and the visitor’s goal.</p></div><Check size={18} /></div><div><span>02</span><div><strong>Investigate the friction</strong><p>Check journeys, SEO, and page performance.</p></div><Check size={18} /></div><div><span>03</span><div><strong>Bring back the evidence</strong><p>Clear findings. Practical next steps.</p></div><FileSearch size={18} /></div></div>
            <div className="preview-evidence"><FileSearch size={20} /><div><strong>From “something feels off” to a verified finding.</strong><p>Expected behavior → observed behavior → recommended fix</p></div></div>
            <div className="preview-bottom"><ShieldCheck size={15} /> Safe mode enforced <span>No purchases. No form submissions.</span></div>
          </div>
        </section>
        <section className="landing-capabilities" id="capabilities" aria-labelledby="capabilities-heading">
          <div className="section-intro"><span className="landing-eyebrow">LESS GUESSWORK. MORE CLARITY.</span><h2 id="capabilities-heading">One agent. Four ways to get answers.</h2><p>Choose the investigation your website needs.</p></div>
          <div className="capability-grid">
            <article><span className="capability-icon"><Bot /></span><h3>Investigate your site</h3><p>Let the agent map your site and explore the paths that matter most.</p></article>
            <article><span className="capability-icon"><Route /></span><h3>Test a visitor’s goal</h3><p>See whether someone can complete a task, and where the journey breaks.</p></article>
            <article><span className="capability-icon"><Gauge /></span><h3>Uncover slowdowns</h3><p>Measure page performance and investigate likely causes of friction.</p></article>
            <article><span className="capability-icon"><ShieldCheck /></span><h3>Verify your fixes</h3><p>Revisit a reported problem and check that the behavior has improved.</p></article>
          </div>
        </section>
        <section className="landing-how" id="how-it-works" aria-labelledby="how-heading"><div><span className="landing-eyebrow">FROM URL TO INSIGHT</span><h2 id="how-heading">Your next investigation<br />is three steps away.</h2><a href={user ? "/dashboard" : "/api/auth/google"} className="text-cta" target={user ? undefined : "_top"}>Open your workspace <ArrowRight size={18} /></a></div><ol><li><span>1</span><div><h3>Sign in with Google</h3><p>Securely enter your DropSeo workspace.</p></div></li><li><span>2</span><div><h3>Give the agent a website</h3><p>Paste a public URL and choose a workflow.</p></div></li><li><span>3</span><div><h3>Turn findings into fixes</h3><p>Follow the investigation and review the evidence.</p></div></li></ol></section>
      </main>
      <footer className="landing-footer"><Link className="brand" href="/"><span className="brand-mark"><Activity size={18} /></span>DropSeo<span>.</span></Link><p>Evidence before claims. Safety before actions.</p><span>© {new Date().getFullYear()} DropSeo</span></footer>
    </div>
  );
}
