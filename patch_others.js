import fs from 'fs';

let content = fs.readFileSync('src/components/Reports.tsx', 'utf-8');

content = content.replace(
  /className="overflow-x-auto rounded-xl border border-slate-200 bg-white( shadow-xs)?"/g,
  (match) => match + ' style={{ overflowY: "clip" }}'
);

fs.writeFileSync('src/components/Reports.tsx', content);
