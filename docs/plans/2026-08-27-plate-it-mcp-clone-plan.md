# Build plan — "Plate It" clone as an MCP connector (recipe capture, organize, cook, share)

**Status:** concept → ready for a fresh build session
**Author:** design session, 2026-08-27
**Branch:** `claude/voygent-plate-it-concept-ida3oa`
**Origin:** Reddit "Plate It" app (recipe capture from any video/webpage into a clean, ad-free, searchable library with translation, grocery lists, meal plans, tags, sharing). Screenshot in the seed conversation.

---

## 0. TL;DR for the next session

Build a **consumer recipe app shaped exactly like Voygent** — a Cloudflare Worker exposing a StreamableHTTP MCP server at `/mcp`, consumed as a **claude.ai connector**, so the **user's own Claude subscription does all the AI work** (extraction, translation, meal planning, substitutions) and the server pays for **zero inference**. The domain objects rename almost 1:1 from Voygent:

| Voygent | This app ("Recipe Box" working name) |
|---|---|
| Trip (workspace record) | **Recipe** / **Cookbook** (collection) |
| Folio (HTML → R2, hosted URL) | **Recipe page** (clean, ad-free, print/cook-mode) |
| Board (compare-and-pick) | **Meal plan** / **Grocery list** builder |
| `import_from_url` / `clean_fetch` / `smart_ingest` | recipe ingestion from URL/paste/photo |
| `manage_annotations`, tags | allergy/diet/cuisine tags, personal notes |
| `share_folio` / `publish_folio` | share a recipe or cookbook |
| `find_trips` / `search_trip_content` | search the whole library |
| trip-migrations registry + fixture discipline | recipe-schema migrations + fixture discipline |

**MVP = webpage + YouTube-with-captions ingestion.** Short-form social video (TikTok/IG/FB spoken-only recipes) is the genuinely hard part and is gated behind a probe (Phase 4), not assumed.

**Recommended repo decision:** a **fresh repo** that *lifts the scaffolding patterns* from voygent-lite (Worker + MCP wiring, per-user URL+token auth, KV/D1/R2 storage contract, render-to-R2, migration registry, fixture rules) rather than forking the travel domain. See §9.

---

## 1. Why the Voygent architecture fits

Both products are the identical pipeline: **ingest an arbitrary URL/video → extract to a structured record → store → tag/search/organize → render a clean view → share.** Voygent already does every step for trips. The only fundamentally new capability is *spoken-word video transcription*, and even that tiers into an easy 80% (text is available) and a hard 20% (audio/on-screen-text only).

The **economic differentiator is the connector model.** Because the LLM is the user's Claude, every conversational operation is free to the operator: *"import this, make it gluten-free, halve it, and add it to Thursday's plan"* is one turn, no server-side inference bill. A hosted-inference competitor (likely including Plate It itself) eats that cost per user. This is the strongest reason to build it this way, and it should be stated up front in any pitch.

---

## 2. Brainstorm — feature set

Grouped by surface. **★ = MVP.** Everything else is post-MVP unless noted. Items marked *(free)* cost the operator nothing because the user's Claude does the reasoning.

### 2.1 Capture / ingestion
- ★ **URL ingest** — any recipe webpage → structured recipe. *(reuse `clean_fetch`/`import_from_url` pattern; recipe sites also expose schema.org `Recipe` JSON-LD, which makes extraction near-deterministic — parse it first, fall back to LLM.)*
- ★ **Paste ingest** — paste raw recipe text / a screenshot's text → structure it. *(free)*
- ★ **YouTube ingest** — pull captions + description → recipe. Long-form cooking videos usually carry the recipe in the description too.
- **Photo / cookbook-page OCR** — snap a cookbook page or handwritten card; the user's multimodal Claude reads it. *(free; huge ease-of-use win, no ASR infra)*
- **Short-form social video** — TikTok/IG Reels/FB. **Probe-gated (Phase 4).** Tiered fallback: post caption → pinned/description text → ASR API → vision-over-frames.
- **Batch import** — paste a list of URLs; ingest all.
- **Email-in address** — forward a recipe link to `save@…`; it ingests and lands in the library. (Removes "paste into chat" friction; a Worker email route.)
- **De-dup on ingest** — detect "you already saved this" by canonical URL + title/ingredient fingerprint.
- **Fidelity flags** — when extraction is uncertain (spoken-only video), mark low-confidence fields for review instead of silently guessing.

