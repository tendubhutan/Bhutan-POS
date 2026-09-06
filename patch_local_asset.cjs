const fs = require('fs');
const file = 'src/services/localAIService.ts';
let content = fs.readFileSync(file, 'utf8');

const replacement = `
  if (qLower.includes('enable bill discount') || (qLower.includes('turn on') && qLower.includes('bill discount'))) {
      return 'Enabling Bill Discount in POS settings.\\n\\n\`\`\`json\\n{\\n  "action": "UPDATE_POS_SETTINGS",\\n  "payload": { "enableBillDiscount": true }\\n}\\n\`\`\`';
  }
  if (qLower.includes('disable bill discount') || (qLower.includes('turn off') && qLower.includes('bill discount'))) {
      return 'Disabling Bill Discount in POS settings.\\n\\n\`\`\`json\\n{\\n  "action": "UPDATE_POS_SETTINGS",\\n  "payload": { "enableBillDiscount": false }\\n}\\n\`\`\`';
  }
  
  if (qLower.includes('enable asset management') || (qLower.includes('turn on') && qLower.includes('asset management'))) {
      return 'Enabling Asset Management module.\\n\\n\`\`\`json\\n{\\n  "action": "UPDATE_CONFIG",\\n  "payload": { "EnableAssetManagement": "true" }\\n}\\n\`\`\`';
  }
  if (qLower.includes('disable asset management') || (qLower.includes('turn off') && qLower.includes('asset management'))) {
      return 'Disabling Asset Management module.\\n\\n\`\`\`json\\n{\\n  "action": "UPDATE_CONFIG",\\n  "payload": { "EnableAssetManagement": "false" }\\n}\\n\`\`\`';
  }
`;

content = content.replace(
  /if \(qLower\.includes\('enable bill discount'\)[\s\S]*?payload": \{ "enableBillDiscount": false \}\\n\}\\n\`\`\`';\n  \}/,
  replacement.trim()
);

fs.writeFileSync(file, content, 'utf8');
