::: {align="center"}

⚡ DropSeo Agent

Autonomous Website Intelligence, Testing & Optimization Agent

<p>

<img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=600&size=22&pause=1000&center=true&vCenter=true&width=760&lines=Explore+%E2%86%92+Reason+%E2%86%92+Test+%E2%86%92+Diagnose;SEO+%2B+Performance+%2B+Accessibility+%2B+UX;Real+Browser.+Real+Evidence.+Actionable+Fixes." alt="DropSeo typing animation" />{=html}

</p>

<p>

<img src="https://img.shields.io/badge/Browser-Playwright-2EAD33?style=for-the-badge&logo=playwright&logoColor=white" />{=html}
<img src="https://img.shields.io/badge/AI-Gemini-8E75B2?style=for-the-badge&logo=googlegemini&logoColor=white" />{=html}
<img src="https://img.shields.io/badge/Runtime-Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" />{=html}
<img src="https://img.shields.io/badge/Frontend-TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />{=html}

</p>

DropSeo is not another URL → score → AI-summary wrapper.
It launches a real Chromium browser, investigates a website, gathers
deterministic evidence, recovers from failed actions, and turns findings
into prioritized fixes.
:::

🤖 Watch the Agent Think in Actions

┌──────────────────────────────────────────────────────────────┐
│                     SITEPULSE AGENT                         │
├──────────────────────────────────────────────────────────────┤
│  URL                                                        │
│  https://example.com                                        │
│                         ↓                                    │
│  👀 OBSERVE → 🧠 PLAN → 🖱️ ACT → 🔎 EVALUATE               │
│                         ↓                                    │
│              ↖──── RECOVER / ADAPT ────↙                    │
│                         ↓                                    │
│                    ✅ VERIFY                                 │
│                         ↓                                    │
│        Evidence-backed, prioritized recommendations          │
└──────────────────────────────────────────────────────────────┘

<p align="center">

<b>{=html}Real browser session • bounded autonomy • deterministic
checks • AI planning</b>{=html}

</p>

✨ What Makes Sitepulse Different?

Capability                          What Sitepulse does

🧭 Autonomous Exploration       Uses a real Playwright-controlled
Chromium session to investigate the
target site.

🧠 AI Planning                  Gemini helps plan browser-agent
actions instead of only summarizing
a static report.

🔍 SEO Analysis                 Runs deterministic SEO checks and
turns evidence into useful
findings.

⚡ Performance Investigation    Collects performance evidence and
helps identify optimization
opportunities.

♿ Accessibility Checks         Detects accessibility issues
through deterministic inspection.

🧪 Browser Interaction          Works through real browser actions
rather than relying only on
HTTP/API responses.

🛟 Recovery                     The agent can recover after failed
actions instead of immediately
terminating.

📸 Evidence Stream              Run reports and screenshots provide
evidence for what the agent
observed.

✅ Fix Verification             Supports verification so
improvements can be checked rather
than merely suggested.

🔄 Agent Loop

flowchart LR
    A[🌐 Target URL] --> B[👀 Observe]
    B --> C[🧠 Plan]
    C --> D[🖱️ Browser Action]
    D --> E[🔎 Evaluate]
    E -->|Need more evidence| B
    E -->|Action failed| F[🛟 Recover]
    F --> B
    E -->|Investigation complete| G[📊 Prioritize Findings]
    G --> H[🛠️ Recommend Fixes]
    H --> I[✅ Verify]

The core idea is simple:

Observe → Plan → Act → Evaluate → Recover → Verify → Report

Sitepulse separates tasks by responsibility: browser automation performs
interactions, deterministic checks collect measurable evidence, and the
AI layer handles planning and interpretation.

🎯 Current MVP

Sitepulse currently combines:

Playwright-controlled Chromium for real browser execution

Gemini planning for agent decisions

deterministic SEO, accessibility and performance checks

streaming agent activity and evidence

recovery after failed actions

fix verification

local storage of run reports and screenshots

The browser worker is intentionally bounded rather than being given
unrestricted control.

🛡️ Safety by Design

Sitepulse treats every website as untrusted input.

Public HTTP/HTTPS only
        │
        ├── Private/link-local networks → BLOCKED
        ├── Cross-domain main navigation → BLOCKED
        ├── Purchases/destructive actions → BLOCKED
        ├── Form submissions → BLOCKED
        ├── Sensitive fields → BLOCKED
        └── Page/action/time budgets → ENFORCED

