import sys
with open('src/services/storageService.ts', 'r') as f:
    lines = f.readlines()

for i in range(len(lines)):
    if "return { ok: true, voucherNo: no, items: updatedItems, ledgers: updatedLedgers };" in lines[i] and "saveCreditNote" in "".join(lines[max(0, i-50):i]):
        lines.insert(i, "  if (existIdxCN >= 0) recalculateLedgerBalances();\n")
        break

for i in range(len(lines)):
    if "return { ok: true, voucherNo: no, items: updatedItems, ledgers: updatedLedgers };" in lines[i] and "saveDebitNote" in "".join(lines[max(0, i-50):i]):
        lines.insert(i, "  if (existIdxDN >= 0) recalculateLedgerBalances();\n")
        break

with open('src/services/storageService.ts', 'w') as f:
    f.writelines(lines)
