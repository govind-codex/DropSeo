import Link from "next/link";
import { Activity } from "lucide-react";
import { redirect } from "next/navigation";
import { GoogleSignIn } from "@/components/google-signin";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in | DropSeo" };

const messages: Record<string, { title: string; detail: string }> = {
  configuration: { title: "Google sign-in isn’t ready yet", detail: "The site owner needs to finish connecting Google sign-in. Please try again once setup is complete." },
  cancelled: { title: "Sign-in was cancelled", detail: "No problem. Continue with Google whenever you’re ready to start an investigation." },
  expired: { title: "Let’s try that again", detail: "Your sign-in request expired or could not be verified. Start a new sign-in below." },
  failed: { title: "We couldn’t complete sign-in", detail: "Google sign-in was interrupted. Please try again in a moment." },
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getSession()) redirect("/dashboard");
  const { error } = await searchParams;
  const message = error && Object.hasOwn(messages, error) ? messages[error] : { title: "Your workspace awaits", detail: "Sign in with Google to investigate a website, follow the agent, and review evidence-backed findings." };
  return <main className="auth-page"><section className="auth-card"><Link className="brand" href="/"><span className="brand-mark"><Activity size={21} /></span>DropSeo<span>.</span></Link><div role={error ? "alert" : undefined}><h1>{message.title}</h1><p>{message.detail}</p></div>{error !== "configuration" && <GoogleSignIn />}<Link className="back-link" href="/">Back to home</Link></section></main>;
}
