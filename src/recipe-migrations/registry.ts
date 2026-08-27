import type { RecipeMigration, RecipeRecord } from "./types";

/**
 * Ordered recipe-JSON migration registry.
 *
 * AUTHORING CONVENTION (see types.ts): any PR that changes what a renderer /
 * meal-plan / grocery-list path EXPECTS from a recipe record ships a migration
 * here, in the same PR, with an idempotency fixture test in registry.test.ts.
 */
export const MIGRATIONS: RecipeMigration[] = [
  {
    // Documented no-op baseline: the pattern for future entries. applies()=false
    // for every recipe, so runMigrations stamps it without transforming anything.
    id: "2026-08-27-registry-baseline",
    description: "No-op baseline documenting the migration pattern; stamps only.",
    applies: () => false,
    migrate: (recipe) => recipe,
  },
];

/**
 * Apply every not-yet-applied migration to a recipe record, in order. Pure and
 * idempotent: re-running over an already-migrated record is a no-op that returns
 * an equivalent record. Stamps each applied (or applicable-but-skipped) id into
 * meta.appliedMigrations; preserves meta.lastModified (a migration is not an
 * edit).
 */
export function runMigrations(
  input: RecipeRecord,
  migrations: RecipeMigration[] = MIGRATIONS,
): RecipeRecord {
  let recipe = input;
  const applied = new Set(recipe.meta?.appliedMigrations ?? []);

  for (const m of migrations) {
    if (applied.has(m.id)) continue;
    if (m.applies(recipe)) {
      recipe = m.migrate(recipe);
    }
    applied.add(m.id);
  }

  const priorLastModified = input.meta?.lastModified;
  return {
    ...recipe,
    meta: {
      ...recipe.meta,
      appliedMigrations: [...applied],
      ...(priorLastModified !== undefined
        ? { lastModified: priorLastModified }
        : {}),
    },
  };
}
