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
    "report": "item-profit"
  }
}
\\\`\\\`\\\`
Possible report strings: "sales", "stock", "gst", "ledger", "trial balance", "profit & loss", "balance sheet", "item-profit".
You can also navigate to other views like "pos", "normalsale", "purchase", "masters", "vouchers", "dashboard".

Here is the context data extracted`;

content = content.replace("Here is the context data extracted", navInstruction);

fs.writeFileSync(file, content, 'utf8');
console.log('Patched server instruction with NAVIGATE 3');
