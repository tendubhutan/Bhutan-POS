const fs = require('fs');
const file = 'src/services/localAIService.ts';
let content = fs.readFileSync(file, 'utf8');

// I will just use string concatenation and double quotes.

content = content.replace(/return 'Enabling Item Discount in POS settings\.[\s\S]*?\}'/g, 
  "return 'Enabling Item Discount in POS settings.\\n\\n```json\\n{\\n  \"action\": \"UPDATE_POS_SETTINGS\",\\n  \"payload\": { \"enableItemDiscount\": true }\\n}\\n```';"
);

content = content.replace(/return 'Disabling Item Discount in POS settings\.[\s\S]*?\}'/g, 
  "return 'Disabling Item Discount in POS settings.\\n\\n```json\\n{\\n  \"action\": \"UPDATE_POS_SETTINGS\",\\n  \"payload\": { \"enableItemDiscount\": false }\\n}\\n```';"
);

content = content.replace(/return 'Enabling Bill Discount in POS settings\.[\s\S]*?\}'/g, 
  "return 'Enabling Bill Discount in POS settings.\\n\\n```json\\n{\\n  \"action\": \"UPDATE_POS_SETTINGS\",\\n  \"payload\": { \"enableBillDiscount\": true }\\n}\\n```';"
);

content = content.replace(/return 'Disabling Bill Discount in POS settings\.[\s\S]*?\}'/g, 
  "return 'Disabling Bill Discount in POS settings.\\n\\n```json\\n{\\n  \"action\": \"UPDATE_POS_SETTINGS\",\\n  \"payload\": { \"enableBillDiscount\": false }\\n}\\n```';"
);

fs.writeFileSync(file, content, 'utf8');
