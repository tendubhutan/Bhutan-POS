import re

with open("src/components/SalesInvoiceEntry.tsx", "r") as f:
    content = f.read()

# Add import for ThermalReceiptModal and SalesInvoice
if "ThermalReceiptModal" not in content:
    content = content.replace("import { SerialModal } from './SerialModal';",
"""import { SerialModal } from './SerialModal';
import { ThermalReceiptModal } from './ThermalReceiptModal';
import { SalesInvoice } from '../types';""")

# Add state for printing
if "showPrintModal" not in content:
    content = content.replace("const [showConfirm, setShowConfirm] = useState(false);",
"""const [showConfirm, setShowConfirm] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [savedInvoice, setSavedInvoice] = useState<SalesInvoice | null>(null);""")

# Update save logic to show print modal
save_regex = r'setToast\(\{ message: \'Sales Invoice Saved Successfully!\', type: \'success\' \}\);\n\s*setTimeout\(\(\) => \{\n\s*onDataRefresh\(\);\n\s*// Reset form\n'
save_replacement = """setToast({ message: 'Sales Invoice Saved Successfully!', type: 'success' });
      setSavedInvoice(res.invoice as SalesInvoice);
      setShowPrintModal(true);
      onDataRefresh();
      // Reset form
"""

content = re.sub(r'setToast\(\{ message: \'Sales Invoice Saved Successfully!\', type: \'success\' \}\);\n\s*setTimeout\(\(\) => \{\n\s*onDataRefresh\(\);\n\s*// Reset form\n', save_replacement, content)

# Inject the ThermalReceiptModal at the end of the file
modal_injection = """      {showPrintModal && (
        <ThermalReceiptModal
          isOpen={showPrintModal}
          onClose={() => setShowPrintModal(false)}
          invoice={savedInvoice}
          config={config}
        />
      )}
    </div>
  );"""

content = re.sub(r'<\/div>\s*<\/div>\s*\);\s*\}\s*$', modal_injection + '\n}', content)

with open("src/components/SalesInvoiceEntry.tsx", "w") as f:
    f.write(content)
