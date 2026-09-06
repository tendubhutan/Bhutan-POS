const fs = require('fs');
const file = 'src/services/localAIService.ts';
let content = fs.readFileSync(file, 'utf8');

const replacement = `
// Basic fuzzy match / synonym checking
const synonyms = {
  top_items: ['top', 'best', 'highest', 'most sold', 'trending'],
  outstanding: ['outstanding', 'receivable', 'payable', 'due', 'owe'],
  sales: ['sale', 'sales', 'revenue', 'sold', 'income', 'earning'],
  purchases: ['purchase', 'purchases', 'bought', 'buy', 'expense', 'spent'],
  stock: ['stock balance', 'stock', 'inventory', 'item', 'items', 'qty', 'quantity', 'product', 'products', 'low stock'],
  gst: ['gst', 'tax', 'vat', 'taxes', 'duties'],
  ledger: ['ledger', 'account', 'statement', 'transaction', 'transactions', 'balance', 'party', 'customer', 'supplier'],
  profit: ['profit', 'loss', 'pnl', 'margin', 'earnings', 'net income'],
  bs: ['balance sheet', 'assets', 'liabilities', 'bs', 'capital', 'equity'],
  tb: ['trial balance', 'tb'],
  payroll: ['payroll', 'salary', 'wages', 'pay', 'employee']
};
`;

content = content.replace(
  /\/\/ Basic fuzzy match \/ synonym checking[\s\S]*?payroll: \['payroll', 'salary', 'wages', 'pay', 'employee'\]\n\};/,
  replacement.trim()
);

fs.writeFileSync(file, content, 'utf8');
