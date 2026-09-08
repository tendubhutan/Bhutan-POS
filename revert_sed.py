import sys

with open('src/services/storageService.ts', 'r') as f:
    content = f.read()

s1 = """  saveJson(STORAGE_KEYS.SALES_INVOICES, invoices);

  let lg1 = loadJson<LedgerLogEntry[]>(STORAGE_KEYS.LEDGER_LOG, []);
  lg1 = lg1.filter(l => l["Ref No"] !== invoiceNo);
  saveJson(STORAGE_KEYS.LEDGER_LOG, lg1);

  let sl1 = loadJson<StockLedgerEntry[]>(STORAGE_KEYS.STOCK_LEDGER, []);
  sl1 = sl1.filter(s => s["Ref No"] !== invoiceNo);
  saveJson(STORAGE_KEYS.STOCK_LEDGER, sl1);"""

s2 = """  saveJson(STORAGE_KEYS.PURCHASE_INVOICES, purchases);

  let lg2 = loadJson<LedgerLogEntry[]>(STORAGE_KEYS.LEDGER_LOG, []);
  lg2 = lg2.filter(l => l["Ref No"] !== ref);
  saveJson(STORAGE_KEYS.LEDGER_LOG, lg2);

  let sl2 = loadJson<StockLedgerEntry[]>(STORAGE_KEYS.STOCK_LEDGER, []);
  sl2 = sl2.filter(s => s["Ref No"] !== ref);
  saveJson(STORAGE_KEYS.STOCK_LEDGER, sl2);"""

s3 = """  saveJson(STORAGE_KEYS.VOUCHERS, vouchers);

  let lg3 = loadJson<LedgerLogEntry[]>(STORAGE_KEYS.LEDGER_LOG, []);
  lg3 = lg3.filter(l => l["Ref No"] !== voucherNo);
  saveJson(STORAGE_KEYS.LEDGER_LOG, lg3);

  let sl3 = loadJson<StockLedgerEntry[]>(STORAGE_KEYS.STOCK_LEDGER, []);
  sl3 = sl3.filter(s => s["Ref No"] !== voucherNo);
  saveJson(STORAGE_KEYS.STOCK_LEDGER, sl3);"""

content = content.replace(s1, "  saveJson(STORAGE_KEYS.SALES_INVOICES, invoices);")
content = content.replace(s2, "  saveJson(STORAGE_KEYS.PURCHASE_INVOICES, purchases);")
content = content.replace(s3, "  saveJson(STORAGE_KEYS.VOUCHERS, vouchers);")

with open('src/services/storageService.ts', 'w') as f:
    f.write(content)

