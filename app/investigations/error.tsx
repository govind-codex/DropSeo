"use client";
export default function InvestigationError({ reset }: { reset: () => void }) {
  return <main className="agent-main"><div className="agent-error" role="alert"><div><strong>Investigation unavailable</strong><p>Your saved evidence could not be loaded. Please try again.</p><button className="run-button" onClick={reset}>Try again</button></div></div></main>;
}