### 2.2 Structuring / enrichment *(all free — user's Claude)*
- ★ **Canonical ingredient parse** — `{qty, unit, item, prep, optional}` per line; normalize units.
- ★ **Auto-tags** — cuisine, meal type, protein, difficulty, total time, dietary (vegan/keto/GF), **allergens**.
- **Nutrition estimate** — per-serving estimate with a clear "estimated" disclaimer (LLM estimate MVP; optional nutrition API later for accuracy).
- **Always preserve source** — keep original URL + raw extracted text/transcript so every extraction is auditable and creators are credited (matters for TOS — §12).

### 2.3 Organize
- ★ **Cookbooks/collections** (folders) + ★ **tags** (allergy, diet, cuisine, occasion, season).
- ★ **Search everything** — full-text + tag + facet (time, protein, diet). *(reuse `search_trip_content` shape.)*
- **Smart collections** — saved searches ("weeknight <30 min chicken").
- **Favorites, star rating, cooked-count, last-cooked date.**
- ★ **Personal notes & modifications** per recipe ("used half the sugar, added chili"), kept distinct from the original.
- **Version history** — your tweaks vs the source version.

### 2.4 Cook experience (hosted page features)
- ★ **Cook Mode** — step-by-step, large text, **screen-wake-lock**, checkable steps. (Plate It has this toggle.)
- ★ **Serving scaler** — live re-compute of quantities on +/- servings. (Plate It shows `Serves 12 −/+`.)
- ★ **Unit toggle** — metric/imperial.
- **Inline timers** — parse "simmer 20 min" into tappable timers on the page.
- **Ingredient check-off** while cooking; **mise-en-place** view (group by prep).

### 2.5 Plan & shop
- ★ **Meal planner** — assign recipes to days on a calendar. *(Board pattern.)*
- ★ **Grocery list** — aggregate ingredients across selected recipes, merge duplicates, group by aisle. *(free reasoning; Board render.)*
- **Pantry** — mark staples you have; grocery list subtracts them.
- **Reverse search** — "what can I make with what I have?" *(free)*
- **Budget estimate** for a list (later; needs price data).

### 2.6 Transform / accessibility *(all free)*
- ★ **Translate** recipe to any language.
- ★ **Ingredient substitutions** ("no buttermilk → milk + vinegar"), **allergy-aware**.
- **Dietary transforms** — "make this vegan / gluten-free / halve the sugar."

### 2.7 Share / social
- ★ **Share a recipe** as a clean hosted page (no ads, no life-story scroll). *(reuse `share_folio`/`publish_folio`.)*
- **Share a cookbook or meal plan.**
- **Household sharing** — a shared library across family members.
- **Export to print-friendly PDF.**
- **Round-trip import** from another user's shared link.

### 2.8 Discovery (later)
- "Cook something similar," weekly suggestions from your own library, seasonal picks. *(free)*

---

## 3. Ease-of-use design principles

1. **One-line, multi-op turns.** The connector's superpower is that "import X, make it vegan, scale to 4, add to Friday, and put it on the grocery list" is a single conversational turn. Design tool granularity so the model can chain these without round-tripping the user.
2. **Deterministic-first extraction.** Parse schema.org `Recipe` JSON-LD before invoking the model; fall back to LLM only when structured data is absent. Cheaper, faster, and higher-fidelity.
3. **Never silently guess.** Low-confidence fields are flagged, not fabricated — especially for video. A wrong quantity in a recipe is a real-world failure (see fixture discipline, §11).
4. **The hosted page carries the "app" polish** — cook mode, scaler, timers, wake-lock live in the R2-hosted HTML, since the connector chat is the control surface but not a great browse/cook surface.
5. **Honest scope on video.** Market "save from any recipe page or video that has a transcript," not "any video," until Phase 4 proves otherwise.

---

## 4. The video problem — tiered plan + probe gate

You (the prior session) correctly flagged video as the hard part. It splits:

- **Tier A — text already present (MVP):** webpages (JSON-LD), YouTube captions + descriptions. Reliable today with `fetch()`-only tooling. There is a `yt-transcript.sh` pattern already used in this repo's tooling for caption pull.
- **Tier B — text adjacent to the video:** TikTok/IG/FB post captions, pinned comments, descriptions. Often contains the full recipe. Needs platform-specific fetch; **probe first** (`/onboard --probe-only`-style: curl-impersonate → Worker `fetch()` → last-resort browser) to learn what each platform exposes to a Worker.
- **Tier C — spoken-only or on-screen-text-only (hard 20%):** requires real infra, not a Worker `fetch()`:
  - **ASR** (Deepgram / AssemblyAI / OpenAI Whisper) — a paid API call; the one place the operator has a marginal cost. Offer as a metered/premium feature.
  - **Vision-over-frames** — Worker pulls + downsamples video, hands frames to the user's multimodal Claude. Heavy for the runtime; prototype before committing.

