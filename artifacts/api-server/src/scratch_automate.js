import { execSync } from "child_process";
import fs from "fs";

const queries = [
  "خبز صاج",
  "خبز شراك",
  "شاورما لحم",
  "شاورما دجاج",
  "كبسة لحم",
  "كبسة دجاج"
];

function runCmd(cmd) {
  try {
    return execSync(cmd, { encoding: "utf-8" });
  } catch (err) {
    console.error(`Command failed: ${cmd}`, err.message);
    return "";
  }
}

function parseXmlTexts() {
  try {
    if (!fs.existsSync("./window_dump.xml")) {
      return [];
    }
    const xmlData = fs.readFileSync("./window_dump.xml", "utf-8");
    const regex = /text="([^"]*)"/g;
    let match;
    const texts = [];
    while ((match = regex.exec(xmlData)) !== null) {
      if (match[1].trim()) {
        texts.push(match[1]);
      }
    }
    const descRegex = /content-desc="([^"]*)"/g;
    while ((match = descRegex.exec(xmlData)) !== null) {
      if (match[1].trim()) {
        texts.push(match[1]);
      }
    }
    return Array.from(new Set(texts)); // Deduplicate
  } catch (err) {
    console.error("Error reading window_dump.xml", err);
    return [];
  }
}

console.log("=========================================================");
console.log("MOBILE UI AUTOMATION SEARCH TEST SUITE");
console.log("=========================================================");

const results = [];

const adbPath = `"C:\\Users\\r_elbes\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe"`;

for (const q of queries) {
  console.log(`\nTesting Query: "${q}"...`);

  // 1. Force-stop and restart app to reset state
  runCmd(`${adbPath} shell am force-stop com.tayyibati.app`);
  runCmd(`powershell -Command "Start-Sleep -Seconds 2"`);
  runCmd(`${adbPath} shell monkey -p com.tayyibati.app -c android.intent.category.LAUNCHER 1`);
  console.log("Waiting 18 seconds for full app load...");
  runCmd(`powershell -Command "Start-Sleep -Seconds 18"`);

  // 2. Switch to search tab
  runCmd(`${adbPath} shell input tap 756 2311`);
  runCmd(`powershell -Command "Start-Sleep -Seconds 3"`);

  // 3. Set clipboard and paste text
  runCmd(`powershell -Command "Set-Clipboard -Value '${q}'"`);
  runCmd(`${adbPath} shell input tap 550 433`);
  runCmd(`powershell -Command "Start-Sleep -Seconds 2"`);
  runCmd(`${adbPath} shell input keyevent 279`);
  runCmd(`powershell -Command "Start-Sleep -Seconds 2"`);

  // 4. Trigger Search (ENTER)
  runCmd(`${adbPath} shell input keyevent 66`);
  console.log("Waiting 10 seconds for search analysis to complete...");
  runCmd(`powershell -Command "Start-Sleep -Seconds 10"`);

  // 5. Dump and pull UI layout
  if (fs.existsSync("./window_dump.xml")) {
    fs.unlinkSync("./window_dump.xml");
  }
  runCmd(`${adbPath} shell uiautomator dump /sdcard/window_dump.xml`);
  runCmd(`${adbPath} pull /sdcard/window_dump.xml ./window_dump.xml`);

  // 6. Parse texts
  const texts = parseXmlTexts();
  console.log("Extracted UI Texts:");
  console.log(texts.map(t => `  - "${t}"`).join("\n"));

  results.push({
    query: q,
    texts
  });
}

console.log("\n=========================================================");
console.log("AUTOMATION COMPLETED. RESULTS LOGGED.");
console.log("=========================================================");
fs.writeFileSync("./mobile_ui_test_results.json", JSON.stringify(results, null, 2), "utf-8");
