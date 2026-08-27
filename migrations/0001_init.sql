-- Phase 0 — auth schema.
--
-- Per-user URL+token auth is the front door (see docs/plans design refinement,
-- "Fork 1"): each user connects at /mcp/u/{user_id}?token=<random>. The raw
-- token is NEVER stored — only its HMAC-SHA256 fingerprint (mcp_url_token_hash),
-- recomputed and constant-time-compared on every request (src/auth/url-token.ts).
--
-- This same URL+token works as a private connector on BOTH claude.ai and
-- ChatGPT. Public directory distribution (which needs OAuth 2.1 + dynamic client
-- registration) is deferred to the gated Phase 0.5 — see src/auth/oauth.ts.

CREATE TABLE IF NOT EXISTS users (
  user_id             TEXT PRIMARY KEY,
  email               TEXT,
  -- Runtime tier. Exactly 'free' | 'premium' (see src/tier/catalog.ts).
  tier                TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'premium')),
  -- HMAC-SHA256(TOKEN_HASH_KEY, connector_token). 32 raw bytes. Never the token.
  mcp_url_token_hash  BLOB NOT NULL,
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
