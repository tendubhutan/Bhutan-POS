export type GstSourceType = 'manual' | 'ledger' | 'voucher' | 'formula';

export interface GstFieldConfig {
  id: string;
  label: string;
  dataType: 'text' | 'number' | 'date';
  sourceType: GstSourceType;
  sourceValue?: string;
  showInReport?: boolean;
  order: number;
}

export interface GstInputTypeConfig {
  typeId: string;
  fields: GstFieldConfig[];
}

export interface Config {
  CompanyName: string;
  Address: string;
  CompanyGSTNo: string;
  CompanyTPNNo: string;
  CompanyAddress?: string;
  CompanyPhone?: string;
  CompanyEmail?: string;
  GSTIN?: string;
  GSTRate: string; // e.g. "5"
  CurrencySymbol: string; // e.g. "Nu."
  Bank1Ledger: string;
  Bank2Ledger: string;
  CompanyBankDetails: string;
  EnableGST: string; // "true" | "false"
  EnableGSTInputTax?: string; // "true" | "false"
  gstInputConfigs?: string; // JSON encoded GstInputTypeConfig[]
  EnableSerials: string; // "true" | "false"
  EnablePharmacyBatch?: string; // "true" | "false"
  EnableItemDiscount?: string; // "true" | "false"
  ItemDiscountType?: "flat" | "percent";
  BillDiscountType?: "flat" | "percent";
  EnableCategory?: string; // "true" | "false"
  EnableAssetManagement?: string; // "true" | "false"
  EnablePayroll?: string;
  EnableStaffAttendanceAndLeave?: string; // "true" | "false"
  EnableStaffAssignments?: string; // "true" | "false"
  EnablePOS?: string;
  EnableNormalSale?: string;
  EnableEmployeeAdvances?: string; // "true" | "false"
  BarcodePrefix: string;
  CompanyLogo?: string;
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
  SalesOrderPrefix?: string;
  PurchaseOrderPrefix?: string;
  ReceiptNotePrefix?: string;
  SalesInvoicePrefix?: string;
  SalesInvoiceStartingNo?: number;
  POSInvoicePrefix?: string;
  POSInvoiceStartingNo?: number;
  PurchaseInvoicePrefix?: string;
  PurchaseInvoiceStartingNo?: number;
  EnableBillDiscount?: string; // "true" | "false"
  IntegrateAccountsWithInventory?: string; // "true" | "false"
  ReportDetailDepth?: 'summary' | 'detailed' | 'super_detailed';
  EnableBankReconciliation?: string; // "true" | "false"
  EnableAltUnitPrice?: string; // "true" | "false"
  EnableBankTxnId?: string; // "true" | "false"
  EnableWholesalePrice?: string; // "true" | "false"
  EnableBillWiseDetails?: string; // "true" | "false"
  EnableAdvancedAI?: string; // "true" | "false"
  EnableAuditTrail?: string; // "true" | "false"
  PrintAuditStamp?: string; // "true" | "false"
  AllowSupportAccess?: string; // "true" | "false"
  EnableSpareParts?: string; // "true" | "false"
  EnableRackBin?: string; // "true" | "false"
  EnableCompatibility?: string; // "true" | "false"
  PrintPartNumber?: string; // "true" | "false"
  PrintCompatibility?: string; // "true" | "false"
  EnableGarmentsAndFootwear?: string; // "true" | "false"
  EnableSize?: string; // "true" | "false"
  EnableColor?: string; // "true" | "false"
  PrintSize?: string; // "true" | "false"
  PrintColor?: string; // "true" | "false"
  EnablePurchase?: string; // "true" | "false"
  EnableVouchers?: string; // "true" | "false"
  EnableSchemes?: string; // "true" | "false"
  EnableBarcodePrinting?: string; // "true" | "false"
  EnableMultiBranch?: string; // "true" | "false"
  EnableMultiGodown?: string; // "true" | "false"
  BranchTransferMode?: 'flexible' | 'direct' | 'challan';
  StockTransferPrefix?: string;
  TransferChallanPrefix?: string;
  ActiveBranchId?: string;
  ActiveBranchName?: string;
  superadminFeatures?: Record<string, boolean>;
}

