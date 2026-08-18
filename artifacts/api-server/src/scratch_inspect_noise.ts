import { CanonicalSearchEngine } from "./lib/canonicalSearchEngine";

async function inspectNoise() {
  const noiseQueries = ["زز", "ققق", "سسس", "xyz", "of.", "###", "!!!", "تمر", "خبز", "أرز", "خبز فرنسي", "منسف دجاج"];

  for (const q of noiseQueries) {
    const res = await CanonicalSearchEngine.searchEntities(q, { debug: true });
    console.log(`=== Query: "${q}" ===`);
    console.log(`  queryIntent: ${res.queryIntent}`);
    console.log(`  searchOutcome: ${res.searchOutcome}`);
    console.log(`  displayFoods (${res.displayFoods.length}):`, res.displayFoods.map(f => ({ name: f.canonicalName, conf: f.confidence, method: f.searchMethod })));
    console.log(`  displayDishes (${res.displayDishes.length}):`, res.displayDishes.map(d => ({ name: d.canonicalName, conf: d.confidence, method: d.searchMethod })));
  }
}

inspectNoise();
