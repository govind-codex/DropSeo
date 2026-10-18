<div align="center">
  <img src="public/audifox-logo.png" alt="AudiFox logo" width="88" />

  # AudiFox

  <a href="https://git.io/typing-svg">
    <img src="https://readme-typing-svg.demolab.com?font=Inter&amp;weight=600&amp;size=22&amp;duration=2600&amp;pause=900&amp;color=087C68&amp;center=true&amp;vCenter=true&amp;width=620&amp;lines=Website+friction%2C+handled.;Evidence+before+claims.;Safety+before+actions." alt="AudiFox animated introduction" />
  </a>

  **An AI website investigator that explores real visitor journeys and shows you exactly what to fix.**

  ![Next.js](https://img.shields.io/badge/Next.js-16-111111?style=flat-square&logo=nextdotjs)
  ![React](https://img.shields.io/badge/React-19-149ECA?style=flat-square&logo=react&logoColor=white)
  ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)
  ![Playwright](https://img.shields.io/badge/Playwright-Browser_Agent-2EAD33?style=flat-square&logo=playwright&logoColor=white)
</div>

## What AudiFox does

| Workflow | Purpose |
| --- | --- |
| **Investigate** | Maps the site and tests its most important paths |
| **Complete a goal** | Attempts a visitor task and finds where the journey breaks |
| **Performance detective** | Measures the page and investigates likely slowdowns |
| **Verify a fix** | Replays an issue and compares the new behavior with the original run |

## How it works

```text
Public URL -> Investigation plan -> Safe browser actions -> Live evidence -> Findings -> Verify or export PDF
```

1. Enter a public HTTP(S) website and choose a goal on the homepage; Google sign-in preserves your inputs.
2. The agent profiles the site, creates a plan, and explores same-domain pages in read-only mode.
3. Saved status and events keep the workspace current after refresh or reconnection. Browser mode captures screenshots and actions; portable mode collects document checks.
4. Each finding explains the expected behavior, observed behavior, evidence, severity, and recommended fix.
5. Runs are saved to investigation history. Supported checks can be verified in a separate dated result, and reports exported as PDF.

> Browser mode applies best-effort controls against purchases, form submissions, sensitive fields and other consequential actions. Inspect only websites you are authorized to investigate.

## Run locally

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local`, add your credentials, then open [localhost:3000](http://localhost:3000).

Sign-in requires **Google OAuth**. Browser investigations require **Gemini** and a browser worker; portable document checks can finish without AI enrichment. Next.js production needs **MongoDB** for allowances, with MongoDB or remote D1 for history. Cloudflare production uses a migrated **D1 DB binding** for history and allowances. Payments are optional.

## Useful commands

```bash
npm run dev       # Web app + browser worker
npm test          # Test agent workflows
npm run test:auth
npm run test:investigations
npm run test:plans
npm run test:launch
npm run lint      # Check the codebase
npm run build     # Production build
```

See [the launch review checklist](docs/launch-review.md) for test evidence, isolated browser-check setup, the D1 migration and required owner/engineering sign-off. This implementation is prepared for review; outstanding production and policy gates prevent a launch-ready claim.

Report exports embed Noto Sans, distributed under its [Open Font License](public/fonts/OFL.txt).

Built with Next.js, React, Gemini, Playwright, WebCMD, MongoDB/D1, and Dodo Payments. Requires Node.js 22.17+.

## Browser worker deployment troubleshooting

A 404 response containing "Application not found" during a browser run is an upstream-service error. Check the worker deployment and the public origin configured as `AGENT_WORKER_URL` in Vercel's Production environment. Use the browser worker service domain, not the frontend, hosting dashboard or an old domain.

1. Confirm the worker deployment is running and its public domain routes to that service. Its target port must match the supplied `PORT`; the server already listens on `0.0.0.0` and reads `PORT`.
2. Check `https://YOUR-WORKER-DOMAIN/health`. Expect HTTP 200 with `ok: true` and `browser: true`. A platform 404 requires correcting the service routing/deployment. HTTP 503 from this endpoint means Chromium is not ready; inspect worker logs.
3. Set Vercel's `AGENT_WORKER_URL` to that public origin and `AGENT_BROWSER_MODE=integrated`. The worker and frontend must use the same `AGENT_WORKER_TOKEN`. Never share the token in support messages. Worker 401/403 errors indicate an authentication/configuration issue.
4. Redeploy Vercel after updating production variables, then verify a controlled investigation and its saved report. The 300-second limit in `vercel.json` cannot repair a missing worker service.

Explicitly choosing `AGENT_BROWSER_MODE=portable` bypasses the worker and provides document analysis without browser screenshots or journey replay. This is a deliberate mode choice, not automatic failover. Saved browser reports still require their original engine for verification.

Upstream rejection and connection failures return a readable service error, save the failed start and release its reserved allowance. Accepted runs that later fail retain the existing allowance policy.
