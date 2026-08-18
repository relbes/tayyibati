import { CanonicalSearchEngine } from "./lib/canonicalSearchEngine";
import { UnifiedAnalysisEngine } from "./lib/unifiedAnalysisEngine";

async function inspectMaqluba() {
  const res = await CanonicalSearchEngine.searchEntities("مقلوبة", { debug: true });
  console.log("Maqluba searchEntities:", JSON.stringify(res, null, 2));

  const legacy = await CanonicalSearchEngine.search("مقلوبة", { debug: true });
  console.log("Maqluba legacy search:", JSON.stringify(legacy, null, 2));

  const uRes = await UnifiedAnalysisEngine.analyze({ query: "مقلوبة", displayQuery: "مقلوبة", inputType: "text" });
  console.log("Maqluba unified report:", JSON.stringify(uRes.report, null, 2));
}

inspectMaqluba();
