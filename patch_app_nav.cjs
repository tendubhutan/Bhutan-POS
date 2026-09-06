const fs = require('fs');
const file = 'src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

const newNavLogic = `
    const handleAppNavigate = (e: any) => {
      if (e.detail?.view) {
        if (e.detail.view === 'reports') {
          const target: any = { timestamp: Date.now(), ...e.detail };
          delete target.view;
          delete target.report;

          // Legacy mappings
          const r = e.detail.report?.toLowerCase() || '';
          if (r) {
            if (r.includes('sales')) target.category = 'daily';
            else if (r.includes('stock')) target.category = 'inv';
            else if (r.includes('gst')) target.category = 'gst';
            else if (r.includes('ledger')) { target.category = 'fin'; target.finSubTab = 'LED'; target.ledgerName = e.detail.ledgerName; }
            else if (r.includes('trial')) { target.category = 'fin'; target.finSubTab = 'TB'; }
            else if (r.includes('itemwise') || r.includes('item-profit') || r.includes('item profit')) { target.category = 'inv'; target.invSubTab = 'prof'; }
            else if (r.includes('profit')) { target.category = 'fin'; target.finSubTab = 'PNL'; }
            else if (r.includes('balance')) { target.category = 'fin'; target.finSubTab = 'BS'; }
          }
          
          if (!target.category && !target.ledgerName) {
            setReportTarget(null);
            navigateTo('reports', null);
          } else {
            setReportTarget(target);
            navigateTo('reports', target);
          }
        } else {
          navigateTo(e.detail.view);
        }
      }
    };
`;

content = content.replace(
  /const handleAppNavigate = \(e: any\) => \{[\s\S]*?navigateTo\(e\.detail\.view\);\s*\}\s*\}\s*\};/,
  newNavLogic.trim()
);

fs.writeFileSync(file, content, 'utf8');
console.log('Patched App.tsx navigation mapping');
