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

1. Sign in with Google, enter a public website, and choose a workflow.
2. The agent profiles the site, creates a plan, and explores same-domain pages in read-only mode.
3. Progress, screenshots, actions, and verified findings stream into the workspace live.
4. Each finding explains the expected behavior, observed behavior, evidence, severity, and recommended fix.
5. Runs are saved to investigation history. Fixes can be checked again and reports downloaded as PDF.

> AudiFox blocks purchases, form submissions, sensitive fields, and other consequential actions.

## Run locally

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local`, add your credentials, then open [localhost:3000](http://localhost:3000).

Required services: **Gemini** and **Google OAuth**. Production history uses **MongoDB or Cloudflare D1**; payments and a separate browser worker are optional.

## Useful commands

```bash
npm run dev       # Web app + browser worker
npm test          # Test agent workflows
npm run lint      # Check the codebase
npm run build     # Production build
```

Built with Next.js, React, Gemini, Playwright, WebCMD, MongoDB/D1, and Dodo Payments. Requires Node.js 22.17+.
