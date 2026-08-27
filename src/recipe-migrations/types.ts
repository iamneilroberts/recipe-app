// Recipe-JSON migration registry types (ported shape from voygent-lite
// src/trip-migrations).
//
// LOAD-BEARING CONVENTION (see README + the design refinement doc): any PR that
// changes what a renderer / meal-plan / grocery-list path EXPECTS from a recipe
// JSON record MUST ship a migration here in the SAME PR, with an idempotency
// fixture test. Treat a shape-expectation change without a migration the way
// you'd treat a D1 schema change without a migration file.
//
// A migration is a pure function pair:
//   applies(recipe) → does this recipe need the transform?  (false ⇒ stamp only)
//   migrate(recipe) → the transformed recipe                (must be idempotent)
// The runner stamps each migration id into recipe.meta.appliedMigrations so a
// migration never runs twice, and preserves meta.lastModified (a migration is
// not a user edit).

// Recipe is intentionally `unknown`-ish in Phase 0: the concrete schema lands in
// Phase 1 with the real writer (`import_recipe`). Migrations operate structurally
// so they don't need the full type here.
export type RecipeRecord = Record<string, unknown> & {
  meta?: { appliedMigrations?: string[]; lastModified?: number };
};

export interface RecipeMigration {
  /** Stable, date-prefixed id, e.g. "2026-09-01-add-allergens-array". */
  id: string;
  description: string;
  /** Pure predicate: does this record need the transform? */
  applies: (recipe: RecipeRecord) => boolean;
  /** Pure, idempotent transform. Only called when applies() is true. */
  migrate: (recipe: RecipeRecord) => RecipeRecord;
}
