import { describe, it, expect } from "vitest";
import { runMigrations, MIGRATIONS } from "../../src/recipe-migrations/registry";
import type { RecipeMigration, RecipeRecord } from "../../src/recipe-migrations/types";

describe("runMigrations — registry discipline", () => {
  it("stamps the baseline id and is idempotent (run twice == run once)", () => {
    const input: RecipeRecord = { title: "Pancakes" };
    const once = runMigrations(input);
    const twice = runMigrations(once);
    expect(twice).toEqual(once);
    expect(once.meta?.appliedMigrations).toContain("2026-08-27-registry-baseline");
  });

  it("preserves an existing meta.lastModified (a migration is not an edit)", () => {
    const input: RecipeRecord = { title: "Soup", meta: { lastModified: 1234 } };
    const out = runMigrations(input);
    expect(out.meta?.lastModified).toBe(1234);
  });

  it("applies a transform exactly once, then leaves the record alone", () => {
    // A stand-in migration that appends a tag; must be idempotent under the runner.
    const addTag: RecipeMigration = {
      id: "test-add-tag",
      description: "test",
      applies: (r) => !(r as { tags?: string[] }).tags?.includes("x"),
      migrate: (r) => ({ ...r, tags: [...(((r as { tags?: string[] }).tags) ?? []), "x"] }),
    };
    const migrations = [...MIGRATIONS, addTag];

    const first = runMigrations({ title: "T" }, migrations);
    const second = runMigrations(first, migrations);

    expect((first as { tags?: string[] }).tags).toEqual(["x"]);
    // Idempotent: the id is already stamped, so the transform never re-runs.
    expect((second as { tags?: string[] }).tags).toEqual(["x"]);
    expect(second.meta?.appliedMigrations).toContain("test-add-tag");
  });
});
