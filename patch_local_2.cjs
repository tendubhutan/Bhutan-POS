const fs = require('fs');
const file = 'src/services/localAIService.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "let msg = `🔍 **Found ${entryMatches.length + itemMatchesFallback.length} matching record",
  "let msg = quotaMsg + `🔍 **Found ${entryMatches.length + itemMatchesFallback.length} matching record"
);

content = content.replace(
  "return `Your total sales revenue",
  "return quotaMsg + `Your total sales revenue"
);

content = content.replace(
  "return `Your total purchases",
  "return quotaMsg + `Your total purchases"
);

content = content.replace(
  "return `For ${label}, your Gross Profit",
  "return quotaMsg + `For ${label}, your Gross Profit"
);

content = content.replace(
  "return `GST Summary for",
  "return quotaMsg + `GST Summary for"
);

content = content.replace(
  "return `The current balance",
  "return quotaMsg + `The current balance"
);

content = content.replace(
  "return `Please specify which ledger",
  "return quotaMsg + `Please specify which ledger"
);

content = content.replace(
  "return `You can view your complete Trial Balance",
  "return quotaMsg + `You can view your complete Trial Balance"
);

content = content.replace(
  "return `You can view your Balance Sheet",
  "return quotaMsg + `You can view your Balance Sheet"
);

content = content.replace(
  "return `I found the item",
  "return quotaMsg + `I found the item"
);

content = content.replace(
  "return `You can view your inventory summary",
  "return quotaMsg + `You can view your inventory summary"
);

content = content.replace(
  "return `I'm an offline Smart Assistant.",
  "return quotaMsg + `I'm an offline Smart Assistant."
);

fs.writeFileSync(file, content, 'utf8');
console.log('Patched localAIService prepending quotaMsg');
