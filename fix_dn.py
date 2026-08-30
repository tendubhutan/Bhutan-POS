with open("src/components/vouchers/DebitNoteEntry.tsx", "r") as f:
    c = f.read()
c = c.replace("partyName", "supplierLedger")
with open("src/components/vouchers/DebitNoteEntry.tsx", "w") as f:
    f.write(c)