export interface Branch {
  id: string;
  code: string;
  name: string;
  isHeadOffice?: boolean;
  address?: string;
  dzongkhag?: string;
  phone?: string;
  email?: string;
  taxId?: string;
  tradeLicense?: string;
  isActive: boolean;
  createdDate?: string;
  notes?: string;
}

export interface Godown {
  id: string;
  code: string;
  name: string;
  branchId: string;
  branchName?: string;
  address?: string;
  isDefault?: boolean;
  isActive: boolean;
  notes?: string;
}

export interface TerminalConfig {
  id: string;
  name: string;
  code: string;
  role: 'Cashier' | 'Accountant' | 'Sales' | 'Manager' | 'Admin';
  defaultView: 'pos' | 'normalsale' | 'vouchers' | 'sales' | 'reports' | 'dashboard';
  description?: string;
  tag?: string;
  color?: string;
  branchId?: string;
  branchName?: string;
  isActive: boolean;
  isPrimary?: boolean;
}

export interface StockTransferItem {
  itemCode: string;
  itemName: string;
  unit: string;
  qty: number;
  rate?: number;
  amount?: number;
  batchNo?: string;
  expiryDate?: string;
  serials?: string[];
  size?: string;
  color?: string;
  partNumber?: string;
}

export interface StockTransferVoucher {
  id: string;
  transferNo: string;
  date: string;
  transferMode: 'direct' | 'challan'; // 'direct' = 1-step instant; 'challan' = 2-step in-transit
  status: 'completed' | 'in_transit' | 'received' | 'cancelled';
  fromBranchId: string;
  fromBranchName: string;
  toBranchId: string;
  toBranchName: string;
  fromGodownId?: string;
  fromGodownName?: string;
  toGodownId?: string;
  toGodownName?: string;
  vehicleNo?: string;
  driverName?: string;
  driverPhone?: string;
  dispatchTime?: string;
  receivedDate?: string;
  receivedBy?: string;
  receivedNotes?: string;
  narration?: string;
  items: StockTransferItem[];
  totalQty: number;
  totalAmount?: number;
  createdBy?: string;
}

export type AuditActionType = 'ENTERED' | 'ALTERED' | 'CANCELLED' | 'DELETED';

export interface AuditLogEntry {
  id: string;
  timestamp: string; // ISO string
  date: string; // YYYY-MM-DD
  time: string; // e.g. 08:30:15 PM
  action: AuditActionType;
  userId: string;
  userName: string;
  userRole: string;
  module: string; // e.g. "Sales Invoice", "POS Billing", "Purchase Bill", "Payment", "Receipt", "Journal", "Contra", "Credit Note", "Debit Note", "Quotation", "Delivery Note", "Physical Stock", "Item Master", "Ledger Master"
  recordId: string; // Ref No, Voucher No, Item Code, or Ledger Name
  partyName?: string;
  amount?: number;
  prevAmount?: number;
  details?: string;
}

export interface BillAllocation {
  billNo: string;
  billDate?: string;
  billAmount?: number;
  amount: number;
}

export interface BillWiseDetail {
  billNo: string;
  billDate: string;
  originalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  billType: 'Sales Invoice' | 'Purchase Bill' | 'Opening Balance' | 'Debit Note' | 'Credit Note' | 'Journal';
  dueDate?: string;
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
  role: 'superadmin' | 'Administrator' | 'admin' | 'Manager' | 'Cashier' | 'Accountant' | 'Custom';
  pinCode?: string;
  status: 'Active' | 'Inactive';
  permissions: UserPermission[];
}

export interface ItemVariant {
  id: string;
  size: string;
  color: string;
  barcode: string;
  openingStock: number;
  openingAmount?: number;
  purchaseRate?: number;
  saleRate?: number;
  wholesaleRate?: number;
  mrp?: number;
  currentStock?: number;
}

