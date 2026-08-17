import fs from "fs";

try {
  const xmlData = fs.readFileSync("./window_dump.xml", "utf-8");
  const regex = /<node [^>]*>/g;
  let match;
  console.log("Interactive nodes with text/bounds:");
  while ((match = regex.exec(xmlData)) !== null) {
    const nodeStr = match[0];
    const textMatch = /text="([^"]*)"/.exec(nodeStr);
    const boundsMatch = /bounds="([^"]*)"/.exec(nodeStr);
    const classMatch = /class="([^"]*)"/.exec(nodeStr);
    const contentDescMatch = /content-desc="([^"]*)"/.exec(nodeStr);

    const text = textMatch ? textMatch[1] : "";
    const bounds = boundsMatch ? boundsMatch[1] : "";
    const className = classMatch ? classMatch[1] : "";
    const contentDesc = contentDescMatch ? contentDescMatch[1] : "";

    if (text || contentDesc) {
      console.log(`- Text: "${text}" | Desc: "${contentDesc}" | Class: "${className}" | Bounds: ${bounds}`);
    }
  }
} catch (err) {
  console.error(err);
}
