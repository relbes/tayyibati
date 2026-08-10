import { normalize, stripArticle, extractBaseEntity } from "./lib/arabicNormalization";
import { CanonicalSearchEngine, SearchMode } from "./lib/canonicalSearchEngine";

async function debugKhubz() {
  const q = "خبز شراك";
  console.log("normalize:", normalize(q));
  console.log("stripArticle:", stripArticle(q));
  console.log("extractBaseEntity:", extractBaseEntity(q));

  const res = await CanonicalSearchEngine.search({ query: q, mode: SearchMode.TEXT, debug: true });
  console.log("Search Result:", JSON.stringify(res, null, 2));
}

debugKhubz().catch(console.error);
