import { GstFieldConfig, GstInputTypeConfig } from '../types';

export const DEFAULT_GST_INPUT_TYPES = [
  'Local Purchase',
  'Local Expenses',
  'Bank Charges',
  'Import Customs GST Payment',
  'Import Purchase'
];

export function getDefaultGstFieldConfigs(typeId: string): GstFieldConfig[] {
  if (typeId === 'Import Customs GST Payment' || typeId === 'Import Purchase') {
    return [
      { id: 'supplierName', label: 'Supplier Name', dataType: 'text', sourceType: 'manual', showInReport: true, order: 1 },
      { id: 'invoiceNo', label: 'Supplier Invoice No.', dataType: 'text', sourceType: 'manual', showInReport: true, order: 2 },
      { id: 'invoiceDate', label: 'Supplier Invoice Date', dataType: 'date', sourceType: 'manual', showInReport: true, order: 3 },
      { id: 'declarationNo', label: 'Declaration Number', dataType: 'text', sourceType: 'manual', showInReport: true, order: 4 },
      { id: 'declarationDate', label: 'Declaration Date', dataType: 'date', sourceType: 'manual', showInReport: true, order: 5 },
      { id: 'taxableAmount', label: 'Taxable Value', dataType: 'number', sourceType: 'formula', sourceValue: 'gstAmount * 20', showInReport: true, order: 6 },
      { id: 'exemptedAmount', label: 'Exempted Value', dataType: 'number', sourceType: 'manual', showInReport: true, order: 7 },
      { id: 'gstAmount', label: 'GST Amount Paid @ 5%', dataType: 'number', sourceType: 'manual', showInReport: true, order: 8 },
      { id: 'totalImportAmount', label: 'Total Import Amount', dataType: 'number', sourceType: 'manual', showInReport: true, order: 9 },
    ];
  }
  
  if (typeId === 'Bank Charges') {
    return [
      { id: 'supplierName', label: 'Supplier Name (Party)', dataType: 'text', sourceType: 'ledger', sourceValue: 'name', showInReport: true, order: 1 },
      { id: 'supplierGstNo', label: 'Supplier GST No.', dataType: 'text', sourceType: 'ledger', sourceValue: 'gstNo', showInReport: true, order: 2 },
      { id: 'invoiceDate', label: 'Invoice Date', dataType: 'date', sourceType: 'manual', showInReport: true, order: 3 },
      { id: 'invoiceNo', label: 'Invoice No.', dataType: 'text', sourceType: 'manual', showInReport: true, order: 4 },
      { id: 'referenceNo', label: 'Reference No.', dataType: 'text', sourceType: 'manual', showInReport: true, order: 5 },
      { id: 'taxableAmount', label: 'Taxable Value', dataType: 'number', sourceType: 'formula', sourceValue: 'gstAmount * 20', showInReport: true, order: 6 },
      { id: 'exemptedAmount', label: 'Exempted Value', dataType: 'number', sourceType: 'manual', showInReport: true, order: 7 },
      { id: 'gstAmount', label: 'GST @ 5%', dataType: 'number', sourceType: 'manual', showInReport: true, order: 8 },
    ];
  }

  // Default for Local Purchase & Local Expenses
  return [
    { id: 'supplierName', label: 'Supplier / Payee', dataType: 'text', sourceType: 'ledger', sourceValue: 'name', showInReport: true, order: 1 },
    { id: 'supplierGstNo', label: 'Supplier GST No', dataType: 'text', sourceType: 'ledger', sourceValue: 'gstNo', showInReport: true, order: 2 },
    { id: 'transactionType', label: 'Transaction Type', dataType: 'text', sourceType: 'voucher', sourceValue: 'gstInputType', showInReport: true, order: 3 },
    { id: 'invoiceDate', label: 'Invoice Date', dataType: 'date', sourceType: 'manual', showInReport: true, order: 4 },
    { id: 'invoiceNo', label: 'INVOICE / REF No', dataType: 'text', sourceType: 'manual', showInReport: true, order: 5 },
    { id: 'taxableAmount', label: 'Taxable Value', dataType: 'number', sourceType: 'formula', sourceValue: 'gstAmount * 20', showInReport: true, order: 6 },
    { id: 'exemptedAmount', label: 'Exempted Value', dataType: 'number', sourceType: 'manual', showInReport: true, order: 7 },
    { id: 'gstAmount', label: 'GST Amount', dataType: 'number', sourceType: 'manual', showInReport: true, order: 8 },
  ];
}

export function getGstConfigsFromConfig(configStr?: string): GstInputTypeConfig[] {
  if (!configStr) return [];
  try {
    const parsed = typeof configStr === 'string' ? JSON.parse(configStr) : configStr;
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return [];
}

export function getGstFieldsForType(configStr: string | undefined, typeId: string): GstFieldConfig[] {
  const configs = getGstConfigsFromConfig(configStr);
  const found = configs.find(c => c.typeId === typeId);
  if (found && found.fields && found.fields.length > 0) {
    return [...found.fields].sort((a, b) => a.order - b.order);
  }
  return getDefaultGstFieldConfigs(typeId);
}

export function getGstFieldLabel(configStr: string | undefined, typeId: string, fieldId: string, defaultLabel: string): string {
  const fields = getGstFieldsForType(configStr, typeId);
  const found = fields.find(f => f.id === fieldId);
  return (found && found.label) ? found.label : defaultLabel;
}

export function evaluateGstFormula(formula: string | undefined, context: Record<string, any>): number {
  if (!formula || !formula.trim()) return 0;
  try {
    let expr = formula.trim();
    // Replace variable names with context values
    // Sort keys by length descending to prevent partial variable replacements
    const keys = Object.keys(context).sort((a, b) => b.length - a.length);
    for (const key of keys) {
      const rawVal = context[key];
      const numVal = typeof rawVal === 'number' ? rawVal : (Number(rawVal) || 0);
      const reg = new RegExp(`\\b${key}\\b`, 'g');
      expr = expr.replace(reg, String(numVal));
    }
    // Only allow math tokens
    if (!/^[0-9+\-*/().\s]+$/.test(expr)) {
      return 0;
    }
    const fn = new Function(`return (${expr});`);
    const res = fn();
    return isNaN(res) || !isFinite(res) ? 0 : Number(res);
  } catch {
    return 0;
  }
}
