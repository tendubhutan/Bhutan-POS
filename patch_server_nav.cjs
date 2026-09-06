const fs = require('fs');
const file = 'server.ts';
let content = fs.readFileSync(file, 'utf8');

const navInstruction = `
Use "NAVIGATE" to guide the user to specific reports if they ask to see a report. 
For example, if they ask for an "itemwise profit report", "stock summary", or "trial balance".
\\\`\\\`\\\`json
{
  "action": "NAVIGATE",
  "payload": {
    "view": "reports",
    "report": "itemwise profit"
  }
}
\\\`\\\`\\\`
Possible report strings: "sales", "stock", "gst", "ledger", "trial balance", "profit & loss", "balance sheet", "item-profit".
You can also navigate to other views like "pos", "normalsale", "purchase", "masters", "vouchers", "dashboard".
`;

content = content.replace(
  /Use "UPDATE_POS_SETTINGS" specifically for POS screen settings[\s\S]*?```json\n\{\n  "action": "UPDATE_POS_SETTINGS",\n  "payload": \{\n    "enableItemDiscount": false,\n    "enableBillDiscount": true\n  \}\n\}\n```/i,
  `Use "UPDATE_POS_SETTINGS" specifically for POS screen settings (e.g. enableItemDiscount, enableBillDiscount, autoPrintReceipt, enableSoundFeedback). Values must be true/false booleans.
\`\`\`json
{
  "action": "UPDATE_POS_SETTINGS",
  "payload": {
    "enableItemDiscount": false,
    "enableBillDiscount": true
  }
}
\`\`\`
${navInstruction}
`
);

fs.writeFileSync(file, content, 'utf8');
console.log('Patched server instruction with NAVIGATE');
