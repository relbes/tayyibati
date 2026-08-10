const fs = require('fs');
const path = require('path');

const directoryPath = path.resolve(__dirname, 'app');
const componentsPath = path.resolve(__dirname, 'components');

function removeDirectionRtl(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      removeDirectionRtl(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf-8');
      if (content.includes('direction: "rtl"')) {
        content = content.replace(/,\s*direction:\s*"rtl"\s*as\s*any/g, '');
        content = content.replace(/,\s*direction:\s*"rtl"/g, '');
        content = content.replace(/direction:\s*"rtl"\s*as\s*any\s*,?/g, '');
        content = content.replace(/direction:\s*"rtl"\s*,?/g, '');
        fs.writeFileSync(fullPath, content, 'utf-8');
        console.log(`Cleaned ${fullPath}`);
      }
    }
  }
}

removeDirectionRtl(directoryPath);
removeDirectionRtl(componentsPath);
