export interface Config {
  CompanyName: string;
  Address: string;
  CompanyGSTNo: string;
  CompanyTPNNo: string;
  GSTRate: string; // e.g. "5"
  CurrencySymbol: string; // e.g. "Nu."
  Bank1Ledger: string;
  Bank2Ledger: string;
  CompanyBankDetails: string;
  EnableGST: string; // "true" | "false"
  EnableSerials: string; // "true" | "false"
  EnableItemDiscount?: string; // "true" | "false"
  ItemDiscountType?: "flat" | "percent";
  BillDiscountType?: "flat" | "percent";
  EnableCategory?: string; // "true" | "false"
  EnableAssetManagement?: string; // "true" | "false"
  EnablePayroll?: string;
  EnablePOS?: string;
  EnableNormalSale?: string;
  EnableEmployeeAdvances?: string; // "true" | "false"
  BarcodePrefix: string;
  ReceiptHeaderImage: string;
  ReceiptSignatureImage: string;
  InvoiceTemplate?: 'standard' | 'modern' | 'classic' | 'letterhead' | 'compact';
  PaperSize?: 'A4' | '80mm' | '58mm' | 'A5';
  FooterTerms?: string;
  SecondaryTerms?: string;
  PredefinedTermsList?: string[];
  TermsAndConditions?: string;
  SelectedBankLedgerForPrint?: string;
  PrintBankDetailsOnInvoice?: string;
  EnableItemDescription?: string; // "true" | "false"
  SignatoryTitle?: string;
  VoucherNumberingMode?: 'auto' | 'manual';
  PaymentVoucherPrefix?: string;
  ReceiptVoucherPrefix?: string;
  JournalVoucherPrefix?: string;
  ContraVoucherPrefix?: string;
  CreditNotePrefix?: string;
  DebitNotePrefix?: string;
  DeliveryNotePrefix?: string;
  PhysicalStockPrefix?: string;
  QuotationPrefix?: string;
  SalesInvoicePrefix?: string;
  SalesInvoiceStartingNo?: number;
  POSInvoicePrefix?: string;
  POSInvoiceStartingNo?: number;
  PurchaseInvoicePrefix?: string;
  PurchaseInvoiceStartingNo?: number;
  EnableBillDiscount?: string; // "true" | "false"
}

export type ModuleId = 'pos' | 'purchase' | 'vouchers' | 'masters' | 'barcode' | 'payroll' | 'reports' | 'settings';

export interface UserPermission {
  module: ModuleId;
  display: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  print: boolean;
}

export interface AppUser {
  id: string;
  username: string;
  fullName: string;
  role: 'Administrator' | 'Manager' | 'Cashier' | 'Accountant' | 'Custom';
  pinCode?: string;
  status: 'Active' | 'Inactive';
  permissions: UserPermission[];
}

export interface Item {
  'Item Code': string;
  Barcode: string;
  'Item Name': string;
  'Print Name': string;
  Group: string;
  Category?: string;
  Unit: string;
  'Purchase Rate': number;
  'Sale Rate': number;
  MRP: number;
  'GST %': number;
  'Zero Rated (Y/N)': 'Y' | 'N';
  'Is Serialized': 'Y' | 'N';
  'Maintain Stock'?: 'Y' | 'N';
  'HSN/SAC': string;
  'Opening Stock': number;
  'Current Stock': number;
  'Reorder Level': number;
  'Opening Serials'?: string;
  oldCode?: string;
}

export interface ItemGroup {
  'Group Name': string;
  'Parent Group'?: string;
  oldName?: string;
}

export interface Unit {
  'Unit Name': string;
  Symbol: string;
  Group: string;
  'Conversion Factor': number;
  oldName?: string;
}

export interface UnitGroup {
  'Group Name': string;
  'Base Unit'?: string;
  oldName?: string;
}

