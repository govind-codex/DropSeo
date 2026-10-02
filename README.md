Under Construction

## Investigation history

Investigations and all streamed evidence are saved on the server. Sites uses the
`DB` D1 binding declared in `.openai/hosting.json`; apply the SQL migrations in
`drizzle/` before starting a local Workers preview. Hosted Sites applies these
packaged migrations during deployment.

For Next.js deployments (including Vercel), configure `CLOUDFLARE_ACCOUNT_ID`,
`INVESTIGATIONS_D1_ID`, and `INVESTIGATIONS_D1_TOKEN` for a persistent D1 database.
The token needs D1 read/write permission; keep it server-side. Apply the same
`drizzle/*.sql` migrations to that database. Production fails closed if durable
storage is missing. Next development uses `.data/investigations` (gitignored),
or `INVESTIGATIONS_DEV_DIR` for an explicit local directory.

The browser worker requires `AGENT_WORKER_TOKEN` on both the web app and worker.
Workflow and run memory are isolated by authenticated owner. Old browser-only
summaries cannot be migrated safely: they contain neither ownership nor complete
evidence. All new investigations are saved, including ongoing and interrupted
runs. Verification creates a new history entry and retains the original report.
Positive matching pass evidence is required for Fixed; incomplete evidence is
Unverified. Closing a tab does not cancel server-side event persistence, subject
to the hosting platform's execution timeout.
