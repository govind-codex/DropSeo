import { env } from "cloudflare:workers";
export function investigationDatabase(): D1Database | null { return env.DB || null; }
