# Design refinement — dual-target (claude.ai + ChatGPT) recipe connector

**Status:** design refinement, session 2026-08-27
**Supersedes nothing** — this is a companion to `2026-08-27-plate-it-mcp-clone-plan.md`. Read that
first for the full feature set, data model, and phasing. This doc records the four decisions locked
this session and pressure-tests the plan against them.

---

## Decisions locked this session

1. **Build in this repo** (`iamneilroberts/recipe-app`) — fresh, lifting Voygent's *scaffolding*
   patterns (Worker + StreamableHTTP `/mcp`, per-user auth, KV/D1/R2, migration registry, fixture
   discipline). Not a fork of the travel domain.
2. **Product name deferred.** Consequence, made load-bearing below: **wire contracts must be
   name-independent.** Tools are named by function (`import_recipe`), never by brand
   (`platit_import`). Only the marketing name + hosted subdomain carry the brand, and both are
   swappable without a wire-contract migration. This is the Voygent "phased rename, keep wire
   contracts" lesson applied *before* we incur the debt.
3. **This session = refine the design.** No code.
4. **Target BOTH claude.ai and ChatGPT.** This is new vs. the original plan and drives everything
   below.

---

## The dual-target decision changes four things

The original plan assumed a claude.ai-only connector. Supporting ChatGPT too is not "the same
server, one more client" — it forks auth, rendering, and the extraction-quality assumption. None of
these are hard, but they must be designed in, not discovered.

### Fork 1 — Auth: URL+token works for both as a *private* connector; a *directory* listing needs OAuth

This is the sharpest new fork.

- **Voygent's per-user URL+token** (`/mcp/u/{userId}?token=<hmac-checked>`) bakes the credential
  into the connector URL each user pastes. Both claude.ai *and* ChatGPT can add a remote MCP server
  by URL with **"no authentication"** selected, because the credential rides in the URL and the
  server validates it. So the Voygent auth pattern is **already dual-client friendly for private /
  self-serve connectors** — this is a reason to lift it verbatim, not replace it.
- **The catch:** public distribution changes the requirement. The **ChatGPT Apps directory** (and
  claude.ai's connector directory) will expect a real **OAuth 2.1 authorization-server** surface
  with dynamic client registration — a static token-in-URL won't pass directory review. A query
  token is also weaker (logs, referrer leakage) than an `Authorization` header the host injects per
  request.
- **Recommendation:** ship URL+token for the MVP (works on both hosts as a private connector,
  unblocks the whole build), and treat **OAuth 2.1 + DCR as its own gated phase**, entered only if
  and when we decide to pursue public directory distribution. Do **not** let OAuth block the
  claude.ai/ChatGPT MVP loop. → new **Phase 0.5 (optional, gated): OAuth AS** in the phasing below.

### Fork 2 — Rendering: the R2 hosted page is the universal surface; ChatGPT inline widgets are a later enhancement

- claude.ai connectors have **no native inline UI** — the model narrates, and polish (cook mode,
  scaler, timers, wake-lock) lives on the **R2-hosted HTML page** reached by a link. That's the
  plan's §4/§7 and it's correct.
- **ChatGPT's Apps SDK** *does* support inline rendered components (widgets) returned alongside tool
  results. Tempting — but building native widgets is a **second rendering path** and a ChatGPT-only
  divergence.
- **Recommendation:** the **R2 hosted page is the single universal surface** for the MVP — a link
  works identically in both hosts and on mobile. Native ChatGPT widgets are a **post-MVP,
  ChatGPT-specific enhancement**, never a blocker and never the source of truth. One renderer,
  hosted, theme-aware, mobile-first.

### Fork 3 — Extraction can't assume Claude-quality reasoning → deterministic-first is now mandatory, not preferred

- On claude.ai, extraction reasoning is Claude's. On ChatGPT it's GPT's. Fidelity must not depend on
  which host model called the tool.
- The plan's §3.2 "deterministic-first" (parse schema.org `Recipe` **JSON-LD** server-side before
  any model involvement) was a *preference*. Under dual-target it is **load-bearing**: the reliable
  path produces the same structured record regardless of host model, and the model is only the
  fallback for sites with no structured data. This raises JSON-LD parsing from "nice optimization"
  to "the primary ingestion path."

### Fork 4 — Tool-count budget: ChatGPT ~35-tool cap → hold the router discipline

