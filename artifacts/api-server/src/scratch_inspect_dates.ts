import { UnifiedAnalysisEngine } from "./lib/unifiedAnalysisEngine";

async function inspectDates() {
  const res = await UnifiedAnalysisEngine.analyze({ query: "تمر", displayQuery: "تمر", inputType: "text" });
  console.log("تمر report:", JSON.stringify(res.report, null, 2));
}

inspectDates();