export interface ItemBatch {
  id: string;
  batchNo: string;
  mfgDate?: string;
  expDate: string; // YYYY-MM-DD or MM/YYYY
  barcode?: string;
  openingStock?: number;
  currentStock: number;
  purchaseRate: number;
  saleRate: number;
  wholesaleRate?: number;
  mrp?: number;
  manufacturer?: string;
}

export interface BranchStockAllocation {
  branchId: string;
  branchName: string;
  godownId?: string;
  godownName?: string;
  openingStock: number;
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
  'Wholesale Rate'?: number;
  MRP: number;
  'GST %': number;
  'Zero Rated (Y/N)': 'Y' | 'N';
  'Is Serialized': 'Y' | 'N';
  'Maintain Stock'?: 'Y' | 'N';
  'HSN/SAC': string;
  'Opening Stock': number;
  'Opening Amount'?: number;
  'Current Stock': number;
  'Reorder Level': number;
  'Opening Serials'?: string;
  partNumber?: string; // Part Number / OEM No. for spare parts
  rackLocation?: string; // Rack / Bin / Shelf location
  compatibility?: string; // Vehicle / Machine compatibility models
  size?: string; // Footwear / Garment size(s) e.g. "M", "42", "S, M, L"
  color?: string; // Garment / Footwear color(s) e.g. "Black", "Red", "Blue"
  brand?: string;
  Brand?: string;
  isPharmacy?: 'Y' | 'N';
  maintainBatch?: 'Y' | 'N';
  batches?: ItemBatch[];
  variants?: ItemVariant[];
  branchAllocations?: BranchStockAllocation[];
  multiUnits?: { unit: string; conversionFactor: number; purchaseRate: number; saleRate: number; wholesaleRate?: number; mrp: number; }[];
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
  'Base Unit'?: string;
  oldName?: string;
}

export interface UnitGroup {
  'Group Name': string;
  'Primary Unit'?: string;
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
  selectedSize?: string;
  selectedColor?: string;
  selectedBatchNo?: string;
  selectedBatchExp?: string;
  selectedBatchId?: string;
  variantId?: string;
  barcode?: string;
  appliedSchemeId?: string;
  appliedSchemeName?: string;
  originalRate?: number;
  isFreeItem?: boolean;
  schemeDiscount?: number;
}

export type SchemeTargetType = 'all_items' | 'item' | 'item_group' | 'item_category' | 'brand';
export type SchemeType = 'percent_discount' | 'flat_discount' | 'special_rate' | 'bogo' | 'bill_discount';
export type SchemeSaleChannel = 'all' | 'pos_only' | 'b2b_only';

export interface Scheme {
  id: string;
  name: string;
  code?: string;
  description?: string;
  status: 'active' | 'inactive';
  appliesToSaleType: SchemeSaleChannel; // 'all' | 'pos_only' | 'b2b_only'
  
  // Date range (YYYY-MM-DD)
  startDate?: string;
  endDate?: string;
  
  // Recurring days of week: 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat
  daysOfWeek?: number[];
  
  // Time limits (e.g. Happy Hour)
  hasTimeLimit?: boolean;
  startTime?: string; // "HH:MM" e.g. "14:00"
  endTime?: string;   // "HH:MM" e.g. "18:00"
  
  // Target scope
  targetType: SchemeTargetType;
  targetValues: string[]; // List of Item Codes, Group Names, Category Names, or Brands
  
  // Benefit
  schemeType: SchemeType;
  discountValue?: number; // % or Nu. flat per unit
  specialRate?: number;   // Promotional fixed rate per unit
  minQty?: number;        // Minimum purchase quantity required
  maxQty?: number;        // Optional max quantity cap
  
  // Buy X Get Y Free (BOGO)
  buyQty?: number;
  freeQty?: number;
  freeItemCode?: string;
  
  // Bill-Level Scheme (Spend X Get Y)
  minBillAmount?: number;
  billDiscountType?: 'percent' | 'flat';
  billDiscountValue?: number;
  