export interface Ledger {
  'Ledger Name': string;
  Group: string;
  'GST No'?: string;
  'TPN No'?: string;
  'GST Exempted'?: 'Y' | 'N' | boolean;
  'GST Type'?: 'Regular' | 'Exempted' | 'Unregistered' | 'Composition';
  Address?: string;
  'Contact No'?: string;
  Email?: string;
  'Bank Name'?: string;
  Branch?: string;
  'Account No'?: string;
  'Opening Balance': number;
  'Balance Type (Dr/Cr)': 'Dr' | 'Cr';
  'Current Balance': number;
  oldName?: string;
}

export interface LedgerGroup {
  'Group Name': string;
  'Parent Group'?: string;
  Nature: 'Asset' | 'Liability' | 'Income' | 'Expense' | 'Capital';
  oldName?: string;
}

export interface CartLine {
  itemCode: string;
  itemName: string;
  unit?: string;
  qty: number;
  rate: number;
  discount: number;
  discountType?: 'flat' | 'percent';
  gstPct: number;
  zeroRated: 'Y' | 'N';
  purchaseRate: number;
  isSerialized: 'Y' | 'N';
  serials: string[];
  gstAmt?: number;
  description?: string;
  lineDescription?: string;
}

export interface CustomerDetails {
  ledger: string;
  name: string;
  gstNo?: string;
  tpnNo?: string;
  address?: string;
  phone?: string;
  contactNo?: string;
  email?: string;
  gstType?: string;
  isGSTExempted?: boolean;
}

export interface PaymentDetails {
  cash: number;
  bank1: number;
  bank2: number;
  bank1Ledger: string;
  bank2Ledger: string;
  bankTxnNo?: string;
  bank2TxnNo?: string;
}

export interface SalesInvoice {
  invoiceNo: string;
  orderNo?: string;
  orderDate?: string;
  deliveryNoteNo?: string;
  date: string;
  customer: CustomerDetails;
  subtotal?: number;
  discount?: number;
  discountType?: 'flat' | 'percent';
  discountValue?: number;
  taxable: number;
  zeroRated: number;
  gstAmt: number;
  total: number;
  cash: number;
  bank1: number;
  bank2: number;
  credit: number;
  status: 'Paid' | 'Credit' | 'Partial Credit' | 'Cancelled';
  paymentStatus?: 'Paid' | 'Credit' | 'Partial Credit';
  paymentDetails?: PaymentDetails;
  additionalExpenses?: { ledger: string; amount: number }[];
  termsAndConditions?: string;
  narration?: string;
  voucherTypeId?: string;
  voucherTypeName?: string;
  config: Config;
  bankTxnNo?: string;
  bank2TxnNo?: string;
  items: Array<{
    'Invoice No'?: string;
    'Item Code': string;
    'Item Name': string;
    'Item Description'?: string;
    description?: string;
  lineDescription?: string;
    Unit?: string;
    Qty: number;
    Rate: number;
    Discount: number;
    'Taxable Value': number;
    'GST %': number;
    'GST Amount': number;
    'Zero Rated (Y/N)': 'Y' | 'N';
    'Line Total': number;
    'Serial Numbers': string;
  }>;
}

export interface PurchaseInvoice {
  billNo: string;
  invoiceNo?: string;
  supplierBillNo?: string;
  date: string;
  supplier: {
    name: string;
    ledger?: string;
    gstNo?: string;
    tpnNo?: string;
    address?: string;
    Address?: string;
    phone?: string;
    contactNo?: string;
  };
  taxable: number;
  zeroRated: number;
  gstAmt: number;
  total: number;
  cash: number;
  bank1: number;
  bank2: number;
  credit: number;
  status: 'Paid' | 'Credit' | 'Partial Credit' | 'Cancelled';
  paymentStatus?: 'Paid' | 'Credit' | 'Partial Credit';
  paymentDetails?: PaymentDetails;
  additionalExpenses?: { ledger: string; amount: number }[];
  voucherTypeId?: string;
  voucherTypeName?: string;
  items: Array<{
    'Bill No'?: string;
    'Item Code': string;
    'Item Name': string;
    'Item Description'?: string;
    description?: string;
  lineDescription?: string;
    Unit?: string;
    Qty: number;
    Rate: number;
    Discount: number;
    'Taxable Value': number;
    'GST %': number;
    'GST Amount': number;
    'Zero Rated (Y/N)': 'Y' | 'N';
    'Line Total': number;
    'Serial Numbers': string;
  }>;
}