- The plan's ~10 domain-routed tools sit comfortably under ChatGPT's ~35 cap. No change needed —
  but the cap is now a **hard constraint**, not a Voygent anecdote. Keep the surface router-shaped
  (one mutate router per domain), and never let per-supplier/per-action tool sprawl creep back in.

---

## Sharpening the tool boundary: who extracts?

The plan's single `import_recipe` handling `url | youtube | paste | photo` hides a real MCP
boundary that must be explicit, because **in a connector the server never sees the user's image or
does OCR — the host multimodal model does.** So `import_recipe` actually has **two distinct modes**:

- **Mode A — server-fetch (deterministic).** Caller passes a `url`. The **server** fetches, parses
  JSON-LD → structured Recipe with **zero model involvement**. This is the cheap, reliable, host-
  model-agnostic path (Fork 3). If the page has no JSON-LD, the server returns **cleaned text plus a
  `needsStructuring` flag** so the host model can structure it and call back in Mode B.
- **Mode B — model-supplied (structured).** Caller passes an **already-structured recipe** the host
  model produced — from reading a **photo/cookbook page** (the model did the OCR, free, no server
  ASR/OCR infra), a **paste**, or a **transcript**. The server **validates + persists**; it does not
  re-extract.

This split matters:
- "Photo ingest" is not server OCR — it's *the model reads the image → Mode B*. Free, no infra,
  works on any multimodal host. The tool contract must accept model-supplied structured input, or
  photo ingest is impossible to wire.
- It keeps the deterministic path (Mode A) and the model path (Mode B) auditable and separately
  testable. **Fixtures for Mode A derive from the real JSON-LD parser; fixtures for Mode B derive
  from the real validator** — each against its real writer (§11 discipline).

---

## New risk the plan understates: recipe sites fight scrapers too

Voygent learned that supplier sites gate `fetch()` behind Cloudflare/Akamai anti-bot. **Recipe
sites are the same** — many big ones sit behind Cloudflare and will 403/challenge a bare Worker
`fetch()`. So Mode A is not "always works":

- Try Worker `fetch()` with **impersonation headers** (the curl-impersonate lesson) first.
- On block, **fall back to asking the user to paste** the recipe (→ Mode B) rather than silently
  failing or fabricating. The host model can sometimes fetch the page itself in-context and hand
  structured data to Mode B — but never assume it.
- **This means a `/onboard --probe-only`-style reachability probe is worth running against the top
  ~20 recipe domains early** (cheap, falsifiable), so we know the real Mode-A hit rate before we
  promise "import from any recipe page." Same under-promise discipline as the video tiers.

---

## Revised phasing (deltas from plan §8 only)

Unchanged phases 1–3, 5–6 stand. Inserts/edits:

- **Phase 0 — Scaffold.** Add: prove the connect loop on **both** claude.ai **and** ChatGPT with the
  same URL+token connector + `ping`, not just claude.ai. This retires the dual-target risk on day
  one, when it's cheapest.
- **Phase 0.5 — OAuth AS (GATED, optional).** OAuth 2.1 authorization server + dynamic client
  registration. Entered **only** if we decide to pursue public directory distribution on either
  host. Not on the MVP critical path.
- **Phase 1 — Ingest.** Make the **Mode A / Mode B split** explicit in `import_recipe`. Add a
  **recipe-domain reachability probe** (top ~20 sites) as an early falsifiable check on the Mode-A
  hit rate. JSON-LD parser is the primary path; model fallback is secondary.
- **Phase 2 — Render.** One universal R2 hosted page. **ChatGPT native widgets explicitly deferred**
  to a later, optional, ChatGPT-only enhancement.

Ship 0 → 3 before any video work beyond YouTube captions. That's a complete, dual-host, useful
product.

---

## Open questions still needing a human (unchanged + new)

Carried from plan §12, plus new from dual-target:

- **Public directory distribution?** — decides whether Phase 0.5 (OAuth AS) is ever built. If the
  product is "paste your private connector URL," we may never need it. (New.)
- **ChatGPT native widgets — worth a second rendering path later?** Or is the hosted link enough
  forever? (New.)
- **Creator TOS / attribution** before any *public* sharing (plan §12) — unchanged, still the
  biggest legal gate; personal-copy + always-show-source is the mitigation.
- **Name** — deferred, but must be chosen before the first *public* hosted page / any directory
  submission, since the subdomain and marketing name bind then (wire contracts stay name-free
  regardless).
