import { env } from "cloudflare:workers";
export type InvestigationDocumentStore = {
  save(record: unknown): Promise<void>;
  get(userId: string, id: string): Promise<unknown | null>;
  list(userId: string): Promise<unknown[]>;
};
export function investigationDatabase(): D1Database | null { return env.DB || null; }
export function investigationDocumentStore(): InvestigationDocumentStore | null { return null; }
