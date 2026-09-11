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
AGENT_BROWSER_MODE=portable
```

`npm run dev` uses the portable live-HTML analyzer. Run `npm run dev:worker` for the full local Playwright + Webcmd browser worker with screenshots and rendered-page evidence. `npm run agent` starts only that worker.

## Deploy to Sites or another serverless host

Add `GEMINI_API_KEY` and optionally `GEMINI_MODEL` to the production environment. The default model is `gemini-3.6-flash`.

The hosted API performs deterministic checks against the live HTML response and uses Gemini to prioritize that evidence. It does not attempt to start Chromium inside Cloudflare Workers.

For real browser screenshots in production, deploy `agent/server.mjs` to a Node host with Chrome/Chromium and set `AGENT_WORKER_URL` plus optional `AGENT_WORKER_TOKEN`. The API route streams that worker when configured and otherwise uses portable analysis.

## Deploy the browser worker to Railway

Keep the Next.js application on Vercel and deploy this repository as a second
Railway service. Railway detects the root `Dockerfile` and uses
`railway.toml` to check `/health` before routing traffic.

Set these Railway variables:

```env
GEMINI_API_KEY=your_key
GEMINI_MODEL=gemini-3.6-flash
AGENT_WORKER_TOKEN=use_a_long_random_secret
WEBCMD_ENABLED=true
WEBCMD_PROFILE=sitepulse
```

Railway supplies `PORT`; do not create it manually. Generate a public domain in
Railway under **Settings > Networking**. A healthy deployment returns JSON from
`https://your-worker-domain/health` with `ok: true` and `browser: true`.

For durable workflow memory, attach a Railway volume at `/data`. The container
already stores Webcmd configuration, cache, and learned workflows beneath that
directory. Without a volume, the worker still operates, but this memory resets
when Railway replaces the container.

Finally, set these variables on the Vercel project and redeploy it:

```env
AGENT_BROWSER_MODE=external
AGENT_WORKER_URL=https://your-worker-domain
AGENT_WORKER_TOKEN=the_same_random_secret
```

Do not include `/run` in `AGENT_WORKER_URL`; the Vercel API adds that path.

## Deployment configuration

- `.openai/hosting.json` binds this project to its Sites deployment.
- `.env.example` documents every supported environment variable without containing secrets.
- `app/api/agent/run/route.ts` supports portable analysis and an external browser worker.
- `agent/worker.mjs` writes temporary run artifacts to the operating system's temporary directory.
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
