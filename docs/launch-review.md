# AudiFox launch review

Review date: 13 October 2026. Source: the complete eight-page AudiFox UI/UX Launch Readiness Client Report dated 10 October 2026.

Implementation is prepared for review. This is not production launch approval. The original report explicitly describes recommendations rather than proof of missing features. Existing investigation history, evidence details, subscription entitlements and verification comparisons were inspected and retained.

## UX acceptance checklist

| Item | Implementation | Verification | Remaining sign-off |
| --- | --- | --- | --- |
| UX-01, P0 | URL-first homepage; HTTP(S) validation; selected goal; signed OAuth return destination; cancellation retry retains intent; authenticated continuation | Intent tests, OAuth PKCE/state/nonce/callback tests, browser form and continuation checks | Real Google account through the production callback |
| UX-02, P0 | Public sample report linked twice from homepage; constructed evidence, affected URL, priority and recommendation clearly labeled | Public route, evidence expansion, viewport and accessibility checks | None specific to sample content |
| UX-03, P1 | Guided first-use state; recent saved runs and statuses; observed findings to review; new-investigation actions; counters from saved records and entitlement API | Empty and returning-user browser fixtures; storage and ownership tests | Production storage smoke test |
| UX-04, P0 | Durable queued/running/completed/failed state and events; no invented completion percentages or checked-off plan steps; polling and reconnection; Next `after` persistence; execution-window failure recovery; retry and report links | Storage, disconnect, failure and stale-run tests; browser refresh/reconnect fixtures; live portable investigation | Deployed worker/host disconnect and execution-limit smoke tests |
| UX-05, P0 | Shared finding card with priority, URLs, observation, expectation, recommendation, evidence and verification status; consistent severity ordering and filters; theories labeled; screenshot references matched by ID and URL | Presentation and evidence-ownership tests; browser expansion and filter checks | Real browser-worker screenshot and action evidence review |
| UX-06, P1 | Finding verification requires matching deterministic checks and the original engine; separate result with source/finding IDs and date; original evidence preserved; supported report checks remain available | Repeated/targeted verification, ownership, unsupported-action and engine-mismatch tests; browser comparison navigation | Production targeted check after a controlled website fix |
| UX-07, P0 | Privacy, Terms, Help and Contact resources in footers and account settings; support email confirmed by owner; actual retention/deletion limits disclosed | Public routes, account navigation and contrast checks; code review of data-handling statements | Formal privacy/terms approval, retention/deletion procedure and support operation |
| UX-08, P0 | Responsive layouts at all requested widths; named filters, inline errors, status semantics, visible focus, contrast corrections and reduced-motion support; stable date formatting and saved initial state | Chrome viewport matrix, axe WCAG A/AA checks, keyboard and visual review | Assistive-technology and target-device production smoke test; this is not accessibility certification |
| UX-09, P1 | Free 3/4, Pro 50/15, Studio 200/30 investigation/page limits; UTC calendar-month reset; accepted queued/running/failed runs consume allowances; rejected starts release reservations; unsupported seats/priority removed | Plan tests, concurrent D1 reservations/refunds, checkout reconciliation fixtures, UI usage/pricing checks | Confirm Dodo product prices/currency, taxes and subscription/cancellation/refund policy |
| UX-10, P1 | Shared start validation, finding presentation, date format, trust links and report filters; consistent investigation terms; existing button/card design preserved; useful pending/error/retry states | Lint, TypeScript, component behavior and browser checks | None beyond the journey checks above |
| UX-11, P2 | Purposeful status/open/hover transitions, reduced motion, removal of decorative export pulsing; PDF includes expected/observed behaviour, affected URLs, evidence, dates and comparison; long findings paginate | PDF text placement and long-content tests, browser download, rendered PDF inspection | Unsupported font glyphs are rejected with a browser Print-to-PDF fallback; international-script scope needs owner confirmation |

## Frontend and backend changes

Frontend: URL-first entry, sample and trust resources, dashboard hierarchy, saved-state rendering, meaningful status and retry controls, accessible finding/evidence filters, supported verification controls, consistent dates and responsive contrast/focus improvements.

Backend: URL validation before allowance reservation, signed investigation intent through OAuth, durable lifecycle/events, background persistence after client navigation, stale execution recovery, selected-check verification with immutable source linkage, correct evidence URL/ID association, and D1 entitlement/usage storage.

