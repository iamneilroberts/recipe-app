# recipe-app

An MCP-based recipe-capture app in the shape of a claude.ai connector — a Cloudflare Worker
exposing a StreamableHTTP MCP server, where the **user's own Claude subscription does all the AI
work** (recipe extraction, translation, meal planning, substitutions) so the server pays for zero
inference.

Capture a recipe from any recipe webpage or video-with-transcript into a clean, ad-free, searchable
library; scale servings, cook step-by-step, build grocery lists and meal plans, tag for allergies,
translate, and share.

## Status

Concept / pre-build. The full design and phased build plan lives at:

- [`docs/plans/2026-08-27-plate-it-mcp-clone-plan.md`](docs/plans/2026-08-27-plate-it-mcp-clone-plan.md)

Start there — it covers the architecture, feature set, data model, MCP tool surface, the tiered
video-ingestion plan (probe-gated), the phased milestones, and the conventions to carry over.
