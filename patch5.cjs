const fs = require('fs');
const file = 'src/components/DrillModal.tsx';
let content = fs.readFileSync(file, 'utf8');

const dateFilterHtml = `
            {(active.type === 'item-profit' || active.type === 'ledger' || active.type === 'group') && (
              <div className="flex items-center gap-2 mr-2">
                <input
                  type="date"
                  value={localFrom}
                  onChange={e => setLocalFrom(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-slate-700 text-[11px] rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 font-medium"
                />
                <span className="text-slate-400 text-xs">to</span>
                <input
                  type="date"
                  value={localTo}
                  onChange={e => setLocalTo(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-slate-700 text-[11px] rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 font-medium"
                />
              </div>
            )}
`;

content = content.replace(
  "          <div className=\"flex items-center gap-2\">\n            {(active.type === 'ledger' || active.type === 'stock' || active.type === 'group' || active.type === 'item-profit') && (",
  "          <div className=\"flex items-center gap-2\">\n" + dateFilterHtml + "            {(active.type === 'ledger' || active.type === 'stock' || active.type === 'group' || active.type === 'item-profit') && ("
);

fs.writeFileSync(file, content, 'utf8');
console.log('Patched UI');