Apply `drizzle/0002_mighty_xavin.sql` to the production D1 database before deploying to Cloudflare. It adds plan entitlement, monthly usage and reconciliation tables. SQLite tests apply all migrations and check ownership, timestamp ordering, concurrent quota enforcement and nonnegative releases. Next.js production still needs MongoDB for allowances; remote D1 API credentials alone provide investigation history, not plan storage.

## Evidence and reproducible checks

```text
npm test
npm run test:auth
npm run test:investigations
npm run test:plans
npm run test:launch
npm run lint
npm run build
npm run build:next
npx tsc --noEmit
```

Final local evidence: all 45 automated tests passed. The browser pass covered 90 route/viewport combinations at 320, 375, 390, 430, 768 and 1440 CSS pixels with no horizontal overflow; 33 axe scans reported no violations, and all 10 journey scenarios passed with no browser errors. Desktop/mobile screenshots and both the original and verification PDFs were visually inspected. Verification export preserved the source investigation ID, date and fixed-check outcome. A real local portable investigation completed and saved its evidence despite unavailable AI enrichment. These results use Chrome and do not certify other browsers or screen readers.

Run Vite and Next builds sequentially: both generate `.next/types/routes.d.ts`, so concurrent builds can leave incompatible generated route types. Final lint passed with zero errors and nine image-optimization warnings. Both the Vite and Next production builds passed; the standalone TypeScript check also passed after the Next build.

The browser harness uses explicitly labeled local test fixtures and signed test sessions. It exercises actual UI and history endpoints, while intercepting the Google provider boundary and run responses for deterministic continuation/verification cases. Backend tests execute the actual route, storage and comparison code with controlled analyzer/provider boundaries. These are not claims that production Google, MongoDB, D1 or the browser worker have been verified.

Start an isolated review server in PowerShell without replacing the normal development server:

```powershell
$env:AUDIFOX_BUILD_DIR='.data/next-launch-review-webpack'
$env:AUTH_URL='http://localhost:3001'
$env:AUTH_SECRET='launch-review-test-only-secret-32-characters-long'
$env:GOOGLE_CLIENT_ID='launch-review-test.apps.googleusercontent.com'
$env:GOOGLE_CLIENT_SECRET='launch-review-test'
$env:AGENT_BROWSER_MODE='portable'
$env:MONGODB_URI=''
$env:DODO_PAYMENTS_API_KEY=''
$env:INVESTIGATIONS_DEV_DIR='.data/launch-review'
node node_modules/next/dist/bin/next dev --webpack -p 3001
```

These credentials are public test constants, valid only for the isolated local review server. Never put them in production. In another terminal, run `npm run test:browser`. Chrome must be installed or `CHROME_EXECUTABLE_PATH` set. Review screenshots, browser results and downloaded PDF under `.data/launch-review-qa/`. Test fixtures are confined to `.data/launch-review/`, not normal development history. The test signer and fixtures deliberately do not simulate a real Google login.

## Required launch decisions

1. Product owner: approve the draft privacy/terms wording, service identity and any required legal terms; choose retention periods, deletion scope and completion deadline, and assign an operator to fulfill deletion requests. Current code has no automatic expiry or self-service deletion. Confirm `govindwork902@gmail.com` is monitored for support, billing and deletion requests.
2. Product owner/billing: confirm the displayed Pro USD 9 and Studio USD 24 monthly prices against the actual Dodo products. Approve failure/queued-run allowance policy, cancellation/refund handling and tax disclosures. Shared seats and priority queue are not implemented and are no longer advertised.
3. Engineering: apply migrations, verify persistent storage, environment secrets, worker token/network restrictions, host execution windows and storage capacity. `after` prevents browser disconnect from canceling persistence; it does not create an unlimited job lifetime or a restartable durable queue. Runs exceeding their execution window become failed and retain collected events.
4. Engineering/product: complete a production journey on mobile and desktop using a real Google account, then review a genuine browser-worker report, screenshot ownership, targeted verification, PDF, billing update, failure recovery and deletion operation. Verify Gemini availability and the portable/browser mode displayed to users. The live local portable smoke check succeeded while AI enrichment was unavailable; AI absence does not produce invented findings.
5. Accessibility/release: perform a screen-reader and target-browser/device smoke test and approve every P0 item or record an explicit owner waiver. CSS viewport emulation and automated checks do not replace that sign-off.

Do not approve broader launch while these P0 production/policy checks remain outstanding.