**Gate:** do **not** build Tier B/C in the MVP. Phase 4 is a probe that returns a per-platform verdict, and only then do we decide what's worth building.

---

## 5. Data model (first cut)

Mirror Voygent's KV/D1 split: a JSON record per recipe (KV or D1 row), an index for listing/search, R2 for rendered pages and uploaded photos.

```
Recipe {
  id, ownerId, createdAt, lastModified,
  source: { type: "url"|"youtube"|"paste"|"photo"|"social", url, fetchedAt, rawText, transcript? },
  title, description, imageUrl,
  servings: { base: number, unit },
  time: { prep, cook, total },   // minutes
  ingredients: [ { qty, unit, item, prep?, optional?, group? } ],
  steps: [ { n, text, timerMinutes? } ],
  tags: { cuisine[], meal[], diet[], allergens[], custom[] },
  nutrition?: { perServing, estimated: true },
  notes?: [ { authorId, text, createdAt } ],
  ratings?: { stars, cookedCount, lastCookedAt },
  fidelity: { confidence: "high"|"medium"|"low", flaggedFields[] },
  meta: { appliedMigrations[], previewUrl?, publishedUrl? }
}
Cookbook { id, ownerId, name, recipeIds[], shared?: {...} }
MealPlan { id, ownerId, days: [ { date, recipeIds[] } ] }
GroceryList { id, ownerId, fromRecipeIds[], items: [ {item, qty, unit, aisle, have?} ] }
```

**Load-bearing convention (lift from Voygent):** any change to what a renderer/board expects from recipe JSON ships a **migration in a registry** (`applies`/`migrate`, idempotent, stamped into `meta.appliedMigrations`) in the same PR, with an idempotency fixture test.

---

## 6. MCP tool surface (first cut)

Keep it small and domain-routed (Voygent's ~30-router lesson: stay well under ChatGPT's ~35-tool cap).

- `import_recipe` — `{source}` → structured Recipe (JSON-LD-first, LLM fallback). Handles url/youtube/paste/photo.
- `read_recipe` / `list_recipes` / `search_recipes` — retrieval + facets.
- `manage_recipe` — patch fields, notes, ratings, tags (single mutate router).
- `manage_cookbook` — create/rename/add/remove.
- `preview_recipe` — render clean recipe page → R2 → hosted URL (cook mode, scaler, timers baked into the HTML/JS).
- `share_recipe` / `publish_recipe` — hosted share/publish.
- `build_meal_plan` — assign recipes to days; render the plan.
- `build_grocery_list` — aggregate + merge + aisle-group across recipes; render.
- `transform_recipe` — translate / substitute / dietary transform (mostly a thin tool; the model does the work, tool persists the result as a version).

Auth + platform: **per-user URL+token** (`/mcp/u/{userId}?token=…`, HMAC-hashed), fresh `McpServer` per request, tools gated by tier (`free` = capture/organize/cook; `premium` = ASR video, nutrition API, household sharing).

---

## 7. Rendering surfaces

