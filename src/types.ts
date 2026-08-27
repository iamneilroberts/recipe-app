// Authoritative environment interface. Add every new secret / var / binding here
// BEFORE the code that reads it — a missing field is a compile error, which is
// how a credential-gated feature is prevented from silently shipping ungated.

export interface Env {
  // ── Bindings (wrangler.toml) ────────────────────────────────────────────
  /** Per-user recipe records + indexes. */
  RECIPES: KVNamespace;
  /** Auth (users table) — see migrations/0001_init.sql. */
  DB: D1Database;
  /** Rendered recipe pages (HTML) + uploaded photos. */
  MEDIA: R2Bucket;

  // ── Vars (wrangler.toml [vars]) ─────────────────────────────────────────
  WORKER_ENV?: string;
  WORKER_BASE_URL?: string;

  // ── Secrets (wrangler secret put / .dev.vars) ───────────────────────────
  /** HMAC key for hashing per-user connector tokens. Required for /mcp/u auth. */
  TOKEN_HASH_KEY?: string;
  /** Transitional dev bearer allowlist (comma-separated) for the /mcp?key= path. */
  AUTH_KEYS?: string;
}
