import { UnifiedAnalysisEngine } from "./lib/unifiedAnalysisEngine";

async function testZingerAnalysis() {
  console.log("==================================================");
  console.log("TESTING UNIFIED ANALYSIS ENGINE FOR 'زنجر'");
  console.log("==================================================");

  const res = await UnifiedAnalysisEngine.analyze({ query: "زنجر", inputType: "text" });
  console.log("Report Output:");
  console.log(JSON.stringify(res.report, null, 2));
}

testZingerAnalysis().catch(console.error);
