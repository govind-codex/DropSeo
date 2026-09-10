declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    GEMINI_API_KEY?: string;
    GEMINI_MODEL?: string;
    AGENT_WORKER_URL?: string;
    AGENT_WORKER_TOKEN?: string;
  }
}
