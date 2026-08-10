/**
 * Phase 8 Step 2.3 - Runtime migration removed.
 * All ingredient aliases are seeded via database migrations (e.g. 0004_seed_ingredient_aliases.sql).
 */
export async function runPendingIngredientAliasesMigration() {
  // No-op: Runtime database modifications removed during server startup
}
