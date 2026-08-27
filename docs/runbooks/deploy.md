# Runbook — provision & deploy the recipe MCP Worker

These commands run from **your local terminal** (or any machine with `wrangler` logged into your
Cloudflare account) — **not** from a Claude Code remote session, which has no Cloudflare
credentials. Each command creates a real resource in your Cloudflare account and either prints an id
you paste into `wrangler.toml` or is interactive.

One-time provisioning per environment; after that, deploys are just `npm run deploy:*`.

---

## 0. Get the code and authenticate

```bash
git clone https://github.com/iamneilroberts/recipe-app.git
cd recipe-app
git checkout claude/recipe-app-design-jyi20b   # or main, once merged
npm install
wrangler login          # opens a browser — or: export CLOUDFLARE_API_TOKEN=...
```

Verify locally before touching Cloudflare:

```bash
npm run typecheck       # tsc over src + tests
npm test                # vitest (8 tests)
```

---

## 1. Create the stores (production / top-level env)

Two of these print an id you must paste into `wrangler.toml`. The R2 bucket is referenced by name,
so it needs no id.

```bash
wrangler kv namespace create RECIPES
#   → id = "abc123…"          paste over REPLACE_ME_KV_ID   ([[kv_namespaces]])

wrangler d1 create recipe-app
#   → database_id = "def456…" paste over REPLACE_ME_D1_ID   ([[d1_databases]])

wrangler r2 bucket create recipe-media
#   → no id needed
```

**These ids are NOT secrets** — commit them in `wrangler.toml` (the standard pattern). Only
`wrangler secret` values and `.dev.vars` stay out of git.

---

## 2. Apply the D1 schema and set the token-hash secret

Order matters: the D1 id from step 1 must already be in `wrangler.toml` — `migrations apply` reads
the database reference from that file.

```bash
wrangler d1 migrations apply recipe-app --remote    # creates the users table (migrations/0001_init.sql)
wrangler secret put TOKEN_HASH_KEY                  # paste the output of:  openssl rand -hex 32
```

`--remote` targets the real Cloudflare D1, not a local simulation. `secret put` is interactive and
stores the value encrypted in Cloudflare; it never touches the repo.

`TOKEN_HASH_KEY` is the HMAC key used to fingerprint per-user connector tokens
(`src/crypto/hash.ts`). Treat it like a signing key: rotating it invalidates every existing
connector URL, so pick it once per environment and keep it stable.

---

## 3. Deploy

```bash
npm run deploy:prod     # production   (wrangler deploy)
```

Smoke it:

```bash
curl https://<your-worker-host>/health
#   → {"ok":true,"server":"recipe-app","version":"0.0.1","env":"production"}
```

`/health` returning that JSON is the first proof the Worker is live.

---

## 4. (Optional) Staging is a SEPARATE set of resources

`npm run deploy:dev` targets `--env staging`, which has its own `REPLACE_ME_STAGING_*` slots in the
`[env.staging.*]` blocks. To run staging, create a **second** KV namespace and a **second** D1
database, paste those ids into the staging blocks, and set the staging secret:

```bash
wrangler kv namespace create RECIPES        # paste id → [[env.staging.kv_namespaces]]
wrangler d1 create recipe-app-staging       # paste database_id → [[env.staging.d1_databases]]
wrangler d1 migrations apply recipe-app-staging --remote --env staging
wrangler secret put TOKEN_HASH_KEY --env staging

npm run deploy:dev
```

If you only want production for now, skip this section entirely.

---

## 5. Connect it (private connector)

Until Phase 1 ships a `/admin/mint` route, mint a user by hand: pick a `user_id` and a random token,
HMAC-hash the token with `TOKEN_HASH_KEY`, and insert the row. A throwaway local snippet
(`node`/`tsx`) using `src/crypto/hash.ts`'s `hashToken` produces the fingerprint bytes for the
`mcp_url_token_hash` BLOB. Then add the connector on claude.ai **or** ChatGPT with **"no
authentication"** and this URL:

```
https://<your-worker-host>/mcp/u/<user_id>?token=<the-raw-token>
```

The token rides in the URL, so the same link is a private connector on both hosts. Public directory
listing (which needs OAuth 2.1 + dynamic client registration) is the gated Phase 0.5 — see
`src/auth/oauth.ts`.

---

## Local dev (no Cloudflare account needed)

`wrangler dev` runs with local KV/D1/R2 simulation, so you can exercise the MCP loop without
provisioning anything:

```bash
cp .dev.vars.example .dev.vars    # set TOKEN_HASH_KEY (any random string) and an AUTH_KEYS dev bearer
npm run dev &                     # http://localhost:8787
scripts/smoke.sh local            # /health + tools/list + call ping
```
