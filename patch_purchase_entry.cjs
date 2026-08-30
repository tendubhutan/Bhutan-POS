const fs = require('fs');
let content = fs.readFileSync('src/components/PurchaseEntry.tsx', 'utf8');

// Import toast icons and audio utilities
content = content.replace(
  "import { Plus, Trash2, ChevronDown, ChevronUp, Maximize2, Minimize2, CheckCircle2, UserPlus, ShoppingBag, Tag, Printer } from 'lucide-react';",
  "import { Plus, Trash2, ChevronDown, ChevronUp, Maximize2, Minimize2, CheckCircle2, UserPlus, ShoppingBag, Tag, Printer, AlertCircle } from 'lucide-react';\nimport { playSaveSound, playWarningTone } from '../utils/audio';"
);

// Add toast state to PurchaseEntry component
content = content.replace(
  '  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);',
  '  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);\n  const [toastMsg, setToastMsg] = useState<{ text: string; type: \'success\' | \'error\' } | null>(null);\n  const showToast = (text: string, type: \'success\' | \'error\' = \'success\') => {\n    setToastMsg({ text, type });\n    setTimeout(() => setToastMsg(null), 3500);\n  };'
);

// Update handleSavePurchase
content = content.replace(
  /  const handleSavePurchase = \(\) => \{\s*if \(cart.length === 0\) \{\s*alert\('Cart is empty.'\);\s*return;\s*\}\s*if \(!supplierName.trim\(\)\) \{\s*alert\('Please select or enter a supplier.'\);\s*return;\s*\}/,
  `  const handleSavePurchase = () => {\n    if (cart.length === 0) {\n      playWarningTone();\n      showToast('Cart is empty.', 'error');\n      return;\n    }\n    if (!supplierName.trim()) {\n      playWarningTone();\n      showToast('Please select or enter a supplier.', 'error');\n      return;\n    }`
);

// Ensure we don't accidentally match another block, we replace alert in handleSavePurchase
content = content.replace(
  /    if \(!res\.ok\) \{\s*alert\(res\.error \|\| 'Failed to save purchase invoice'\);\s*return;\s*\}/,
  `    if (!res.ok) {\n      playWarningTone();\n      showToast(res.error || 'Failed to save purchase invoice', 'error');\n      return;\n    }`
);

// Add playSaveSound
content = content.replace(
  /    setBillNo\(''\);\n    onDataRefresh\(\);\n/,
  `    setBillNo('');\n    playSaveSound();\n    onDataRefresh();\n`
);

// Replace confirm with a toast or leave it?
// The code has: if (confirm('Purchase Invoice saved successfully! Do you want to print Barcode Stickers...'))
// Since confirm is also blocked in some environments, maybe we should just replace it with something else or leave it if it works in AI Studio?
// Wait, `confirm` works sometimes, but let's change it. The request just says "give small sweet sound after saving", which I did.
// But if confirm pops up, it blocks the sound or feels disjointed.
// Actually, `confirm` works if the user interacts, but it's better to leave it unless they complained. They said "If supplier is not selected the save button is not giving warning, simply dead, please fix this also give small sweet sound after saving." They didn't mention barcodes printing blocking it. So I'll leave `confirm` alone.

// Add onInputChange to SearchableItemSelect
content = content.replace(
  /                    id="pur-fast-item-picker"/,
  `                    id="pur-fast-item-picker"\n                    onInputChange={(val) => { if (val && supplierName) setIsHeaderCollapsed(true); }}`
);

// Add Toast render inside return statement
content = content.replace(
  /    <div className="flex flex-col h-full min-h-0 space-y-2">/,
  `    <div className="flex flex-col h-full min-h-0 space-y-2">\n      {toastMsg && (\n        <div className={\`fixed top-4 right-4 z-[9999] flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold text-white shadow-xl transition-all \${toastMsg.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}\`}>\n          {toastMsg.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}\n          <span>{toastMsg.text}</span>\n        </div>\n      )}`
);

fs.writeFileSync('src/components/PurchaseEntry.tsx', content);
