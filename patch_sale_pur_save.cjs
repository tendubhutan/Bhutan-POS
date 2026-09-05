const fs = require('fs');

function patchSales() {
  let content = fs.readFileSync('src/components/SalesInvoiceEntry.tsx', 'utf8');
  
  // 1. Add ID to bottom save button
  content = content.replace(
    /onClick={handleSaveInvoice}\n\s*disabled={cart.length === 0}\n\s*className="/g,
    'id="sale-save-btn"\n                onClick={handleSaveInvoice}\n                disabled={cart.length === 0}\n                className="focus:ring-4 focus:ring-emerald-500 outline-none '
  );
  
  // 2. Add onKeyDown to narration
  content = content.replace(
    /onChange=\{\(e\) => setNarration\(e.target.value\)\}\n\s*className="flex-1 text-xs border-none outline-none bg-transparent placeholder:text-slate-400 font-medium"\n\s*\/>/g,
    `onChange={(e) => setNarration(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              document.getElementById('sale-save-btn')?.focus();
            }
          }}
          className="flex-1 text-xs border-none outline-none bg-transparent placeholder:text-slate-400 font-medium focus:ring-2 focus:ring-indigo-500 focus:bg-indigo-50 px-2 py-1 rounded transition-all"
        />`
  );
  
  fs.writeFileSync('src/components/SalesInvoiceEntry.tsx', content);
}

function patchPurchase() {
  let content = fs.readFileSync('src/components/PurchaseEntry.tsx', 'utf8');
  
  // 1. Add ID to bottom save button
  content = content.replace(
    /onClick={handleSavePurchase}\n\s*disabled={cart.length === 0}\n\s*className="/g,
    'id="pur-save-btn"\n                onClick={handleSavePurchase}\n                disabled={cart.length === 0}\n                className="focus:ring-4 focus:ring-emerald-500 outline-none '
  );
  
  fs.writeFileSync('src/components/PurchaseEntry.tsx', content);
}

patchSales();
patchPurchase();
