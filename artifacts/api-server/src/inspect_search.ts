import { CanonicalSearchEngine } from "./lib/canonicalSearchEngine";
import { FoodResolutionEngine } from "./lib/foodResolutionEngine";
import { UnifiedAnalysisEngine } from "./lib/unifiedAnalysisEngine";
import { extractBaseEntityWithModifiers } from "./lib/arabicNormalization";

async function main() {
  const query = "شاورما";
  console.log(`=== RUNNING SEARCH FOR "${query}" ===`);
  
  const ext = extractBaseEntityWithModifiers("شاورما بقري");
  console.log("extractBaseEntityWithModifiers('شاورما بقري'):", ext);
  
  const searchRes = await CanonicalSearchEngine.search(query, { debug: true });
  console.log("CanonicalSearchEngine.search result:", JSON.stringify(searchRes, null, 2));

  const resolveRes = await FoodResolutionEngine.resolve(query, "text", 1.0);
  console.log("FoodResolutionEngine.resolve result:", JSON.stringify(resolveRes, null, 2));

  const analysisRes = await UnifiedAnalysisEngine.analyze({ inputType: "text", query });
  console.log("UnifiedAnalysisEngine.analyze report query:", analysisRes.report.query);
  console.log("UnifiedAnalysisEngine.analyze report resultMode:", analysisRes.report.resultMode);
  console.log("UnifiedAnalysisEngine.analyze report full:", JSON.stringify(analysisRes.report, null, 2));
}

main().catch(console.error);
