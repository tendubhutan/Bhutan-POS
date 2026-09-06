const fs = require('fs');
const file = 'src/services/localAIService.ts';
let content = fs.readFileSync(file, 'utf8');

const replacement = `
  if (qLower.includes('enable asset management') || (qLower.includes('turn on') && qLower.includes('asset management'))) {
      return 'Enabling Asset Management module.\\n\\n\`\`\`json\\n{\\n  "action": "UPDATE_CONFIG",\\n  "payload": { "EnableAssetManagement": "true" }\\n}\\n\`\`\`';
  }
  if (qLower.includes('disable asset management') || (qLower.includes('turn off') && qLower.includes('asset management'))) {
      return 'Disabling Asset Management module.\\n\\n\`\`\`json\\n{\\n  "action": "UPDATE_CONFIG",\\n  "payload": { "EnableAssetManagement": "false" }\\n}\\n\`\`\`';
  }
  
  if (qLower.includes('enable payroll') || (qLower.includes('turn on') && qLower.includes('payroll'))) {
      return 'Enabling Payroll module.\\n\\n\`\`\`json\\n{\\n  "action": "UPDATE_CONFIG",\\n  "payload": { "EnablePayroll": "true" }\\n}\\n\`\`\`';
  }
  if (qLower.includes('disable payroll') || (qLower.includes('turn off') && qLower.includes('payroll'))) {
      return 'Disabling Payroll module.\\n\\n\`\`\`json\\n{\\n  "action": "UPDATE_CONFIG",\\n  "payload": { "EnablePayroll": "false" }\\n}\\n\`\`\`';
  }

  // 3. Search exact vouchers/entries or items
`;

content = content.replace(
  /if \(qLower\.includes\('enable asset management'\)[\s\S]*?\/\/ 3\. Search exact vouchers\/entries or items/,
  replacement
);

fs.writeFileSync(file, content, 'utf8');
