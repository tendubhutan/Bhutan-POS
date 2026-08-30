import fs from 'fs';
let content = fs.readFileSync('src/components/Reports.tsx', 'utf-8');

// The card wrapper
content = content.replace(
  /<div className="rounded-2xl border border-slate-200 bg-white shadow-xs">/,
  '<div className="bg-white border-y border-slate-200 shadow-xs -mx-3 sm:-mx-6 mb-[-1.5rem] lg:mb-[-2rem]">'
);

// The header of the card
content = content.replace(
  /<div className="px-4 py-2 border-b border-slate-200 bg-slate-50 flex justify-between items-center">/,
  '<div className="px-4 sm:px-6 py-2 border-b border-slate-200 bg-slate-50 flex justify-between items-center">'
);

// Also we changed p-4 to p-0, let's make it px-0
// Wait, I changed p-4 to p-0 earlier.
// If it's p-0, the table touches the edges. We want the first column to have padding, which it does (px-3).

fs.writeFileSync('src/components/Reports.tsx', content);
