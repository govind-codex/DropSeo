# Sitepulse Agent

Sitepulse is a bounded autonomous browser agent for website investigation. It runs real browser sessions, uses Webcmd for exploration and learned workflow replay, keeps Playwright for evidence and deterministic execution, uses Gemini for adaptive planning, performs deterministic SEO/accessibility/performance checks, and blocks consequential actions.

## Local development

Requirements: Node.js 22.17 or newer and Chrome or Edge installed.

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Add your Gemini key to `.env.local`, then open `http://localhost:3000`.

Webcmd `0.8.4` is installed as a project dependency. Its first browser launch may download its browser runtime; diagnose or prewarm it with:

```powershell
npm run webcmd:doctor
```

```env
GEMINI_API_KEY=your_key
GEMINI_MODEL=gemini-3.6-flash
AGENT_BROWSER_MODE=integrated
```

With `AGENT_BROWSER_MODE=integrated`, the standard `npm run dev` command streams the full local Playwright + Webcmd browser worker through the Next.js API. `npm run dev:worker` remains available for testing the separate-worker topology, and `npm run agent` starts only that worker.

## Deploy to Vercel

1. Push this repository to GitHub, GitLab, or Bitbucket.
2. Import the repository in Vercel. The framework preset is detected as Next.js.
3. Add `GEMINI_API_KEY` in Project Settings → Environment Variables for Production, Preview, and Development as needed.
4. Optionally add `GEMINI_MODEL`; the default is `gemini-3.6-flash`.
5. Deploy. No custom build or output-directory setting is required.

The Playwright browser agent runs in a Node.js Vercel Function with streaming enabled and a five-minute duration budget. It downloads a compatible minimal Chromium pack on the first cold start and reuses the extracted binary while the function instance remains warm. Webcmd subprocess execution is disabled on Vercel by default because its local browser runtime is not serverless-friendly; use a dedicated worker for Webcmd or explicitly enable it only on infrastructure that supports subprocess browsers.

If you prefer a dedicated browser service, set `AGENT_WORKER_URL` and optionally `AGENT_WORKER_TOKEN`. The API route automatically proxies to that worker instead of launching Chromium inside Vercel.

## Deployment configuration

- `vercel.json` enables Fluid compute and sets function duration budgets.
- `next.config.ts` traces the browser-agent runtime package into the deployment.
- `.env.example` documents every supported environment variable without containing secrets.
- `app/api/agent/run/route.ts` supports both integrated Vercel Chromium and an external worker.
- `agent/worker.mjs` writes temporary run artifacts to `/tmp` on Vercel because function filesystems are ephemeral.
- `agent/webcmd/` contains the single safe Webcmd CLI adapter, workflow store, replay executor, and recovery layer.

## Browser intelligence and memory

- First visits use Webcmd reconnaissance to map links and controls, then the existing Playwright planner explores the highest-value safe journey.
- Successful Playwright journeys are compiled into bounded Webcmd `browser run` workflows and mirrored to Webcmd's native per-site memory notes.
- Returning visits validate the known workflow first. Passing workflows skip LLM rediscovery; stale workflows fall back to Playwright recovery and are updated.
- `Verify fix` carries the related workflow ID and reruns that flow instead of intentionally selecting an unrelated journey.
- Results compare prior LCP and meta-description state, and report previously passing workflows that now fail.

The default local store is `outputs/workflows`. Set `WEBCMD_WORKFLOW_DIR` to durable storage in production. Set `WEBCMD_ENABLED=false` to run in Playwright-only mode; audits continue and explicitly report the fallback.

## Safety boundaries

- Only public HTTP/HTTPS targets are accepted; private and link-local networks are rejected.
- Main-frame navigation stays on the approved domain and its subdomains.
- Purchases, destructive actions, form submissions, and sensitive fields are blocked.
- Every run has page, action, and time budgets.
- Website content is treated as untrusted evidence, never as agent instructions.
