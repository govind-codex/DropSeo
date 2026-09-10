# Sitepulse Agent

Sitepulse is a bounded autonomous browser agent for website investigation. It runs a real Chromium session, uses Gemini for adaptive planning, performs deterministic SEO/accessibility/performance checks, streams evidence to the dashboard, and blocks consequential actions.

## Local development

Requirements: Node.js 22.17 or newer and Chrome or Edge installed.

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Add your Gemini key to `.env.local`, then open `http://localhost:3000`.

```env
GEMINI_API_KEY=your_key
GEMINI_MODEL=gemini-3.6-flash
AGENT_BROWSER_MODE=integrated
```

The standard development command uses the same integrated API route that Vercel runs. `npm run agent` remains available when you want to run the browser worker as a separate service.

## Deploy to Vercel

1. Push this repository to GitHub, GitLab, or Bitbucket.
2. Import the repository in Vercel. The framework preset is detected as Next.js.
3. Add `GEMINI_API_KEY` in Project Settings → Environment Variables for Production, Preview, and Development as needed.
4. Optionally add `GEMINI_MODEL`; the default is `gemini-3.6-flash`.
5. Deploy. No custom build or output-directory setting is required.

The browser agent runs in a Node.js Vercel Function with streaming enabled and a five-minute duration budget. It downloads a compatible minimal Chromium pack on the first cold start and reuses the extracted binary while the function instance remains warm.

If you prefer a dedicated browser service, set `AGENT_WORKER_URL` and optionally `AGENT_WORKER_TOKEN`. The API route automatically proxies to that worker instead of launching Chromium inside Vercel.

## Deployment configuration

- `vercel.json` enables Fluid compute and sets function duration budgets.
- `next.config.ts` traces the browser-agent runtime package into the deployment.
- `.env.example` documents every supported environment variable without containing secrets.
- `app/api/agent/run/route.ts` supports both integrated Vercel Chromium and an external worker.
- `agent/worker.mjs` writes temporary run artifacts to `/tmp` on Vercel because function filesystems are ephemeral.

## Safety boundaries

- Only public HTTP/HTTPS targets are accepted; private and link-local networks are rejected.
- Main-frame navigation stays on the approved domain and its subdomains.
- Purchases, destructive actions, form submissions, and sensitive fields are blocked.
- Every run has page, action, and time budgets.
- Website content is treated as untrusted evidence, never as agent instructions.
