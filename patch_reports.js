import fs from 'fs';

let content = fs.readFileSync('src/components/Reports.tsx', 'utf-8');

// Remove max-h and use overflow-x-auto instead of overflow-auto for vertical scrolling delegation
content = content.replace(
  /className=\{`overflow-auto border-t border-slate-200 \$\{isControlsCollapsed[^}]+\}`\}/,
  'className="overflow-x-auto border-t border-slate-200"'
);

// Add sticky bottom to tfoot and tr inside tfoot
// Currently tfoot might have no classes, and tr has bg-slate-100
// We need to add `sticky bottom-0 z-10 shadow-[0_-1px_3px_rgba(0,0,0,0.1)]` to the tfoot or tr.
// The easiest is to replace `<tfoot` with `<tfoot className="sticky bottom-0 z-10 shadow-[0_-2px_4px_rgba(0,0,0,0.05)]"`

content = content.replace(
  /<tfoot>/g,
  '<tfoot className="sticky bottom-0 z-10 shadow-[0_-2px_4px_rgba(0,0,0,0.05)]">'
);

fs.writeFileSync('src/components/Reports.tsx', content);
