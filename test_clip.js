import fs from 'fs';
let content = fs.readFileSync('src/components/Reports.tsx', 'utf-8');
content = content.replace(
  /className="overflow-x-auto border-t border-slate-200"/,
  'className="overflow-x-auto border-t border-slate-200" style={{ overflowY: "clip" }}'
);
fs.writeFileSync('src/components/Reports.tsx', content);
