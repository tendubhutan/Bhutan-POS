const fs = require('fs');

function patchFile(filepath) {
  let content = fs.readFileSync(filepath, 'utf-8');
  
  // Add state if not present
  if (!content.includes('const [isHeaderCollapsed, setIsHeaderCollapsed]')) {
    content = content.replace(
      'const [activeTab, setActiveTab]',
      'const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);\n  const [activeTab, setActiveTab]'
    );
    
    // Add useEffect
    // Find where items are kept: quoteItems, noteItems, stockItems
    let itemArrMatch = content.match(/const \[([a-zA-Z]+Items)\],/);
    let itemArr = 'items';
    if (content.includes('quoteItems')) itemArr = 'quoteItems';
    else if (content.includes('noteItems')) itemArr = 'noteItems';
    else if (content.includes('stockItems')) itemArr = 'stockItems';
    else if (content.includes('cart')) itemArr = 'cart'; // fallback

    let partyMatch = content.includes('customerName') ? 'customerName' : (content.includes('partyName') ? 'partyName' : null);

    let effectCode = `\n  useEffect(() => {
    if (${itemArr}.length > 0 && ${partyMatch ? partyMatch : 'true'}) {
      setIsHeaderCollapsed(true);
    } else if (${itemArr}.length === 0) {
      setIsHeaderCollapsed(false);
    }
  }, [${itemArr}.length]);\n`;
    
    content = content.replace(
      'const loadSaved',
      effectCode + '\n  const loadSaved'
    );
    
    // Now replace the header div
    // We look for: {/* Header Grid */} \n <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs space-y-2 text-xs">
    // or similar
    
    let partyLabel = 'Party';
    let partyVar = partyMatch || "'-'";
    let dateVar = content.includes('date') ? 'date' : 'new Date().toISOString().split("T")[0]';
    let noVar = content.includes('quotationNo') ? 'quotationNo' : (content.includes('noteNo') ? 'noteNo' : (content.includes('voucherNo') ? 'voucherNo' : "'-'"));
    
    const replacement = `{isHeaderCollapsed ? (
          <div 
            className="flex items-center justify-between p-3 cursor-pointer hover:bg-violet-100 transition-colors bg-gradient-to-r from-violet-50 to-purple-50 border-b-2 border-violet-200 rounded-xl shadow-xs"
            onClick={() => setIsHeaderCollapsed(false)}
            title="Click to expand header details"
          >
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-500 uppercase tracking-widest text-[10px] bg-white px-2 py-0.5 rounded-full shadow-sm">${partyLabel}</span>
                <span className="font-extrabold text-violet-900">{${partyVar} || <span className="text-rose-500">Not Selected</span>}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-500 uppercase tracking-widest text-[10px] bg-white px-2 py-0.5 rounded-full shadow-sm">Date</span>
                <span className="font-bold text-slate-800">{${dateVar}}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-500 uppercase tracking-widest text-[10px] bg-white px-2 py-0.5 rounded-full shadow-sm">No</span>
                <span className="font-bold text-slate-800">{${noVar} || '-'}</span>
              </div>
            </div>
            <button type="button" className="flex items-center gap-1.5 text-xs font-black text-violet-600 hover:text-violet-800 uppercase tracking-wide bg-white px-3 py-1 rounded-lg shadow-sm border border-violet-100">
              <span>Edit Header</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-down"><path d="m6 9 6 6 6-6"/></svg>
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs space-y-2 text-xs relative">
            <div className="absolute top-2 right-2">
              <button 
                type="button"
                onClick={() => setIsHeaderCollapsed(true)}
                className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-violet-600 uppercase tracking-wide cursor-pointer transition-colors"
                title="Collapse to save space"
              >
                <span>Collapse</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-up"><path d="m18 15-6-6-6 6"/></svg>
              </button>
            </div>`;
    
    // Replace standard header wrapper. We need to find something like:
    // <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs space-y-2 text-xs">
    // or <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs text-xs space-y-2">
    content = content.replace(
      /<div className="rounded-xl border border-slate-200 bg-white p-2\.5 shadow-xs (space-y-2 text-xs|text-xs space-y-2)">/,
      replacement
    );
    
    // Close the ) at the end of the header div.
    // We need to find the end of that div. This is tricky.
    // Alternatively, I can just use sed or Python to do this cleanly manually.
  }
}
