import { CanonicalSearchEngine, SearchMode } from "../artifacts/api-server/src/lib/canonicalSearchEngine.js";

async function run() {
  console.log("=== TESTING AUTOCOMPLETE QUERIES ===");
  const queries = ["ش", "شا", "شاو", "شاور", "شاورما", "منسف", "من"];
  for (const q of queries) {
    const res = await CanonicalSearchEngine.search(q, { mode: SearchMode.AUTOCOMPLETE });
    console.log(`\nQuery: "${q}" -> Outcome: ${res?.searchOutcome}`);
    if (res?.candidateDishes) {
      console.log(`  Candidate items count: ${res.candidateDishes.length}`);
      res.candidateDishes.forEach((c, idx) => {
        console.log(`  ${idx + 1}. [${c.canonicalEntityType}] ${c.canonicalName} (Score/Conf: ${c.searchConfidence}, Type: ${c.matchType})`);
      });
    } else if (res) {
      console.log(`  1. [${res.canonicalEntityType}] ${res.canonicalName} (Score/Conf: ${res.searchConfidence})`);
    }
  }
}

run().catch(console.error);
