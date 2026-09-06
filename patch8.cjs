const fs = require('fs');
const file = 'src/components/DrillModal.tsx';
let content = fs.readFileSync(file, 'utf8');

// Insert the states
content = content.replace(
  "  const [showDeleteModal, setShowDeleteModal] = useState(false);",
  "  const [showDeleteModal, setShowDeleteModal] = useState(false);\n  const [showChangePeriodModal, setShowChangePeriodModal] = useState(false);\n  const [tempFrom, setTempFrom] = useState(localFrom);\n  const [tempTo, setTempTo] = useState(localTo);"
);

// Insert the event listener for app:drill-open-change-period
content = content.replace(
  "  // Listen to app:back event dispatched from Header or App.tsx",
  `
  useEffect(() => {
    const handleDrillChangePeriod = () => {
      setTempFrom(localFrom);
      setTempTo(localTo);
      setShowChangePeriodModal(true);
    };
    window.addEventListener('app:drill-open-change-period', handleDrillChangePeriod);
    return () => window.removeEventListener('app:drill-open-change-period', handleDrillChangePeriod);
  }, [localFrom, localTo]);

  const applyPreset = (preset: string) => {
    const now = new Date();
    const formatYMD = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return \`\${y}-\${m}-\${day}\`;
    };
    const todayStr = formatYMD(now);
    let startStr = todayStr;
    let endStr = todayStr;

    if (preset === 'today') {
      // already set
    } else if (preset === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      startStr = formatYMD(y);
      endStr = formatYMD(y);
    } else if (preset === 'this_week') {
      const d = new Date(now);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      d.setDate(diff);
      startStr = formatYMD(d);
    } else if (preset === 'this_month') {
      startStr = formatYMD(new Date(now.getFullYear(), now.getMonth(), 1));
      endStr = formatYMD(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    } else if (preset === 'last_month') {
      startStr = formatYMD(new Date(now.getFullYear(), now.getMonth() - 1, 1));
      endStr = formatYMD(new Date(now.getFullYear(), now.getMonth(), 0));
    } else if (preset === 'this_quarter') {
      const q = Math.floor(now.getMonth() / 3);
      startStr = formatYMD(new Date(now.getFullYear(), q * 3, 1));
      endStr = formatYMD(new Date(now.getFullYear(), q * 3 + 3, 0));
    } else if (preset === 'this_fy') {
      const currentMonth = now.getMonth() + 1;
      const fyStartYear = currentMonth >= 4 ? now.getFullYear() : now.getFullYear() - 1;
      startStr = \`\${fyStartYear}-04-01\`;
      endStr = \`\${fyStartYear + 1}-03-31\`;
    }
    
    setLocalFrom(startStr);
    setLocalTo(endStr);
    setShowChangePeriodModal(false);
  };

  // Listen to app:back event dispatched from Header or App.tsx`
);

// Insert the modal UI at the end
content = content.replace(
  "    </div>\n  );\n};\n",
  `
      {/* Change Period Modal (Z-index 60 to overlay DrillModal) */}
      {showChangePeriodModal && (
        <div
          className="fixed inset-0 z-[60] flex items-start justify-center pt-16 sm:pt-24 p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setShowChangePeriodModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base">Change Drill Period</h3>
                <kbd className="text-[10px] bg-slate-800 border border-slate-700 text-slate-300 px-1.5 py-0.5 rounded font-mono font-bold">Alt+F2</kbd>
              </div>
              <button
                type="button"
                onClick={() => setShowChangePeriodModal(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {/* Content */}
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  1-Click Presets
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'today', label: 'Today' },
                    { id: 'yesterday', label: 'Yesterday' },
                    { id: 'this_week', label: 'This Week' },
                    { id: 'this_month', label: 'This Month' },
                    { id: 'last_month', label: 'Last Month' },
                    { id: 'this_quarter', label: 'This Quarter' },
                    { id: 'this_fy', label: 'Financial Year (FY)' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => applyPreset(p.id)}
                      className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <hr className="border-slate-200" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">From Date</label>
                  <input
                    type="date"
                    value={tempFrom}
                    onChange={(e) => setTempFrom(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">To Date</label>
                  <input
                    type="date"
                    value={tempTo}
                    onChange={(e) => setTempTo(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                </div>
              </div>
            </div>
            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowChangePeriodModal(false)}
                className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-xl transition cursor-pointer text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setLocalFrom(tempFrom);
                  setLocalTo(tempTo);
                  setShowChangePeriodModal(false);
                }}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition cursor-pointer text-sm"
              >
                Apply Custom Period
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
`
);

fs.writeFileSync(file, content, 'utf8');
console.log('Patched DrillModal.tsx');
