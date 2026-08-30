import re

with open("src/App.tsx", "r") as f:
    content = f.read()

replacement = """<SalesInvoiceEntry
              config={config}
              items={items}
              ledgers={ledgers}
              onDataRefresh={refreshData}
              initialVoucherTarget={voucherTarget}
              onOpenNewItemModal={(onSelect) => setQuickItemModalProps({isOpen: true, onSelect})}
              onOpenNewLedgerModal={(group, onSelect) => setQuickLedgerModalProps({isOpen: true, group: group || 'Sundry Debtors', onSelect})}
            />"""

content = content.replace("<SalesInvoiceEntry config={config} onDataRefresh={refreshData} />", replacement)

with open("src/App.tsx", "w") as f:
    f.write(content)