export interface HeldBill {
  holdId: string;
  customerName: string;
  cart: CartLine[];
  heldTime: string;
  billDiscount?: number;
  billDiscountType?: 'flat' | 'percent';
}

export interface StockLedgerEntry {
  DateIso: string;
  'Item Code': string;
  'Item Name': string;
  Type: string;
  'Qty In': number;
  'Qty Out': number;
  Balance: number;
  'Ref No': string;
}

export interface LedgerLogEntry {
  DateIso: string;
  'Ledger Name': string;
  Type: string;
  Debit?: number;
  Credit?: number;
  'Ref No': string;
  Narration: string;
}

export type VoucherGroupType =
  | 'Payment'
  | 'Receipt'
  | 'Journal'
  | 'Contra'
  | 'Sale'
  | 'Purchase'
  | 'Credit Note'
  | 'Debit Note'
  | 'Delivery Note'
  | 'Quotation'
  | 'Physical Stock'
  | 'CreditNote'
  | 'DebitNote'
  | 'DeliveryNote'
  | 'PhysicalStock';

export interface VoucherType {
  id: string;
  name: string;
  parentType?: VoucherGroupType;
  type?: VoucherGroupType;
  typeCode?: 'P' | 'R' | 'J' | 'C' | 'S' | 'PUR' | 'CN' | 'DN' | 'DEL_NOTE' | 'QUOTATION' | 'PHYSICAL_STOCK';
  prefix: string;
  numberingMode: 'auto' | 'manual';
  startingNumber?: number;
  zeroPadding?: number;
  suffix?: string;
  defaultDebitLedger?: string;
  defaultCreditLedger?: string;
  defaultNarration?: string;
  isDefault?: boolean;
  description?: string;
  lineDescription?: string;
  isActive?: boolean;
  status?: 'Active' | 'Inactive';
}

export interface VoucherLine {
  type: 'Dr' | 'Cr';
  ledger: string;
  amount: number;
  narration?: string;
}

export interface Voucher {
  voucherNo: string;
  date: string;
  type: 'P' | 'R' | 'J' | 'C' | 'S' | 'PUR' | 'CN' | 'DN' | 'DEL_NOTE' | 'PHYSICAL_STOCK' | 'QUOTATION';
  voucherTypeId?: string;
  voucherTypeName?: string;
  debitLedger?: string;
  creditLedger?: string;
  amount: number;
  totalAmount?: number;
  narration: string;
  status?: 'Active' | 'Cancelled';
  cancelledAt?: string;
  cancellationReason?: string;
  lines?: VoucherLine[];
  partyName?: string;
  originalInvoiceRef?: string;
  items?: Array<{
    itemCode: string;
    itemName: string;
    description?: string;
  lineDescription?: string;
    qty: number;
    rate?: number;
    discount?: number;
    gstPct?: number;
    amount?: number;
    bookQty?: number;
    physicalQty?: number;
    differenceQty?: number;
  }>;
}

export interface QuotationItem {
  itemCode: string;
  itemName: string;
  description?: string;
  lineDescription?: string;
  qty: number;
  unit?: string;
  rate: number;
  discount: number;
  discountType?: 'flat' | 'percent';
  taxableValue: number;
  gstPct: number;
  gstAmount: number;
  zeroRated: 'Y' | 'N';
  lineTotal: number;
}

export interface Quotation {
  quotationNo: string;
  date: string;
  validUntil?: string;
  customer: CustomerDetails;
  taxable: number;
  zeroRated: number;
  gstAmt: number;
  total: number;
  status: 'Draft' | 'Sent' | 'Accepted' | 'Converted' | 'Expired';
  remarks?: string;
  paymentTerms?: string;
  deliveryTerms?: string;
  termsAndConditions?: string;
  voucherTypeId?: string;
  voucherTypeName?: string;
  items: QuotationItem[];
}

