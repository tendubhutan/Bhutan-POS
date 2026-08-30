import re

with open("src/types.ts", "r") as f:
    content = f.read()

old_config = """  QuotationPrefix?: string;
}"""

new_config = """  QuotationPrefix?: string;
  SalesInvoicePrefix?: string;
  SalesInvoiceStartingNo?: number;
  POSInvoicePrefix?: string;
  POSInvoiceStartingNo?: number;
  PurchaseInvoicePrefix?: string;
  PurchaseInvoiceStartingNo?: number;
  EnableBillDiscount?: string; // "true" | "false"
}"""

content = content.replace(old_config, new_config)

with open("src/types.ts", "w") as f:
    f.write(content)
