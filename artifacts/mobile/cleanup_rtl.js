const fs = require('fs');
const path = require('path');

const files = [
  path.resolve(__dirname, 'app/auth.tsx'),
  path.resolve(__dirname, 'app/forgot-password.tsx')
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf-8');

  // Replace I18nManager.isRTL with isRTL()
  content = content.replace(/I18nManager\.isRTL/g, 'isRTL()');
  
  // Clean up unused imports of I18nManager if any (I'll just remove the log)
  content = content.replace(/console\.log\("RTL:", isRTL\(\)\);\n/g, '');
  content = content.replace(/console\.log\("allowRTL:", I18nManager\.allowRTL\);\n/g, '');
  
  // Add import isRTL from i18n
  if (!content.includes('import { isRTL } from "@/lib/i18n";')) {
    content = content.replace(/import \{ I18nManager \} from "react-native";/g, 'import { I18nManager } from "react-native";\nimport { isRTL } from "@/lib/i18n";');
  }

  fs.writeFileSync(file, content, 'utf-8');
}
console.log("Refactored I18nManager.isRTL in auth and forgot-password.");
