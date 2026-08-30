import fs from 'fs';

const files = [
  'src/components/vouchers/QuotationEntry.tsx',
  'src/components/vouchers/DeliveryNoteEntry.tsx',
  'src/components/vouchers/CreditNoteEntry.tsx',
  'src/components/vouchers/DebitNoteEntry.tsx',
  'src/components/vouchers/PhysicalStockEntry.tsx',
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');
  
  if (content.includes('isHeaderCollapsed')) continue;
  
  // 1. Add state
  content = content.replace(
    /const \[activeTab, setActiveTab\] = useState[^;]+;/,
    `const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);\n  const [activeTab, setActiveTab] = useState<'create' | 'register'>('create');`
  );

  // For PhysicalStockEntry, activeTab might not exist, let's just insert it after config
  if (!content.includes('activeTab')) {
      content = content.replace(
        /const isAutoMode/,
        `const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);\n  const isAutoMode`
      );
  }
  
  // 2. Add useEffect
  let itemsVar = 'cart';
  if (content.includes('quoteItems')) itemsVar = 'quoteItems';
  else if (content.includes('noteItems')) itemsVar = 'noteItems';
  else if (content.includes('stockItems')) itemsVar = 'stockItems';
  
  let partyVar = content.includes('customerName') ? 'customerName' : (content.includes('partyName') ? 'partyName' : 'true');
  if (file.includes('PhysicalStock')) partyVar = 'true';

  let dateVar = content.includes('date') ? 'date' : 'new Date().toISOString().split("T")[0]';
  let noVar = content.includes('quotationNo') ? 'quotationNo' : (content.includes('noteNo') ? 'noteNo' : (content.includes('voucherNo') ? 'voucherNo' : "'-'"));
  let noLabel = file.includes('Quotation') ? 'Quotation No' : (file.includes('Note') ? 'Note No' : 'Voucher No');

  let effectCode = `\n  useEffect(() => {
    if (${itemsVar}.length > 0 && ${partyVar}) {
      setIsHeaderCollapsed(true);
    } else if (${itemsVar}.length === 0) {
      setIsHeaderCollapsed(false);
    }
  }, [${itemsVar}.length]);\n`;
  
  // find a good place for effectCode, usually before loadSavedXXX or showToast
  if (content.includes('const loadSaved')) {
    content = content.replace('const loadSaved', effectCode + '\n  const loadSaved');
  } else if (content.includes('const showToast')) {
    content = content.replace('const showToast', effectCode + '\n  const showToast');
  } else if (content.includes('const handleSubmit')) {
    content = content.replace('const handleSubmit', effectCode + '\n  const handleSubmit');
  }

  // 3. Wrap Header
  // The header wrapper is typically:
  // <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs space-y-2 text-xs">
  // We need to replace it and then close it later. But this is too fragile with regex. Let's just find the exact text for each file.
  
  // Let's use a simpler marker. 
  // We can just replace `{/* Header Grid */}` block with the collapsed logic wrapper.
  const collapsedHeaderUI = `{/* Header Grid */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden transition-all duration-300 mb-2">
            {isHeaderCollapsed ? (
              <div 
                className="flex items-center justify-between p-3 cursor-pointer hover:bg-violet-100 transition-colors bg-gradient-to-r from-violet-50 to-purple-50 border-b-2 border-violet-200"
                onClick={() => setIsHeaderCollapsed(false)}
                title="Click to expand header details"
              >
                <div className="flex items-center gap-6 text-sm">
                  ${file.includes('Physical') ? '' : `<div className="flex items-center gap-2">
                    <span className="font-bold text-slate-500 uppercase tracking-widest text-[10px] bg-white px-2 py-0.5 rounded-full shadow-sm">Party</span>
                    <span className="font-extrabold text-violet-900">{${partyVar} || <span className="text-rose-500">Not Selected</span>}</span>
                  </div>`}
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-500 uppercase tracking-widest text-[10px] bg-white px-2 py-0.5 rounded-full shadow-sm">Date</span>
                    <span className="font-bold text-slate-800">{${dateVar}}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-500 uppercase tracking-widest text-[10px] bg-white px-2 py-0.5 rounded-full shadow-sm">${noLabel}</span>
                    <span className="font-bold text-slate-800">{${noVar} || '-'}</span>
                  </div>
                </div>
                <button type="button" className="flex items-center gap-1.5 text-xs font-black text-violet-600 hover:text-violet-800 uppercase tracking-wide bg-white px-3 py-1 rounded-lg shadow-sm border border-violet-100">
                  <span>Edit Header</span>
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="p-2.5 space-y-2 relative">
                <div className="absolute top-2 right-2">
                  <button 
                    type="button"
                    onClick={() => setIsHeaderCollapsed(true)}
                    className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-violet-600 uppercase tracking-wide cursor-pointer transition-colors"
                    title="Collapse to save space"
                  >
                    <span>Collapse</span>
                    <ChevronUp className="h-4 w-4" />
                  </button>
                </div>
`;
  
  content = content.replace(
    /\{\/\* Header Grid \*\/}[^{]*?<div className="rounded-xl border border-slate-200 bg-white p-2\.5 shadow-xs[^"]*">/,
    collapsedHeaderUI
  );

  // We need to inject `</div>\n            )}` after the header fields.
  // The header fields end with `</div>\n          </div>\n          {/* Line Items Table`
  
  content = content.replace(
    /<\/div>\s*<\/div>\s*\{\/\* Line Items Table/g,
    `</div>\n              </div>\n            )}\n          </div>\n\n          {/* Line Items Table`
  );
  
  // also need to import ChevronDown, ChevronUp if not already
  if (!content.includes('ChevronDown')) {
    content = content.replace(
      /import \{([^}]+)\} from 'lucide-react';/,
      `import {$1, ChevronDown, ChevronUp} from 'lucide-react';`
    );
  }

  fs.writeFileSync(file, content);
}