Website content is evidence --- never agent instructions.

🏗️ Architecture

flowchart TB
    U[👤 User] --> UI[🖥️ Sitepulse Dashboard]
    UI --> API[🔌 Agent Run API]
    API --> W[🤖 Browser Agent Worker]

    W --> P[🧠 Gemini Planner]
    W --> B[🌐 Playwright / Chromium]
    W --> C[🔍 Deterministic Checks]

    B --> T[🎯 Target Website]
    C --> S[SEO]
    C --> A[Accessibility]
    C --> PF[Performance]

    P --> W
    B --> E[📸 Evidence]
    S --> E
    A --> E
    PF --> E

    E --> R[📊 Findings + Fixes + Verification]
    R --> UI

📂 Agent-Specific Structure

sitepulse-project/
│
├── app/
│   ├── page.tsx
│   │   └── Streaming agent workspace + evidence report
│   │
│   └── api/
│       └── agent/
│           └── run/
│               └── route.ts
│                   └── Dashboard → worker streaming proxy
│
├── agent/
│   └── worker.mjs
│       ├── Playwright executor
│       ├── Planner loop
│       ├── Safeguards
│       ├── Measurements
│       └── Evidence storage
│
├── outputs/
│   └── runs/
│       └── Local reports + screenshots (gitignored)
│
└── .env.local

🚀 Run Locally

Prerequisites

Node.js >= 22.13.0

Windows, macOS, or Linux

Gemini API key

1. Install dependencies

npm install

2. Configure environment

Create/update .env.local:

GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=your_supported_model

Never commit real API keys.

3. Start Sitepulse

npm run dev

Open:

http://localhost:5173

The development command starts both the dashboard and browser-agent
worker.

The worker listens locally on:

127.0.0.1:8788

☁️ Hosted Architecture

For a hosted dashboard, the browser worker needs a long-running
Node.js environment with Chrome available.

Configure:

AGENT_WORKER_URL=your_worker_url
AGENT_WORKER_TOKEN=your_optional_shared_token

The dashboard communicates with that worker while the worker owns the
browser session, safeguards, measurements and evidence generation.

🧰 Tech Stack

::: {align="center"}
Layer                Technology

🖥️ UI                TypeScript / Vinext
🤖 Agent             Node.js
🌐 Browser           Playwright + Chromium
🧠 AI Planning       Gemini
📊 Evidence          Agent run reports + screenshots
🗃️ Optional Data     Cloudflare D1 + Drizzle
☁️ Runtime Support   Cloudflare/Vinext tooling
:::

🧪 Useful Commands

# Development
npm run dev

# Production build
npm run build

# Preview built worker
npm run start

# Locked dependency install
npm run install:ci

# Generate Drizzle migrations
npm run db:generate

🗺️ Product Direction

                    SITEPULSE
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
     Website Audit   User Journey    QA Agent
          │             Testing         │
          ▼               │             ▼
   SEO / A11y / Perf      │        Broken Flows
          └───────────────┼─────────────┘
                          ▼
                    AI Diagnosis
                          ▼
                 Prioritized Fixes
                          ▼
                    Verification

Potential expansion areas include goal-driven user journeys, autonomous
QA, conversion-flow analysis, competitor intelligence and regression
monitoring. The priority is to add workflows that require genuine
browser interaction rather than inflate the product with generic AI
summaries.

🧠 Design Principle

Deterministic tool can measure it?  → Use the deterministic tool.
Browser needs to interact with it?  → Use Playwright.
Decision requires context?          → Use the AI planner.
Claim needs proof?                  → Attach evidence.
Fix was applied?                    → Verify it.

🤝 Contributing

git clone https://github.com/govind-codex/DropSeo.git
cd DropSeo
npm install
npm run dev

Create a branch, make your changes, validate the build, and open a pull
request.

📌 Repository

DropSeo 

Built around one principle:

Don't just score a website. Investigate it.

<p align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&height=120&section=footer&text=Sitepulse%20Agent&fontSize=28&animation=fadeIn" alt="Sitepulse footer animation" />{=html}

</p>

::: {align="center"}
Explore. Test. Diagnose. Verify.

⭐ If you find the project useful, consider starring the repository.
:::
