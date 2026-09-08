import sys
import re

with open('src/services/storageService.ts', 'r') as f:
    code = f.read()

def inject_ledger_removal(code, func_name, id_var):
    pattern = r"(export function " + func_name + r"\([^)]+\) \{.*?)(saveJson\(STORAGE_KEYS\.(?:SALES_INVOICES|PURCHASE_INVOICES|VOUCHERS),.*?;\n)"
    replacement = r"\1\2\n  let logs = loadJson<LedgerLogEntry[]>(STORAGE_KEYS.LEDGER_LOG, []);\n  logs = logs.filter(l => l['Ref No']?.trim().toLowerCase() !== " + id_var + r".trim().toLowerCase());\n  saveJson(STORAGE_KEYS.LEDGER_LOG, logs);\n\n"
    new_code = re.sub(pattern, replacement, code, count=1, flags=re.DOTALL)
    if new_code == code:
        print(f"Failed to patch {func_name}")
    return new_code

code = inject_ledger_removal(code, 'cancelSalesInvoice', 'invoiceNo')
code = inject_ledger_removal(code, 'cancelPurchaseInvoice', 'billNo')
code = inject_ledger_removal(code, 'cancelVoucher', 'voucherNo')

with open('src/services/storageService.ts', 'w') as f:
    f.write(code)