All are R2-hosted HTML (Voygent's `preview_folio` → `drafts/<userId>/<id>.html` pattern), theme-aware, mobile-first:
1. **Recipe page** — hero image, meta chips (time/servings/source), ingredients (scalable, checkable), steps (cook mode, timers, wake-lock).
2. **Cookbook / library grid** — the browse wall (the Plate It left rail + grid).
3. **Meal plan** — week calendar.
4. **Grocery list** — aisle-grouped, checkable, printable.

---

## 8. Phased build plan / milestones

- **Phase 0 — Scaffold (1 session).** Fresh repo; Worker + StreamableHTTP `/mcp`; per-user auth; KV/D1/R2 bindings; health check; one trivial tool (`ping`) reachable as a claude.ai connector. Lift the wiring from voygent-lite `src/worker.ts` + `src/mcp/server.ts`.
- **Phase 1 — Ingest + store + read (MVP core).** `import_recipe` (JSON-LD-first, LLM fallback), `read_recipe`, `list_recipes`. Recipe schema + migration registry + first fixtures **derived from the real writer**.
- **Phase 2 — Render + cook.** `preview_recipe` → R2 hosted page with cook mode, serving scaler, unit toggle, inline timers, wake-lock.
- **Phase 3 — Organize + search + share.** Cookbooks, tags, `search_recipes` with facets, `share_recipe`/`publish_recipe`.
- **Phase 4 — Video probe (GATE).** Probe YouTube-captions (confirm), then TikTok/IG/FB for what a Worker `fetch()` can reach. Output a per-platform verdict doc. Decide Tier B/C scope from evidence, not assumption.
- **Phase 5 — Plan + shop.** `build_meal_plan`, `build_grocery_list` (aggregate/merge/aisle), pantry.
- **Phase 6 — Transforms + premium.** Translate/substitute/dietary; then metered ASR video + nutrition API as premium tier.

Ship Phases 0–3 before touching video beyond YouTube captions. That's a genuinely useful product on its own.

---

## 9. Repo & stack decision

**Recommendation: fresh repo, lift patterns.** Fork carries the entire travel domain (suppliers, tiers catalog, trip vocabulary) as dead weight and confuses the vocabulary. Instead copy-port the *scaffolding*:
- Worker + `agents/mcp` StreamableHTTP handler, fresh-`McpServer`-per-request pattern.
- Per-user URL+token auth (HMAC-in-D1).
- KV-keys / index / validation storage contract shape.
- `preview_*` → R2 render-and-host pattern.
- Migration registry + fixture discipline (§11).
- Deploy split (dev/staging/prod) + smoke gate.

Stack: TypeScript, Cloudflare Workers (`nodejs_compat`), Wrangler, Vitest. No Playwright/Node-only deps in the request path (same discipline as Voygent adapters).

**Open decision for the human:** confirm fresh-repo vs. monorepo-subdir, and the product name (working name "Recipe Box"; "Plate It" is the source app's name — pick our own).

---

## 10. Reuse map (concrete lift targets in voygent-lite)

When Phase 0 starts, read these as templates (do not import at runtime — copy-port):
- `src/worker.ts` — CORS + bearer/per-user auth + routing.
- `src/mcp/server.ts` — `createVoygentLiteServer` build-per-request + tool registration pattern.
- `src/shared/kv-keys.ts`, `trip-index.ts`, `validation.ts` — storage contract shape.
- `preview_folio` renderer path — R2 write + hosted URL + `meta.previewUrl` write-back.
- `src/trip-migrations/registry.ts` — migration registry shape (`applies`/`migrate`, idempotency fixtures).
- `scripts/deploy.sh` + `npm run deploy:dev|prod` — dev/prod separation + smoke gate.
- `src/adapters/expedia-taap/parser-cars.ts` `curateTaapCars` — the "fetch-all then curate + facets" result-shaping pattern, useful for search results.

---

## 11. Non-negotiable conventions to carry over

1. **Fixtures derived from the real writer, never hand-shaped to the reader.** Recipe fixtures must come from `import_recipe`'s actual output, not authored to match what the renderer wants. (Voygent #750/#791: reader-shaped fixtures hid a defect for the entire life of the feature.)
2. **Dates in fixtures are relative, never hardcoded.** (Voygent #729.)
3. **Shape-expectation change ⇒ migration in the same PR**, with an idempotency fixture.
4. **Never silently truncate** search/list results — carry a `truncated` flag + facets so the model knows the shape it holds.

---

## 12. Risks & open questions

- **Creator TOS / attribution.** Scraping recipe sites and re-hosting a clean copy has copyright/TOS exposure. Mitigations: always preserve + display source link and creator; store the extracted recipe as the user's personal copy; keep sharing user-scoped; get legal read before any *public* recipe directory. **Flag this to the human before Phase 3 sharing ships.**
- **Extraction fidelity.** A wrong quantity is a real failure. Hence JSON-LD-first, confidence flags, and fixture discipline.
- **Nutrition accuracy.** LLM estimates must be labeled "estimated"; don't imply medical precision.
- **Short-form video reality.** "Any video" is marketing until Phase 4 proves per-platform reachability. Under-promise.
- **Browse UX ceiling.** The connector chat isn't a great idle-browse surface; the hosted grid page carries that. Accept that this is a chat-first product with hosted pages, not a native app.
- **ASR cost.** Tier C is the one place with a marginal per-use cost — meter it behind premium.

---

## 13. First-session concrete steps

1. Confirm with the human: fresh repo vs subdir, product name, and whether the connector targets claude.ai (recommended) and/or ChatGPT.
2. Scaffold Phase 0 (Worker + `/mcp` + per-user auth + KV/D1/R2 + `ping`), deploy to a dev environment, and connect it as a claude.ai connector to prove the loop end-to-end.
3. Build `import_recipe` (JSON-LD-first) against 5–10 real recipe URLs; write fixtures from its real output.
4. Add `preview_recipe` → R2 hosted page with cook mode + scaler.
5. Only then schedule the Phase 4 video probe.

---

*Companion context:* seed conversation compared Plate It to Voygent and concluded the architectures match ~1:1, with video as the sole genuinely-new capability. This plan operationalizes that: reuse the scaffolding, ship the text-ingestion product first, probe video before believing "any video."
