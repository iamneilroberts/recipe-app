# recipe-app

An MCP-based recipe-capture app in the shape of a claude.ai / ChatGPT connector — a Cloudflare
Worker exposing a StreamableHTTP MCP server, where the **user's own Claude/GPT subscription does all
the AI work** (recipe extraction, translation, meal planning, substitutions) so the server pays for
**zero inference**.

Capture a recipe from any recipe webpage or video-with-transcript into a clean, ad-free, searchable
library; scale servings, cook step-by-step, build grocery lists and meal plans, tag for allergies,
translate, and share.

> **Product name is deferred.** Everything here is brand-neutral on purpose — tools are named by
> function (`ping`, `import_recipe`), never by brand, so naming later costs no wire-contract
> migration. Only the marketing name + hosted subdomain will carry the brand.

## Status — Phase 0 scaffolded ✅

The connectable skeleton is in place:

- Cloudflare Worker + StreamableHTTP MCP (`agents/mcp`), fresh `McpServer` per request.
- **Per-user URL+token auth** (`/mcp/u/{user_id}?token=…`, HMAC-hashed in D1) — the private-connector
  front door that works on **both claude.ai and ChatGPT**.
- KV / D1 / R2 bindings, D1 `users` migration, per-user KV key contract.
- Recipe-JSON **migration registry** (baseline no-op) + fixture-discipline test.
- Two tools: **`ping`** (health/echo) and **`whoami`** (tier preflight).
- OAuth 2.1 is pre-wired to a documented stub (Phase 0.5, gated on public directory distribution).

### Design docs (read these first)

- [`docs/plans/2026-08-27-plate-it-mcp-clone-plan.md`](docs/plans/2026-08-27-plate-it-mcp-clone-plan.md)
  — the full architecture, feature set, data model, tool surface, video tiering, and phased plan.
- [`docs/plans/2026-08-27-design-refinement-dual-target.md`](docs/plans/2026-08-27-design-refinement-dual-target.md)
  — the dual-target (claude.ai + ChatGPT) pressure-test and the decisions driving Phase 0.

## Develop

```bash
npm install
npm run dev          # wrangler dev on :8787 (reads .dev.vars; local KV/D1/R2 sim)
npm run typecheck    # tsc over src + tests (tsconfig.check.json — NOT a bare tsc)
npm test             # vitest
```

Copy `.dev.vars.example` → `.dev.vars` and set `TOKEN_HASH_KEY` (any long random string locally)
and, optionally, a dev bearer in `AUTH_KEYS`. Then:

```bash
npm run dev &                 # in one shell
scripts/smoke.sh local        # /health + tools/list + call ping, using the dev bearer
```

## Deploy (one-time provisioning first)

The three `REPLACE_ME_*` ids in `wrangler.toml` are the only thing between this repo and a real
deploy. Provision the stores, paste the ids, then deploy:

```bash
wrangler kv namespace create RECIPES
wrangler d1 create recipe-app
wrangler r2 bucket create recipe-media
wrangler d1 migrations apply recipe-app --remote     # applies migrations/*.sql (users table)
wrangler secret put TOKEN_HASH_KEY                    # openssl rand -hex 32

npm run deploy:dev                                    # staging
npm run deploy:prod                                   # production
```

### Connect it (private connector)

Mint a user row (Phase 1 will add a `/admin/mint` route; for now insert into `users` with an
HMAC-hashed token), then add the connector on either host with **"no authentication"** and the URL:

```
https://<your-worker-host>/mcp/u/<user_id>?token=<the-raw-token>
```

The token rides in the URL, so the same link works as a private connector on **claude.ai** and
**ChatGPT**. Public directory listing (which requires OAuth 2.1 + dynamic client registration) is
the gated Phase 0.5 — see `src/auth/oauth.ts`.

## Layout

```
src/
  worker.ts               request routing: CORS, /health, /mcp/u auth, /mcp dev+OAuth
  types.ts                authoritative Env (bindings, vars, secrets)
  auth/
    url-token.ts          per-user URL+token resolution (the front door)
    oauth.ts              Phase 0.5 OAuth 2.1 stub (documented, drop-in)
  crypto/hash.ts          HMAC-SHA256 + constant-time compare
  tier/catalog.ts         THE TIER LOCK — free | premium
  mcp/
    server.ts             createRecipeServer (fresh per request)
    tools/ping.ts         ping + whoami
  shared/kv-keys.ts       per-user KV key contract
  recipe-migrations/      registry + types (shape-change ⇒ migration-in-same-PR)
migrations/0001_init.sql  D1 users table
tests/                    auth hashing + migration idempotency
vendor/ai-stub/           local stub for the agents MCP client's unused import("ai")
```

## Load-bearing conventions (carried from Voygent)

- **Shape-expectation change ⇒ migration in the same PR** (`src/recipe-migrations/`), with an
  idempotency fixture test.
- **Fixtures derive from the real writer**, never hand-shaped to what the reader wants.
- **Dates in fixtures are relative**, never hardcoded.
- **Never silently truncate** list/search results — carry a `truncated` flag + facets.
- Add every new secret/binding to `src/types.ts` `Env` **before** the code that reads it.
