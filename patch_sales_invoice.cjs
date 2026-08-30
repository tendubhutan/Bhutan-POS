const fs = require('fs');
let content = fs.readFileSync('src/components/SalesInvoiceEntry.tsx', 'utf8');

// Update imports
content = content.replace(
  "import { Plus, Trash2, ChevronDown, ChevronUp, Maximize2, Minimize2, CheckCircle2, UserPlus, ShoppingBag, Tag, Printer, Settings } from 'lucide-react';",
  "import { Plus, Trash2, ChevronDown, ChevronUp, Maximize2, Minimize2, CheckCircle2, UserPlus, ShoppingBag, Tag, Printer, Settings, AlertCircle } from 'lucide-react';\nimport { playSaveSound, playWarningTone } from '../utils/audio';"
);

// Add toast state and showToast
content = content.replace(
  '  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);',
  '  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);\n  const [toastMsg, setToastMsg] = useState<{ text: string; type: \'success\' | \'error\' } | null>(null);\n  const showToast = (text: string, type: \'success\' | \'error\' = \'success\') => {\n    setToastMsg({ text, type });\n    setTimeout(() => setToastMsg(null), 3500);\n  };'
);

// Update handleSaveInvoice logic
content = content.replace(
  /  const handleSaveInvoice = \(\) => \{\s*if \(cart\.length === 0\) \{\s*alert\("Cart is empty\."\);\s*return;\s*\}\s*if \(!customerName\.trim\(\)\) \{\s*alert\("Please select or enter a customer\."\);\s*return;\s*\}/,
  `  const handleSaveInvoice = () => {\n    if (cart.length === 0) {\n      playWarningTone();\n      showToast("Cart is empty.", "error");\n      return;\n    }\n    if (!customerName.trim()) {\n      playWarningTone();\n      showToast("Please select or enter a customer.", "error");\n      return;\n    }`
);

content = content.replace(
  /    if \(!res\.ok\) \{\s*alert\(res\.error \|\| "Failed to save sales invoice"\);\s*return;\s*\}/,
  `    if (!res.ok) {\n      playWarningTone();\n      showToast(res.error || "Failed to save sales invoice", "error");\n      return;\n    }`
);

// Add sound on successful save
content = content.replace(
  /    setSavedInvoice\(res\.invoice as any\);\n    setShowPrintModal\(true\);/,
  `    setSavedInvoice(res.invoice as any);\n    playSaveSound();\n    setShowPrintModal(true);`
);

// Add onInputChange to auto collapse
content = content.replace(
  /                    id="pur-fast-item-picker"/,
  `                    id="pur-fast-item-picker"\n                    onInputChange={(val) => { if (val && customerName) setIsHeaderCollapsed(true); }}`
);

// Add toast rendering to the component root
content = content.replace(
  /    <div className="flex flex-col h-full min-h-0 space-y-2">/,
  `    <div className="flex flex-col h-full min-h-0 space-y-2">\n      {toastMsg && (\n        <div className={\`fixed top-4 right-4 z-[9999] flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold text-white shadow-xl transition-all \${toastMsg.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}\`}>\n          {toastMsg.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}\n          <span>{toastMsg.text}</span>\n        </div>\n      )}`
);

fs.writeFileSync('src/components/SalesInvoiceEntry.tsx', content);
