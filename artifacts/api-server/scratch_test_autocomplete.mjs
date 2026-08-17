import { CanonicalSearchEngine } from "./dist/index.mjs";

async function run() {
  console.log("=== TESTING AUTOCOMPLETE QUERIES ===");
  const queries = ["ش", "شا", "شاو", "شاور", "شاورما", "منسف", "من"];
  for (const q of queries) {
    const res = await CanonicalSearchEngine.search(q, { mode: "AUTOCOMPLETE" });
    console.log(`\nQuery: "${q}" -> Outcome: ${res?.searchOutcome}`);
    if (res?.candidateDishes) {
      console.log(`  Candidate items count: ${res.candidateDishes.length}`);
      res.candidateDishes.forEach((c, idx) => {
        console.log(`  ${idx + 1}. [${c.canonicalEntityType}] ${c.canonicalName} (Conf: ${c.searchConfidence}, Method/Type: ${c.matchedReason})`);
      });
    } else if (res) {
      console.log(`  1. [${res.canonicalEntityType}] ${res.canonicalName} (Conf: ${res.searchConfidence})`);
    }
  }
}

run().catch(console.error);
