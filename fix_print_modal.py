import re

with open("src/components/SalesInvoiceEntry.tsx", "r") as f:
    content = f.read()

modal_injection = """
      {/* Serial Modal */}
      {activeSerialIndex > -1 && cart[activeSerialIndex] && (
        <SerialModal
          isOpen={serialModalOpen}
          onClose={() => setSerialModalOpen(false)}
          onConfirm={serials => {
            const updated = [...cart];
            updated[activeSerialIndex].serials = serials;
            setCart(updated);
            setSerialModalOpen(false);
            setTimeout(() => document.getElementById('pur-fast-item-picker')?.focus(), 50);
          }}
          requiredQty={cart[activeSerialIndex].qty}
          itemName={cart[activeSerialIndex].itemName}
          initialSerials={cart[activeSerialIndex].serials}
        />
      )}

      {showPrintModal && savedInvoice && (
        <ThermalReceiptModal
          isOpen={showPrintModal}
          onClose={() => setShowPrintModal(false)}
          invoice={savedInvoice}
          config={config}
        />
      )}
    </div>
  );
};
"""
content = re.sub(r'\{\/\* Serial Modal \*\/\}.*?\}\s*<\/div>\s*\);\s*\};\s*$', modal_injection, content, flags=re.DOTALL)

with open("src/components/SalesInvoiceEntry.tsx", "w") as f:
    f.write(content)