  priority?: number;      // Higher priority wins if multiple schemes match
  createdAt?: string;
  updatedAt?: string;
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
  companyId?: string;
  company_id?: string;
  isPOS?: boolean;
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
  appliedBillSchemeName?: string;
  appliedBillSchemeId?: string;
  voucherTypeId?: string;
  voucherTypeName?: string;
  config: Config;
  bankTxnNo?: string;
  bank2TxnNo?: string;
  branchId?: string;
  branchName?: string;
  godownId?: string;
  godownName?: string;
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
    discountType?: 'flat' | 'percent';
    discountAmt?: number;
    originalRate?: number;
    appliedSchemeId?: string;
    appliedSchemeName?: string;
    'Taxable Value': number;
    'GST %': number;
    'GST Amount': number;
    'Zero Rated (Y/N)': 'Y' | 'N';
    'Line Total': number;
    'Serial Numbers': string;
    'Batch No'?: string;
    'Expiry Date'?: string;
    batchId?: string;
  }>;
}

export interface PurchaseInvoice {
  companyId?: string;
  company_id?: string;
  billNo: string;
  invoiceNo?: string;
  supplierBillNo?: string;
  receiptNoteNo?: string;
  poNo?: string;
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
  bankTxnNo?: string;
  bank2TxnNo?: string;
  branchId?: string;
  branchName?: string;
  godownId?: string;
  godownName?: string;
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
    selectedSize?: string;
    selectedColor?: string;
    Size?: string;
    Color?: string;
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
  branchId?: string;
  branchName?: string;
  godownId?: string;
  godownName?: string;
}