export interface DeliveryNoteItem {
  itemCode: string;
  itemName: string;
  description?: string;
  lineDescription?: string;
  qty: number;
  unit?: string;
  rate?: number;
  amount?: number;
}

export interface DeliveryNote {
  noteNo: string;
  date: string;
  customer: CustomerDetails;
  orderRefNo?: string;
  dispatchThrough?: string;
  destination?: string;
  vehicleNo?: string;
  status: 'Dispatched' | 'Delivered' | 'Invoiced' | 'Cancelled';
  remarks?: string;
  voucherTypeId?: string;
  voucherTypeName?: string;
  items: DeliveryNoteItem[];
}

export interface PhysicalStockItem {
  itemCode: string;
  itemName: string;
  unit: string;
  bookQty: number;
  physicalQty: number;
  differenceQty: number;
  rate: number;
  varianceValue: number;
}

export interface PhysicalStockVoucher {
  voucherNo: string;
  date: string;
  verifiedBy?: string;
  remarks?: string;
  totalItemsCounted: number;
  totalShortageQty: number;
  totalExcessQty: number;
  netVarianceValue: number;
  items: PhysicalStockItem[];
}

export interface BarcodeQueueItem {
  itemCode: string;
  itemName: string;
  barcode: string;
  rate: number;
  mrp: number;
  gstPct: number;
  qty: number;
}

export interface PayHead {
  id: string;
  name: string;
  type: 'Earning' | 'Deduction';
  calculationType: 'Fixed' | 'PercentBasic' | 'PercentGross' | 'Manual';
  defaultValue: number;
  isStatutory?: boolean;
  description?: string;
  lineDescription?: string;
  enabled: boolean;
}

export interface Employee {
  id: string;
  empCode: string;
  fullName: string;
  cidNo: string;
  tpnNo?: string;
  nppfNo?: string;
  designation: string;
  department: string;
  joiningDate: string;
  exitDate?: string;
  contactNo: string;
  email?: string;
  bankName: string;
  bankBranch?: string;
  accountNo: string;
  basicSalary: number;
  status: 'Active' | 'Inactive';
  customPayHeads?: {
    [payHeadId: string]: {
      overrideValue?: number;
      enabled?: boolean;
      endMonth?: string; // e.g. "2026-12" after which deduction stops automatically
    }
  };
}

export type AdvanceType = 'Local DSA' | 'Foreign DSA' | 'Imprest' | 'Salary Advance' | 'Welfare Loan';

export interface EmployeeAdvance {
  id: string;
  advanceNo: string;
  employeeId: string;
  type: AdvanceType;
  amount: number;
  date: string;
  narration: string;
  status: 'Open' | 'Settled';
  settledAmount: number;
  settledDate?: string;
  issueVoucherId?: string;
  settlementVoucherId?: string;
}

export interface PayrollPayHeadItem {
  payHeadId: string;
  payHeadName: string;
  type: 'Earning' | 'Deduction';
  amount: number;
}

export interface PayrollEntry {
  id: string;
  empId: string;
  empCode: string;
  fullName: string;
  cidNo: string;
  designation: string;
  department: string;
  bankName: string;
  accountNo: string;
  basicSalary: number; // Full base monthly salary
  monthTotalDays?: number; // Total days in month (e.g. 30)
  workingDays?: number; // Actual days worked (e.g. 15 if left mid-month)
  earnings: PayrollPayHeadItem[];
  deductions: PayrollPayHeadItem[];
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  paymentStatus: 'Unpaid' | 'Paid';
  paymentDate?: string;
  paymentMode?: 'Bank Transfer' | 'Cash' | 'Cheque';
  voucherRefNo?: string;
  remarks?: string;
}

export interface MonthlyPayroll {
  id: string; // e.g. "2026-08"
  monthYear: string; // e.g. "August 2026"
  year: number;
  month: number;
  processedDate: string;
  entries: PayrollEntry[];
  totalGrossPay: number;
  totalDeductions: number;
  totalNetPay: number;
  isPostedToAccounting: boolean;
  voucherRefNo?: string;
}

export * from './types/assetManagement';