export interface LedgerLogEntry {
  DateIso: string;
  'Ledger Name': string;
  Type: string;
  Debit?: number;
  Credit?: number;
  'Ref No': string;
  Narration: string;
  transactionId?: string;
  'Transaction ID'?: string;
  branchId?: string;
  branchName?: string;
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
  | 'Sales Order'
  | 'Purchase Order'
  | 'Receipt Note'
  | 'CreditNote'
  | 'DebitNote'
  | 'DeliveryNote'
  | 'PhysicalStock'
  | 'SalesOrder'
  | 'PurchaseOrder'
  | 'ReceiptNote';

export interface VoucherType {
  id: string;
  name: string;
  parentType?: VoucherGroupType;
  type?: VoucherGroupType;
  typeCode?: 'P' | 'R' | 'J' | 'C' | 'S' | 'PUR' | 'CN' | 'DN' | 'DEL_NOTE' | 'QUOTATION' | 'PHYSICAL_STOCK' | 'SALES_ORDER' | 'PURCHASE_ORDER' | 'RECEIPT_NOTE';
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
  branchId?: string;
  branchCode?: string;
  branchName?: string;
}

export interface VoucherLine {
  type: 'Dr' | 'Cr';
  ledger: string;
  amount: number;
  narration?: string;
  transactionId?: string;
}

export interface Voucher {
  companyId?: string;
  company_id?: string;
  voucherNo: string;
  date: string;
  type: 'P' | 'R' | 'J' | 'C' | 'S' | 'PUR' | 'CN' | 'DN' | 'DEL_NOTE' | 'PHYSICAL_STOCK' | 'QUOTATION' | 'SALES_ORDER' | 'PURCHASE_ORDER' | 'RECEIPT_NOTE' | 'STOCK_TRANSFER';
  voucherTypeId?: string;
  voucherTypeName?: string;
  branchId?: string;
  branchName?: string;
  fromBranchId?: string;
  fromBranchName?: string;
  toBranchId?: string;
  toBranchName?: string;
  debitLedger?: string;
  creditLedger?: string;
  amount: number;
  totalAmount?: number;
  narration: string;
  transactionId?: string;
  bankTxnNo?: string;
  chequeNo?: string;
  status?: 'Active' | 'Cancelled';
  cancelledAt?: string;
  cancellationReason?: string;
  lines?: VoucherLine[];
  partyName?: string;
  partyGstNo?: string;
  originalInvoiceRef?: string;
  taxable?: number;
  gstAmt?: number;
  billNo?: string;
  // GST Input Tracking Fields
  gstInputType?: 'Local Purchase' | 'Local Expenses' | 'Bank Charges' | 'Import Customs GST Payment' | 'Import Purchase' | 'None';
  supplierName?: string;
  supplierGstNo?: string;
  supplierCountry?: string;
  invoiceNo?: string;
  invoiceDate?: string;
  referenceNo?: string;
  declarationNo?: string;
  declarationDate?: string;
  taxableAmount?: number;
  exemptedAmount?: number;
  gstAmount?: number;
  totalImportAmount?: number;
  customGstData?: Record<string, any>;
  billAllocations?: BillAllocation[];
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
  qty: number | '';
  unit?: string;
  rate?: number;
  amount?: number;
}

export interface DeliveryNote {
  noteNo: string;
  date: string;
  customer: CustomerDetails;
  orderRefNo?: string;
  invoiceNo?: string;
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
  wholesaleRate?: number;
  mrp: number;
  gstPct: number;
  qty: number;
  size?: string;
  color?: string;
  batchNo?: string;
  expDate?: string;
  mfgDate?: string;
  batchId?: string;
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

export interface BiometricCredential {
  id: string; // Base64URL-encoded credential ID
  rawId?: string;
  type: string; // e.g. 'public-key'
  createdAt: string; // ISO date string
  deviceName?: string; // e.g. 'iPhone TouchID / FaceID', 'Android Fingerprint', 'Chrome Windows Hello'
  transports?: string[];
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
  pin?: string; // 4-6 digit security PIN for mobile staff portal sign-in (default: 1234)
  biometricCredentials?: BiometricCredential[]; // WebAuthn registered biometric credentials
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

export interface TrashEntry {
  id: string;
  refNo: string;
  type: string;
  amount: number;
  date: string;
  deletedAt: string;
  narration?: string;
  originalData?: any;
}

export interface BankReconEntry {
  isCleared: boolean;
  clearedDate?: string;
  transactionId?: string;
  notes?: string;
}

export type BankReconState = Record<string, BankReconEntry>;

export interface SalesOrderItem {
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

export interface SalesOrder {
  orderNo: string;
  date: string;
  deliveryDate?: string;
  customer: CustomerDetails;
  taxable: number;
  zeroRated: number;
  gstAmt: number;
  total: number;
  status: 'Pending' | 'Confirmed' | 'Delivered' | 'Invoiced' | 'Cancelled';
  remarks?: string;
  termsAndConditions?: string;
  voucherTypeId?: string;
  voucherTypeName?: string;
  items: SalesOrderItem[];
}

export interface PurchaseOrderItem {
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

export interface PurchaseOrder {
  poNo: string;
  date: string;
  expectedDate?: string;
  supplier: {
    name: string;
    ledger?: string;
    gstNo?: string;
    tpnNo?: string;
    address?: string;
    phone?: string;
  };
  taxable: number;
  zeroRated: number;
  gstAmt: number;
  total: number;
  status: 'Pending' | 'Approved' | 'Received' | 'Invoiced' | 'Cancelled';
  remarks?: string;
  termsAndConditions?: string;
  voucherTypeId?: string;
  voucherTypeName?: string;
  items: PurchaseOrderItem[];
}

export interface ReceiptNoteItem {
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

export interface ReceiptNote {
  noteNo: string;
  date: string;
  supplierChallanNo?: string;
  poNo?: string;
  invoiceNo?: string;
  supplier: {
    name: string;
    ledger?: string;
    gstNo?: string;
    tpnNo?: string;
    address?: string;
    phone?: string;
  };
  taxable: number;
  zeroRated: number;
  gstAmt: number;
  total: number;
  status: 'Received' | 'Invoiced' | 'Cancelled';
  remarks?: string;
  voucherTypeId?: string;
  voucherTypeName?: string;
  items: ReceiptNoteItem[];
}

export * from './types/assetManagement';
