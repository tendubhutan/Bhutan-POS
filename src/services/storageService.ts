import {
  Config,
  Item,
  ItemGroup,
  Unit,
  UnitGroup,
  Ledger,
  LedgerGroup,
  CartLine,
  CustomerDetails,
  PaymentDetails,
  SalesInvoice,
  PurchaseInvoice,
  HeldBill,
  StockLedgerEntry,
  LedgerLogEntry,
  Voucher,
  VoucherType,
  VoucherGroupType,
  Quotation,
  QuotationItem,
  SalesOrder,
  SalesOrderItem,
  PurchaseOrder,
  PurchaseOrderItem,
  ReceiptNote,
  ReceiptNoteItem,
  DeliveryNote,
  DeliveryNoteItem,
  PhysicalStockItem,
  PhysicalStockVoucher,
  PayHead,
  Employee,
  PayrollEntry,
  MonthlyPayroll,
  AppUser,
  UserPermission,
  ModuleId,
  TrashEntry,
  BillAllocation,
  BillWiseDetail,
  AuditLogEntry,
  AuditActionType,
  Branch,
  Godown,
  TerminalConfig,
  StockTransferVoucher,
  StockTransferItem
} from '../types';
import {
  AssetCategory,
  FixedAsset,
  AssetDisposal
} from '../types/assetManagement';
import {
  DEFAULT_CATEGORIES,
  DEFAULT_ASSETS
} from './assetManagementService';
import {
  syncConfigToSupabase as syncConfigToFirestore,
  syncItemToSupabase as syncItemToFirestore,
  syncItemsBatchToSupabase as syncItemsBatchToFirestore,
  deleteItemFromSupabase as deleteItemFromFirestore,
  syncLedgerToSupabase as syncLedgerToFirestore,
  deleteLedgerFromSupabase as deleteLedgerFromFirestore,
  syncSalesInvoiceToSupabase as syncSalesInvoiceToFirestore,
  deleteSalesInvoiceFromSupabase as deleteSalesInvoiceFromFirestore,
  syncPurchaseInvoiceToSupabase as syncPurchaseInvoiceToFirestore,
  deletePurchaseInvoiceFromSupabase as deletePurchaseInvoiceFromFirestore,
  syncVoucherToSupabase as syncVoucherToFirestore,
  deleteVoucherFromSupabase as deleteVoucherFromFirestore,
  purgeRemoteCompanyData
} from './supabaseSyncService';
import { 
  getActiveCompanyId, 
  DEFAULT_TENANT_COMPANY,
  createFinancialYear,
  createCompany,
  setActiveFYId
} from './supabaseTenantService';
import { supabase, isSupabaseConfigured } from '../lib/supabase';


export const STORAGE_KEYS = {
  CONFIG: 'deep_pos_config',
  ITEMS: 'deep_pos_items',
  UNITS: 'deep_pos_units',
  UNIT_GROUPS: 'deep_pos_unit_groups',
  ITEM_GROUPS: 'deep_pos_item_groups',
  ITEM_CATEGORIES: 'deep_pos_item_categories',
  LEDGERS: 'deep_pos_ledgers',
  LEDGER_GROUPS: 'deep_pos_ledger_groups',
  VOUCHER_TYPES: 'deep_pos_voucher_types',
  HELD_BILLS: 'deep_pos_held_bills',
  SALES_INVOICES: 'deep_pos_sales_invoices',
  PURCHASE_INVOICES: 'deep_pos_purchase_invoices',
  STOCK_LEDGER: 'deep_pos_stock_ledger',
  LEDGER_LOG: 'deep_pos_ledger_log',
  COUNTERS: 'deep_pos_counters',
  VOUCHERS: 'deep_pos_vouchers',
  QUOTATIONS: 'deep_pos_quotations',
  DELIVERY_NOTES: 'deep_pos_delivery_notes',
  SALES_ORDERS: 'deep_pos_sales_orders',
  PURCHASE_ORDERS: 'deep_pos_purchase_orders',
  RECEIPT_NOTES: 'deep_pos_receipt_notes',
  PHYSICAL_STOCK: 'deep_pos_physical_stock',
  PAY_HEADS: 'deep_pos_pay_heads',
  EMPLOYEES: 'deep_pos_employees',
  EMPLOYEE_ADVANCES: 'deep_pos_employee_advances',
  MONTHLY_PAYROLLS: 'deep_pos_monthly_payrolls',
  USERS: 'deep_pos_users',
  TRASH_LOG: 'deep_pos_trash',
  BANK_RECON: 'deep_pos_bank_recon',
  DELETED_LEDGERS: 'deep_pos_deleted_ledgers',
  DELETED_ITEMS: 'deep_pos_deleted_items',
  DELETED_SALES_INVOICES: 'deep_pos_deleted_sales_invoices',
  DELETED_PURCHASE_INVOICES: 'deep_pos_deleted_purchase_invoices',
  DELETED_VOUCHERS: 'deep_pos_deleted_vouchers',
  AUDIT_LOG: 'deep_pos_audit_log',
  RACKS: 'deep_pos_racks',
  COMPATIBILITIES: 'deep_pos_compatibilities',
  SIZES: 'deep_pos_sizes',
  COLORS: 'deep_pos_colors',
  SCHEMES: 'deep_pos_schemes',
  BRANCHES: 'deep_pos_branches',
  GODOWNS: 'deep_pos_godowns',
  STOCK_TRANSFERS: 'deep_pos_stock_transfers',
  TERMINALS: 'deep_pos_terminals',
  LEAVE_TYPES: 'deep_pos_leave_types',
  LEAVE_APPLICATIONS: 'deep_pos_leave_applications',
  ATTENDANCE_RECORDS: 'deep_pos_attendance_records',
  TASK_ASSIGNMENTS: 'deep_pos_task_assignments',
  OFFICE_NETWORK_CONFIG: 'deep_pos_office_network_config'
};

export const DEFAULT_BRANCHES: Branch[] = [
  {
    id: 'branch_ho',
    code: 'HO-01',
    name: 'Head Office (Thimphu)',
    isHeadOffice: true,
    address: 'Norzin Lam, Thimphu, Bhutan',
    dzongkhag: 'Thimphu',
    phone: '+975-2-321000',
    email: 'ho@store.bt',
    taxId: '30AAAAA0000A1Z5',
    tradeLicense: 'TL-TH-2024-001',
    isActive: true,
    createdDate: '2026-01-01',
    notes: 'Main Head Office & Central Administration'
  },
  {
    id: 'branch_phuntsholing',
    code: 'BR-02',
    name: 'Phuntsholing Branch',
    isHeadOffice: false,
    address: 'Dhamdhara, Phuntsholing, Chukha, Bhutan',
    dzongkhag: 'Chukha',
    phone: '+975-5-252000',
    email: 'pshling@store.bt',
    taxId: '30AAAAA0000A1Z5',
    tradeLicense: 'TL-CH-2024-042',
    isActive: true,
    createdDate: '2026-01-15',
    notes: 'Border Town Wholesale & Retail Outstation'
  }
];

export const DEFAULT_GODOWNS: Godown[] = [
  {
    id: 'godown_ho_main',
    code: 'GD-HO-01',
    name: 'Main Central Godown',
    branchId: 'branch_ho',
    branchName: 'Head Office (Thimphu)',
    address: 'Basement Storage Area, Norzin Lam',
    isDefault: true,
    isActive: true,
    notes: 'Primary bulk receiving warehouse'
  },
  {
    id: 'godown_ho_counter',
    code: 'GD-HO-02',
    name: 'Front Retail Counter',
    branchId: 'branch_ho',
    branchName: 'Head Office (Thimphu)',
    address: 'Ground Floor Showroom Floor',
    isDefault: false,
    isActive: true,
    notes: 'Retail sales counter and display shelves'
  },
  {
    id: 'godown_pshling_main',
    code: 'GD-PSH-01',
    name: 'Phuntsholing Warehouse',
    branchId: 'branch_phuntsholing',
    branchName: 'Phuntsholing Branch',
    address: 'Dhamdhara Commercial Godown',
    isDefault: true,
    isActive: true,
    notes: 'Outstation receiving and dispatch godown'
  }
];

export const DEFAULT_SIZES = [
  'XS',
  'S',
  'M',
  'L',
  'XL',
  'XXL',
  '38',
  '39',
  '40',
  '41',
  '42',
  '43',
  '44',
  '45',
  'Free Size'
];

export const DEFAULT_COLORS = [
  'Black',
  'White',
  'Red',
  'Blue',
  'Navy Blue',
  'Grey',
  'Green',
  'Yellow',
  'Brown',
  'Beige',
  'Pink'
];

export const DEFAULT_RACKS = [
  'Rack A-01',
  'Rack A-02',
  'Rack B-01',
  'Rack B-02',
  'Rack C-01',
  'Bin 01',
  'Bin 02',
  'Warehouse Floor'
];

export const DEFAULT_COMPATIBILITIES = [
  'Toyota Hilux 2.8',
  'Mahindra Bolero',
  'Maruti Alto 800',
  'Hyundai Creta 1.6',
  'JCB 3DX Backhoe',
  'Tata Ace',
  'Ford Ranger',
  'Universal / Multi-Fit'
];

export const DEFAULT_CONFIG: Config = {
  CompanyName: 'My Retail Store',
  Address: 'Phuntsholing, Chukha, Bhutan',
  CompanyGSTNo: '30AAAAA0000A1Z5',
  CompanyTPNNo: 'TPN-1029384',
  GSTRate: '5',
  CurrencySymbol: 'Nu.',
  Bank1Ledger: 'BOB Account',
  Bank2Ledger: 'BNBL Account',
  CompanyBankDetails: 'Bank of Bhutan\nA/C: 1029384756\nBranch: Phuntsholing',
  SelectedBankLedgerForPrint: 'BOB Account',
  PrintBankDetailsOnInvoice: 'true',
  EnableGST: 'true',
  EnableSerials: 'true',
  EnablePharmacyBatch: 'true',
  EnableItemDiscount: 'true',
  EnableCategory: 'true',
  EnableAssetManagement: 'true',
  EnablePayroll: 'true',
  EnableStaffAttendanceAndLeave: 'true',
  EnableStaffAssignments: 'true',
  EnablePOS: 'true',
  EnableNormalSale: 'true',
  EnableEmployeeAdvances: 'true',
  EnableItemDescription: 'true',
  EnableAuditTrail: 'true',
  PrintAuditStamp: 'false',
  AllowSupportAccess: 'false',
  BarcodePrefix: '20',
  ReceiptHeaderImage: '',
  ReceiptSignatureImage: '',
  InvoiceTemplate: 'standard',
  PaperSize: '80mm',
  FooterTerms: '1. Goods once sold are non-refundable after 7 days.',
  SecondaryTerms: '2. Warranty claims require original tax invoice. All disputes subject to local jurisdiction.',
  PredefinedTermsList: [
    '1. Goods once sold are non-refundable after 7 days.',
    '2. Interest @ 18% p.a. will be charged if bill is not settled within credit period.',
    '3. Manufacturer warranty applies where applicable; original bill required for warranty claim.',
    '4. Subject to local municipal jurisdiction only.',
    '5. All disputes subject to local arbitration.'
  ],
  SignatoryTitle: 'Authorized Signatory',
  VoucherNumberingMode: 'auto',
  PaymentVoucherPrefix: 'PMT-',
  ReceiptVoucherPrefix: 'RCT-',
  JournalVoucherPrefix: 'JRN-',
  ContraVoucherPrefix: 'CTR-',
  CreditNotePrefix: 'CN-',
  DebitNotePrefix: 'DN-',
  DeliveryNotePrefix: 'DLV-',
  PhysicalStockPrefix: 'PHY-',
  QuotationPrefix: 'QTN-',
  IntegrateAccountsWithInventory: 'true',
  EnableBankReconciliation: 'true',
  EnableAltUnitPrice: 'true',
  EnableBankTxnId: 'true',
  EnableWholesalePrice: 'true',
  EnableBillWiseDetails: 'true',
  EnableSpareParts: 'false',
  EnableRackBin: 'true',
  EnableCompatibility: 'true',
  PrintPartNumber: 'true',
  PrintCompatibility: 'false',
  EnableGarmentsAndFootwear: 'false',
  EnableSize: 'true',
  EnableColor: 'true',
  PrintSize: 'true',
  PrintColor: 'true',
  EnableMultiBranch: 'false',
  EnableMultiGodown: 'false',
  BranchTransferMode: 'flexible',
  StockTransferPrefix: 'TRF-',
  TransferChallanPrefix: 'TRC-',
  ActiveBranchId: 'branch_ho',
  ActiveBranchName: 'Head Office (Thimphu)'
};

export const DEFAULT_VOUCHER_TYPES: VoucherType[] = [
  { id: 'vt_pmt_std', name: 'Payment Voucher', parentType: 'Payment', type: 'Payment', typeCode: 'P', prefix: 'PMT-', numberingMode: 'auto', startingNumber: 1, zeroPadding: 4, isDefault: true, isActive: true, status: 'Active', description: 'General cash and bank payments to vendors and expenses' },
  { id: 'vt_pmt_petty', name: 'Petty Cash Payment', parentType: 'Payment', type: 'Payment', typeCode: 'P', prefix: 'PETTY-', numberingMode: 'auto', startingNumber: 1, zeroPadding: 4, defaultCreditLedger: 'Cash-in-Hand', isDefault: false, isActive: true, status: 'Active', description: 'Day-to-day office tea, snacks, and petty expenses' },
  { id: 'vt_pmt_bank', name: 'Bank Payment', parentType: 'Payment', type: 'Payment', typeCode: 'P', prefix: 'BNK-PMT-', numberingMode: 'auto', startingNumber: 1, zeroPadding: 4, defaultCreditLedger: 'BOB Account', isDefault: false, isActive: true, status: 'Active', description: 'RTGS, NEFT, Cheque and online banking payments' },
  
  { id: 'vt_rct_std', name: 'Receipt Voucher', parentType: 'Receipt', type: 'Receipt', typeCode: 'R', prefix: 'RCT-', numberingMode: 'auto', startingNumber: 1, zeroPadding: 4, isDefault: true, isActive: true, status: 'Active', description: 'Customer settlements and other cash/bank receipts' },
  { id: 'vt_rct_bank', name: 'Bank Receipt', parentType: 'Receipt', type: 'Receipt', typeCode: 'R', prefix: 'BNK-RCT-', numberingMode: 'auto', startingNumber: 1, zeroPadding: 4, defaultDebitLedger: 'BOB Account', isDefault: false, isActive: true, status: 'Active', description: 'Direct bank transfers and deposits from clients' },
  { id: 'vt_rct_cust', name: 'Customer Collection', parentType: 'Receipt', type: 'Receipt', typeCode: 'R', prefix: 'COL-', numberingMode: 'auto', startingNumber: 1, zeroPadding: 4, isDefault: false, isActive: true, status: 'Active', description: 'Field agent and credit debtor collections' },

  { id: 'vt_jrn_std', name: 'Journal Voucher', parentType: 'Journal', type: 'Journal', typeCode: 'J', prefix: 'JRN-', numberingMode: 'auto', startingNumber: 1, zeroPadding: 4, isDefault: true, isActive: true, status: 'Active', description: 'Non-cash adjusting entries, depreciation & year-end closing' },
  { id: 'vt_jrn_sal', name: 'Salary Journal', parentType: 'Journal', type: 'Journal', typeCode: 'J', prefix: 'SAL-JRN-', numberingMode: 'auto', startingNumber: 1, zeroPadding: 4, isDefault: false, isActive: true, status: 'Active', description: 'Monthly employee payroll provisions and adjustments' },
  { id: 'vt_jrn_adj', name: 'Adjustment Journal', parentType: 'Journal', type: 'Journal', typeCode: 'J', prefix: 'ADJ-', numberingMode: 'auto', startingNumber: 1, zeroPadding: 4, isDefault: false, isActive: true, status: 'Active', description: 'Inventory write-offs and tax adjustments' },

  { id: 'vt_ctr_std', name: 'Contra Voucher', parentType: 'Contra', type: 'Contra', typeCode: 'C', prefix: 'CTR-', numberingMode: 'auto', startingNumber: 1, zeroPadding: 4, isDefault: true, isActive: true, status: 'Active', description: 'Fund transfers between Cash and Bank or between Bank accounts' },

  { id: 'vt_sale_cash', name: 'POS Cash Sale', parentType: 'Sale', type: 'Sale', typeCode: 'S', prefix: 'POS-', numberingMode: 'auto', startingNumber: 1, zeroPadding: 4, isDefault: true, isActive: true, status: 'Active', description: 'Standard fast counter POS cash & digital retail invoice (95% default)' },
  { id: 'vt_sale_credit', name: 'Credit / B2B Sale', parentType: 'Sale', type: 'Sale', typeCode: 'S', prefix: 'B2B-', numberingMode: 'auto', startingNumber: 1, zeroPadding: 4, isDefault: false, isActive: true, status: 'Active', description: 'Credit invoice for registered B2B debtors & institutional sales' },
  { id: 'vt_sale_std', name: 'Sales Invoice', parentType: 'Sale', type: 'Sale', typeCode: 'S', prefix: 'INV-', numberingMode: 'auto', startingNumber: 1, zeroPadding: 4, isDefault: false, isActive: false, status: 'Inactive', description: 'Standard general sales tax invoice series' },

  { id: 'vt_pur_std', name: 'Purchase Invoice', parentType: 'Purchase', type: 'Purchase', typeCode: 'PUR', prefix: 'PUR-', numberingMode: 'auto', startingNumber: 1, zeroPadding: 4, isDefault: true, isActive: true, status: 'Active', description: 'Inward supplier bills and stock purchase invoices' },
  { id: 'vt_pur_imp', name: 'Import Purchase', parentType: 'Purchase', type: 'Purchase', typeCode: 'PUR', prefix: 'IMP-PUR-', numberingMode: 'auto', startingNumber: 1, zeroPadding: 4, isDefault: false, isActive: true, status: 'Active', description: 'Customs import inward bills' },

  { id: 'vt_cn_std', name: 'Credit Note', parentType: 'Credit Note', type: 'Credit Note', typeCode: 'CN', prefix: 'CN-', numberingMode: 'auto', startingNumber: 1, zeroPadding: 4, isDefault: true, isActive: true, status: 'Active', description: 'Sales returns and price rebate credit allowances to customers' },
  { id: 'vt_dn_std', name: 'Debit Note', parentType: 'Debit Note', type: 'Debit Note', typeCode: 'DN', prefix: 'DN-', numberingMode: 'auto', startingNumber: 1, zeroPadding: 4, isDefault: true, isActive: true, status: 'Active', description: 'Purchase returns and debit charges to suppliers' },
  { id: 'vt_dlv_std', name: 'Delivery Note', parentType: 'Delivery Note', type: 'Delivery Note', typeCode: 'DEL_NOTE', prefix: 'DLV-', numberingMode: 'auto', startingNumber: 1, zeroPadding: 4, isDefault: true, isActive: true, status: 'Active', description: 'Goods dispatch delivery challans without immediate invoice' },
  { id: 'vt_qtn_std', name: 'Quotation / Proforma', parentType: 'Quotation', type: 'Quotation', typeCode: 'QUOTATION', prefix: 'QTN-', numberingMode: 'auto', startingNumber: 1, zeroPadding: 4, isDefault: true, isActive: true, status: 'Active', description: 'Customer price estimates and proforma quotations' },
  { id: 'vt_so_std', name: 'Sales Order', parentType: 'Sales Order', type: 'Sales Order', typeCode: 'SALES_ORDER', prefix: 'SO-', numberingMode: 'auto', startingNumber: 1, zeroPadding: 4, isDefault: true, isActive: true, status: 'Active', description: 'Customer sales orders and order confirmations' },
  { id: 'vt_po_std', name: 'Purchase Order', parentType: 'Purchase Order', type: 'Purchase Order', typeCode: 'PURCHASE_ORDER', prefix: 'PO-', numberingMode: 'auto', startingNumber: 1, zeroPadding: 4, isDefault: true, isActive: true, status: 'Active', description: 'Supplier purchase orders and order commitments' },
  { id: 'vt_grn_std', name: 'Receipt Note (GRN)', parentType: 'Receipt Note', type: 'Receipt Note', typeCode: 'RECEIPT_NOTE', prefix: 'GRN-', numberingMode: 'auto', startingNumber: 1, zeroPadding: 4, isDefault: true, isActive: true, status: 'Active', description: 'Inward goods receipt notes from suppliers' },
  { id: 'vt_phy_std', name: 'Physical Stock', parentType: 'Physical Stock', type: 'Physical Stock', typeCode: 'PHYSICAL_STOCK', prefix: 'PHY-', numberingMode: 'auto', startingNumber: 1, zeroPadding: 4, isDefault: true, isActive: true, status: 'Active', description: 'Physical inventory counting and audit verification' }
];

export const DEFAULT_USERS: AppUser[] = [
  {
    id: 'usr_admin',
    username: 'admin',
    fullName: 'System Administrator',
    role: 'Administrator',
    pinCode: '1234',
    status: 'Active',
    permissions: [
      { module: 'pos', display: true, create: true, edit: true, delete: true, print: true },
      { module: 'purchase', display: true, create: true, edit: true, delete: true, print: true },
      { module: 'vouchers', display: true, create: true, edit: true, delete: true, print: true },
      { module: 'masters', display: true, create: true, edit: true, delete: true, print: true },
      { module: 'barcode', display: true, create: true, edit: true, delete: true, print: true },
      { module: 'payroll', display: true, create: true, edit: true, delete: true, print: true },
      { module: 'reports', display: true, create: true, edit: true, delete: true, print: true },
      { module: 'settings', display: true, create: true, edit: true, delete: true, print: true }
    ]
  },
  {
    id: 'usr_cashier',
    username: 'cashier',
    fullName: 'Karma Store Cashier',
    role: 'Cashier',
    pinCode: '0000',
    status: 'Active',
    permissions: [
      { module: 'pos', display: true, create: true, edit: false, delete: false, print: true },
      { module: 'purchase', display: false, create: false, edit: false, delete: false, print: false },
      { module: 'vouchers', display: false, create: false, edit: false, delete: false, print: false },
      { module: 'masters', display: true, create: false, edit: false, delete: false, print: false },
      { module: 'barcode', display: true, create: false, edit: false, delete: false, print: true },
      { module: 'payroll', display: false, create: false, edit: false, delete: false, print: false },
      { module: 'reports', display: false, create: false, edit: false, delete: false, print: false },
      { module: 'settings', display: false, create: false, edit: false, delete: false, print: false }
    ]
  },
  {
    id: 'usr_accountant',
    username: 'accountant',
    fullName: 'Dechen Accountant',
    role: 'Accountant',
    pinCode: '5555',
    status: 'Active',
    permissions: [
      { module: 'pos', display: true, create: true, edit: true, delete: false, print: true },
      { module: 'purchase', display: true, create: true, edit: true, delete: false, print: true },
      { module: 'vouchers', display: true, create: true, edit: true, delete: true, print: true },
      { module: 'masters', display: true, create: true, edit: true, delete: false, print: true },
      { module: 'barcode', display: true, create: true, edit: true, delete: false, print: true },
      { module: 'payroll', display: true, create: true, edit: true, delete: true, print: true },
      { module: 'reports', display: true, create: true, edit: true, delete: false, print: true },
      { module: 'settings', display: true, create: false, edit: false, delete: false, print: false }
    ]
  }
];

export const DEFAULT_UNITS: Unit[] = [
  { 'Unit Name': 'Pcs', Symbol: 'pcs', Group: 'Count', 'Conversion Factor': 1 },
  { 'Unit Name': 'Box', Symbol: 'box', Group: 'Count', 'Conversion Factor': 10 },
  { 'Unit Name': 'Kg', Symbol: 'kg', Group: 'Weight', 'Conversion Factor': 1 },
  { 'Unit Name': 'Ltr', Symbol: 'ltr', Group: 'Volume', 'Conversion Factor': 1 }
];

const DEFAULT_UNIT_GROUPS: UnitGroup[] = [
  { 'Group Name': 'Count', 'Base Unit': 'Pcs' },
  { 'Group Name': 'Weight', 'Base Unit': 'Kg' },
  { 'Group Name': 'Volume', 'Base Unit': 'Ltr' }
];

export const DEFAULT_ITEM_GROUPS: ItemGroup[] = [
  { 'Group Name': 'General Electronics', 'Parent Group': '' },
  { 'Group Name': 'Computer Peripherals', 'Parent Group': 'General Electronics' },
  { 'Group Name': 'Groceries', 'Parent Group': '' },
  { 'Group Name': 'Stationery', 'Parent Group': '' }
];

const DEFAULT_ITEM_CATEGORIES: string[] = [
  'General',
  'Electronics',
  'Computer Hardware',
  'Mobile Accessories',
  'Groceries',
  'Stationery',
  'Apparel & Textiles',
  'Home & Kitchen',
  'Services'
];

const DEFAULT_LEDGER_GROUPS: LedgerGroup[] = [
  // Primary Groups (16 Standard Accounting Groups)
  { 'Group Name': 'Current Assets', 'Parent Group': '', Nature: 'Asset' },
  { 'Group Name': 'Fixed Assets', 'Parent Group': '', Nature: 'Asset' },
  { 'Group Name': 'Investments', 'Parent Group': '', Nature: 'Asset' },
  { 'Group Name': 'Misc. Expenses (Asset)', 'Parent Group': '', Nature: 'Asset' },
  { 'Group Name': 'Branch / Divisions', 'Parent Group': '', Nature: 'Asset' },
  { 'Group Name': 'Current Liabilities', 'Parent Group': '', Nature: 'Liability' },
  { 'Group Name': 'Loans (Liability)', 'Parent Group': '', Nature: 'Liability' },
  { 'Group Name': 'Capital Account', 'Parent Group': '', Nature: 'Capital' },
  { 'Group Name': 'Suspense Account', 'Parent Group': '', Nature: 'Liability' },
  { 'Group Name': 'Sales Accounts', 'Parent Group': '', Nature: 'Income' },
  { 'Group Name': 'Direct Incomes', 'Parent Group': '', Nature: 'Income' },
  { 'Group Name': 'Indirect Incomes', 'Parent Group': '', Nature: 'Income' },
  { 'Group Name': 'Purchase Accounts', 'Parent Group': '', Nature: 'Expense' },
  { 'Group Name': 'Direct Expenses', 'Parent Group': '', Nature: 'Expense' },
  { 'Group Name': 'Indirect Expenses', 'Parent Group': '', Nature: 'Expense' },

  // Sub-Groups / Secondary Groups
  { 'Group Name': 'Sundry Debtors', 'Parent Group': 'Current Assets', Nature: 'Asset' },
  { 'Group Name': 'Sundry Creditors', 'Parent Group': 'Current Liabilities', Nature: 'Liability' },
  { 'Group Name': 'Bank Accounts', 'Parent Group': 'Current Assets', Nature: 'Asset' },
  { 'Group Name': 'Cash-in-Hand', 'Parent Group': 'Current Assets', Nature: 'Asset' },
  { 'Group Name': 'Stock-in-Hand', 'Parent Group': 'Current Assets', Nature: 'Asset' },
  { 'Group Name': 'Deposits (Asset)', 'Parent Group': 'Current Assets', Nature: 'Asset' },
  { 'Group Name': 'Loans & Advances (Asset)', 'Parent Group': 'Current Assets', Nature: 'Asset' },
  { 'Group Name': 'Duties & Taxes', 'Parent Group': 'Current Liabilities', Nature: 'Liability' },
  { 'Group Name': 'Provisions', 'Parent Group': 'Current Liabilities', Nature: 'Liability' },
  { 'Group Name': 'Bank OD/OCC A/c', 'Parent Group': 'Loans (Liability)', Nature: 'Liability' },
  { 'Group Name': 'Secured Loans', 'Parent Group': 'Loans (Liability)', Nature: 'Liability' },
  { 'Group Name': 'Unsecured Loans', 'Parent Group': 'Loans (Liability)', Nature: 'Liability' },
  { 'Group Name': 'Reserves & Surplus', 'Parent Group': 'Capital Account', Nature: 'Capital' },
  { 'Group Name': 'Sales Account', 'Parent Group': 'Sales Accounts', Nature: 'Income' },
  { 'Group Name': 'Purchase Account', 'Parent Group': 'Purchase Accounts', Nature: 'Expense' },
  { 'Group Name': 'Administrative Expenses', 'Parent Group': 'Indirect Expenses', Nature: 'Expense' },
  { 'Group Name': 'Selling & Distribution Expenses', 'Parent Group': 'Indirect Expenses', Nature: 'Expense' },
  { 'Group Name': 'Financial Expenses', 'Parent Group': 'Indirect Expenses', Nature: 'Expense' },
  { 'Group Name': 'Wages & Factory Expenses', 'Parent Group': 'Direct Expenses', Nature: 'Expense' },
  { 'Group Name': 'Freight & Carriage Inwards', 'Parent Group': 'Direct Expenses', Nature: 'Expense' }
];

export const DEFAULT_LEDGERS: Ledger[] = [
  { 'Ledger Name': 'Cash', Group: 'Cash-in-Hand', 'Opening Balance': 0, 'Balance Type (Dr/Cr)': 'Dr', 'Current Balance': 0 },
  { 'Ledger Name': 'BOB Account', Group: 'Bank Accounts', 'Bank Name': 'Bank of Bhutan', Branch: 'Main Branch', 'Account No': '1029384756', 'Opening Balance': 0, 'Balance Type (Dr/Cr)': 'Dr', 'Current Balance': 0 },
  { 'Ledger Name': 'BNBL Account', Group: 'Bank Accounts', 'Bank Name': 'Bhutan National Bank', Branch: 'Phuntsholing', 'Account No': '9876543210', 'Opening Balance': 0, 'Balance Type (Dr/Cr)': 'Dr', 'Current Balance': 0 },
  { 'Ledger Name': 'Capital Account', Group: 'Capital Account', 'Opening Balance': 0, 'Balance Type (Dr/Cr)': 'Cr', 'Current Balance': 0 },
  { 'Ledger Name': 'Cash Customer', Group: 'Sundry Debtors', 'Opening Balance': 0, 'Balance Type (Dr/Cr)': 'Dr', 'Current Balance': 0 },
  { 'Ledger Name': 'Walk-in Customer', Group: 'Sundry Debtors', 'Opening Balance': 0, 'Balance Type (Dr/Cr)': 'Dr', 'Current Balance': 0 },
  { 'Ledger Name': 'Dorji Traders', Group: 'Sundry Creditors', 'GST No': '30BBBBB1111B1Z2', 'TPN No': 'TPN-998877', Address: 'Main Street, Thimphu', 'Contact No': '17112233', 'Opening Balance': 0, 'Balance Type (Dr/Cr)': 'Cr', 'Current Balance': 0 },
  { 'Ledger Name': 'Sales Account', Group: 'Sales Account', 'Opening Balance': 0, 'Balance Type (Dr/Cr)': 'Cr', 'Current Balance': 0 },
  { 'Ledger Name': 'Purchase Account', Group: 'Purchase Account', 'Opening Balance': 0, 'Balance Type (Dr/Cr)': 'Dr', 'Current Balance': 0 },
  { 'Ledger Name': 'GST Payable', Group: 'Duties & Taxes', 'Opening Balance': 0, 'Balance Type (Dr/Cr)': 'Cr', 'Current Balance': 0 },
  { 'Ledger Name': 'GST Receivable', Group: 'Duties & Taxes', 'Opening Balance': 0, 'Balance Type (Dr/Cr)': 'Dr', 'Current Balance': 0 },
  { 'Ledger Name': 'Duties & Taxes', Group: 'Duties & Taxes', 'Opening Balance': 0, 'Balance Type (Dr/Cr)': 'Cr', 'Current Balance': 0 },
  { 'Ledger Name': 'NPPF Payable', Group: 'Duties & Taxes', 'Opening Balance': 0, 'Balance Type (Dr/Cr)': 'Cr', 'Current Balance': 0 },
  { 'Ledger Name': 'GIS Payable', Group: 'Duties & Taxes', 'Opening Balance': 0, 'Balance Type (Dr/Cr)': 'Cr', 'Current Balance': 0 },
  { 'Ledger Name': 'PIT Payable', Group: 'Duties & Taxes', 'Opening Balance': 0, 'Balance Type (Dr/Cr)': 'Cr', 'Current Balance': 0 },
  { 'Ledger Name': 'Health Contribution Payable', Group: 'Duties & Taxes', 'Opening Balance': 0, 'Balance Type (Dr/Cr)': 'Cr', 'Current Balance': 0 },
  { 'Ledger Name': 'Salary Payable', Group: 'Duties & Taxes', 'Opening Balance': 0, 'Balance Type (Dr/Cr)': 'Cr', 'Current Balance': 0 },
  { 'Ledger Name': 'Salary Advance Recovery', Group: 'Loans & Advances (Asset)', 'Opening Balance': 0, 'Balance Type (Dr/Cr)': 'Dr', 'Current Balance': 0 },
  { 'Ledger Name': 'Staff Loan Recovery', Group: 'Loans & Advances (Asset)', 'Opening Balance': 0, 'Balance Type (Dr/Cr)': 'Dr', 'Current Balance': 0 },

  // Pre-configured Common Expense Ledgers
  { 'Ledger Name': 'Telephone Expenses', Group: 'Indirect Expenses', 'Opening Balance': 0, 'Balance Type (Dr/Cr)': 'Dr', 'Current Balance': 0 },
  { 'Ledger Name': 'Electricity Charges', Group: 'Indirect Expenses', 'Opening Balance': 0, 'Balance Type (Dr/Cr)': 'Dr', 'Current Balance': 0 },
  { 'Ledger Name': 'Internet Charges', Group: 'Indirect Expenses', 'Opening Balance': 0, 'Balance Type (Dr/Cr)': 'Dr', 'Current Balance': 0 },
  { 'Ledger Name': 'Water & Sewerage Charges', Group: 'Indirect Expenses', 'Opening Balance': 0, 'Balance Type (Dr/Cr)': 'Dr', 'Current Balance': 0 },
  { 'Ledger Name': 'Depreciation', Group: 'Indirect Expenses', 'Opening Balance': 0, 'Balance Type (Dr/Cr)': 'Dr', 'Current Balance': 0 },
  { 'Ledger Name': 'Loss on Disposal of Asset', Group: 'Indirect Expenses', 'Opening Balance': 0, 'Balance Type (Dr/Cr)': 'Dr', 'Current Balance': 0 },
  { 'Ledger Name': 'Gain on Disposal of Asset', Group: 'Indirect Incomes', 'Opening Balance': 0, 'Balance Type (Dr/Cr)': 'Cr', 'Current Balance': 0 },
  { 'Ledger Name': 'Profit on Disposal of Asset', Group: 'Indirect Incomes', 'Opening Balance': 0, 'Balance Type (Dr/Cr)': 'Cr', 'Current Balance': 0 },
  { 'Ledger Name': 'Transportation Charges', Group: 'Direct Expenses', 'Opening Balance': 0, 'Balance Type (Dr/Cr)': 'Dr', 'Current Balance': 0 },
  { 'Ledger Name': 'Labour Charges', Group: 'Direct Expenses', 'Opening Balance': 0, 'Balance Type (Dr/Cr)': 'Dr', 'Current Balance': 0 },
  { 'Ledger Name': 'Custom Duty', Group: 'Direct Expenses', 'Opening Balance': 0, 'Balance Type (Dr/Cr)': 'Dr', 'Current Balance': 0 },
  { 'Ledger Name': 'Loading/Unloading', Group: 'Direct Expenses', 'Opening Balance': 0, 'Balance Type (Dr/Cr)': 'Dr', 'Current Balance': 0 },
  { 'Ledger Name': 'Insurance Premium', Group: 'Indirect Expenses', 'Opening Balance': 0, 'Balance Type (Dr/Cr)': 'Dr', 'Current Balance': 0 },
  { 'Ledger Name': 'TA/DA Expenses', Group: 'Indirect Expenses', 'Opening Balance': 0, 'Balance Type (Dr/Cr)': 'Dr', 'Current Balance': 0 },
  { 'Ledger Name': 'Fuel', Group: 'Indirect Expenses', 'Opening Balance': 0, 'Balance Type (Dr/Cr)': 'Dr', 'Current Balance': 0 },
  { 'Ledger Name': 'Repair & Maintenance Vehicle', Group: 'Indirect Expenses', 'Opening Balance': 0, 'Balance Type (Dr/Cr)': 'Dr', 'Current Balance': 0 },
  { 'Ledger Name': 'Repair & Maintenance Office', Group: 'Indirect Expenses', 'Opening Balance': 0, 'Balance Type (Dr/Cr)': 'Dr', 'Current Balance': 0 },
  { 'Ledger Name': 'Repair & Maintenance Shop', Group: 'Indirect Expenses', 'Opening Balance': 0, 'Balance Type (Dr/Cr)': 'Dr', 'Current Balance': 0 },
  { 'Ledger Name': 'Salary & Allowance', Group: 'Indirect Expenses', 'Opening Balance': 0, 'Balance Type (Dr/Cr)': 'Dr', 'Current Balance': 0 },
  { 'Ledger Name': 'Staff Welfare', Group: 'Indirect Expenses', 'Opening Balance': 0, 'Balance Type (Dr/Cr)': 'Dr', 'Current Balance': 0 },
  { 'Ledger Name': 'Entertainment', Group: 'Indirect Expenses', 'Opening Balance': 0, 'Balance Type (Dr/Cr)': 'Dr', 'Current Balance': 0 },
  { 'Ledger Name': 'Printing & Stationery', Group: 'Indirect Expenses', 'Opening Balance': 0, 'Balance Type (Dr/Cr)': 'Dr', 'Current Balance': 0 },
  { 'Ledger Name': 'Vehicle Registration Renewal', Group: 'Indirect Expenses', 'Opening Balance': 0, 'Balance Type (Dr/Cr)': 'Dr', 'Current Balance': 0 },
  { 'Ledger Name': 'Donation', Group: 'Indirect Expenses', 'Opening Balance': 0, 'Balance Type (Dr/Cr)': 'Dr', 'Current Balance': 0 },
  { 'Ledger Name': 'Membership Fee', Group: 'Indirect Expenses', 'Opening Balance': 0, 'Balance Type (Dr/Cr)': 'Dr', 'Current Balance': 0 },
  { 'Ledger Name': 'Postage & Courier', Group: 'Indirect Expenses', 'Opening Balance': 0, 'Balance Type (Dr/Cr)': 'Dr', 'Current Balance': 0 },
  { 'Ledger Name': 'Clearing Charges', Group: 'Direct Expenses', 'Opening Balance': 0, 'Balance Type (Dr/Cr)': 'Dr', 'Current Balance': 0 },
  { 'Ledger Name': 'Declaration Fee', Group: 'Direct Expenses', 'Opening Balance': 0, 'Balance Type (Dr/Cr)': 'Dr', 'Current Balance': 0 },
  { 'Ledger Name': 'Labour Permit', Group: 'Direct Expenses', 'Opening Balance': 0, 'Balance Type (Dr/Cr)': 'Dr', 'Current Balance': 0 },
  { 'Ledger Name': 'Agent Commission', Group: 'Indirect Expenses', 'Opening Balance': 0, 'Balance Type (Dr/Cr)': 'Dr', 'Current Balance': 0 },
  { 'Ledger Name': 'Training Expenses', Group: 'Indirect Expenses', 'Opening Balance': 0, 'Balance Type (Dr/Cr)': 'Dr', 'Current Balance': 0 },
  { 'Ledger Name': 'Travelling Expenses', Group: 'Indirect Expenses', 'Opening Balance': 0, 'Balance Type (Dr/Cr)': 'Dr', 'Current Balance': 0 },
  { 'Ledger Name': 'Rental Charges', Group: 'Indirect Expenses', 'Opening Balance': 0, 'Balance Type (Dr/Cr)': 'Dr', 'Current Balance': 0 }
];

export function inferLedgerGroup(name: string, fallbackGroup: string = 'Sundry Debtors'): string {
  const clean = (name || '').trim().toLowerCase();
  if (!clean) return fallbackGroup;

  // Bank Accounts
  if (
    clean === 'bob' ||
    clean === 'bob account' ||
    clean === 'bob a/c' ||
    clean === 'bnbl' ||
    clean === 'bnbl account' ||
    clean === 'bnbl a/c' ||
    clean === 'bank' ||
    clean === 'bank 1' ||
    clean === 'bank 2' ||
    clean === 'bank of bhutan' ||
    clean === 'bhutan national bank' ||
    clean === 'tdk' ||
    clean === 'tbank' ||
    clean === 't-bank' ||
    clean === 'bdbl' ||
    clean === 'dpnb' ||
    clean.includes('bank') ||
    clean.includes('bank account') ||
    clean.includes('bank a/c') ||
    clean.endsWith(' bank')
  ) {
    if (!clean.includes('debtor') && !clean.includes('creditor') && !clean.includes('customer') && !clean.includes('supplier')) {
      return 'Bank Accounts';
    }
  }

  // Cash-in-Hand
  if (
    clean === 'cash' ||
    clean === 'cash in hand' ||
    clean === 'cash-in-hand' ||
    clean === 'petty cash' ||
    clean === 'cash a/c' ||
    clean === 'cash account' ||
    clean === 'main cash'
  ) {
    return 'Cash-in-Hand';
  }

  // Capital Account
  if (
    clean === 'capital' ||
    clean === 'capital account' ||
    clean === "owner's capital" ||
    clean === 'owners capital' ||
    clean === "owner's equity" ||
    clean === 'proprietor capital' ||
    clean === "proprietor's capital" ||
    clean === 'share capital' ||
    clean === 'partner capital' ||
    clean === "partner's capital" ||
    clean === 'equity' ||
    clean.includes('capital account')
  ) {
    return 'Capital Account';
  }

  // Loans (Liability)
  if (
    clean === 'loan' ||
    clean === 'loans' ||
    clean === 'bank loan' ||
    clean === 'secured loan' ||
    clean === 'unsecured loan' ||
    clean === 'term loan' ||
    clean === 'vehicle loan' ||
    clean === 'equipment loan' ||
    clean === 'bank od' ||
    clean.includes('loan account') ||
    clean.includes('borrowing')
  ) {
    return 'Loans (Liability)';
  }

  // Fixed Assets
  if (
    clean === 'fixed asset' ||
    clean === 'fixed assets' ||
    clean.includes('furniture') ||
    clean.includes('fixtures') ||
    clean.includes('machinery') ||
    clean.includes('equipment') ||
    clean.includes('computer') ||
    clean.includes('building') ||
    clean.includes('vehicle') ||
    clean.includes('plant &')
  ) {
    if (!clean.includes('loss') && !clean.includes('gain') && !clean.includes('profit') && !clean.includes('depreciation') && !clean.includes('repair') && !clean.includes('maintenance')) {
      return 'Fixed Assets';
    }
  }

  // Loss on Disposal of Assets / Depreciation
  if (
    clean.includes('loss on disposal') ||
    clean.includes('loss on sale') ||
    clean.includes('loss on write-off') ||
    clean.includes('loss on scrapping') ||
    clean.includes('loss on asset') ||
    clean.includes('asset written off') ||
    clean.includes('depreciation')
  ) {
    return 'Indirect Expenses';
  }

  // Gain / Profit on Disposal of Assets
  if (
    clean.includes('gain on disposal') ||
    clean.includes('profit on disposal') ||
    clean.includes('gain on sale') ||
    clean.includes('profit on sale') ||
    clean.includes('gain on asset') ||
    clean.includes('profit on asset')
  ) {
    return 'Indirect Incomes';
  }

  // Loans & Advances (Asset)
  if (
    clean.includes('salary advance') ||
    clean.includes('staff loan') ||
    clean.includes('advance to staff') ||
    clean.includes('advance recovery')
  ) {
    return 'Loans & Advances (Asset)';
  }

  // Deposits (Asset)
  if (
    clean === 'security deposit' ||
    clean === 'rental deposit' ||
    clean.includes('deposit')
  ) {
    return 'Deposits (Asset)';
  }

  // Duties & Taxes
  if (
    clean === 'duties & taxes' ||
    clean === 'duties and taxes' ||
    clean === 'gst payable' ||
    clean === 'gst receivable' ||
    clean === 'gst' ||
    clean === 'tds payable' ||
    clean === 'pit payable' ||
    clean === 'nppf payable' ||
    clean === 'gis payable' ||
    clean === 'health contribution payable' ||
    clean === 'salary payable' ||
    clean === 'customs duty' ||
    clean.includes('gst') ||
    clean.includes('tax') ||
    clean.includes('duty') ||
    clean.includes('duties') ||
    clean.includes('tds') ||
    clean.includes('pit') ||
    clean.includes('nppf') ||
    clean.includes('gis') ||
    clean.includes('payable')
  ) {
    if (!clean.includes('debtor') && !clean.includes('creditor') && !clean.includes('customer') && !clean.includes('supplier')) {
      return 'Duties & Taxes';
    }
  }

  // Sales Account
  if (clean === 'sales account' || clean === 'sales' || clean === 'sales return' || clean.includes('sales a/c') || clean.includes('sales revenue')) {
    return 'Sales Account';
  }

  // Purchase Account
  if (clean === 'purchase account' || clean === 'purchases' || clean === 'purchase return' || clean.includes('purchase a/c')) {
    return 'Purchase Account';
  }

  // Direct Expenses
  if (
    clean === 'wages' ||
    clean === 'factory wages' ||
    clean === 'freight inwards' ||
    clean === 'carriage inwards' ||
    clean.includes('factory') ||
    clean.includes('carriage inward') ||
    clean.includes('freight inward')
  ) {
    return 'Direct Expenses';
  }

  // Indirect Expenses
  if (
    clean === 'salaries & wages expense' ||
    clean.includes('expense') ||
    clean.includes('salary') ||
    clean.includes('wages') ||
    clean.includes('rent') ||
    clean.includes('freight') ||
    clean.includes('carriage') ||
    clean.includes('electricity') ||
    clean.includes('stationery') ||
    clean.includes('audit fee') ||
    clean.includes('office maintenance')
  ) {
    return 'Indirect Expenses';
  }

  // Direct Incomes
  if (clean.includes('direct income') || clean.includes('service delivery income')) {
    return 'Direct Incomes';
  }

  // Indirect Incomes
  if (
    clean.includes('interest income') ||
    clean.includes('discount received') ||
    clean.includes('commission received') ||
    clean.includes('rental income') ||
    clean.includes('indirect income')
  ) {
    return 'Indirect Incomes';
  }

  return fallbackGroup;
}

export function sanitizeLedgers(list: Ledger[]): Ledger[] {
  if (!Array.isArray(list)) return [];
  let changed = false;
  const updated = list.map(l => {
    if (!l) return l;
    const name = (l['Ledger Name'] || '').trim();
    const cleanLower = name.toLowerCase();
    const currentGroup = (l.Group || '').trim();

    let targetGroup = currentGroup;
    if (
      cleanLower.includes('loss on disposal') ||
      cleanLower.includes('loss on sale') ||
      cleanLower.includes('loss on write-off') ||
      cleanLower.includes('loss on scrapping') ||
      cleanLower.includes('loss on asset') ||
      cleanLower.includes('asset written off')
    ) {
      targetGroup = 'Indirect Expenses';
    } else if (
      cleanLower.includes('gain on disposal') ||
      cleanLower.includes('profit on disposal') ||
      cleanLower.includes('gain on sale') ||
      cleanLower.includes('profit on sale') ||
      cleanLower.includes('gain on asset') ||
      cleanLower.includes('profit on asset')
    ) {
      targetGroup = 'Indirect Incomes';
    } else if (cleanLower === 'depreciation' || cleanLower.includes('depreciation on')) {
      targetGroup = 'Indirect Expenses';
    } else if (l['Bank Name'] || l['Account No']) {
      targetGroup = 'Bank Accounts';
    } else if (!targetGroup) {
      targetGroup = inferLedgerGroup(name, 'Sundry Debtors');
    }

    if (!targetGroup) {
      targetGroup = 'Sundry Debtors';
    }

    if (targetGroup !== l.Group) {
      changed = true;
      return { ...l, Group: targetGroup };
    }
    return l;
  });

  if (changed) {
    try {
      saveJson(STORAGE_KEYS.LEDGERS, updated);
    } catch {
      // ignore
    }
  }
  return updated;
}

const DEFAULT_PAY_HEADS: PayHead[] = [
  {
    id: 'ph_basic',
    name: 'Basic Pay',
    type: 'Earning',
    calculationType: 'Fixed',
    defaultValue: 0,
    isStatutory: false,
    description: 'Base Monthly Salary',
    enabled: true
  },
  {
    id: 'ph_hra',
    name: 'House Rent Allowance (HRA)',
    type: 'Earning',
    calculationType: 'PercentBasic',
    defaultValue: 20,
    isStatutory: false,
    description: 'Housing Allowance (e.g. 20% of Basic)',
    enabled: true
  },
  {
    id: 'ph_fixed_bonus',
    name: 'Fixed / Performance Bonus',
    type: 'Earning',
    calculationType: 'Fixed',
    defaultValue: 0,
    isStatutory: false,
    description: 'Additional Monthly Incentive',
    enabled: true
  },
  {
    id: 'ph_health',
    name: 'Health Contribution (1%)',
    type: 'Deduction',
    calculationType: 'PercentGross',
    defaultValue: 1,
    isStatutory: true,
    description: 'Statutory Bhutan Health Contribution (1% of Gross Salary)',
    enabled: true
  },
  {
    id: 'ph_nppf',
    name: 'NPPF Provident Fund',
    type: 'Deduction',
    calculationType: 'PercentBasic',
    defaultValue: 11,
    isStatutory: true,
    description: 'National Pension & Provident Fund (11% of Basic)',
    enabled: true
  },
  {
    id: 'ph_gis',
    name: 'Group Insurance Scheme (GIS)',
    type: 'Deduction',
    calculationType: 'Fixed',
    defaultValue: 300,
    isStatutory: true,
    description: 'Group Life Insurance (Fixed Nu. 300)',
    enabled: true
  },
  {
    id: 'ph_pit',
    name: 'Personal Income Tax (PIT)',
    type: 'Deduction',
    calculationType: 'Manual',
    defaultValue: 0,
    isStatutory: true,
    description: 'DRC Bhutan Personal Income Tax Deduction',
    enabled: true
  },
  {
    id: 'ph_adv_recovery',
    name: 'Salary Advance Recovery',
    type: 'Deduction',
    calculationType: 'Manual',
    defaultValue: 0,
    isStatutory: false,
    description: 'Deduction for Salary Advance taken',
    enabled: true
  },
  {
    id: 'ph_loan_recovery',
    name: 'Staff Loan Recovery',
    type: 'Deduction',
    calculationType: 'Manual',
    defaultValue: 0,
    isStatutory: false,
    description: 'Monthly Staff Loan EMI / Recovery',
    enabled: true
  }
];

const DEFAULT_EMPLOYEES: Employee[] = [
  {
    id: 'emp_1',
    empCode: 'EMP-001',
    fullName: 'Sonam Tobgay',
    cidNo: '11502001832',
    designation: 'General Manager',
    department: 'Management',
    joiningDate: '2023-01-15',
    contactNo: '17654321',
    email: 'sonam@company.bt',
    bankName: 'Bank of Bhutan (BOB)',
    accountNo: '102938475',
    basicSalary: 35000,
    status: 'Active'
  },
  {
    id: 'emp_2',
    empCode: 'EMP-002',
    fullName: 'Dechen Wangmo',
    cidNo: '10805002941',
    designation: 'Senior Accountant',
    department: 'Finance',
    joiningDate: '2023-06-01',
    contactNo: '17890123',
    email: 'dechen@company.bt',
    bankName: 'Bhutan National Bank (BNBL)',
    accountNo: '201928374',
    basicSalary: 25000,
    status: 'Active'
  },
  {
    id: 'emp_3',
    empCode: 'EMP-003',
    fullName: 'Karma Tshering',
    cidNo: '11208003419',
    designation: 'POS Store Cashier',
    department: 'Operations',
    joiningDate: '2024-02-10',
    contactNo: '77123456',
    email: 'karma@company.bt',
    bankName: 'T-Bank',
    accountNo: '304958271',
    basicSalary: 16000,
    status: 'Active'
  }
];

export const DEFAULT_ITEMS: Item[] = [
  {
    'Item Code': 'ITM260812000001',
    Barcode: '20000001',
    'Item Name': 'Pendrive 320GB',
    'Print Name': 'Pendrive 320GB',
    Group: 'Computer Peripherals',
    Unit: 'Pcs',
    'Purchase Rate': 3800,
    'Sale Rate': 4500,
    MRP: 4800,
    'GST %': 5,
    'Zero Rated (Y/N)': 'N',
    'Is Serialized': 'Y',
    'HSN/SAC': '8471',
    'Opening Stock': 15,
    'Current Stock': 15,
    'Reorder Level': 3,
    'Opening Serials': 'SN-PD320-001, SN-PD320-002, SN-PD320-003'
  },
  {
    'Item Code': 'ITM260812000002',
    Barcode: '20000002',
    'Item Name': 'Wireless Mouse Logitech',
    'Print Name': 'Logitech Mouse M185',
    Group: 'Computer Peripherals',
    Unit: 'Pcs',
    'Purchase Rate': 650,
    'Sale Rate': 850,
    MRP: 950,
    'GST %': 5,
    'Zero Rated (Y/N)': 'N',
    'Is Serialized': 'N',
    'HSN/SAC': '8471',
    'Opening Stock': 25,
    'Current Stock': 25,
    'Reorder Level': 5
  },
  {
    'Item Code': 'ITM260812000003',
    Barcode: '20000003',
    'Item Name': 'A4 Copy Paper Rim',
    'Print Name': 'A4 Paper 80GSM',
    Group: 'Stationery',
    Unit: 'Pcs',
    'Purchase Rate': 280,
    'Sale Rate': 350,
    MRP: 380,
    'GST %': 0,
    'Zero Rated (Y/N)': 'Y',
    'Is Serialized': 'N',
    'HSN/SAC': '4802',
    'Opening Stock': 50,
    'Current Stock': 50,
    'Reorder Level': 10
  },
  {
    'Item Code': 'ITM260812000004',
    Barcode: '20000004',
    'Item Name': 'Mechanical Keyboard RGB',
    'Print Name': 'RGB Mech Keyboard',
    Group: 'Computer Peripherals',
    Unit: 'Pcs',
    'Purchase Rate': 2200,
    'Sale Rate': 2950,
    MRP: 3200,
    'GST %': 5,
    'Zero Rated (Y/N)': 'N',
    'Is Serialized': 'Y',
    'HSN/SAC': '8471',
    'Opening Stock': 8,
    'Current Stock': 8,
    'Reorder Level': 2,
    'Opening Serials': 'KB-RGB-101, KB-RGB-102'
  }
];

// Helper to get tenant-scoped storage key
export function getTenantStorageKey(key: string, customCompanyId?: string): string {
  // Global keys that span across companies
  if (
    key.startsWith('supabase_') || 
    key.startsWith('deep_pos_auth_') ||
    key === 'deep_pos_active_user_id' || 
    key === 'bhutan_pos_session_unlocked'
  ) {
    return key;
  }
  
  const cId = customCompanyId || getActiveCompanyId();
  if (!cId) {
    return `deep_pos_unassigned_${key}`;
  }
  return `${key}_${cId}`;
}

export function loadJson<T>(key: string, fallback: T, customCompanyId?: string): T {
  try {
    const cId = customCompanyId || getActiveCompanyId();
    const isDemo = cId === DEFAULT_TENANT_COMPANY.id;
    const effectiveKey = getTenantStorageKey(key, customCompanyId);

    // One-time legacy migration for Demo Company: if demo company key is empty but un-prefixed key exists, migrate it
    if (isDemo && typeof localStorage !== 'undefined' && !localStorage.getItem(effectiveKey)) {
      const legacyRaw = localStorage.getItem(key);
      if (legacyRaw) {
        localStorage.setItem(effectiveKey, legacyRaw);
      }
    }

    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(effectiveKey) : null;
    if (raw) {
      const parsed = JSON.parse(raw);

      // Auto-heal & sanitize: non-demo tenant ledgers & invoices must NEVER retain contaminated demo balances
      if (!isDemo && Array.isArray(parsed)) {
        if (key === STORAGE_KEYS.SALES_INVOICES || key === STORAGE_KEYS.PURCHASE_INVOICES || key === STORAGE_KEYS.VOUCHERS) {
          const filtered = parsed.filter((item: any) => {
            const itemComp = item.companyId || item.company_id;
            if (itemComp && itemComp !== cId) return false;
            // Reject demo invoices leaking into client workspace
            const invNo = (item.invoiceNo || item.billNo || item.voucherNo || '').trim().toLowerCase();
            if (invNo === 'pos-0007' || invNo === 'pos-0011' || item.isDemo === true) {
              return false;
            }
            if (invNo.startsWith('pos-') || invNo.startsWith('sal-') || invNo.startsWith('vou-')) {
              const hasDemoItems = Array.isArray(item.items) && item.items.some((it: any) => 
                it['Item Name']?.includes('Wireless Mouse') || 
                it['Item Name']?.includes('Pendrive') || 
                it['Item Name']?.toLowerCase().includes('candy') ||
                it['Item Code']?.startsWith('ITM260812') ||
                it.isDemo === true
              );
              if (hasDemoItems) return false;
            }
            return true;
          });

          if (filtered.length !== parsed.length) {
            if (typeof localStorage !== 'undefined') {
              localStorage.setItem(effectiveKey, JSON.stringify(filtered));
            }
            return filtered as unknown as T;
          }
        }

        if (key === STORAGE_KEYS.LEDGERS) {
          const sKey = getTenantStorageKey(STORAGE_KEYS.SALES_INVOICES, cId);
          const pKey = getTenantStorageKey(STORAGE_KEYS.PURCHASE_INVOICES, cId);
          const vKey = getTenantStorageKey(STORAGE_KEYS.VOUCHERS, cId);
          const sRaw = typeof localStorage !== 'undefined' ? localStorage.getItem(sKey) : null;
          const pRaw = typeof localStorage !== 'undefined' ? localStorage.getItem(pKey) : null;
          const vRaw = typeof localStorage !== 'undefined' ? localStorage.getItem(vKey) : null;
          const hasTransactions = 
            (sRaw && sRaw !== '[]' && JSON.parse(sRaw).length > 0) ||
            (pRaw && pRaw !== '[]' && JSON.parse(pRaw).length > 0) ||
            (vRaw && vRaw !== '[]' && JSON.parse(vRaw).length > 0);

          if (!hasTransactions) {
            let sanitized = false;
            parsed.forEach((l: any) => {
              const cur = Number(l['Current Balance']) || 0;
              const op = Number(l['Opening Balance']) || 0;
              // Any non-zero current balance or opening balance without transactions in a client workspace is phantom
              if (cur !== 0 || op !== 0) {
                l['Opening Balance'] = 0;
                l['Current Balance'] = 0;
                sanitized = true;
              }
            });
            if (sanitized && typeof localStorage !== 'undefined') {
              localStorage.setItem(effectiveKey, JSON.stringify(parsed));
            }
          }
        }
      }

      return parsed;
    }

    // If new or non-demo company has no custom config/vouchers/items yet, provide clean defaults
    if (!isDemo) {
      // Clean blank state for vouchers, invoices, and transactions in a brand new company
      if (
        key === STORAGE_KEYS.SALES_INVOICES ||
        key === STORAGE_KEYS.PURCHASE_INVOICES ||
        key === STORAGE_KEYS.VOUCHERS ||
        key === STORAGE_KEYS.STOCK_LEDGER ||
        key === STORAGE_KEYS.LEDGER_LOG ||
        key === STORAGE_KEYS.HELD_BILLS ||
        key === STORAGE_KEYS.QUOTATIONS ||
        key === STORAGE_KEYS.DELIVERY_NOTES ||
        key === STORAGE_KEYS.SALES_ORDERS ||
        key === STORAGE_KEYS.PURCHASE_ORDERS ||
        key === STORAGE_KEYS.RECEIPT_NOTES ||
        key === STORAGE_KEYS.PHYSICAL_STOCK ||
        key === STORAGE_KEYS.MONTHLY_PAYROLLS ||
        key === STORAGE_KEYS.EMPLOYEE_ADVANCES ||
        key === STORAGE_KEYS.BANK_RECON ||
        key === STORAGE_KEYS.TRASH_LOG ||
        key === STORAGE_KEYS.AUDIT_LOG ||
        key === STORAGE_KEYS.ITEMS ||
        key === STORAGE_KEYS.EMPLOYEES ||
        key === STORAGE_KEYS.PAY_HEADS ||
        key === 'deep_pos_am_assets' ||
        key === 'deep_pos_am_disposals'
      ) {
        return ([] as unknown) as T;
      }

      // Clean counters for non-demo tenant
      if (key === STORAGE_KEYS.COUNTERS) {
        return ({
          SalesInvoice: 0,
          POSInvoice: 0,
          PurchaseInvoice: 0,
          PaymentVoucher: 0,
          ReceiptVoucher: 0,
          JournalVoucher: 0,
          ContraVoucher: 0,
          CreditNote: 0,
          DebitNote: 0,
          Voucher: 0
        } as unknown) as T;
      }

      // Clean Chart of Accounts with zero opening and current balances
      if (key === STORAGE_KEYS.LEDGERS) {
        return (DEFAULT_LEDGERS.map(l => ({
          ...l,
          'Opening Balance': 0,
          'Current Balance': 0
        })) as unknown) as T;
      }

      // Company configuration: Do NOT inherit "Bhutan Retail Enterprise" demo profile!
      if (key === STORAGE_KEYS.CONFIG) {
        let compName = 'Client Enterprise';
        let tpn = '';
        let phone = '';
        let email = '';
        let license = '';
        let address = '';
        let currency = 'Nu.';
        try {
          const cached = typeof localStorage !== 'undefined' ? localStorage.getItem('supabase_cached_companies') : null;
          if (cached) {
            const list = JSON.parse(cached);
            const found = list.find((x: any) => x.id === cId);
            if (found) {
              compName = found.company_name || compName;
              tpn = found.tax_payer_id || '';
              phone = found.phone || '';
              email = found.email || '';
              license = found.trade_license_no || '';
              address = found.address || '';
              currency = found.currency_symbol || currency;
            }
          }
        } catch {}
        return ({
          CompanyName: compName,
          CompanyTPNNo: tpn,
          CompanyGSTNo: license,
          CompanyPhone: phone,
          CompanyEmail: email,
          TaxId: tpn,
          Phone: phone,
          Address: address,
          Currency: currency,
          CurrencySymbol: currency,
          ShowTax: true,
          PaperSize: '3inch',
          FooterMessage: 'Thank you for your business!'
        } as unknown) as T;
      }
    }

    return fallback;
  } catch (e) {
    return fallback;
  }
}

/**
 * Resets a specific tenant company completely to a blank slate:
 * - 0 vouchers
 * - 0 sales invoices
 * - 0 purchase bills
 * - 0 inventory items
 * - 0 ledger log / stock ledger entries
 * - Reset sequential numbering counters back to 0 (so next is 1)
 * - Standard chart of accounts initialized with 0 opening and 0 current balances
 */
export function resetCompanyToBlank(companyId: string): void {
  // Demo company must NEVER be wiped to blank!
  if (!companyId || companyId === DEFAULT_TENANT_COMPANY.id) return;

  const emptyArrayKeys = [
    STORAGE_KEYS.VOUCHERS,
    STORAGE_KEYS.SALES_INVOICES,
    STORAGE_KEYS.PURCHASE_INVOICES,
    STORAGE_KEYS.STOCK_LEDGER,
    STORAGE_KEYS.LEDGER_LOG,
    STORAGE_KEYS.HELD_BILLS,
    STORAGE_KEYS.ITEMS,
    STORAGE_KEYS.QUOTATIONS,
    STORAGE_KEYS.DELIVERY_NOTES,
    STORAGE_KEYS.SALES_ORDERS,
    STORAGE_KEYS.PURCHASE_ORDERS,
    STORAGE_KEYS.RECEIPT_NOTES,
    STORAGE_KEYS.PHYSICAL_STOCK,
    STORAGE_KEYS.MONTHLY_PAYROLLS,
    STORAGE_KEYS.EMPLOYEE_ADVANCES,
    STORAGE_KEYS.BANK_RECON,
    STORAGE_KEYS.TRASH_LOG,
    STORAGE_KEYS.AUDIT_LOG,
    STORAGE_KEYS.DELETED_ITEMS,
    STORAGE_KEYS.DELETED_LEDGERS,
    'deep_pos_am_assets',
    'deep_pos_am_disposals'
  ];

  emptyArrayKeys.forEach(k => {
    localStorage.setItem(getTenantStorageKey(k, companyId), '[]');
  });

  // Reset sequential numbering counters so new transactions start clean from 1
  localStorage.setItem(getTenantStorageKey(STORAGE_KEYS.COUNTERS, companyId), JSON.stringify({
    SalesInvoice: 0,
    POSInvoice: 0,
    PurchaseInvoice: 0,
    PaymentVoucher: 0,
    ReceiptVoucher: 0,
    JournalVoucher: 0,
    ContraVoucher: 0,
    CreditNote: 0,
    DebitNote: 0,
    Voucher: 0
  }));

  // Clean standard chart of accounts with 0 opening and 0 current balance
  const cleanLedgers = DEFAULT_LEDGERS.map(l => ({
    ...l,
    'Opening Balance': 0,
    'Current Balance': 0
  }));
  localStorage.setItem(getTenantStorageKey(STORAGE_KEYS.LEDGERS, companyId), JSON.stringify(cleanLedgers));

  // Purge Supabase remote records for this client company to prevent re-hydration
  purgeRemoteCompanyData(companyId).catch(() => {});

  // Notify components of tenant data change
  window.dispatchEvent(new CustomEvent('supabase:tenant_changed', { detail: { companyId } }));
}

/**
 * Auto-Heal & Sanitize Non-Demo Client Tenant Workspaces:
 * Guarantees that client/new companies NEVER inherit demo transactions, demo items,
 * or lingering phantom balances (e.g. Sales, GST, Opening Balances).
 */
export function healAndSanitizeNonDemoTenant(targetCompanyId?: string): void {
  const cId = targetCompanyId || getActiveCompanyId();
  if (!cId || cId === DEFAULT_TENANT_COMPANY.id) return; // Skip default demo company

  try {
    const isDemoItem = (it: any) => {
      if (!it) return false;
      if (it.isDemo === true) return true;
      const code = String(it['Item Code'] || it.itemCode || '').trim();
      const name = String(it['Item Name'] || it.itemName || '').trim().toLowerCase();
      if (code.startsWith('ITM260812')) return true;
      if (name.includes('wireless mouse') || name.includes('pendrive') || name.includes('five star') || name.includes('candy')) return true;
      return false;
    };

    const isStaleInvoice = (s: any) => {
      if (!s) return false;
      if ((s as any).isDemo === true) return true;
      const invNo = String(s.invoiceNo || s.billNo || s.voucherNo || '').trim().toLowerCase();
      if (invNo === 'pos-0007' || invNo === 'pos-0011') return true;
      if (Array.isArray(s.items) && s.items.some(isDemoItem)) return true;
      return false;
    };

    // 1. Sanitize Sales Invoices for non-demo company
    let sales = loadJson<SalesInvoice[]>(STORAGE_KEYS.SALES_INVOICES, [], cId);
    let salesModified = false;
    if (Array.isArray(sales) && sales.length > 0) {
      const cleanSales = sales.filter(s => {
        if (isStaleInvoice(s)) {
          salesModified = true;
          if (s.invoiceNo) deleteSalesInvoiceFromFirestore(s.invoiceNo, cId).catch(() => {});
          return false;
        }
        return true;
      });

      if (salesModified) {
        saveJson(STORAGE_KEYS.SALES_INVOICES, cleanSales, cId);
        sales = cleanSales;
      }
    }

    // Always issue cleanups for target stale test invoices in Supabase
    deleteSalesInvoiceFromFirestore('POS-0007', cId).catch(() => {});
    deleteSalesInvoiceFromFirestore('POS-0011', cId).catch(() => {});

    // 2. Sanitize Purchase Invoices & Vouchers similarly
    let purchases = loadJson<PurchaseInvoice[]>(STORAGE_KEYS.PURCHASE_INVOICES, [], cId);
    if (Array.isArray(purchases) && purchases.length > 0) {
      let pMod = false;
      const cleanP = purchases.filter(p => {
        if ((p as any).isDemo === true || (Array.isArray(p.items) && p.items.some(isDemoItem))) {
          pMod = true;
          if (p.billNo || p.invoiceNo) deletePurchaseInvoiceFromFirestore(p.billNo || p.invoiceNo, cId).catch(() => {});
          return false;
        }
        return true;
      });
      if (pMod) {
        saveJson(STORAGE_KEYS.PURCHASE_INVOICES, cleanP, cId);
        purchases = cleanP;
      }
    }

    let vouchers = loadJson<Voucher[]>(STORAGE_KEYS.VOUCHERS, [], cId);
    if (Array.isArray(vouchers) && vouchers.length > 0) {
      let vMod = false;
      const cleanV = vouchers.filter(v => {
        if ((v as any).isDemo === true) {
          vMod = true;
          if (v.voucherNo) deleteVoucherFromFirestore(v.voucherNo, cId).catch(() => {});
          return false;
        }
        return true;
      });
      if (vMod) {
        saveJson(STORAGE_KEYS.VOUCHERS, cleanV, cId);
        vouchers = cleanV;
      }
    }

    // 3. Ensure Standard System Ledgers have 0 Opening Balance for new client companies
    let ledgers = loadJson<Ledger[]>(STORAGE_KEYS.LEDGERS, DEFAULT_LEDGERS, cId);
    let ledgersModified = false;
    if (Array.isArray(ledgers)) {
      ledgers.forEach(l => {
        const op = Number(l['Opening Balance']) || 0;
        if (op !== 0 && !(l as any).isCustomOpeningBalance) {
          l['Opening Balance'] = 0;
          ledgersModified = true;
        }
      });

      const activeSales = (sales || []).filter(s => s.status !== 'Cancelled');
      const activePurch = (purchases || []).filter(p => p.status !== 'Cancelled');
      const activeVouch = (vouchers || []).filter(v => v.status !== 'Cancelled');

      if (activeSales.length === 0 && activePurch.length === 0 && activeVouch.length === 0) {
        ledgers.forEach(l => {
          if (Number(l['Current Balance']) !== 0) {
            l['Current Balance'] = 0;
            ledgersModified = true;
          }
        });
        saveJson(STORAGE_KEYS.LEDGER_LOG, [], cId);
        saveJson(STORAGE_KEYS.STOCK_LEDGER, [], cId);
      }

      if (ledgersModified) {
        saveJson(STORAGE_KEYS.LEDGERS, ledgers, cId);
      }
    }

    recalculateLedgerBalances();
  } catch (err) {
    console.warn('[Tenant Sanitization Warning]:', err);
  }
}

export function migrateExistingItemsOpeningAmount() {
  const items = loadJson<Item[]>(STORAGE_KEYS.ITEMS, []);
  let modified = false;
  const newItems = items.map(item => {
    if (item['Opening Amount'] === undefined && Number(item['Opening Stock']) > 0) {
      modified = true;
      return {
        ...item,
        'Opening Amount': Number(item['Opening Stock']) * (Number(item['Purchase Rate']) || 0)
      };
    }
    return item;
  });

  if (modified) {
    saveJson(STORAGE_KEYS.ITEMS, newItems);
  }
}

export function saveJson<T>(key: string, val: T, targetCompanyId?: string): void {
  try {
    const effectiveKey = getTenantStorageKey(key, targetCompanyId);
    localStorage.setItem(effectiveKey, JSON.stringify(val));
  } catch (e) {
    console.error('Failed to save to localStorage:', key, e);
  }
}

export function round2(n: number): number {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

export function nextCounter(name: string): number {
  const counters = loadJson<Record<string, number>>(STORAGE_KEYS.COUNTERS, { InternalBarcode: 5, SalesInvoice: 32, PurchaseInvoice: 12, PaymentVoucher: 1, ReceiptVoucher: 1, JournalVoucher: 1, ContraVoucher: 1 });
  const val = (counters[name] || 0) + 1;
  counters[name] = val;
  saveJson(STORAGE_KEYS.COUNTERS, counters);
  return val;
}

export function getLedgers(targetCompanyId?: string): Ledger[] {
  const cId = targetCompanyId || getActiveCompanyId();
  let leds = loadJson<Ledger[]>(STORAGE_KEYS.LEDGERS, DEFAULT_LEDGERS, cId);
  const deletedLedgers = new Set(loadJson<string[]>(STORAGE_KEYS.DELETED_LEDGERS, [], cId).map(d => (d || '').trim().toLowerCase()));
  const isDefaultDemoCompany = !cId || cId === DEFAULT_TENANT_COMPANY.id;

  // Auto-purge TD/DA Expenses if present and unused (consolidating to TA/DA Expenses)
  leds = leds.filter(l => {
    const norm = (l['Ledger Name'] || '').trim().toLowerCase();
    if (norm === 'td/da expenses' && !isLedgerInUse('TD/DA Expenses')) return false;
    if (deletedLedgers.has(norm)) return false;
    return true;
  });

  const existingLedgerNames = new Set(leds.map(l => (l['Ledger Name'] || '').trim().toLowerCase()));
  let ledgersUpdated = false;
  DEFAULT_LEDGERS.forEach(dl => {
    const normName = (dl['Ledger Name'] || '').trim().toLowerCase();
    if (!existingLedgerNames.has(normName) && !deletedLedgers.has(normName)) {
      // If it's a new company, ensure zero starting balance
      const newLedgerEntry = isDefaultDemoCompany ? { ...dl } : { ...dl, 'Opening Balance': 0, 'Current Balance': 0 };
      leds.push(newLedgerEntry);
      existingLedgerNames.add(normName);
      ledgersUpdated = true;
    }
  });

  // Non-demo tenant safety: ensure zero starting balance if no transactions exist
  if (!isDefaultDemoCompany) {
    const sList = loadJson<any[]>(STORAGE_KEYS.SALES_INVOICES, []);
    const pList = loadJson<any[]>(STORAGE_KEYS.PURCHASE_INVOICES, []);
    const vList = loadJson<any[]>(STORAGE_KEYS.VOUCHERS, []);
    if (sList.length === 0 && pList.length === 0 && vList.length === 0) {
      leds.forEach(l => {
        const cur = Number(l['Current Balance']) || 0;
        const op = Number(l['Opening Balance']) || 0;
        if (cur !== 0 || op !== 0) {
          l['Opening Balance'] = 0;
          l['Current Balance'] = 0;
          ledgersUpdated = true;
        }
      });
    }
  }

  leds = sanitizeLedgers(leds);
  saveJson(STORAGE_KEYS.LEDGERS, leds);
  return leds;
}

export function getInitialData() {
  healAndSanitizeNonDemoTenant();
  autoCleanTrash();
  const logs = loadJson<LedgerLogEntry[]>(STORAGE_KEYS.LEDGER_LOG, []);
  const sales = loadJson<SalesInvoice[]>(STORAGE_KEYS.SALES_INVOICES, []);
  if (logs.length === 0 && sales.length > 0) {
    rebuildAccountingLogs();
  } else {
    recalculateLedgerBalances();
  }
  const cfg = loadJson<Config>(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
  const items = loadJson<Item[]>(STORAGE_KEYS.ITEMS, DEFAULT_ITEMS);
  const units = loadJson<Unit[]>(STORAGE_KEYS.UNITS, DEFAULT_UNITS);
  const uGrps = loadJson<UnitGroup[]>(STORAGE_KEYS.UNIT_GROUPS, DEFAULT_UNIT_GROUPS);
  const iGrps = loadJson<ItemGroup[]>(STORAGE_KEYS.ITEM_GROUPS, DEFAULT_ITEM_GROUPS);
  const iCats = loadJson<string[]>(STORAGE_KEYS.ITEM_CATEGORIES, DEFAULT_ITEM_CATEGORIES);
  
  const leds = getLedgers();
  let lGrps = loadJson<LedgerGroup[]>(STORAGE_KEYS.LEDGER_GROUPS, DEFAULT_LEDGER_GROUPS);
  const hB = loadJson<HeldBill[]>(STORAGE_KEYS.HELD_BILLS, []);
  const payHeads = loadJson<PayHead[]>(STORAGE_KEYS.PAY_HEADS, DEFAULT_PAY_HEADS);
  const employees = loadJson<Employee[]>(STORAGE_KEYS.EMPLOYEES, DEFAULT_EMPLOYEES);

  // Ensure all standard primary and secondary ledger groups exist
  const existingGroupNames = new Set(lGrps.map(g => g['Group Name']));
  let groupsUpdated = false;
  DEFAULT_LEDGER_GROUPS.forEach(dg => {
    if (!existingGroupNames.has(dg['Group Name'])) {
      lGrps.push(dg);
      existingGroupNames.add(dg['Group Name']);
      groupsUpdated = true;
    }
  });

  // Save with tenant-scoped keys if missing or updated
  if (!localStorage.getItem(getTenantStorageKey(STORAGE_KEYS.CONFIG))) saveJson(STORAGE_KEYS.CONFIG, cfg);
  if (!localStorage.getItem(getTenantStorageKey(STORAGE_KEYS.ITEMS))) saveJson(STORAGE_KEYS.ITEMS, items);
  if (!localStorage.getItem(getTenantStorageKey(STORAGE_KEYS.UNITS))) saveJson(STORAGE_KEYS.UNITS, units);
  if (!localStorage.getItem(getTenantStorageKey(STORAGE_KEYS.UNIT_GROUPS))) saveJson(STORAGE_KEYS.UNIT_GROUPS, uGrps);
  if (!localStorage.getItem(getTenantStorageKey(STORAGE_KEYS.ITEM_GROUPS))) saveJson(STORAGE_KEYS.ITEM_GROUPS, iGrps);
  if (!localStorage.getItem(getTenantStorageKey(STORAGE_KEYS.ITEM_CATEGORIES))) saveJson(STORAGE_KEYS.ITEM_CATEGORIES, iCats);
  if (!localStorage.getItem(getTenantStorageKey(STORAGE_KEYS.LEDGERS))) saveJson(STORAGE_KEYS.LEDGERS, leds);
  if (!localStorage.getItem(getTenantStorageKey(STORAGE_KEYS.LEDGER_GROUPS)) || groupsUpdated) saveJson(STORAGE_KEYS.LEDGER_GROUPS, lGrps);
  if (!localStorage.getItem(getTenantStorageKey(STORAGE_KEYS.PAY_HEADS))) saveJson(STORAGE_KEYS.PAY_HEADS, payHeads);
  if (!localStorage.getItem(getTenantStorageKey(STORAGE_KEYS.EMPLOYEES))) saveJson(STORAGE_KEYS.EMPLOYEES, employees);
  if (!localStorage.getItem(getTenantStorageKey(STORAGE_KEYS.VOUCHER_TYPES))) saveJson(STORAGE_KEYS.VOUCHER_TYPES, DEFAULT_VOUCHER_TYPES);

  const vTypes = loadJson<VoucherType[]>(STORAGE_KEYS.VOUCHER_TYPES, DEFAULT_VOUCHER_TYPES);

  return { config: cfg, items, units, unitGroups: uGrps, itemGroups: iGrps, categories: iCats, ledgers: leds, ledgerGroups: lGrps, heldBills: hB, payHeads, employees, voucherTypes: vTypes };
}

export function formatVoucherNumber(prefix: string = '', num: number = 1, zeroPadding?: number, suffix: string = ''): string {
  let numStr = String(Math.max(1, Math.floor(Number(num) || 1)));
  const pad = Number(zeroPadding) || 0;
  if (pad > 0) {
    numStr = numStr.padStart(pad, '0');
  }
  return `${prefix || ''}${numStr}${suffix || ''}`;
}

export function normalizeVoucherTypes(list: any[]): VoucherType[] {
  if (!Array.isArray(list) || list.length === 0) return DEFAULT_VOUCHER_TYPES;

  const typeCodeMap: Record<string, 'P' | 'R' | 'J' | 'C' | 'S' | 'PUR' | 'CN' | 'DN' | 'DEL_NOTE' | 'QUOTATION' | 'PHYSICAL_STOCK' | 'SALES_ORDER' | 'PURCHASE_ORDER' | 'RECEIPT_NOTE'> = {
    Payment: 'P',
    Receipt: 'R',
    Sale: 'S',
    Sales: 'S',
    Purchase: 'PUR',
    Journal: 'J',
    Contra: 'C',
    'Credit Note': 'CN',
    CreditNote: 'CN',
    'Debit Note': 'DN',
    DebitNote: 'DN',
    'Delivery Note': 'DEL_NOTE',
    DeliveryNote: 'DEL_NOTE',
    Quotation: 'QUOTATION',
    'Sales Order': 'SALES_ORDER',
    SalesOrder: 'SALES_ORDER',
    'Purchase Order': 'PURCHASE_ORDER',
    PurchaseOrder: 'PURCHASE_ORDER',
    'Receipt Note': 'RECEIPT_NOTE',
    ReceiptNote: 'RECEIPT_NOTE',
    'Physical Stock': 'PHYSICAL_STOCK',
    PhysicalStock: 'PHYSICAL_STOCK'
  };

  const normalized = list.map(item => {
    let parent = item.parentType || item.type || 'Payment';
    if (parent === 'CreditNote') parent = 'Credit Note';
    if (parent === 'DebitNote') parent = 'Debit Note';
    if (parent === 'DeliveryNote') parent = 'Delivery Note';
    if (parent === 'PhysicalStock') parent = 'Physical Stock';
    if (parent === 'Sales') parent = 'Sale';

    const typeCode = item.typeCode || typeCodeMap[parent] || 'P';

    const isInactive = item.status === 'Inactive' || item.isActive === false;
    const isActive = !isInactive;
    const status: 'Active' | 'Inactive' = isActive ? 'Active' : 'Inactive';

    return {
      id: item.id || `vt_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: (item.name || 'Untitled Voucher Type').trim(),
      parentType: parent as any,
      type: parent as any,
      typeCode: typeCode,
      prefix: (item.prefix || '').trim().toUpperCase(),
      suffix: (item.suffix || '').trim(),
      numberingMode: item.numberingMode === 'manual' ? 'manual' : 'auto',
      startingNumber: Number(item.startingNumber) || 1,
      zeroPadding: item.zeroPadding !== undefined ? Number(item.zeroPadding) : 4,
      defaultDebitLedger: item.defaultDebitLedger || '',
      defaultCreditLedger: item.defaultCreditLedger || '',
      defaultNarration: item.defaultNarration || '',
      isDefault: Boolean(item.isDefault),
      description: (item.description || '').trim(),
      isActive,
      status,
      branchId: item.branchId || undefined,
      branchCode: item.branchCode || undefined,
      branchName: item.branchName || undefined
    } as VoucherType;
  });

  // Ensure every existing default voucher type is preserved or merged if missing
  DEFAULT_VOUCHER_TYPES.forEach(def => {
    const exists = normalized.some(n => n.id === def.id || (n.name === def.name && n.parentType === def.parentType && !n.branchId));
    if (!exists) {
      normalized.push(def);
    }
  });

  return normalized;
}

export function getVoucherTypes(): VoucherType[] {
  const loaded = loadJson<VoucherType[]>(STORAGE_KEYS.VOUCHER_TYPES, DEFAULT_VOUCHER_TYPES);
  const normalized = normalizeVoucherTypes(loaded);
  saveJson(STORAGE_KEYS.VOUCHER_TYPES, normalized);
  return normalized;
}

export function getVoucherTypesForBranch(branchId?: string, voucherGroup?: VoucherGroupType): VoucherType[] {
  const all = getVoucherTypes();
  let list = all;
  if (branchId) {
    list = all.filter(v => !v.branchId || v.branchId === branchId);
  }
  if (voucherGroup) {
    list = list.filter(v => v.parentType === voucherGroup || v.type === voucherGroup);
  }
  return list;
}

export function peekNextVoucherNumber(vt: VoucherType): string {
  if (!vt || vt.numberingMode === 'manual') return 'MANUAL';
  const counters = loadJson<Record<string, number>>(STORAGE_KEYS.COUNTERS, {});
  const counterKey = `Voucher_${vt.id}`;
  const currentCount = counters[counterKey] || 0;
  const startNum = Number(vt.startingNumber) || 1;
  const nextNum = Math.max(startNum, currentCount + 1);
  return formatVoucherNumber(vt.prefix, nextNum, vt.zeroPadding, vt.suffix);
}

export function saveVoucherType(vt: Partial<VoucherType>) {
  let list = getVoucherTypes();
  const isNew = !vt.id;
  const id = isNew ? `vt_${Date.now()}_${Math.random().toString(36).substr(2, 5)}` : vt.id!;

  let parent = (vt.parentType || vt.type || 'Payment') as string;
  if (parent === 'CreditNote') parent = 'Credit Note';
  if (parent === 'DebitNote') parent = 'Debit Note';
  if (parent === 'DeliveryNote') parent = 'Delivery Note';
  if (parent === 'PhysicalStock') parent = 'Physical Stock';
  if (parent === 'SalesOrder') parent = 'Sales Order';
  if (parent === 'PurchaseOrder') parent = 'Purchase Order';
  if (parent === 'ReceiptNote') parent = 'Receipt Note';
  if (parent === 'Sales') parent = 'Sale';

  const typeCodeMap: Record<string, any> = {
    Payment: 'P',
    Receipt: 'R',
    Sale: 'S',
    Purchase: 'PUR',
    Journal: 'J',
    Contra: 'C',
    'Credit Note': 'CN',
    'Debit Note': 'DN',
    'Delivery Note': 'DEL_NOTE',
    Quotation: 'QUOTATION',
    'Sales Order': 'SALES_ORDER',
    'Purchase Order': 'PURCHASE_ORDER',
    'Receipt Note': 'RECEIPT_NOTE',
    'Physical Stock': 'PHYSICAL_STOCK'
  };

  const isInactive = vt.status === 'Inactive' || vt.isActive === false;
  const isActive = !isInactive;
  const status: 'Active' | 'Inactive' = isActive ? 'Active' : 'Inactive';

  const itemToSave: VoucherType = {
    id,
    name: (vt.name || 'Untitled Voucher Type').trim(),
    parentType: parent as any,
    type: parent as any,
    typeCode: vt.typeCode || typeCodeMap[parent] || 'P',
    prefix: (vt.prefix || '').trim().toUpperCase(),
    suffix: (vt.suffix || '').trim(),
    numberingMode: vt.numberingMode === 'manual' ? 'manual' : 'auto',
    startingNumber: Number(vt.startingNumber) || 1,
    zeroPadding: vt.zeroPadding !== undefined ? Number(vt.zeroPadding) : 4,
    defaultDebitLedger: vt.defaultDebitLedger || '',
    defaultCreditLedger: vt.defaultCreditLedger || '',
    defaultNarration: vt.defaultNarration || '',
    isDefault: Boolean(vt.isDefault),
    description: (vt.description || '').trim(),
    isActive,
    status,
    branchId: vt.branchId || undefined,
    branchCode: vt.branchCode || undefined,
    branchName: vt.branchName || undefined
  };

  // If marked as default, ensure it is active and unset other defaults in the same group
  if (itemToSave.isDefault) {
    itemToSave.isActive = true;
    itemToSave.status = 'Active';
    list = list.map(v => (v.parentType === itemToSave.parentType && v.id !== itemToSave.id ? { ...v, isDefault: false } : v));
  }

  const idx = list.findIndex(v => v.id === itemToSave.id);
  if (idx > -1) {
    list[idx] = itemToSave;
  } else {
    list.push(itemToSave);
  }

  saveJson(STORAGE_KEYS.VOUCHER_TYPES, list);
  return { ok: true, voucherTypes: list, savedVoucherType: itemToSave };
}

export function toggleVoucherTypeStatus(id: string) {
  let list = getVoucherTypes();
  const target = list.find(v => v.id === id);
  if (!target) return { ok: false, voucherTypes: list };

  const isCurrentlyActive = target.isActive !== false && target.status !== 'Inactive';
  const willBeActive = !isCurrentlyActive;

  list = list.map(v => {
    if (v.id === id) {
      return {
        ...v,
        isActive: willBeActive,
        status: (willBeActive ? 'Active' : 'Inactive') as 'Active' | 'Inactive',
        isDefault: willBeActive ? v.isDefault : false
      };
    }
    return v;
  });

  saveJson(STORAGE_KEYS.VOUCHER_TYPES, list);
  return { ok: true, voucherTypes: list };
}

export function setVoucherTypeDefault(id: string) {
  let list = getVoucherTypes();
  const target = list.find(v => v.id === id);
  if (!target) return { ok: false, voucherTypes: list };

  list = list.map(v => {
    if (v.parentType === target.parentType) {
      if (v.id === id) {
        return {
          ...v,
          isDefault: true,
          isActive: true,
          status: 'Active' as const
        };
      }
      return { ...v, isDefault: false };
    }
    return v;
  });

  saveJson(STORAGE_KEYS.VOUCHER_TYPES, list);
  return { ok: true, voucherTypes: list };
}

export function deleteVoucherType(id: string) {
  let list = getVoucherTypes();
  const target = list.find(v => v.id === id);
  if (target?.isDefault) {
    return { ok: false, message: 'System default voucher types cannot be deleted. Set another type as default first.', voucherTypes: list };
  }
  list = list.filter(v => v.id !== id);
  saveJson(STORAGE_KEYS.VOUCHER_TYPES, list);
  return { ok: true, voucherTypes: list };
}

export function resetDefaultVoucherTypes() {
  saveJson(STORAGE_KEYS.VOUCHER_TYPES, DEFAULT_VOUCHER_TYPES);
  return { ok: true, voucherTypes: DEFAULT_VOUCHER_TYPES };
}

export function getConfig(): Config {
  return loadJson<Config>(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
}

export function saveConfig(cfgObj: Partial<Config>) {
  const cur = loadJson<Config>(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
  const updated = { ...cur, ...cfgObj };
  saveJson(STORAGE_KEYS.CONFIG, updated);
  syncConfigToFirestore(updated).catch(() => {});
  return { ok: true, config: updated };
}

export function getUnits(): Unit[] {
  return loadJson<Unit[]>(STORAGE_KEYS.UNITS, DEFAULT_UNITS);
}

export function saveUnit(unit: Unit) {
  const list = loadJson<Unit[]>(STORAGE_KEYS.UNITS, DEFAULT_UNITS);
  const cleanName = (unit['Unit Name'] || '').trim();
  if (!cleanName) return { ok: false, error: 'Unit Name is required.', units: list };

  const dup = list.find(u => (u['Unit Name'] || '').trim().toLowerCase() === cleanName.toLowerCase() && (u['Unit Name'] || '').trim() !== (unit.oldName || '').trim());
  if (dup) return { ok: false, error: `Duplicate Unit: A measurement unit named "${cleanName}" already exists.`, units: list };

  const idx = list.findIndex(u => u['Unit Name'] === (unit.oldName || unit['Unit Name']));
  if (idx > -1) list[idx] = unit; else list.push(unit);
  saveJson(STORAGE_KEYS.UNITS, list);
  return { ok: true, units: list };
}

export function saveUnitGroup(group: UnitGroup) {
  const list = loadJson<UnitGroup[]>(STORAGE_KEYS.UNIT_GROUPS, DEFAULT_UNIT_GROUPS);
  const cleanName = (group['Group Name'] || '').trim();
  if (!cleanName) return { ok: false, error: 'Unit Group Name is required.', unitGroups: list };

  const dup = list.find(g => (g['Group Name'] || '').trim().toLowerCase() === cleanName.toLowerCase() && (g['Group Name'] || '').trim() !== (group.oldName || '').trim());
  if (dup) return { ok: false, error: `Duplicate Unit Group: A unit group named "${cleanName}" already exists.`, unitGroups: list };

  const idx = list.findIndex(g => g['Group Name'] === (group.oldName || group['Group Name']));
  if (idx > -1) list[idx] = group; else list.push(group);
  saveJson(STORAGE_KEYS.UNIT_GROUPS, list);
  return { ok: true, unitGroups: list };
}

export function saveItemGroup(group: ItemGroup) {
  const list = loadJson<ItemGroup[]>(STORAGE_KEYS.ITEM_GROUPS, DEFAULT_ITEM_GROUPS);
  const cleanName = (group['Group Name'] || '').trim();
  if (!cleanName) return { ok: false, error: 'Item Group Name is required.', itemGroups: list };

  const dup = list.find(g => (g['Group Name'] || '').trim().toLowerCase() === cleanName.toLowerCase() && (g['Group Name'] || '').trim() !== (group.oldName || '').trim());
  if (dup) return { ok: false, error: `Duplicate Item Group: An item group named "${cleanName}" already exists.`, itemGroups: list };

  const idx = list.findIndex(g => g['Group Name'] === (group.oldName || group['Group Name']));
  if (idx > -1) list[idx] = group; else list.push(group);
  saveJson(STORAGE_KEYS.ITEM_GROUPS, list);
  return { ok: true, itemGroups: list };
}

export function deleteItemGroup(groupName: string) {
  const list = loadJson<ItemGroup[]>(STORAGE_KEYS.ITEM_GROUPS, DEFAULT_ITEM_GROUPS);
  const filtered = list.filter(g => g['Group Name'] !== groupName);
  saveJson(STORAGE_KEYS.ITEM_GROUPS, filtered);
  return { ok: true, itemGroups: filtered };
}

export function deleteUnitGroup(groupName: string) {
  const list = loadJson<UnitGroup[]>(STORAGE_KEYS.UNIT_GROUPS, DEFAULT_UNIT_GROUPS);
  const filtered = list.filter(g => g['Group Name'] !== groupName);
  saveJson(STORAGE_KEYS.UNIT_GROUPS, filtered);
  return { ok: true, unitGroups: filtered };
}

export function getItemCategories(): string[] {
  return loadJson<string[]>(STORAGE_KEYS.ITEM_CATEGORIES, DEFAULT_ITEM_CATEGORIES);
}

export function saveItemCategory(catName: string) {
  const trimmed = catName.trim();
  if (!trimmed) return { ok: false, error: 'Category Name is required.', categories: getItemCategories() };
  const list = getItemCategories();
  if (list.some(c => c.trim().toLowerCase() === trimmed.toLowerCase())) {
    return { ok: false, error: `Duplicate Category: Category "${trimmed}" already exists.`, categories: list };
  }
  list.push(trimmed);
  saveJson(STORAGE_KEYS.ITEM_CATEGORIES, list);
  return { ok: true, categories: list };
}

export function getRacks(): string[] {
  return loadJson<string[]>(STORAGE_KEYS.RACKS, DEFAULT_RACKS);
}

export function saveRack(rackName: string) {
  const trimmed = rackName.trim();
  if (!trimmed) return { ok: false, error: 'Rack/Bin Name is required.', racks: getRacks() };
  const list = getRacks();
  if (list.some(r => r.trim().toLowerCase() === trimmed.toLowerCase())) {
    return { ok: false, error: `Duplicate Rack/Bin: "${trimmed}" already exists.`, racks: list };
  }
  list.push(trimmed);
  saveJson(STORAGE_KEYS.RACKS, list);
  return { ok: true, racks: list };
}

export function deleteRack(rackName: string) {
  const list = getRacks();
  const filtered = list.filter(r => r !== rackName);
  saveJson(STORAGE_KEYS.RACKS, filtered);
  return { ok: true, racks: filtered };
}

export function getCompatibilities(): string[] {
  return loadJson<string[]>(STORAGE_KEYS.COMPATIBILITIES, DEFAULT_COMPATIBILITIES);
}

export function saveCompatibility(compatName: string) {
  const trimmed = compatName.trim();
  if (!trimmed) return { ok: false, error: 'Compatibility Name is required.', compatibilities: getCompatibilities() };
  const list = getCompatibilities();
  if (list.some(c => c.trim().toLowerCase() === trimmed.toLowerCase())) {
    return { ok: false, error: `Duplicate Compatibility: "${trimmed}" already exists.`, compatibilities: list };
  }
  list.push(trimmed);
  saveJson(STORAGE_KEYS.COMPATIBILITIES, list);
  return { ok: true, compatibilities: list };
}

export function deleteCompatibility(compatName: string) {
  const list = getCompatibilities();
  const filtered = list.filter(c => c !== compatName);
  saveJson(STORAGE_KEYS.COMPATIBILITIES, filtered);
  return { ok: true, compatibilities: filtered };
}

export function getSizes(): string[] {
  return loadJson<string[]>(STORAGE_KEYS.SIZES, DEFAULT_SIZES);
}

export function saveSize(sizeName: string) {
  const trimmed = sizeName.trim();
  if (!trimmed) return { ok: false, error: 'Size is required.', sizes: getSizes() };
  const list = getSizes();
  if (list.some(s => s.trim().toLowerCase() === trimmed.toLowerCase())) {
    return { ok: false, error: `Duplicate Size: "${trimmed}" already exists.`, sizes: list };
  }
  list.push(trimmed);
  saveJson(STORAGE_KEYS.SIZES, list);
  return { ok: true, sizes: list };
}

export function deleteSize(sizeName: string) {
  const list = getSizes();
  const filtered = list.filter(s => s !== sizeName);
  saveJson(STORAGE_KEYS.SIZES, filtered);
  return { ok: true, sizes: filtered };
}

export function getColors(): string[] {
  return loadJson<string[]>(STORAGE_KEYS.COLORS, DEFAULT_COLORS);
}

export function saveColor(colorName: string) {
  const trimmed = colorName.trim();
  if (!trimmed) return { ok: false, error: 'Color is required.', colors: getColors() };
  const list = getColors();
  if (list.some(c => c.trim().toLowerCase() === trimmed.toLowerCase())) {
    return { ok: false, error: `Duplicate Color: "${trimmed}" already exists.`, colors: list };
  }
  list.push(trimmed);
  saveJson(STORAGE_KEYS.COLORS, list);
  return { ok: true, colors: list };
}

export function deleteColor(colorName: string) {
  const list = getColors();
  const filtered = list.filter(c => c !== colorName);
  saveJson(STORAGE_KEYS.COLORS, filtered);
  return { ok: true, colors: filtered };
}

// ==========================================
// MULTI-BRANCH & GODOWN / LOCATION SERVICES
// ==========================================
export interface BranchVoucherTemplate {
  key: string;
  name: string;
  parentType: VoucherGroupType;
  typeCode: 'P' | 'R' | 'J' | 'C' | 'S' | 'PUR' | 'CN' | 'DN' | 'DEL_NOTE' | 'QUOTATION' | 'PHYSICAL_STOCK' | 'SALES_ORDER' | 'PURCHASE_ORDER' | 'RECEIPT_NOTE';
  prefixSuffix: string;
  defaultStartingNumber: number;
  zeroPadding: number;
  description: string;
}

export const STANDARD_BRANCH_VOUCHER_TEMPLATES: BranchVoucherTemplate[] = [
  { key: 'pos', name: 'POS Cash Sale', parentType: 'Sale', typeCode: 'S', prefixSuffix: 'POS-', defaultStartingNumber: 1, zeroPadding: 4, description: 'Fast retail counter POS billing' },
  { key: 'b2b', name: 'B2B / Credit Sale', parentType: 'Sale', typeCode: 'S', prefixSuffix: 'B2B-', defaultStartingNumber: 1, zeroPadding: 4, description: 'Credit customer sales invoices' },
  { key: 'pur', name: 'Purchase Invoice', parentType: 'Purchase', typeCode: 'PUR', prefixSuffix: 'PUR-', defaultStartingNumber: 1, zeroPadding: 4, description: 'Supplier inward bills & inventory purchase' },
  { key: 'pmt', name: 'Payment Voucher', parentType: 'Payment', typeCode: 'P', prefixSuffix: 'PMT-', defaultStartingNumber: 1, zeroPadding: 4, description: 'Vendor, expense, and cash/bank payments' },
  { key: 'rct', name: 'Receipt Voucher', parentType: 'Receipt', typeCode: 'R', prefixSuffix: 'RCT-', defaultStartingNumber: 1, zeroPadding: 4, description: 'Customer collections and cash/bank receipts' },
  { key: 'jrn', name: 'Journal Voucher', parentType: 'Journal', typeCode: 'J', prefixSuffix: 'JRN-', defaultStartingNumber: 1, zeroPadding: 4, description: 'Adjusting entries, payroll & year-end entries' },
  { key: 'ctr', name: 'Contra Voucher', parentType: 'Contra', typeCode: 'C', prefixSuffix: 'CTR-', defaultStartingNumber: 1, zeroPadding: 4, description: 'Cash-Bank & Bank-Bank internal fund transfers' },
  { key: 'dn', name: 'Debit Note', parentType: 'Debit Note', typeCode: 'DN', prefixSuffix: 'DN-', defaultStartingNumber: 1, zeroPadding: 4, description: 'Purchase returns & debit charges to suppliers' },
  { key: 'cn', name: 'Credit Note', parentType: 'Credit Note', typeCode: 'CN', prefixSuffix: 'CN-', defaultStartingNumber: 1, zeroPadding: 4, description: 'Sales returns & credit discounts to customers' },
  { key: 'dlv', name: 'Delivery Note', parentType: 'Delivery Note', typeCode: 'DEL_NOTE', prefixSuffix: 'DLV-', defaultStartingNumber: 1, zeroPadding: 4, description: 'Goods dispatch delivery challan' },
  { key: 'grn', name: 'Receipt Note (GRN)', parentType: 'Receipt Note', typeCode: 'RECEIPT_NOTE', prefixSuffix: 'GRN-', defaultStartingNumber: 1, zeroPadding: 4, description: 'Inward goods receipt notes' },
  { key: 'qtn', name: 'Quotation / Proforma', parentType: 'Quotation', typeCode: 'QUOTATION', prefixSuffix: 'QTN-', defaultStartingNumber: 1, zeroPadding: 4, description: 'Price estimates and proforma invoices' },
  { key: 'so', name: 'Sales Order', parentType: 'Sales Order', typeCode: 'SALES_ORDER', prefixSuffix: 'SO-', defaultStartingNumber: 1, zeroPadding: 4, description: 'Customer sales orders' },
  { key: 'po', name: 'Purchase Order', parentType: 'Purchase Order', typeCode: 'PURCHASE_ORDER', prefixSuffix: 'PO-', defaultStartingNumber: 1, zeroPadding: 4, description: 'Supplier purchase orders' },
  { key: 'phy', name: 'Physical Stock Audit', parentType: 'Physical Stock', typeCode: 'PHYSICAL_STOCK', prefixSuffix: 'PHY-', defaultStartingNumber: 1, zeroPadding: 4, description: 'Stocktaking and inventory reconciliation' }
];

export function generateStandardBranchVoucherSeries(branchCode: string, branchName: string, branchId: string): VoucherType[] {
  const code = (branchCode || 'BR').trim().toUpperCase();
  const bName = (branchName || 'Branch').trim();
  
  return STANDARD_BRANCH_VOUCHER_TEMPLATES.map(tmpl => {
    return {
      id: `vt_${branchId}_${tmpl.key}`,
      name: `${bName} ${tmpl.name}`,
      parentType: tmpl.parentType,
      type: tmpl.parentType,
      typeCode: tmpl.typeCode,
      prefix: `${code}-${tmpl.prefixSuffix}`,
      numberingMode: 'auto',
      startingNumber: tmpl.defaultStartingNumber,
      zeroPadding: tmpl.zeroPadding,
      isDefault: false,
      isActive: true,
      status: 'Active',
      description: `${tmpl.description} for ${bName} (${code})`,
      branchId: branchId,
      branchCode: code,
      branchName: bName
    };
  });
}

export function getBranches(): Branch[] {
  return loadJson<Branch[]>(STORAGE_KEYS.BRANCHES, DEFAULT_BRANCHES);
}

export function saveBranch(branch: Branch, autoCreateVouchers: boolean = true) {
  const list = getBranches();
  const cleanName = (branch.name || '').trim();
  if (!cleanName) return { ok: false, error: 'Branch Name is required.', branches: list };

  const dup = list.find(b => b.name.trim().toLowerCase() === cleanName.toLowerCase() && b.id !== branch.id);
  if (dup) return { ok: false, error: `Duplicate Branch: A branch named "${cleanName}" already exists.`, branches: list };

  const isNew = !list.some(b => b.id === branch.id);
  const idx = list.findIndex(b => b.id === branch.id);
  if (idx > -1) {
    list[idx] = { ...list[idx], ...branch };
  } else {
    list.push(branch);
  }
  saveJson(STORAGE_KEYS.BRANCHES, list);

  let createdVoucherCount = 0;
  if (autoCreateVouchers) {
    try {
      let allVTypes = getVoucherTypes();
      const generated = generateStandardBranchVoucherSeries(branch.code, branch.name, branch.id);
      generated.forEach(vt => {
        const existingIdx = allVTypes.findIndex(v => v.id === vt.id || (v.branchId === branch.id && v.parentType === vt.parentType && v.typeCode === vt.typeCode));
        if (existingIdx > -1) {
          allVTypes[existingIdx] = {
            ...allVTypes[existingIdx],
            branchId: branch.id,
            branchCode: branch.code,
            branchName: branch.name,
            name: allVTypes[existingIdx].name || vt.name
          };
        } else {
          allVTypes.push(vt);
          createdVoucherCount++;
        }
      });
      saveJson(STORAGE_KEYS.VOUCHER_TYPES, allVTypes);
    } catch (e) {
      console.error('Failed to auto-create branch voucher types:', e);
    }
  }

  return { ok: true, branches: list, isNew, createdVoucherCount };
}

export function saveBranchWithCustomVouchers(
  branch: Branch,
  voucherSeriesList: Partial<VoucherType>[]
) {
  const list = getBranches();
  const cleanName = (branch.name || '').trim();
  if (!cleanName) return { ok: false, error: 'Branch Name is required.', branches: list };

  const dup = list.find(b => b.name.trim().toLowerCase() === cleanName.toLowerCase() && b.id !== branch.id);
  if (dup) return { ok: false, error: `Duplicate Branch: A branch named "${cleanName}" already exists.`, branches: list };

  const isNew = !list.some(b => b.id === branch.id);
  const idx = list.findIndex(b => b.id === branch.id);
  if (idx > -1) {
    list[idx] = { ...list[idx], ...branch };
  } else {
    list.push(branch);
  }
  saveJson(STORAGE_KEYS.BRANCHES, list);

  let allVTypes = getVoucherTypes();
  let createdVoucherCount = 0;

  voucherSeriesList.forEach(v => {
    const id = v.id || `vt_${branch.id}_${(v.prefix || 'VCH').replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}_${Date.now()}`;
    const itemToSave: VoucherType = {
      id,
      name: (v.name || `${branch.name} ${v.parentType || 'Voucher'}`).trim(),
      parentType: (v.parentType || v.type || 'Payment') as any,
      type: (v.parentType || v.type || 'Payment') as any,
      typeCode: v.typeCode || 'P',
      prefix: (v.prefix || '').trim().toUpperCase(),
      suffix: (v.suffix || '').trim(),
      numberingMode: v.numberingMode === 'manual' ? 'manual' : 'auto',
      startingNumber: Number(v.startingNumber) || 1,
      zeroPadding: v.zeroPadding !== undefined ? Number(v.zeroPadding) : 4,
      defaultDebitLedger: v.defaultDebitLedger || '',
      defaultCreditLedger: v.defaultCreditLedger || '',
      defaultNarration: v.defaultNarration || '',
      isDefault: false,
      description: (v.description || '').trim(),
      isActive: v.isActive !== false,
      status: v.isActive !== false ? 'Active' : 'Inactive',
      branchId: branch.id,
      branchCode: branch.code,
      branchName: branch.name
    };

    const existingIdx = allVTypes.findIndex(existing => existing.id === id || (existing.branchId === branch.id && existing.parentType === itemToSave.parentType && existing.typeCode === itemToSave.typeCode));
    if (existingIdx > -1) {
      allVTypes[existingIdx] = { ...allVTypes[existingIdx], ...itemToSave };
    } else {
      allVTypes.push(itemToSave);
      createdVoucherCount++;
    }
  });

  saveJson(STORAGE_KEYS.VOUCHER_TYPES, allVTypes);

  return { ok: true, branches: list, isNew, createdVoucherCount, voucherTypes: allVTypes };
}

export function deleteBranch(branchId: string) {
  const list = getBranches();
  const target = list.find(b => b.id === branchId);
  if (target?.isHeadOffice) {
    return { ok: false, error: 'Cannot delete the Head Office (HQ) branch.', branches: list };
  }
  const filtered = list.filter(b => b.id !== branchId);
  saveJson(STORAGE_KEYS.BRANCHES, filtered);

  // Clean up branch-specific voucher series
  try {
    let allVTypes = getVoucherTypes();
    const remaining = allVTypes.filter(v => v.branchId !== branchId);
    saveJson(STORAGE_KEYS.VOUCHER_TYPES, remaining);
  } catch {}

  return { ok: true, branches: filtered };
}

export function getTerminalBranchId(config?: Config): string {
  try {
    const local = localStorage.getItem('terminal_branch_id');
    if (local) return local;
  } catch {}
  return config?.ActiveBranchId || 'branch_ho';
}

export function setTerminalBranchId(branchId: string): void {
  try {
    localStorage.setItem('terminal_branch_id', branchId);
    window.dispatchEvent(new CustomEvent('terminal:branch_changed', { detail: { branchId } }));
  } catch {}
}

export function isSystemOnline(): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return false;
  }
  return true;
}

export function getDeviceCounterId(): string {
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('device_counter_id');
      if (stored && stored.trim()) return stored.trim().toUpperCase();
    }
  } catch {}

  // Smart auto-detection based on active user or screen width
  try {
    const activeUser = getActiveUser();
    const roleStr = String(activeUser?.role || '').toLowerCase();
    if (roleStr === 'cashier') return 'C1';
    if (roleStr === 'accountant') return 'ACC';
    if (typeof window !== 'undefined' && window.innerWidth < 768) return 'MOB';
  } catch {}

  return 'C1';
}

export function setDeviceCounterId(counterId: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      const clean = (counterId || '').trim().toUpperCase();
      localStorage.setItem('device_counter_id', clean);
      window.dispatchEvent(new CustomEvent('device_counter_id_changed', { detail: { counterId: clean } }));
    }
  } catch {}
}

export function getDesignatedOfflineCounter(customCompanyId?: string): string {
  try {
    const cId = customCompanyId || getActiveCompanyId();
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(`designated_offline_counter_${cId}`) || localStorage.getItem('designated_offline_counter');
      if (stored && stored.trim()) return stored.trim().toUpperCase();
    }
  } catch {}
  return 'C1';
}

export function setDesignatedOfflineCounter(counterId: string, customCompanyId?: string): void {
  try {
    const cId = customCompanyId || getActiveCompanyId();
    const clean = (counterId || 'C1').trim().toUpperCase();
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`designated_offline_counter_${cId}`, clean);
      localStorage.setItem('designated_offline_counter', clean);
      window.dispatchEvent(new CustomEvent('designated_offline_counter_changed', { detail: { counterId: clean, companyId: cId } }));
    }
  } catch {}
}

export function canCurrentDeviceBillOffline(customCompanyId?: string): {
  allowed: boolean;
  isOnline: boolean;
  currentCounter: string;
  designatedCounter: string;
  designatedCounterName: string;
  reason?: string;
} {
  const isOnline = isSystemOnline();
  const currentCounter = getDeviceCounterId();
  const designatedCounter = getDesignatedOfflineCounter(customCompanyId);
  const terminals = getTerminalsConfig(customCompanyId);
  const matchedTerm = terminals.find(t => (t.code || t.id).toUpperCase() === designatedCounter.toUpperCase());
  const designatedCounterName = matchedTerm?.name || `Counter ${designatedCounter}`;

  if (isOnline) {
    return {
      allowed: true,
      isOnline: true,
      currentCounter,
      designatedCounter,
      designatedCounterName
    };
  }

  const isMatch = currentCounter.toUpperCase() === designatedCounter.toUpperCase();
  if (isMatch) {
    return {
      allowed: true,
      isOnline: false,
      currentCounter,
      designatedCounter,
      designatedCounterName
    };
  }

  return {
    allowed: false,
    isOnline: false,
    currentCounter,
    designatedCounter,
    designatedCounterName,
    reason: `Offline Billing Restricted: Only the designated Master Counter (${designatedCounterName}) can finalize sales while offline to maintain a strict continuous invoice series without numbering gaps. This counter is currently available for price checking and stock lookups.`
  };
}

export function getEffectiveVoucherPrefix(basePrefix: string, isForcedOnline?: boolean): string {
  // Always return unified continuous series prefix (e.g., 'POS-', 'SAL-') without counter suffixes
  return basePrefix || 'POS-';
}

// ----------------- TERMINALS MANAGEMENT & LICENSING -----------------
export const DEFAULT_TERMINALS: TerminalConfig[] = [
  {
    id: 'C1',
    name: 'Counter 1 (Billing PC)',
    code: 'C1',
    role: 'Cashier',
    defaultView: 'pos',
    description: 'Main Billing Desk 1 with rapid barcode scanning',
    tag: 'Counter 1',
    color: 'from-blue-600 to-indigo-600',
    isActive: true,
    isPrimary: true
  },
  {
    id: 'C2',
    name: 'Counter 2 (Billing PC)',
    code: 'C2',
    role: 'Cashier',
    defaultView: 'pos',
    description: 'Second Billing Terminal with synchronized offline safety',
    tag: 'Counter 2',
    color: 'from-indigo-600 to-violet-600',
    isActive: false
  },
  {
    id: 'C3',
    name: 'Counter 3 (Billing PC)',
    code: 'C3',
    role: 'Cashier',
    defaultView: 'pos',
    description: 'Third Billing Counter for peak rush hours',
    tag: 'Counter 3',
    color: 'from-violet-600 to-purple-600',
    isActive: false
  },
  {
    id: 'C4',
    name: 'Counter 4 (Express Checkout)',
    code: 'C4',
    role: 'Cashier',
    defaultView: 'pos',
    description: 'Express Checkout / Quick Grocery Desk',
    tag: 'Counter 4',
    color: 'from-purple-600 to-fuchsia-600',
    isActive: false
  },
  {
    id: 'ACC1',
    name: 'Accountant Desk 1',
    code: 'ACC1',
    role: 'Accountant',
    defaultView: 'vouchers',
    description: 'Direct accounting voucher entry & bank reconciliation',
    tag: 'Accountant 1',
    color: 'from-emerald-600 to-teal-600',
    isActive: true
  },
  {
    id: 'ACC2',
    name: 'Accountant Desk 2',
    code: 'ACC2',
    role: 'Accountant',
    defaultView: 'reports',
    description: 'Financial audits, P&L statements, and ledger reviews',
    tag: 'Accountant 2',
    color: 'from-teal-600 to-cyan-600',
    isActive: false
  },
  {
    id: 'MOB',
    name: 'Owner / Mobile Phone',
    code: 'MOB',
    role: 'Manager',
    defaultView: 'dashboard',
    description: 'Live mobile sales analytics & supervisor overview',
    tag: 'Mobile Admin',
    color: 'from-amber-600 to-orange-600',
    isActive: true
  }
];

export function getTerminalsConfig(customCompanyId?: string): TerminalConfig[] {
  const cId = customCompanyId || getActiveCompanyId();
  const limit = getMaxTerminalLimit(cId);
  const defaultList: TerminalConfig[] = limit === 1 ? [DEFAULT_TERMINALS[0]] : DEFAULT_TERMINALS;
  const list = loadJson<TerminalConfig[]>(STORAGE_KEYS.TERMINALS, defaultList, cId);
  if (limit === 1) {
    const active = list.find(t => t.isActive) || list[0] || DEFAULT_TERMINALS[0];
    return [{ ...active, isActive: true }];
  }
  return list;
}

export function saveTerminalsConfig(terminals: TerminalConfig[], customCompanyId?: string): void {
  saveJson(STORAGE_KEYS.TERMINALS, terminals, customCompanyId);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('terminals_config_changed', { detail: { terminals } }));
  }
}

export function getMaxTerminalLimit(customCompanyId?: string): number {
  try {
    if (typeof localStorage !== 'undefined') {
      const cId = customCompanyId || getActiveCompanyId();
      const tenantKey = getTenantStorageKey('deep_pos_terminal_limit', cId);
      const val = localStorage.getItem(tenantKey);
      if (val !== null && val !== '') {
        const parsed = parseInt(val, 10);
        if (!isNaN(parsed)) return parsed;
      }
      
      // Also check if company record has allowed_counters
      const cached = localStorage.getItem('supabase_cached_companies');
      if (cached && cId) {
        const comps: any[] = JSON.parse(cached);
        const match = comps.find(c => c.id === cId);
        if (match && typeof match.allowed_counters === 'number') {
          return match.allowed_counters;
        }
      }
      
      // Fallback to legacy non-prefixed key if any
      const legacyVal = localStorage.getItem('deep_pos_terminal_limit');
      if (legacyVal !== null && legacyVal !== '') {
        const parsed = parseInt(legacyVal, 10);
        if (!isNaN(parsed)) return parsed;
      }
    }
  } catch {}
  return 1; // Default: 1 active billing counter allowed per company
}

export function setMaxTerminalLimit(limit: number, customCompanyId?: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      const cId = customCompanyId || getActiveCompanyId();
      const tenantKey = getTenantStorageKey('deep_pos_terminal_limit', cId);
      localStorage.setItem(tenantKey, String(limit));
      localStorage.setItem('deep_pos_terminal_limit', String(limit));

      // Update cached company record if present
      const cached = localStorage.getItem('supabase_cached_companies');
      if (cached && cId) {
        try {
          const comps: any[] = JSON.parse(cached);
          const idx = comps.findIndex(c => c.id === cId);
          if (idx !== -1) {
            comps[idx].allowed_counters = limit;
            localStorage.setItem('supabase_cached_companies', JSON.stringify(comps));
          }
        } catch {}
      }

      window.dispatchEvent(new CustomEvent('terminal_limit_changed', { detail: { limit, companyId: cId } }));
    }
  } catch {}
}

export function saveTerminalConfig(terminal: TerminalConfig): { ok: boolean; error?: string; terminals: TerminalConfig[] } {
  const terminals = getTerminalsConfig();
  const limit = getMaxTerminalLimit();
  
  const cleanId = (terminal.id || '').trim();
  const cleanCode = (terminal.code || '').trim().toUpperCase();
  const cleanName = (terminal.name || '').trim();

  if (!cleanCode) {
    return { ok: false, error: 'Terminal Code / ID (e.g. C1, POS-01) is required.', terminals };
  }
  if (!cleanName) {
    return { ok: false, error: 'Terminal Name (e.g. Counter 1, Front Billing) is required.', terminals };
  }

  const existingIndex = terminals.findIndex(
    t => t.id === cleanId || t.code.toUpperCase() === cleanCode
  );

  const updatedTerminal: TerminalConfig = {
    ...terminal,
    id: cleanId || cleanCode,
    code: cleanCode,
    name: cleanName
  };

  if (existingIndex >= 0) {
    // If we are activating an existing inactive terminal, check limit
    const wasInactive = !terminals[existingIndex].isActive;
    const activeCount = terminals.filter((t, idx) => idx !== existingIndex && t.isActive).length;
    if (wasInactive && updatedTerminal.isActive && limit > 0 && activeCount >= limit) {
      return {
        ok: false,
        error: `Cannot activate terminal. Current subscription plan allows maximum ${limit} active terminal(s).`,
        terminals
      };
    }
    terminals[existingIndex] = updatedTerminal;
  } else {
    // Adding brand new terminal
    const activeCount = terminals.filter(t => t.isActive).length;
    if (limit === 1 && terminals.length >= 1) {
      return {
        ok: false,
        error: 'Subscription restricted to 1 terminal only. Please contact Superadmin to upgrade your plan for additional terminals.',
        terminals
      };
    }
    if (updatedTerminal.isActive && limit > 0 && activeCount >= limit) {
      return {
        ok: false,
        error: `Cannot add active terminal. Current subscription plan allows maximum ${limit} active terminal(s). Please adjust the limit or deactivate an unused terminal.`,
        terminals
      };
    }
    terminals.push(updatedTerminal);
  }

  saveTerminalsConfig(terminals);
  return { ok: true, terminals };
}

export function deleteTerminalConfig(terminalId: string): { ok: boolean; error?: string; terminals: TerminalConfig[] } {
  const terminals = getTerminalsConfig();
  if (terminals.length <= 1) {
    return { ok: false, error: 'At least one terminal must remain in the system.', terminals };
  }
  const filtered = terminals.filter(t => t.id !== terminalId && t.code.toUpperCase() !== terminalId.toUpperCase());
  saveTerminalsConfig(filtered);
  return { ok: true, terminals: filtered };
}

export function resetTerminalsToDefault(customCompanyId?: string): TerminalConfig[] {
  const cId = customCompanyId || getActiveCompanyId();
  const limit = getMaxTerminalLimit(cId);
  const defaults = limit === 1 ? [DEFAULT_TERMINALS[0]] : DEFAULT_TERMINALS;
  saveTerminalsConfig(defaults, cId);
  return defaults;
}

export function getActiveBranch(config?: Config): Branch {
  const branches = getBranches();
  const terminalId = getTerminalBranchId(config);
  const found = branches.find(b => b.id === terminalId && b.isActive);
  if (found) return found;
  const configBranch = config?.ActiveBranchId ? branches.find(b => b.id === config.ActiveBranchId && b.isActive) : undefined;
  if (configBranch) return configBranch;
  const ho = branches.find(b => b.isHeadOffice && b.isActive);
  return ho || branches[0] || DEFAULT_BRANCHES[0];
}

export function getGodowns(): Godown[] {
  return loadJson<Godown[]>(STORAGE_KEYS.GODOWNS, DEFAULT_GODOWNS);
}

export function saveGodown(godown: Godown) {
  const list = getGodowns();
  const cleanName = (godown.name || '').trim();
  if (!cleanName) return { ok: false, error: 'Godown Name is required.', godowns: list };

  const dup = list.find(g => g.name.trim().toLowerCase() === cleanName.toLowerCase() && g.branchId === godown.branchId && g.id !== godown.id);
  if (dup) return { ok: false, error: `Duplicate Godown: A godown named "${cleanName}" already exists for this branch.`, godowns: list };

  const idx = list.findIndex(g => g.id === godown.id);
  if (idx > -1) {
    list[idx] = { ...list[idx], ...godown };
  } else {
    list.push(godown);
  }
  saveJson(STORAGE_KEYS.GODOWNS, list);
  return { ok: true, godowns: list };
}

export function deleteGodown(godownId: string): { ok: boolean; godowns: Godown[]; error?: string } {
  const list = getGodowns();
  const filtered = list.filter(g => g.id !== godownId);
  saveJson(STORAGE_KEYS.GODOWNS, filtered);
  return { ok: true, godowns: filtered };
}

export function getStockTransfers(): StockTransferVoucher[] {
  return loadJson<StockTransferVoucher[]>(STORAGE_KEYS.STOCK_TRANSFERS, []);
}

export function peekNextTransferNo(mode: 'direct' | 'challan' = 'direct'): string {
  const config = loadJson<Config>(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
  const prefix = mode === 'challan' ? (config.TransferChallanPrefix || 'TRC-') : (config.StockTransferPrefix || 'TRF-');
  const transfers = getStockTransfers();
  const matching = transfers.filter(t => t.transferNo && t.transferNo.startsWith(prefix));
  let maxNum = 0;
  matching.forEach(t => {
    const numPart = parseInt(t.transferNo.replace(prefix, ''), 10);
    if (!isNaN(numPart) && numPart > maxNum) maxNum = numPart;
  });
  return `${prefix}${String(maxNum + 1).padStart(4, '0')}`;
}

export function saveStockTransfer(transfer: StockTransferVoucher) {
  if (!transfer.items || transfer.items.length === 0) {
    return { ok: false, error: 'At least one item is required for stock transfer.' };
  }
  if (transfer.fromBranchId === transfer.toBranchId && (!transfer.fromGodownId || transfer.fromGodownId === transfer.toGodownId)) {
    return { ok: false, error: 'Source and Destination locations cannot be identical.' };
  }

  const transfers = getStockTransfers();
  const isNew = !transfers.some(t => t.id === transfer.id);
  if (isNew) {
    transfers.unshift(transfer);
  } else {
    const idx = transfers.findIndex(t => t.id === transfer.id);
    if (idx > -1) transfers[idx] = transfer;
  }
  saveJson(STORAGE_KEYS.STOCK_TRANSFERS, transfers);

  // Update stock ledger
  const stockLog = loadJson<StockLedgerEntry[]>(STORAGE_KEYS.STOCK_LEDGER, []);
  const dateIso = transfer.date ? new Date(transfer.date).toISOString() : new Date().toISOString();

  // If transfer mode is direct or status is completed, post Outward from source and Inward to destination
  if (transfer.transferMode === 'direct' || transfer.status === 'completed') {
    transfer.items.forEach(item => {
      // Source outward
      stockLog.push({
        DateIso: dateIso,
        'Item Code': item.itemCode,
        'Item Name': item.itemName,
        Type: 'Stock Transfer Out',
        'Qty In': 0,
        'Qty Out': Number(item.qty) || 0,
        Balance: 0,
        'Ref No': transfer.transferNo,
        branchId: transfer.fromBranchId,
        branchName: transfer.fromBranchName,
        godownId: transfer.fromGodownId,
        godownName: transfer.fromGodownName
      });
      // Destination inward
      stockLog.push({
        DateIso: dateIso,
        'Item Code': item.itemCode,
        'Item Name': item.itemName,
        Type: 'Stock Transfer In',
        'Qty In': Number(item.qty) || 0,
        'Qty Out': 0,
        Balance: 0,
        'Ref No': transfer.transferNo,
        branchId: transfer.toBranchId,
        branchName: transfer.toBranchName,
        godownId: transfer.toGodownId,
        godownName: transfer.toGodownName
      });
    });
  } else if (transfer.transferMode === 'challan' && transfer.status === 'in_transit') {
    // 2-step Challan dispatch: Deduct from source branch into Transit
    transfer.items.forEach(item => {
      stockLog.push({
        DateIso: dateIso,
        'Item Code': item.itemCode,
        'Item Name': item.itemName,
        Type: 'Transfer Challan Out (In-Transit)',
        'Qty In': 0,
        'Qty Out': Number(item.qty) || 0,
        Balance: 0,
        'Ref No': transfer.transferNo,
        branchId: transfer.fromBranchId,
        branchName: transfer.fromBranchName,
        godownId: transfer.fromGodownId,
        godownName: transfer.fromGodownName
      });
    });
  }
  saveJson(STORAGE_KEYS.STOCK_LEDGER, stockLog);

  // Add audit trail entry
  addAuditLog({
    action: isNew ? 'ENTERED' : 'ALTERED',
    module: transfer.transferMode === 'challan' ? 'Transfer Challan' : 'Stock Transfer',
    recordId: transfer.transferNo,
    partyName: `${transfer.fromBranchName} -> ${transfer.toBranchName}`,
    amount: transfer.totalAmount || 0,
    details: `${transfer.items.length} item(s) transferred [Mode: ${transfer.transferMode}, Status: ${transfer.status}]`
  });

  return { ok: true, transfer, transfers };
}

export function receiveStockTransferChallan(transferId: string, receivedNotes?: string, receivedBy?: string) {
  const transfers = getStockTransfers();
  const transfer = transfers.find(t => t.id === transferId);
  if (!transfer) return { ok: false, error: 'Transfer Challan not found.' };
  if (transfer.status === 'received' || transfer.status === 'completed') {
    return { ok: false, error: 'This shipment has already been received.' };
  }

  transfer.status = 'received';
  transfer.receivedDate = new Date().toISOString().split('T')[0];
  transfer.receivedBy = receivedBy || 'Storekeeper';
  transfer.receivedNotes = receivedNotes || 'Received and verified at destination';

  saveJson(STORAGE_KEYS.STOCK_TRANSFERS, transfers);

  // Post destination inward stock
  const stockLog = loadJson<StockLedgerEntry[]>(STORAGE_KEYS.STOCK_LEDGER, []);
  const dateIso = new Date().toISOString();

  transfer.items.forEach(item => {
    stockLog.push({
      DateIso: dateIso,
      'Item Code': item.itemCode,
      'Item Name': item.itemName,
      Type: 'Transfer Challan In (Received)',
      'Qty In': Number(item.qty) || 0,
      'Qty Out': 0,
      Balance: 0,
      'Ref No': transfer.transferNo,
      branchId: transfer.toBranchId,
      branchName: transfer.toBranchName,
      godownId: transfer.toGodownId,
      godownName: transfer.toGodownName
    });
  });
  saveJson(STORAGE_KEYS.STOCK_LEDGER, stockLog);

  addAuditLog({
    action: 'ALTERED',
    module: 'Transfer Challan',
    recordId: transfer.transferNo,
    partyName: `Received at ${transfer.toBranchName}`,
    amount: transfer.totalAmount || 0,
    details: `Challan received by ${transfer.receivedBy}. Notes: ${transfer.receivedNotes}`
  });

  return { ok: true, transfer, transfers };
}

export function cancelStockTransfer(transferId: string, reason?: string) {
  const transfers = getStockTransfers();
  const transfer = transfers.find(t => t.id === transferId);
  if (!transfer) return { ok: false, error: 'Transfer not found.' };
  if (transfer.status === 'received' || transfer.status === 'completed') {
    return { ok: false, error: 'Cannot cancel a completed or received transfer.' };
  }

  transfer.status = 'cancelled';
  transfer.narration = (transfer.narration ? transfer.narration + ' ' : '') + `[Cancelled: ${reason || 'User cancelled'}]`;
  saveJson(STORAGE_KEYS.STOCK_TRANSFERS, transfers);

  // If it was in transit, reverse the source outward deduction
  if (transfer.transferMode === 'challan') {
    const stockLog = loadJson<StockLedgerEntry[]>(STORAGE_KEYS.STOCK_LEDGER, []);
    const dateIso = new Date().toISOString();
    transfer.items.forEach(item => {
      stockLog.push({
        DateIso: dateIso,
        'Item Code': item.itemCode,
        'Item Name': item.itemName,
        Type: 'Transfer Challan Cancelled (Reversal)',
        'Qty In': Number(item.qty) || 0,
        'Qty Out': 0,
        Balance: 0,
        'Ref No': transfer.transferNo,
        branchId: transfer.fromBranchId,
        branchName: transfer.fromBranchName,
        godownId: transfer.fromGodownId,
        godownName: transfer.fromGodownName
      });
    });
    saveJson(STORAGE_KEYS.STOCK_LEDGER, stockLog);
  }

  addAuditLog({
    action: 'CANCELLED',
    module: 'Stock Transfer',
    recordId: transfer.transferNo,
    details: `Transfer cancelled: ${reason || 'User cancelled'}`
  });

  return { ok: true, transfer, transfers };
}

export function getItemStockForBranch(itemCode: string, branchId?: string): number {
  if (!branchId || branchId === 'all') {
    const items = loadJson<Item[]>(STORAGE_KEYS.ITEMS, DEFAULT_ITEMS);
    const it = items.find(i => i['Item Code'] === itemCode);
    return Number(it?.['Current Stock']) || 0;
  }
  const stockLog = loadJson<StockLedgerEntry[]>(STORAGE_KEYS.STOCK_LEDGER, []);
  let branchStock = 0;
  stockLog.filter(l => l['Item Code'] === itemCode && (l.branchId === branchId || (!l.branchId && branchId === 'branch_ho'))).forEach(l => {
    branchStock += (Number(l['Qty In']) || 0) - (Number(l['Qty Out']) || 0);
  });
  return branchStock;
}

export function generateBarcode(): string {
  const num = nextCounter('InternalBarcode');
  // Auto generate 6 to 7 digit numeric barcode starting from 100001
  const val = 100000 + num;
  return String(val);
}

export function generateMissingBarcodes(): { count: number; items: Item[] } {
  const list = loadJson<Item[]>(STORAGE_KEYS.ITEMS, DEFAULT_ITEMS);
  let updatedCount = 0;
  const updatedList = list.map(item => {
    if (!item.Barcode || !item.Barcode.trim()) {
      updatedCount++;
      return { ...item, Barcode: generateBarcode() };
    }
    return item;
  });
  if (updatedCount > 0) {
    saveJson(STORAGE_KEYS.ITEMS, updatedList);
  }
  return { count: updatedCount, items: updatedList };
}

export interface BulkImportItem {
  name: string;
  baseUnit: string;
  altUnit?: string;
  conversionFactor?: number;
  openingQty: number;
  purchaseRate: number;
  saleRate: number;
  wholesaleRate?: number;
  altPurchaseRate?: number;
  altSaleRate?: number;
  altWholesaleRate?: number;
  mrp: number;
  altMrp?: number;
  barcode?: string;
  group?: string;
  category?: string;
  serials?: string[];
  branch?: string;
}

export function bulkImportItems(itemsToImport: BulkImportItem[], defaultTargetBranchId?: string) {
  const itemsList = loadJson<Item[]>(STORAGE_KEYS.ITEMS, DEFAULT_ITEMS);
  const groupsList = loadJson<ItemGroup[]>(STORAGE_KEYS.ITEM_GROUPS, DEFAULT_ITEM_GROUPS);
  const catsList = loadJson<string[]>(STORAGE_KEYS.ITEM_CATEGORIES, DEFAULT_ITEM_CATEGORIES);
  const unitsList = loadJson<Unit[]>(STORAGE_KEYS.UNITS, DEFAULT_UNITS);
  const deletedItems = loadJson<string[]>(STORAGE_KEYS.DELETED_ITEMS, []);
  const allBranches = getBranches();
  const defaultBranch = defaultTargetBranchId
    ? (allBranches.find(b => b.id === defaultTargetBranchId) || getActiveBranch())
    : getActiveBranch();

  let deletedListChanged = false;

  let addedItems = 0;
  const newlyAddedItems: Item[] = [];
  let skippedItems: string[] = [];
  let barcodeCounter = nextCounter('InternalBarcode');
  let itemCodeCounter = Date.now();

  for (const importItem of itemsToImport) {
    const cleanName = String(importItem.name || '').trim();
    if (!cleanName) continue;

    // Resolve target branch for this item
    let targetBranch = defaultBranch;
    if (importItem.branch && String(importItem.branch).trim()) {
      const bStr = String(importItem.branch).trim().toLowerCase();
      const matched = allBranches.find(b => 
        b.id.toLowerCase() === bStr || 
        b.name.toLowerCase() === bStr ||
        b.code?.toLowerCase() === bStr ||
        (bStr.includes('head') && b.isHeadOffice)
      );
      if (matched) {
        targetBranch = matched;
      }
    }

    const opQty = Number(importItem.openingQty) || 0;

    // Check if item already exists by name
    const existingIdx = itemsList.findIndex(i => i['Item Name'].toLowerCase() === cleanName.toLowerCase());
    if (existingIdx > -1) {
      const existing = itemsList[existingIdx];
      // If importing additional branch opening stock for an existing item
      if (opQty > 0) {
        existing['Current Stock'] = (Number(existing['Current Stock']) || 0) + opQty;
        existing['Opening Stock'] = (Number(existing['Opening Stock']) || 0) + opQty;
        const pRate = Number(existing['Purchase Rate']) || Number(importItem.purchaseRate) || 0;
        existing['Opening Amount'] = (existing['Opening Stock'] || 0) * pRate;

        // Update branchAllocations
        if (!existing.branchAllocations) {
          existing.branchAllocations = [];
        }
        const allocIdx = existing.branchAllocations.findIndex(a => a.branchId === targetBranch.id);
        if (allocIdx > -1) {
          existing.branchAllocations[allocIdx].openingStock = (Number(existing.branchAllocations[allocIdx].openingStock) || 0) + opQty;
        } else {
          existing.branchAllocations.push({
            branchId: targetBranch.id,
            branchName: targetBranch.name,
            openingStock: opQty
          });
        }

        // Log opening stock into Stock Ledger under that branch
        logStock(
          existing['Item Code'],
          existing['Item Name'],
          'Opening',
          opQty,
          0,
          existing['Current Stock'],
          `OPENING (${targetBranch.name})`,
          existing.Unit,
          targetBranch.id,
          targetBranch.name
        );

        newlyAddedItems.push(existing);
        addedItems++;
      } else {
        skippedItems.push(cleanName);
      }
      continue;
    }

    const groupName = String(importItem.group || '').trim() || 'Primary';
    if (!groupsList.some(g => g['Group Name'].toLowerCase() === groupName.toLowerCase())) {
      groupsList.push({ 'Group Name': groupName });
    }

    if (importItem.category && String(importItem.category).trim()) {
      const catName = String(importItem.category).trim();
      if (!catsList.some(c => c.toLowerCase() === catName.toLowerCase())) {
        catsList.push(catName);
      }
    }

    const baseUnitName = String(importItem.baseUnit || 'Pcs').trim();
    if (!unitsList.some(u => u['Unit Name'].toLowerCase() === baseUnitName.toLowerCase())) {
      unitsList.push({ 'Unit Name': baseUnitName, Symbol: baseUnitName, Group: 'Primary', 'Conversion Factor': 1 });
    }

    if (importItem.altUnit && String(importItem.altUnit).trim()) {
      const altUnitName = String(importItem.altUnit).trim();
      if (!unitsList.some(u => u['Unit Name'].toLowerCase() === altUnitName.toLowerCase())) {
        unitsList.push({ 'Unit Name': altUnitName, Symbol: altUnitName, Group: 'Primary', 'Conversion Factor': 1 });
      }
    }

    const rawBarcode = importItem.barcode !== undefined && importItem.barcode !== null ? String(importItem.barcode).trim() : '';
    const barcode = rawBarcode || String(100000 + barcodeCounter++);
    const itemCode = 'ITM' + (itemCodeCounter++).toString().slice(-8);

    const isSerialized = importItem.serials && importItem.serials.length > 0 ? 'Y' : 'N';
    const openingSerials = isSerialized === 'Y' ? importItem.serials!.join('\n') : '';

    let convFactor = Number(importItem.conversionFactor) || 1;
    let basePurchaseRate = Number(importItem.purchaseRate) || 0;
    let baseSaleRate = Number(importItem.saleRate) || 0;
    let baseWholesaleRate = importItem.wholesaleRate ? Number(importItem.wholesaleRate) : undefined;
    let baseMrp = Number(importItem.mrp) || 0;

    // If only alt rates are provided, calculate base rates
    if (importItem.altPurchaseRate && !basePurchaseRate) {
      basePurchaseRate = Number((importItem.altPurchaseRate / convFactor).toFixed(2));
    }
    if (importItem.altWholesaleRate && baseWholesaleRate === undefined) {
      baseWholesaleRate = Number((importItem.altWholesaleRate / convFactor).toFixed(2));
    }
    if (importItem.altMrp && !baseMrp) {
      baseMrp = Number((importItem.altMrp / convFactor).toFixed(2));
    }

    const newItem: Item = {
      'Item Code': itemCode,
      Barcode: barcode,
      'Item Name': cleanName,
      'Print Name': cleanName,
      Group: groupName,
      Category: importItem.category ? String(importItem.category).trim() : undefined,
      Unit: baseUnitName,
      'Purchase Rate': basePurchaseRate,
      'Sale Rate': baseSaleRate,
      'Wholesale Rate': baseWholesaleRate,
      MRP: baseMrp,
      'GST %': 5,
      'Zero Rated (Y/N)': 'N',
      'Is Serialized': isSerialized,
      'Maintain Stock': 'Y',
      'HSN/SAC': '',
      'Opening Stock': opQty,
      'Opening Amount': opQty * basePurchaseRate,
      'Current Stock': opQty,
      'Reorder Level': 0,
      'Opening Serials': openingSerials,
      branchAllocations: opQty > 0 ? [{
        branchId: targetBranch.id,
        branchName: targetBranch.name,
        openingStock: opQty
      }] : []
    };

    if (importItem.altUnit && String(importItem.altUnit).trim() && convFactor > 1) {
      const trimmedAltUnit = String(importItem.altUnit).trim();
      newItem.multiUnits = [{
        unit: trimmedAltUnit,
        conversionFactor: convFactor,
        purchaseRate: Number(importItem.altPurchaseRate) || (basePurchaseRate * convFactor),
        saleRate: Number(importItem.altSaleRate) || (baseSaleRate * convFactor),
        wholesaleRate: importItem.altWholesaleRate !== undefined ? Number(importItem.altWholesaleRate) : (baseWholesaleRate !== undefined ? baseWholesaleRate * convFactor : undefined),
        mrp: Number(importItem.altMrp) || (baseMrp * convFactor)
      }];
    }

    itemsList.push(newItem);
    newlyAddedItems.push(newItem);
    addedItems++;

    // Log initial opening stock into Stock Ledger under the assigned branch
    if (opQty > 0) {
      logStock(
        itemCode,
        cleanName,
        'Opening',
        opQty,
        0,
        opQty,
        `OPENING (${targetBranch.name})`,
        baseUnitName,
        targetBranch.id,
        targetBranch.name
      );
    }

    // Un-delete if previously in deleted items
    const cNorm = itemCode.toLowerCase();
    const bNorm = barcode.toLowerCase();
    const dIdx = deletedItems.findIndex(d => d === cNorm || d === bNorm);
    if (dIdx > -1) {
      deletedItems.splice(dIdx, 1);
      deletedListChanged = true;
    }
  }

  if (deletedListChanged) {
    saveJson(STORAGE_KEYS.DELETED_ITEMS, deletedItems);
  }

  // Save next counter
  const counters = loadJson<Record<string, number>>(STORAGE_KEYS.COUNTERS, {});
  counters['InternalBarcode'] = barcodeCounter;
  saveJson(STORAGE_KEYS.COUNTERS, counters);

  // Save all lists locally
  saveJson(STORAGE_KEYS.ITEMS, itemsList);
  saveJson(STORAGE_KEYS.ITEM_GROUPS, groupsList);
  saveJson(STORAGE_KEYS.ITEM_CATEGORIES, catsList);
  saveJson(STORAGE_KEYS.UNITS, unitsList);

  // Immediately push newly added items to Firestore in batch
  if (newlyAddedItems.length > 0) {
    syncItemsBatchToFirestore(newlyAddedItems).catch(err => {
      console.warn('Failed to batch sync imported items to Firestore:', err);
    });
  }

  return { ok: true, added: addedItems, skipped: skippedItems, newItems: newlyAddedItems };
}

export function saveItem(item: Item) {
  const list = loadJson<Item[]>(STORAGE_KEYS.ITEMS, DEFAULT_ITEMS);
  const isNew = !item.oldCode;
  const cleanCode = (item['Item Code'] || '').trim();
  const cleanName = (item['Item Name'] || '').trim();

  if (!cleanName) {
    return { ok: false, error: 'Item Name is required.' };
  }

  // Duplicate Code & Name Checks
  if (cleanCode) {
    const duplicateCode = list.find(i => (i['Item Code'] || '').trim().toLowerCase() === cleanCode.toLowerCase() && (i['Item Code'] || '').trim() !== (item.oldCode || '').trim());
    if (duplicateCode) return { ok: false, error: `Duplicate Item Code: An item with code "${cleanCode}" already exists.` };
  }

  const duplicateName = list.find(i => (i['Item Name'] || '').trim().toLowerCase() === cleanName.toLowerCase() && (i['Item Code'] || '').trim() !== (item.oldCode || '').trim());
  if (duplicateName) return { ok: false, error: `Duplicate Item Name: An item named "${cleanName}" already exists.` };

  if (isNew && !item['Item Code']) {
    item['Item Code'] = 'ITM' + new Date().toISOString().replace(/\D/g, '').slice(2, 14);
  }

  if (!item['Barcode'] || !item['Barcode'].trim()) {
    item['Barcode'] = generateBarcode();
  }
  item['Current Stock'] = isNew ? (Number(item['Opening Stock']) || 0) : Number(item['Current Stock']) || 0;

  const idx = list.findIndex(i => i['Item Code'] === (item.oldCode || item['Item Code']));
  if (idx > -1) list[idx] = item; else list.push(item);
  saveJson(STORAGE_KEYS.ITEMS, list);

  // Audit Trail Logging
  addAuditLog({
    action: isNew ? 'ENTERED' : 'ALTERED',
    module: 'Item Master',
    recordId: item['Item Code'],
    partyName: cleanName,
    amount: Number(item['Sale Rate']) || 0,
    details: isNew ? `Created new item: ${cleanName} (Rate: Nu. ${item['Sale Rate']})` : `Updated item: ${cleanName} (Rate: Nu. ${item['Sale Rate']})`
  });

  // Un-delete if code or barcode was in DELETED_ITEMS
  const deleted = loadJson<string[]>(STORAGE_KEYS.DELETED_ITEMS, []);
  const cNorm = (item['Item Code'] || '').trim().toLowerCase();
  const bNorm = (item.Barcode || '').trim().toLowerCase();
  const filteredDeleted = deleted.filter(d => d !== cNorm && d !== bNorm);
  if (filteredDeleted.length !== deleted.length) {
    saveJson(STORAGE_KEYS.DELETED_ITEMS, filteredDeleted);
  }

  syncItemToFirestore(item).catch(() => {});

  if (isNew && Number(item['Opening Stock']) > 0) {
    const openingRef = item['Opening Serials'] && item['Opening Serials'].trim()
      ? `OPENING (SN: ${item['Opening Serials']})`
      : 'OPENING';

    if (item.branchAllocations && item.branchAllocations.length > 0) {
      item.branchAllocations.forEach(alloc => {
        const aQty = Number(alloc.openingStock) || 0;
        if (aQty > 0) {
          const locLabel = alloc.godownName ? `${alloc.branchName} - ${alloc.godownName}` : alloc.branchName;
          logStock(
            item['Item Code'],
            item['Item Name'],
            'Opening',
            aQty,
            0,
            aQty,
            `${openingRef} (${locLabel})`,
            item.Unit,
            alloc.branchId,
            alloc.branchName,
            alloc.godownId,
            alloc.godownName
          );
        }
      });
    } else {
      const activeBr = getActiveBranch();
      logStock(item['Item Code'], item['Item Name'], 'Opening', Number(item['Opening Stock']), 0, Number(item['Opening Stock']), openingRef, item.Unit, activeBr.id, activeBr.name);
    }
  }

  return { ok: true, items: list };
}

export function isItemInUse(code: string): boolean {
  if (!code || !code.trim()) return false;
  const target = code.trim().toLowerCase();

  // 1. Check if current stock > 0
  const items = loadJson<Item[]>(STORAGE_KEYS.ITEMS, DEFAULT_ITEMS);
  const foundItem = items.find(i => (i['Item Code'] || '').trim().toLowerCase() === target);
  if (foundItem && Number(foundItem['Current Stock']) > 0) {
    return true;
  }

  // 2. Check Sales Invoices
  const sales = loadJson<SalesInvoice[]>(STORAGE_KEYS.SALES_INVOICES, []);
  if (sales.some(s => (s.items || []).some(i => (i['Item Code'] || '').trim().toLowerCase() === target))) return true;

  // 3. Check Purchase Invoices
  const purchases = loadJson<PurchaseInvoice[]>(STORAGE_KEYS.PURCHASE_INVOICES, []);
  if (purchases.some(p => (p.items || []).some(i => (i['Item Code'] || '').trim().toLowerCase() === target))) return true;

  // 4. Check Quotations, Delivery Notes, Physical Stock
  const quotes = loadJson<Quotation[]>(STORAGE_KEYS.QUOTATIONS, []);
  if (quotes.some(q => (q.items || []).some(i => (i['Item Code'] || '').trim().toLowerCase() === target))) return true;

  const notes = loadJson<DeliveryNote[]>(STORAGE_KEYS.DELIVERY_NOTES, []);
  if (notes.some(n => (n.items || []).some(i => (i['Item Code'] || '').trim().toLowerCase() === target))) return true;

  const physicals = loadJson<PhysicalStockVoucher[]>(STORAGE_KEYS.PHYSICAL_STOCK, []);
  if (physicals.some(p => (p.items || []).some(i => (i['Item Code'] || '').trim().toLowerCase() === target))) return true;

  return false;
}

export function deleteItem(code: string) {
  if (!code || !code.trim()) return { ok: false, error: 'Invalid item code.' };
  const target = code.trim();

  if (isItemInUse(target)) {
    return {
      ok: false,
      error: `Cannot delete item code "${target}" because it has active stock movements, sales, or purchases.`
    };
  }

  let list = loadJson<Item[]>(STORAGE_KEYS.ITEMS, DEFAULT_ITEMS);
  list = list.filter(i => (i['Item Code'] || '').trim().toLowerCase() !== target.toLowerCase());
  saveJson(STORAGE_KEYS.ITEMS, list);

  // Record in DELETED_ITEMS so Firestore sync listener does not restore it
  const deleted = loadJson<string[]>(STORAGE_KEYS.DELETED_ITEMS, []);
  if (!deleted.includes(target.toLowerCase())) {
    deleted.push(target.toLowerCase());
    saveJson(STORAGE_KEYS.DELETED_ITEMS, deleted);
  }

  // Clean orphan stock logs for deleted item
  const stockLogs = loadJson<StockLedgerEntry[]>(STORAGE_KEYS.STOCK_LEDGER, []);
  const cleanLogs = stockLogs.filter(l => (l['Item Code'] || '').trim().toLowerCase() !== target.toLowerCase());
  if (cleanLogs.length !== stockLogs.length) {
    saveJson(STORAGE_KEYS.STOCK_LEDGER, cleanLogs);
  }

  deleteItemFromFirestore(target).catch(() => {});

  // Audit Trail Logging
  addAuditLog({
    action: 'DELETED',
    module: 'Item Master',
    recordId: target,
    details: `Deleted item: ${target}`
  });

  return { ok: true, items: list };
}

export function saveLedgerGroup(g: LedgerGroup) {
  const list = loadJson<LedgerGroup[]>(STORAGE_KEYS.LEDGER_GROUPS, DEFAULT_LEDGER_GROUPS);
  const cleanName = (g['Group Name'] || '').trim();
  if (!cleanName) return { ok: false, error: 'Ledger Group Name is required.', ledgerGroups: list };

  const dup = list.find(x => (x['Group Name'] || '').trim().toLowerCase() === cleanName.toLowerCase() && (x['Group Name'] || '').trim() !== (g.oldName || '').trim());
  if (dup) return { ok: false, error: `Duplicate Ledger Group: A group named "${cleanName}" already exists.`, ledgerGroups: list };

  const idx = list.findIndex(x => x['Group Name'] === (g.oldName || g['Group Name']));
  if (idx > -1) list[idx] = g; else list.push(g);
  saveJson(STORAGE_KEYS.LEDGER_GROUPS, list);
  return { ok: true, ledgerGroups: list };
}

export function deleteLedgerGroup(groupName: string) {
  const list = loadJson<LedgerGroup[]>(STORAGE_KEYS.LEDGER_GROUPS, DEFAULT_LEDGER_GROUPS);
  const filtered = list.filter(g => g['Group Name'] !== groupName);
  saveJson(STORAGE_KEYS.LEDGER_GROUPS, filtered);
  return { ok: true, ledgerGroups: filtered };
}

export function saveLedger(l: Ledger) {
  let list = sanitizeLedgers(loadJson<Ledger[]>(STORAGE_KEYS.LEDGERS, DEFAULT_LEDGERS));
  const cleanName = (l['Ledger Name'] || '').trim();

  if (!cleanName) {
    return { ok: false, error: 'Ledger Name is required.' };
  }

  const duplicateName = list.find(x => (x['Ledger Name'] || '').trim().toLowerCase() === cleanName.toLowerCase() && (x['Ledger Name'] || '').trim() !== (l.oldName || '').trim());
  if (duplicateName) return { ok: false, error: `Duplicate Ledger Name: A ledger named "${cleanName}" already exists.` };

  const isNew = !l.oldName;
  l['Current Balance'] = isNew ? (Number(l['Opening Balance']) || 0) : Number(l['Current Balance']) || 0;

  // Auto-infer group if group was omitted
  if (!l.Group) {
    l.Group = inferLedgerGroup(l['Ledger Name'], 'Sundry Debtors');
  }

  const idx = list.findIndex(x => (x['Ledger Name'] || '').trim().toLowerCase() === (l.oldName || l['Ledger Name']).trim().toLowerCase());
  if (idx > -1) list[idx] = l; else list.push(l);
  list = sanitizeLedgers(list);
  saveJson(STORAGE_KEYS.LEDGERS, list);
  syncLedgerToFirestore(l).catch(() => {});

  // Audit Trail Logging
  addAuditLog({
    action: isNew ? 'ENTERED' : 'ALTERED',
    module: 'Ledger Master',
    recordId: cleanName,
    partyName: l.Group,
    amount: Number(l['Opening Balance']) || 0,
    details: isNew ? `Created new ledger: ${cleanName} (${l.Group})` : `Updated ledger: ${cleanName} (${l.Group})`
  });

  return { ok: true, ledgers: list };
}

export function updateLedgerLogTransactionId(dateIso: string, refNo: string, transactionId: string) {
  const logs = loadJson<LedgerLogEntry[]>(STORAGE_KEYS.LEDGER_LOG, []);
  let updated = false;
  logs.forEach(l => {
    if ((dateIso && l.DateIso === dateIso) || (refNo && l['Ref No'] === refNo)) {
      l.transactionId = transactionId;
      l['Transaction ID'] = transactionId;
      updated = true;
    }
  });
  if (updated) {
    saveJson(STORAGE_KEYS.LEDGER_LOG, logs);
  }
}

export function isLedgerInUse(name: string): boolean {
  if (!name || !name.trim()) return false;
  const target = name.trim().toLowerCase();

  // 1. Check if ledger has non-zero current balance or opening balance
  const leds = loadJson<Ledger[]>(STORAGE_KEYS.LEDGERS, DEFAULT_LEDGERS);
  const foundLedger = leds.find(l => (l['Ledger Name'] || '').trim().toLowerCase() === target);
  if (foundLedger) {
    const curBal = Math.abs(Number(foundLedger['Current Balance']) || 0);
    const opBal = Math.abs(Number(foundLedger['Opening Balance']) || 0);
    if (curBal >= 0.01 || opBal >= 0.01) {
      return true;
    }
  }

  // 2. Check Sales Invoices
  const sales = loadJson<SalesInvoice[]>(STORAGE_KEYS.SALES_INVOICES, []);
  if (sales.some(s => {
    const cLedger = (s.customer?.ledger || '').trim().toLowerCase();
    const cName = (s.customer?.name || '').trim().toLowerCase();
    const b1 = (s.paymentDetails?.bank1Ledger || '').trim().toLowerCase();
    const b2 = (s.paymentDetails?.bank2Ledger || '').trim().toLowerCase();
    const expUsed = (s.additionalExpenses || []).some(exp => (exp.ledger || '').trim().toLowerCase() === target);
    return cLedger === target || cName === target || b1 === target || b2 === target || expUsed;
  })) return true;

  // 3. Check Purchase Invoices
  const purchases = loadJson<PurchaseInvoice[]>(STORAGE_KEYS.PURCHASE_INVOICES, []);
  if (purchases.some(p => {
    const sLedger = (p.supplier?.ledger || '').trim().toLowerCase();
    const sName = (p.supplier?.name || '').trim().toLowerCase();
    const b1 = (p.paymentDetails?.bank1Ledger || '').trim().toLowerCase();
    const b2 = (p.paymentDetails?.bank2Ledger || '').trim().toLowerCase();
    const expUsed = (p.additionalExpenses || []).some(exp => (exp.ledger || '').trim().toLowerCase() === target);
    return sLedger === target || sName === target || b1 === target || b2 === target || expUsed;
  })) return true;

  // 4. Check Vouchers
  const vouchers = loadJson<Voucher[]>(STORAGE_KEYS.VOUCHERS, []);
  if (vouchers.some(v => {
    const dbL = (v.debitLedger || '').trim().toLowerCase();
    const crL = (v.creditLedger || '').trim().toLowerCase();
    const lineUsed = (v.lines || []).some(r => (r.ledger || '').trim().toLowerCase() === target);
    return dbL === target || crL === target || lineUsed;
  })) return true;

  // 5. Check Payroll Employees
  const employees = loadJson<Employee[]>(STORAGE_KEYS.EMPLOYEES, []);
  if (employees.some(e => (e['Employee Name'] || '').trim().toLowerCase() === target)) return true;

  return false;
}

export function deleteLedger(name: string) {
  if (!name || !name.trim()) return { ok: false, error: 'Invalid ledger name.' };
  const target = name.trim();

  if (isLedgerInUse(target)) {
    return {
      ok: false,
      error: `Cannot delete ledger "${target}" because it has active transactions, vouchers, or a non-zero balance.`
    };
  }

  let list = sanitizeLedgers(loadJson<Ledger[]>(STORAGE_KEYS.LEDGERS, DEFAULT_LEDGERS));
  list = list.filter(x => (x['Ledger Name'] || '').trim().toLowerCase() !== target.toLowerCase());
  saveJson(STORAGE_KEYS.LEDGERS, list);

  // Record in deleted ledgers so it won't be re-created by DEFAULT_LEDGERS
  const deleted = loadJson<string[]>(STORAGE_KEYS.DELETED_LEDGERS, []);
  const normTarget = target.toLowerCase();
  if (!deleted.includes(normTarget)) {
    deleted.push(normTarget);
    saveJson(STORAGE_KEYS.DELETED_LEDGERS, deleted);
  }

  // Clean orphan ledger log entries for this deleted ledger
  const logs = loadJson<LedgerLogEntry[]>(STORAGE_KEYS.LEDGER_LOG, []);
  const cleanLogs = logs.filter(l => (l['Ledger Name'] || '').trim().toLowerCase() !== normTarget);
  if (cleanLogs.length !== logs.length) {
    saveJson(STORAGE_KEYS.LEDGER_LOG, cleanLogs);
  }

  deleteLedgerFromFirestore(target).catch(() => {});

  // Audit Trail Logging
  addAuditLog({
    action: 'DELETED',
    module: 'Ledger Master',
    recordId: target,
    details: `Deleted ledger: ${target}`
  });

  return { ok: true, ledgers: list };
}

function adjustLedgerBalance(ledgerName: string, amount: number, drCr: 'Dr' | 'Cr', refNo: string, narration: string, type: string, transactionId?: string) {
  if (!ledgerName || !ledgerName.trim()) return;
  const cleanName = ledgerName.trim();
  let ledgers = sanitizeLedgers(loadJson<Ledger[]>(STORAGE_KEYS.LEDGERS, DEFAULT_LEDGERS));
  let idx = ledgers.findIndex(l => (l['Ledger Name'] || '').toLowerCase() === cleanName.toLowerCase());

  if (idx === -1) {
    let defaultGroup = inferLedgerGroup(cleanName, drCr === 'Dr' ? 'Sundry Debtors' : 'Sundry Creditors');
    if (type === 'Sale' && drCr === 'Dr') defaultGroup = inferLedgerGroup(cleanName, 'Sundry Debtors');
    if (type === 'Purchase' && drCr === 'Cr') defaultGroup = inferLedgerGroup(cleanName, 'Sundry Creditors');
    const newLedger: Ledger = {
      'Ledger Name': cleanName,
      Group: defaultGroup,
      'Opening Balance': 0,
      'Balance Type (Dr/Cr)': drCr,
      'Current Balance': 0
    };
    ledgers.push(newLedger);
    idx = ledgers.length - 1;
  }

  if (idx > -1) {
    let current = Number(ledgers[idx]['Current Balance']) || 0;
    current += (drCr === 'Dr' ? amount : -amount);
    ledgers[idx]['Current Balance'] = current;
    saveJson(STORAGE_KEYS.LEDGERS, ledgers);
  }

  const logs = loadJson<LedgerLogEntry[]>(STORAGE_KEYS.LEDGER_LOG, []);
  logs.push({
    DateIso: new Date().toISOString(),
    'Ledger Name': ledgers[idx]['Ledger Name'],
    Type: type || '',
    Debit: drCr === 'Dr' ? amount : undefined,
    Credit: drCr === 'Cr' ? amount : undefined,
    'Ref No': refNo || '',
    Narration: narration || '',
    transactionId: transactionId || '',
    'Transaction ID': transactionId || ''
  });
  saveJson(STORAGE_KEYS.LEDGER_LOG, logs);
}

function logStock(
  itemCode: string,
  itemName: string,
  type: string,
  qtyIn: number,
  qtyOut: number,
  balanceQty: number,
  refNo: string,
  unitName?: string,
  branchId?: string,
  branchName?: string,
  godownId?: string,
  godownName?: string
) {
  qtyIn = getBaseQty(itemCode, unitName, qtyIn);
  qtyOut = getBaseQty(itemCode, unitName, qtyOut);
  const items = loadJson<Item[]>(STORAGE_KEYS.ITEMS, DEFAULT_ITEMS);
  const it = items.find(i => i['Item Code'] === itemCode);
  if (it && it['Maintain Stock'] === 'N') return; // Do not log stock movement for non-stock / service items

  let bId = branchId;
  let bName = branchName;
  if (!bId) {
    const actBr = getActiveBranch();
    bId = actBr.id;
    bName = actBr.name;
  }

  const logs = loadJson<StockLedgerEntry[]>(STORAGE_KEYS.STOCK_LEDGER, []);
  logs.push({
    DateIso: new Date().toISOString(),
    'Item Code': itemCode,
    'Item Name': itemName,
    Type: type,
    'Qty In': qtyIn || 0,
    'Qty Out': qtyOut || 0,
    Balance: balanceQty,
    'Ref No': refNo,
    branchId: bId,
    branchName: bName,
    godownId: godownId,
    godownName: godownName
  });
  saveJson(STORAGE_KEYS.STOCK_LEDGER, logs);
}


function getBaseQty(itemCode: string, unitName: string | undefined, rawQty: number): number {
  if (!unitName) return rawQty;
  const items = loadJson<Item[]>(STORAGE_KEYS.ITEMS, DEFAULT_ITEMS);
  const units = loadJson<Unit[]>(STORAGE_KEYS.UNITS, DEFAULT_UNITS);
  const item = items.find(i => i['Item Code'] === itemCode);
  if (!item) return rawQty;
  
  if (unitName === item.Unit) return rawQty;
  
  // Check if item has multi-unit mapping
  if (item.multiUnits && item.multiUnits.length > 0) {
    const mu = item.multiUnits.find(m => m.unit === unitName);
    if (mu) {
      return rawQty * (Number(mu.conversionFactor) || 1);
    }
  }

  // Fallback to global unit definitions
  const selectedUnit = units.find(u => u['Unit Name'] === unitName);
  if (selectedUnit && selectedUnit['Base Unit'] === item.Unit) {
    return rawQty * (Number(selectedUnit['Conversion Factor']) || 1);
  }
  const itemUnitDef = units.find(u => u['Unit Name'] === item.Unit);
  if (itemUnitDef && itemUnitDef['Base Unit'] === unitName) {
    const cf = Number(itemUnitDef['Conversion Factor']) || 1;
    return rawQty / cf;
  }
  return rawQty;
}

function updateItemStock(itemCode: string, qtyDelta: number, unitName?: string): number {
  qtyDelta = getBaseQty(itemCode, unitName, qtyDelta);
  const items = loadJson<Item[]>(STORAGE_KEYS.ITEMS, DEFAULT_ITEMS);
  const idx = items.findIndex(i => i['Item Code'] === itemCode);
  if (idx === -1) return 0;
  if (items[idx]['Maintain Stock'] === 'N') {
    return Number(items[idx]['Current Stock']) || 0;
  }
  const newQty = (Number(items[idx]['Current Stock']) || 0) + qtyDelta;
  items[idx]['Current Stock'] = newQty;
  saveJson(STORAGE_KEYS.ITEMS, items);
  syncItemToFirestore(items[idx]).catch(() => {});
  return newQty;
}

export function updateItemBatchStock(itemCode: string, batchNoOrId: string, qtyDelta: number, unitName?: string): void {
  qtyDelta = getBaseQty(itemCode, unitName, qtyDelta);
  const items = loadJson<Item[]>(STORAGE_KEYS.ITEMS, DEFAULT_ITEMS);
  const idx = items.findIndex(i => i['Item Code'] === itemCode);
  if (idx === -1) return;
  if (!items[idx].batches || items[idx].batches!.length === 0) return;
  const bIdx = items[idx].batches!.findIndex(b => b.id === batchNoOrId || b.batchNo === batchNoOrId);
  if (bIdx !== -1) {
    const curBStock = Number(items[idx].batches![bIdx].currentStock) || 0;
    items[idx].batches![bIdx].currentStock = curBStock + qtyDelta;
    saveJson(STORAGE_KEYS.ITEMS, items);
    syncItemToFirestore(items[idx]).catch(() => {});
  }
}

export function saveSalesInvoice(payload: {
  orderNo?: string;
  orderDate?: string;
  deliveryNoteNo?: string;
  cart: CartLine[];
  payment: PaymentDetails;
  customer: CustomerDetails;
  billDiscount?: number;
  billDiscountType?: 'flat' | 'percent';
  billDiscountValue?: number;
  additionalExpenses?: { ledger: string; amount: number }[];
  notes?: string;
  termsAndConditions?: string;
  invoiceNo?: string;
  originalInvoiceNo?: string;
  appliedBillSchemeName?: string;
  appliedBillSchemeId?: string;
  date?: string;
  isEdit?: boolean;
  voucherTypeId?: string;
  voucherTypeName?: string;
  isPOS?: boolean;
}) {
  const cfg = loadJson<Config>(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
  const itemsList = loadJson<Item[]>(STORAGE_KEYS.ITEMS, DEFAULT_ITEMS);
  const ledgersList = loadJson<Ledger[]>(STORAGE_KEYS.LEDGERS, DEFAULT_LEDGERS);
  const { cart, payment, customer, billDiscount = 0, billDiscountType = 'flat', billDiscountValue, additionalExpenses = [], termsAndConditions, orderNo, orderDate, deliveryNoteNo, voucherTypeId, voucherTypeName, invoiceNo, originalInvoiceNo, isPOS, notes, appliedBillSchemeName, appliedBillSchemeId } = payload;
  
  // Duplicate Serial Number Check (Must exist and not be sold)
  const serialStock = getSerialNumbersStockReport();
  const targetCheckNo = (originalInvoiceNo || invoiceNo || '').trim();
  for (const l of cart) {
    if (l.serials && l.serials.length > 0) {
      for (const s of l.serials) {
        const stockStatus = serialStock.find(stock => stock.serialNo.toLowerCase() === s.toLowerCase());
        if (!stockStatus) {
          return { ok: false, error: `Serial Number not found in stock: ${s}` };
        }
        if (stockStatus.status === 'Sold' && targetCheckNo && stockStatus.refNo.toLowerCase() !== targetCheckNo.toLowerCase()) {
          return { ok: false, error: `Serial Number already sold: ${s} (Sold in ${stockStatus.refNo})` };
        }
      }
    }
  }

  const isEditing = Boolean(payload.isEdit || originalInvoiceNo || invoiceNo);
  let originalDate: string | undefined;

  const refToMatch = (originalInvoiceNo || invoiceNo || '').trim().toLowerCase();
  if (refToMatch) {
    const existingSales = getDeduplicatedSales();
    const oldInv = existingSales.find(s => s.invoiceNo?.trim().toLowerCase() === refToMatch || (invoiceNo && s.invoiceNo?.trim().toLowerCase() === invoiceNo.trim().toLowerCase()));
    if (oldInv) {
      originalDate = oldInv.date;
      // 1. Revert previous stock deduction ONLY if the original sale had actually deducted stock (i.e. was NOT against a Delivery Note)
      const oldWasAgainstDN = Boolean(oldInv.deliveryNoteNo && oldInv.deliveryNoteNo.trim());
      if (!oldWasAgainstDN) {
        (oldInv.items || []).forEach((item: any) => {
          const qty = Number(item.Qty) || 0;
          if (qty !== 0) {
            updateItemStock(item['Item Code'], qty, item.Unit || item.unit);
          }
        });
      }
    }

    // 2. Remove old stock ledger entries for this invoice to prevent duplicate audit rows
    let stockLogs = loadJson<StockLedgerEntry[]>(STORAGE_KEYS.STOCK_LEDGER, []);
    stockLogs = stockLogs.filter(s => {
      const ref = s['Ref No']?.trim().toLowerCase();
      return ref !== refToMatch && (!invoiceNo || ref !== invoiceNo.trim().toLowerCase());
    });
    saveJson(STORAGE_KEYS.STOCK_LEDGER, stockLogs);

    // 3. Clean out previous ledger logs for this invoice so previous amounts don't double up
    let logs = loadJson<LedgerLogEntry[]>(STORAGE_KEYS.LEDGER_LOG, []);
    logs = logs.filter(l => {
      const ref = l['Ref No']?.trim().toLowerCase();
      return ref !== refToMatch && (!invoiceNo || ref !== invoiceNo.trim().toLowerCase());
    });
    saveJson(STORAGE_KEYS.LEDGER_LOG, logs);
  }

  // Check if customer or their ledger is GST Exempted
  const customerLedgerObj = ledgersList.find(l => l['Ledger Name'] === customer.ledger || l['Ledger Name'] === customer.name);
  const isCustomerGstExempted = Boolean(
    customer.isGSTExempted ||
    customer.gstType === 'Exempted' ||
    customerLedgerObj?.['GST Exempted'] === 'Y' ||
    customerLedgerObj?.['GST Type'] === 'Exempted'
  );

  let tax = 0, zro = 0, gst = 0, rawTot = 0;
  const itemsRows: SalesInvoice['items'] = [];

  cart.forEach(l => {
    const rawDisc = Number(l.discount) || 0;
    const isPercent = l.discountType === 'percent' || cfg.ItemDiscountType === 'percent';
    const lineDisc = isPercent ? ((Number(l.qty) || 0) * (Number(l.rate) || 0) * rawDisc / 100) : rawDisc;
    const gr = (Number(l.qty) || 0) * (Number(l.rate) || 0) - lineDisc;
    const isZ = isCustomerGstExempted || String(l.zeroRated).toUpperCase() === 'Y';
    const lGst = isZ ? 0 : round2(gr * (Number(l.gstPct) || 0) / 100);
    if (isZ) zro += gr; else tax += gr;
    gst += lGst;
    rawTot += (gr + lGst);
    const serialStr = (l.serials && l.serials.length) ? l.serials.join(', ') : '';
    const itemUnit = l.unit || itemsList.find(i => i['Item Code'] === l.itemCode)?.Unit || 'Pcs';
    itemsRows.push({
      'Item Code': l.itemCode,
      'Item Name': l.itemName,
      'Item Description': l.description || l.lineDescription || '',
      description: l.description || l.lineDescription || '',
      lineDescription: l.lineDescription || '',
      Unit: itemUnit,
      Qty: l.qty,
      Rate: l.rate,
      Discount: l.discount,
      discountType: l.discountType || (cfg.ItemDiscountType === 'percent' ? 'percent' : 'flat'),
      discountAmt: round2(lineDisc),
      originalRate: l.originalRate,
      appliedSchemeId: l.appliedSchemeId,
      appliedSchemeName: l.appliedSchemeName,
      'Taxable Value': round2(gr),
      'GST %': isZ ? 0 : l.gstPct,
      'GST Amount': lGst,
      'Zero Rated (Y/N)': isZ ? 'Y' : 'N',
      'Line Total': round2(gr + lGst),
      'Serial Numbers': serialStr,
      'Batch No': l.selectedBatchNo || '',
      'Expiry Date': l.selectedBatchExp || '',
      batchId: l.selectedBatchId || ''
    });
  });

  let expensesTotal = 0;
  additionalExpenses.forEach(exp => {
    expensesTotal += Number(exp.amount) || 0;
  });

  tax = round2(tax); zro = round2(zro); gst = round2(gst); rawTot = round2(rawTot + expensesTotal);
  const appliedDiscount = Math.min(rawTot, Math.max(0, round2(Number(billDiscount) || 0)));
  const finalTot = Math.max(0, round2(rawTot - appliedDiscount));

  // Determine series prefix and voucher number based on selected Voucher Type
  const allVTypes = getVoucherTypes();
  const matchedVt = voucherTypeId ? allVTypes.find(v => v.id === voucherTypeId) : null;
  const defaultPrefix = isPOS ? (cfg.POSInvoicePrefix || 'POS-') : (cfg.SalesInvoicePrefix || 'SAL-');
  const rawPrefix = matchedVt?.prefix || defaultPrefix;
  const isOnline = isSystemOnline();
  const invPrefix = getEffectiveVoucherPrefix(rawPrefix, isOnline);
  const counterKey = matchedVt 
    ? `Voucher_${matchedVt.id}` 
    : (isPOS ? 'POSInvoice' : 'SalesInvoice');

  let iNo = (originalInvoiceNo || invoiceNo)?.trim();
  if (!iNo) {
    const rawCount = nextCounter(counterKey);
    const startNum = Number(matchedVt?.startingNumber) || 1;
    const effNum = rawCount < startNum ? startNum : rawCount;
    iNo = formatVoucherNumber(invPrefix, effNum, matchedVt?.zeroPadding, matchedVt?.suffix);
  } else if (!isEditing && invPrefix && iNo.startsWith(invPrefix)) {
    const numPart = iNo.slice(invPrefix.length).replace(/[^\d]/g, '');
    const pVal = parseInt(numPart, 10);
    if (!isNaN(pVal)) {
      const counters = loadJson<Record<string, number>>(STORAGE_KEYS.COUNTERS, {});
      if ((counters[counterKey] || 0) < pVal) {
        counters[counterKey] = pVal;
        saveJson(STORAGE_KEYS.COUNTERS, counters);
      }
    }
  }

  let cash = Number(payment.cash) || 0, b1 = Number(payment.bank1) || 0, b2 = Number(payment.bank2) || 0;
  const sLg = customer.name?.trim() || customer.ledger?.trim() || 'Cash Customer';
  const sLgLower = sLg.toLowerCase();
  const isCashParty = ['cash', 'cash customer', 'walking cash sale', 'walking cash', 'walk-in', 'walk-in customer', 'cash sale', 'cash-in-hand'].includes(sLgLower) || customerLedgerObj?.Group === 'Cash-in-Hand';

  if (isCashParty && cash === 0 && b1 === 0 && b2 === 0) {
    cash = finalTot;
  }
  let cr = round2(finalTot - cash - b1 - b2);
  
  // If overpaid (meaning change was given to the customer), we should not log negative credit.
  // Instead, the net cash collected by the drawer is just the amount needed for the bill.
  if (cr < -0.009) {
    if (cash >= Math.abs(cr)) {
      cash = round2(cash + cr);
      cr = 0;
    } else {
      cr = 0; // Fallback for edge cases
    }
  }

  const st = cr > 0.009 ? ((cash + b1 + b2) > 0 ? 'Partial Credit' : 'Credit') : 'Paid';

  // Automatically compile predefined terms & conditions if none passed
  let finalTerms = termsAndConditions;
  if (finalTerms === undefined) {
    if (Array.isArray(cfg.PredefinedTermsList) && cfg.PredefinedTermsList.length > 0) {
      finalTerms = cfg.PredefinedTermsList
        .map((t: any) => (typeof t === 'string' ? t : (t.terms || t.title || '')))
        .filter(Boolean)
        .join('\n');
    } else {
      finalTerms = cfg.FooterTerms || '';
    }
  }

  const invoiceDate = payload.date 
    ? new Date(payload.date).toISOString() 
    : (originalDate || new Date().toISOString());

  const sales = getDeduplicatedSales();
  const matchTarget = (originalInvoiceNo || iNo || '').trim().toLowerCase();
  const existIdx = sales.findIndex(s => s.invoiceNo?.trim().toLowerCase() === matchTarget || s.invoiceNo?.trim().toLowerCase() === iNo.toLowerCase());
  const oldInv = existIdx >= 0 ? sales[existIdx] : null;

  const activeBr = getActiveBranch(cfg);
  const finalBranchId = (payload as any).branchId || oldInv?.branchId || activeBr.id;
  const finalBranchName = (payload as any).branchName || oldInv?.branchName || activeBr.name;

  const invoice: SalesInvoice = {
    invoiceNo: iNo,
    date: invoiceDate,
    customer: { ...customer, ledger: sLg, isGSTExempted: isCustomerGstExempted },
    subtotal: rawTot,
    discount: appliedDiscount,
    discountType: billDiscountType,
    discountValue: billDiscountValue !== undefined ? billDiscountValue : appliedDiscount,
    taxable: tax,
    zeroRated: zro,
    gstAmt: gst,
    total: finalTot,
    cash,
    bank1: b1,
    bank2: b2,
    credit: cr,
    status: st,
    branchId: finalBranchId,
    branchName: finalBranchName,
    additionalExpenses,
    termsAndConditions: finalTerms || (cfg.FooterTerms || ''),
    voucherTypeId: matchedVt?.id || voucherTypeId,
    voucherTypeName: matchedVt?.name || voucherTypeName,
    config: cfg,
    narration: notes,
    appliedBillSchemeName: appliedBillSchemeName || undefined,
    appliedBillSchemeId: appliedBillSchemeId || undefined,
    bankTxnNo: payment.bankTxnNo || '',
    bank2TxnNo: payment.bank2TxnNo || '',
    isPOS: isPOS,
    orderNo: payload.orderNo || '',
    orderDate: payload.orderDate || '',
    deliveryNoteNo: payload.deliveryNoteNo || '',
    items: itemsRows
  };

  if (existIdx >= 0) {
    sales[existIdx] = invoice;
  } else {
    sales.push(invoice);
  }
  saveJson(STORAGE_KEYS.SALES_INVOICES, sales);
  syncSalesInvoiceToFirestore(invoice).catch(() => {});

  if (originalInvoiceNo && originalInvoiceNo.trim().toLowerCase() !== iNo.trim().toLowerCase()) {
    deleteSalesInvoiceFromFirestore(originalInvoiceNo.trim()).catch(() => {});
  }

  // Audit Trail Logging
  if (existIdx >= 0 || isEditing) {
    const prevTotal = oldInv ? Number(oldInv.total) : undefined;
    const detailStr = prevTotal !== undefined && prevTotal !== finalTot
      ? `Updated total: Nu. ${prevTotal.toFixed(2)} → Nu. ${finalTot.toFixed(2)} (${itemsRows.length} items)`
      : `Updated invoice (${itemsRows.length} items)`;
    addAuditLog({
      action: 'ALTERED',
      module: isPOS ? 'POS Billing' : 'Sales Invoice',
      recordId: iNo,
      partyName: sLg,
      amount: finalTot,
      prevAmount: prevTotal,
      details: detailStr
    });
  } else {
    addAuditLog({
      action: 'ENTERED',
      module: isPOS ? 'POS Billing' : 'Sales Invoice',
      recordId: iNo,
      partyName: sLg,
      amount: finalTot,
      details: `Created invoice (${itemsRows.length} items, ${st})`
    });
  }

  // Stock logging & ledger balance
  // If invoice is generated against an existing Delivery Note (Challan), stock was already deducted during Delivery Note entry.
  const deliveryNotes = loadJson<DeliveryNote[]>(STORAGE_KEYS.DELIVERY_NOTES, []);
  const dnNo = (payload.deliveryNoteNo || '').trim();
  const isAgainstDeliveryNote = Boolean(
    dnNo ||
    deliveryNotes.some(dn => (dn.invoiceNo && dn.invoiceNo.trim().toLowerCase() === iNo.trim().toLowerCase()) || (dnNo && dn.noteNo?.trim().toLowerCase() === dnNo.toLowerCase()))
  );
  if (!isAgainstDeliveryNote) {
    cart.forEach(l => {
      const q = Number(l.qty);
      const nq = updateItemStock(l.itemCode, -q, l.unit);
      if (l.selectedBatchId || l.selectedBatchNo) {
        updateItemBatchStock(l.itemCode, l.selectedBatchId || l.selectedBatchNo, -q, l.unit);
      }
      if (q < 0) {
        logStock(l.itemCode, l.itemName, 'Sale Return', Math.abs(q), 0, nq, iNo, l.unit, finalBranchId, finalBranchName);
      } else {
        logStock(l.itemCode, l.itemName, 'Sale', 0, q, nq, iNo, l.unit, finalBranchId, finalBranchName);
      }
    });
  }

  if (dnNo) {
    updateDeliveryNoteStatus(dnNo, 'Invoiced', iNo);
  }

  additionalExpenses.forEach(exp => {
    if (exp.ledger && Number(exp.amount) > 0) {
      adjustLedgerBalance(exp.ledger, Number(exp.amount), 'Cr', iNo, 'Sales Additional Charge ' + iNo, 'Sale');
    }
  });

  if (cash > 0) adjustLedgerBalance('Cash', cash, 'Dr', iNo, 'Cash sale ' + iNo, 'Sale');
  if (b1 > 0) {
    const b1Narr = (payment.bank1Ledger || 'BOB Account') + ' sale ' + iNo + (payment.bankTxnNo ? ` (Txn/Ref: ${payment.bankTxnNo})` : '');
    adjustLedgerBalance(payment.bank1Ledger || 'BOB Account', b1, 'Dr', iNo, b1Narr, 'Sale', payment.bankTxnNo);
  }
  if (b2 > 0) {
    const b2Txn = payment.bank2TxnNo || payment.bankTxnNo;
    const b2Narr = (payment.bank2Ledger || 'BNBL Account') + ' sale ' + iNo + (b2Txn ? ` (Txn/Ref: ${b2Txn})` : '');
    adjustLedgerBalance(payment.bank2Ledger || 'BNBL Account', b2, 'Dr', iNo, b2Narr, 'Sale', b2Txn);
  }
  if (cr > 0.009) {
    adjustLedgerBalance(sLg, cr, 'Dr', iNo, 'Credit sale ' + iNo, 'Sale');
  }
  // Sales account adjusted by net sale (tax + zro minus lumpsum discount)
  const netSalesCredit = Math.max(0, round2((tax + zro) - appliedDiscount));
  adjustLedgerBalance('Sales Account', netSalesCredit, 'Cr', iNo, 'Sale ' + iNo, 'Sale');
  if (gst > 0) adjustLedgerBalance(cfg.EnableGSTInputTax === 'true' ? 'GST Output' : 'GST Payable', gst, 'Cr', iNo, 'GST ' + iNo, 'Sale');

  if (isEditing) {
    recalculateLedgerBalances();
  }

  const updatedItems = loadJson<Item[]>(STORAGE_KEYS.ITEMS, DEFAULT_ITEMS);
  const updatedLedgers = loadJson<Ledger[]>(STORAGE_KEYS.LEDGERS, DEFAULT_LEDGERS);

  return {
    ok: true,
    invoiceNo: iNo,
    date: invoice.date,
    subtotal: rawTot,
    discount: appliedDiscount,
    discountType: billDiscountType,
    taxable: tax,
    zeroRated: zro,
    gstAmt: gst,
    total: finalTot,
    cash,
    bank1: b1,
    bank2: b2,
    credit: cr,
    status: st,
    customer,
    config: cfg,
    invoice: invoice,
    bankTxnNo: payment.bankTxnNo || '',
    bank2TxnNo: payment.bank2TxnNo || '',
    items: itemsRows,
    updatedItems,
    updatedLedgers
  };
}

export function holdBill(customerName: string, cart: CartLine[], billDiscount?: number, billDiscountType?: 'flat' | 'percent') {
  const id = 'HOLD-' + new Date().getTime();
  const held = loadJson<HeldBill[]>(STORAGE_KEYS.HELD_BILLS, []);
  held.push({
    holdId: id,
    customerName: customerName || 'Walk-in',
    cart,
    heldTime: new Date().toISOString(),
    billDiscount: billDiscount || 0,
    billDiscountType: billDiscountType || 'flat'
  });
  saveJson(STORAGE_KEYS.HELD_BILLS, held);
  return { ok: true, holdId: id, heldBills: held };
}

export function resumeBill(id: string) {
  let held = loadJson<HeldBill[]>(STORAGE_KEYS.HELD_BILLS, []);
  const found = held.find(x => x.holdId === id);
  if (!found) return { ok: false, customerName: '', cart: [], billDiscount: 0, billDiscountType: 'flat' as const, heldBills: held };
  held = held.filter(x => x.holdId !== id);
  saveJson(STORAGE_KEYS.HELD_BILLS, held);
  return {
    ok: true,
    customerName: found.customerName,
    cart: found.cart,
    billDiscount: found.billDiscount || 0,
    billDiscountType: (found.billDiscountType || 'flat') as 'flat' | 'percent',
    heldBills: held
  };
}

export function deleteHeldBill(id: string) {
  let held = loadJson<HeldBill[]>(STORAGE_KEYS.HELD_BILLS, []);
  held = held.filter(x => x.holdId !== id);
  saveJson(STORAGE_KEYS.HELD_BILLS, held);
  return { ok: true, heldBills: held };
}

export function savePurchaseInvoice(payload: {
  cart: CartLine[];
  supplier: { name: string; gstNo?: string; tpnNo?: string; address?: string; phone?: string };
  payment: PaymentDetails;
  supplierBillNo?: string;
  receiptNoteNo?: string;
  poNo?: string;
  notes?: string;
  narration?: string;
  additionalExpenses?: { ledger: string; amount: number }[];
  billNo?: string;
  originalBillNo?: string;
  date?: string;
  isEdit?: boolean;
}) {
  const cfg = loadJson<Config>(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
  const itemsList = loadJson<Item[]>(STORAGE_KEYS.ITEMS, DEFAULT_ITEMS);
  const ledgersList = loadJson<Ledger[]>(STORAGE_KEYS.LEDGERS, DEFAULT_LEDGERS);

  const { cart, supplier, payment, additionalExpenses = [], originalBillNo, billNo } = payload;
  
  const purchasesCheck = getDeduplicatedPurchases();
  const currentTargetBill = (originalBillNo || billNo || '').trim();
  
  // Duplicate Supplier Bill Number Check
  if (payload.supplierBillNo && payload.supplierBillNo.trim()) {
    const dup = purchasesCheck.find(p => 
      p.supplierBillNo?.toLowerCase() === payload.supplierBillNo!.trim().toLowerCase() && 
      p.supplier.name === supplier.name &&
      p.billNo?.toLowerCase() !== currentTargetBill.toLowerCase()
    );
    if (dup && (dup.status as string) !== 'Cancelled') {
      return { ok: false, error: `Duplicate Supplier Bill Number: ${payload.supplierBillNo}` };
    }
  }

  // Duplicate Serial Number Check
  const serialStock = getSerialNumbersStockReport();
  for (const l of cart) {
    if (l.serials && l.serials.length > 0) {
      for (const s of l.serials) {
        const existing = serialStock.find(stock => stock.serialNo.toLowerCase() === s.toLowerCase() && currentTargetBill && stock.refNo.toLowerCase() !== currentTargetBill.toLowerCase());
        if (existing) {
          return { ok: false, error: `Duplicate Serial Number detected: ${s} (Already exists in ${existing.refNo})` };
        }
      }
    }
  }

  const isEditing = Boolean(payload.isEdit || originalBillNo || billNo);
  let originalDate: string | undefined;
  let oldPur: PurchaseInvoice | undefined;

  const refToMatch = (originalBillNo || billNo || '').trim().toLowerCase();
  if (refToMatch) {
    const existingPurchases = getDeduplicatedPurchases();
    oldPur = existingPurchases.find(p => p.billNo?.trim().toLowerCase() === refToMatch || (billNo && p.billNo?.trim().toLowerCase() === billNo.trim().toLowerCase()));
    if (oldPur) {
      originalDate = oldPur.date;
      // 1. Revert previous stock addition from original purchase
      (oldPur.items || []).forEach((item: any) => {
        const qty = Number(item.Qty) || 0;
        if (qty > 0) {
          updateItemStock(item['Item Code'], -qty, item.Unit || item.unit);
        }
      });
    }

    // 2. Remove old stock ledger entries for this bill to prevent duplicate audit rows
    let stockLogs = loadJson<StockLedgerEntry[]>(STORAGE_KEYS.STOCK_LEDGER, []);
    stockLogs = stockLogs.filter(s => {
      const ref = s['Ref No']?.trim().toLowerCase();
      return ref !== refToMatch && (!billNo || ref !== billNo.trim().toLowerCase());
    });
    saveJson(STORAGE_KEYS.STOCK_LEDGER, stockLogs);

    // 3. Clean out previous ledger logs for this bill so previous amounts don't double up
    let logs = loadJson<LedgerLogEntry[]>(STORAGE_KEYS.LEDGER_LOG, []);
    logs = logs.filter(l => {
      const ref = l['Ref No']?.trim().toLowerCase();
      return ref !== refToMatch && (!billNo || ref !== billNo.trim().toLowerCase());
    });
    saveJson(STORAGE_KEYS.LEDGER_LOG, logs);
  }
  
  const supplierLedgerObj = ledgersList.find(l => l['Ledger Name'] === supplier.name);
  const isSupplierGstExempted = Boolean(
    supplierLedgerObj?.['GST Exempted'] === 'Y' ||
    supplierLedgerObj?.['GST Type'] === 'Exempted'
  );

  let tax = 0, zro = 0, gst = 0, tot = 0;
  const itemsRows: PurchaseInvoice['items'] = [];

  cart.forEach(l => {
    const gr = (Number(l.qty) || 0) * (Number(l.rate) || 0) - (Number(l.discount) || 0);
    const isZ = isSupplierGstExempted || String(l.zeroRated).toUpperCase() === 'Y';
    
    let lGst = isZ ? 0 : round2(gr * (Number(l.gstPct) || 0) / 100);
    if (!isZ && typeof l.gstAmt !== 'undefined') {
      lGst = Number(l.gstAmt) || 0;
    }

    if (isZ) zro += gr; else tax += gr;
    gst += lGst;
    tot += (gr + lGst);

    const serialStr = (l.serials && l.serials.length) ? l.serials.join(', ') : '';
    const itemUnit = l.unit || itemsList.find(i => i['Item Code'] === l.itemCode)?.Unit || 'Pcs';

    itemsRows.push({
      'Item Code': l.itemCode,
      'Item Name': l.itemName,
      Unit: itemUnit,
      Qty: l.qty,
      Rate: l.rate,
      Discount: l.discount,
      'Taxable Value': round2(gr),
      'GST %': l.gstPct,
      'GST Amount': lGst,
      'Zero Rated (Y/N)': isZ ? 'Y' : 'N',
      'Line Total': round2(gr + lGst),
      'Serial Numbers': serialStr,
      selectedSize: l.selectedSize,
      selectedColor: l.selectedColor,
      Size: l.selectedSize,
      Color: l.selectedColor
    });
  });
  
  let expensesTotal = 0;
  additionalExpenses.forEach(exp => {
    expensesTotal += Number(exp.amount) || 0;
  });
  tot += expensesTotal;

  tax = round2(tax); zro = round2(zro); gst = round2(gst); tot = round2(tot);
  expensesTotal = round2(expensesTotal);

  const bNo = (originalBillNo || billNo)?.trim() || ('PUR-' + nextCounter('PurchaseInvoice'));

  let cash = Number(payment.cash) || 0, b1 = Number(payment.bank1) || 0, b2 = Number(payment.bank2) || 0;
  const sLg = supplier.name?.trim() || 'Cash Supplier';
  const sLgLower = sLg.toLowerCase();
  const isCashParty = ['cash', 'cash supplier', 'cash purchase', 'walk-in', 'cash-in-hand'].includes(sLgLower) || supplierLedgerObj?.Group === 'Cash-in-Hand';

  if (isCashParty && cash === 0 && b1 === 0 && b2 === 0) {
    cash = tot;
  }
  const cr = round2(tot - cash - b1 - b2);
  const st = cr > 0.009 ? ((cash + b1 + b2) > 0 ? 'Partial Credit' : 'Credit') : 'Paid';

  const purchaseDate = payload.date
    ? new Date(payload.date).toISOString()
    : (originalDate || new Date().toISOString());

  const activeBr = getActiveBranch(cfg);
  const finalBranchId = (payload as any).branchId || (oldPur as any)?.branchId || activeBr.id;
  const finalBranchName = (payload as any).branchName || (oldPur as any)?.branchName || activeBr.name;

  const purchase: PurchaseInvoice = {
    billNo: bNo,
    supplierBillNo: payload.supplierBillNo || '',
    receiptNoteNo: payload.receiptNoteNo || '',
    poNo: payload.poNo || '',
    date: purchaseDate,
    supplier,
    taxable: tax,
    zeroRated: zro,
    gstAmt: gst,
    total: tot,
    cash,
    bank1: b1,
    bank2: b2,
    credit: cr,
    status: st,
    branchId: finalBranchId,
    branchName: finalBranchName,
    bankTxnNo: payment.bankTxnNo || '',
    bank2TxnNo: payment.bank2TxnNo || '',
    items: itemsRows,
    additionalExpenses
  };

  const purchases = getDeduplicatedPurchases();
  const matchTarget = (originalBillNo || bNo || '').trim().toLowerCase();
  const existIdx = purchases.findIndex(p => p.billNo?.trim().toLowerCase() === matchTarget || p.billNo?.trim().toLowerCase() === bNo.toLowerCase());
  if (existIdx >= 0) {
    purchases[existIdx] = purchase;
  } else {
    purchases.push(purchase);
  }
  saveJson(STORAGE_KEYS.PURCHASE_INVOICES, purchases);
  syncPurchaseInvoiceToFirestore(purchase).catch(() => {});

  if (originalBillNo && originalBillNo.trim().toLowerCase() !== bNo.trim().toLowerCase()) {
    deletePurchaseInvoiceFromFirestore(originalBillNo.trim()).catch(() => {});
  }

  // Audit Trail Logging
  if (existIdx >= 0 || isEditing) {
    const prevTotal = oldPur ? Number(oldPur.total) : undefined;
    const detailStr = prevTotal !== undefined && prevTotal !== tot
      ? `Updated total: Nu. ${prevTotal.toFixed(2)} → Nu. ${tot.toFixed(2)} (${itemsRows.length} items)`
      : `Updated purchase bill (${itemsRows.length} items)`;
    addAuditLog({
      action: 'ALTERED',
      module: 'Purchase Bill',
      recordId: bNo,
      partyName: sLg,
      amount: tot,
      prevAmount: prevTotal,
      details: detailStr
    });
  } else {
    addAuditLog({
      action: 'ENTERED',
      module: 'Purchase Bill',
      recordId: bNo,
      partyName: sLg,
      amount: tot,
      details: `Created purchase bill (${itemsRows.length} items, ${st})`
    });
  }

  // Stock logging & ledger balance
  // If purchase invoice is generated against an existing Receipt Note (GRN), stock was already added into inventory during Receipt Note entry.
  const isAgainstReceiptNote = Boolean(payload.receiptNoteNo && payload.receiptNoteNo.trim());
  if (!isAgainstReceiptNote) {
    cart.forEach(l => {
      const nq = updateItemStock(l.itemCode, Number(l.qty), l.unit);
      if (l.selectedBatchId || l.selectedBatchNo) {
        updateItemBatchStock(l.itemCode, l.selectedBatchId || l.selectedBatchNo, Number(l.qty), l.unit);
      }
      logStock(l.itemCode, l.itemName, 'Purchase', Number(l.qty), 0, nq, bNo, l.unit, finalBranchId, finalBranchName);
    });
  }

  if (cash > 0) adjustLedgerBalance('Cash', cash, 'Cr', bNo, 'Cash purchase ' + bNo, 'Purchase');
  if (b1 > 0) {
    const b1Narr = (payment.bank1Ledger || 'BOB Account') + ' purchase ' + bNo + (payment.bankTxnNo ? ` (Txn/Ref: ${payment.bankTxnNo})` : '');
    adjustLedgerBalance(payment.bank1Ledger || 'BOB Account', b1, 'Cr', bNo, b1Narr, 'Purchase', payment.bankTxnNo);
  }
  if (b2 > 0) {
    const b2Txn = payment.bank2TxnNo || payment.bankTxnNo;
    const b2Narr = (payment.bank2Ledger || 'BNBL Account') + ' purchase ' + bNo + (b2Txn ? ` (Txn/Ref: ${b2Txn})` : '');
    adjustLedgerBalance(payment.bank2Ledger || 'BNBL Account', b2, 'Cr', bNo, b2Narr, 'Purchase', b2Txn);
  }
  
  if (cr > 0.009 && supplier.name) adjustLedgerBalance(supplier.name, cr, 'Cr', bNo, 'Credit purchase ' + bNo, 'Purchase');
  
  adjustLedgerBalance('Purchase Account', tax + zro, 'Dr', bNo, 'Purchase ' + bNo, 'Purchase');
  if (gst > 0) adjustLedgerBalance(cfg.EnableGSTInputTax === 'true' ? 'GST Input' : 'GST Payable', gst, 'Dr', bNo, 'GST ' + bNo, 'Purchase');

  // Adjust expense ledgers
  additionalExpenses.forEach(exp => {
    if (exp.ledger && Number(exp.amount) > 0) {
      adjustLedgerBalance(exp.ledger, Number(exp.amount), 'Dr', bNo, 'Purchase Expense ' + bNo, 'Purchase');
    }
  });

  if (isEditing) {
    recalculateLedgerBalances();
  }

  const updatedItems = loadJson<Item[]>(STORAGE_KEYS.ITEMS, DEFAULT_ITEMS);
  const updatedLedgers = loadJson<Ledger[]>(STORAGE_KEYS.LEDGERS, DEFAULT_LEDGERS);
  
  return { ok: true, billNo: bNo, updatedItems, updatedLedgers };
}

export function getVouchers(customCompanyId?: string): Voucher[] {
  const cId = customCompanyId || getActiveCompanyId();
  const list = loadJson<Voucher[]>(STORAGE_KEYS.VOUCHERS, [], cId);
  // Deduplicate vouchers by voucherNo preserving the most recent record
  const map = new Map<string, Voucher>();
  list.forEach((v, idx) => {
    const key = v.voucherNo || `v-${idx}`;
    map.set(key, v);
  });
  const deduped = Array.from(map.values());
  return deduped.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function getVoucherPrefix(type: 'P' | 'R' | 'J' | 'C' | 'S' | 'PUR' | 'CN' | 'DN' | 'DEL_NOTE' | 'PHYSICAL_STOCK' | 'QUOTATION' | 'SALES_ORDER' | 'PURCHASE_ORDER' | 'RECEIPT_NOTE', cfg?: Config): string {
  const config = cfg || loadJson<Config>(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
  if (type === 'P') return config.PaymentVoucherPrefix !== undefined && config.PaymentVoucherPrefix !== '' ? config.PaymentVoucherPrefix : 'PMT-';
  if (type === 'R') return config.ReceiptVoucherPrefix !== undefined && config.ReceiptVoucherPrefix !== '' ? config.ReceiptVoucherPrefix : 'RCT-';
  if (type === 'J') return config.JournalVoucherPrefix !== undefined && config.JournalVoucherPrefix !== '' ? config.JournalVoucherPrefix : 'JRN-';
  if (type === 'C') return config.ContraVoucherPrefix !== undefined && config.ContraVoucherPrefix !== '' ? config.ContraVoucherPrefix : 'CTR-';
  if (type === 'CN') return config.CreditNotePrefix !== undefined && config.CreditNotePrefix !== '' ? config.CreditNotePrefix : 'CN-';
  if (type === 'DN') return config.DebitNotePrefix !== undefined && config.DebitNotePrefix !== '' ? config.DebitNotePrefix : 'DN-';
  if (type === 'DEL_NOTE') return config.DeliveryNotePrefix !== undefined && config.DeliveryNotePrefix !== '' ? config.DeliveryNotePrefix : 'DLV-';
  if (type === 'PHYSICAL_STOCK') return config.PhysicalStockPrefix !== undefined && config.PhysicalStockPrefix !== '' ? config.PhysicalStockPrefix : 'PHY-';
  if (type === 'QUOTATION') return config.QuotationPrefix !== undefined && config.QuotationPrefix !== '' ? config.QuotationPrefix : 'QTN-';
  if (type === 'SALES_ORDER') return config.SalesOrderPrefix !== undefined && config.SalesOrderPrefix !== '' ? config.SalesOrderPrefix : 'SO-';
  if (type === 'PURCHASE_ORDER') return config.PurchaseOrderPrefix !== undefined && config.PurchaseOrderPrefix !== '' ? config.PurchaseOrderPrefix : 'PO-';
  if (type === 'RECEIPT_NOTE') return config.ReceiptNotePrefix !== undefined && config.ReceiptNotePrefix !== '' ? config.ReceiptNotePrefix : 'GRN-';
  if (type === 'S') return config.SalesInvoicePrefix !== undefined && config.SalesInvoicePrefix !== '' ? config.SalesInvoicePrefix : 'SAL-';
  if (type === 'PUR') return config.PurchaseInvoicePrefix !== undefined && config.PurchaseInvoicePrefix !== '' ? config.PurchaseInvoicePrefix : 'PUR-';
  return 'VOU-';
}

export function peekNextVoucherNo(type: 'P' | 'R' | 'J' | 'C' | 'S' | 'PUR' | 'CN' | 'DN' | 'DEL_NOTE' | 'PHYSICAL_STOCK' | 'QUOTATION' | 'SALES_ORDER' | 'PURCHASE_ORDER' | 'RECEIPT_NOTE', cfg?: Config): string {
  if (type === 'S') {
    return peekNextInvoiceNumber(false);
  }
  const px = getVoucherPrefix(type, cfg);
  const counters = loadJson<Record<string, number>>(STORAGE_KEYS.COUNTERS, {
    InternalBarcode: 5,
    SalesInvoice: 32,
    PurchaseInvoice: 12,
    PaymentVoucher: 1,
    ReceiptVoucher: 1,
    JournalVoucher: 1,
    ContraVoucher: 1,
    CreditNote: 1,
    DebitNote: 1,
    DeliveryNote: 1,
    PhysicalStock: 1,
    Quotation: 1,
    SalesOrder: 1,
    PurchaseOrder: 1,
    ReceiptNote: 1,
    Voucher: 0
  });
  const counterKey = type === 'CN' ? 'CreditNote' :
    type === 'DN' ? 'DebitNote' :
    type === 'DEL_NOTE' ? 'DeliveryNote' :
    type === 'PHYSICAL_STOCK' ? 'PhysicalStock' :
    type === 'QUOTATION' ? 'Quotation' :
    type === 'SALES_ORDER' ? 'SalesOrder' :
    type === 'PURCHASE_ORDER' ? 'PurchaseOrder' :
    type === 'RECEIPT_NOTE' ? 'ReceiptNote' : 'Voucher';
  const val = (counters[counterKey] || counters['Voucher'] || 0) + 1;
  return `${px}${val}`;
}

export function peekNextInvoiceNumber(isPOS: boolean = false, voucherTypeId?: string, forceOnline?: boolean): string {
  const cfg = loadJson<Config>(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
  const allVTypes = getVoucherTypes();
  const matchedVt = voucherTypeId ? allVTypes.find(v => v.id === voucherTypeId) : null;
  const defaultPrefix = isPOS ? (cfg.POSInvoicePrefix || 'POS-') : (cfg.SalesInvoicePrefix || 'SAL-');
  const rawPrefix = matchedVt?.prefix !== undefined ? matchedVt.prefix : defaultPrefix;
  const isOnline = forceOnline !== undefined ? forceOnline : isSystemOnline();
  const invPrefix = getEffectiveVoucherPrefix(rawPrefix, isOnline);
  const counterKey = matchedVt 
    ? `Voucher_${matchedVt.id}` 
    : (isPOS ? 'POSInvoice' : 'SalesInvoice');

  const counters = loadJson<Record<string, number>>(STORAGE_KEYS.COUNTERS, {
    InternalBarcode: 5,
    SalesInvoice: 32,
    POSInvoice: 0,
    PurchaseInvoice: 12
  });

  let currentCount = counters[counterKey] || counters[isPOS ? 'POSInvoice' : 'SalesInvoice'] || 0;

  // Scan existing sales invoices to prevent backward collision
  const sales = loadJson<SalesInvoice[]>(STORAGE_KEYS.SALES_INVOICES, []);
  sales.forEach(s => {
    const no = (s.invoiceNo || (s as any).billNo || '').trim();
    if (invPrefix && no.startsWith(invPrefix)) {
      const remainder = no.slice(invPrefix.length);
      const match = remainder.match(/^(\d+)/);
      if (match) {
        const val = parseInt(match[1], 10);
        if (!isNaN(val) && val > currentCount) {
          currentCount = val;
        }
      }
    }
  });

  const startNum = Number(matchedVt?.startingNumber) || 1;
  const nextNum = Math.max(startNum, currentCount + 1);
  return formatVoucherNumber(invPrefix, nextNum, matchedVt?.zeroPadding, matchedVt?.suffix);
}

export function saveMultiLineVoucher(payload: {
  type: 'P' | 'R' | 'J' | 'C' | 'S' | 'PUR';
  voucherNo?: string;
  originalVoucherNo?: string;
  isEdit?: boolean;
  date?: string;
  narration?: string;
  transactionId?: string;
  bankTxnNo?: string;
  chequeNo?: string;
  billNo?: string;
  billAllocations?: BillAllocation[];
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
  lines: Array<{
    type: 'Dr' | 'Cr';
    ledger: string;
    amount: number;
    narration?: string;
    transactionId?: string;
  }>;
}) {
  const cfg = loadJson<Config>(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
  const px = getVoucherPrefix(payload.type, cfg);
  let no = (payload.originalVoucherNo || payload.voucherNo)?.trim();
  if (!no) {
    no = px + nextCounter('Voucher');
  } else if (!payload.isEdit && !payload.originalVoucherNo) {
    // Check if the custom voucher number ends in a number and advance the counter if higher
    const match = no.match(/\d+$/);
    if (match) {
      const num = parseInt(match[0], 10);
      const counters = loadJson<Record<string, number>>(STORAGE_KEYS.COUNTERS, {});
      if (num > (counters['Voucher'] || 0)) {
        counters['Voucher'] = num;
        saveJson(STORAGE_KEYS.COUNTERS, counters);
      }
    }
  }

  const dateIso = payload.date || new Date().toISOString();
  const overallNarration = payload.narration || '';
  const txnId = payload.transactionId || payload.bankTxnNo || payload.chequeNo || '';

  // Calculate total debit
  const totalDebit = payload.lines
    .filter(l => l.type === 'Dr')
    .reduce((sum, l) => sum + (Number(l.amount) || 0), 0);

  const mainDr = payload.lines.find(l => l.type === 'Dr')?.ledger || '';
  const mainCr = payload.lines.find(l => l.type === 'Cr')?.ledger || '';

  const vouchers = loadJson<Voucher[]>(STORAGE_KEYS.VOUCHERS, []);
  
  // If editing, use the new voucherNo if provided, otherwise fallback to original
  const finalNo = payload.voucherNo?.trim() || no;

  const newVoucher: Voucher = {
    voucherNo: finalNo,
    date: dateIso,
    type: payload.type,
    gstInputType: payload.gstInputType,
    supplierName: payload.supplierName,
    supplierGstNo: payload.supplierGstNo,
    supplierCountry: payload.supplierCountry,
    invoiceNo: payload.invoiceNo,
    invoiceDate: payload.invoiceDate,
    referenceNo: payload.referenceNo,
    declarationNo: payload.declarationNo,
    declarationDate: payload.declarationDate,
    taxableAmount: payload.taxableAmount,
    exemptedAmount: payload.exemptedAmount,
    gstAmount: payload.gstAmount,
    totalImportAmount: payload.totalImportAmount,
    debitLedger: mainDr,
    creditLedger: mainCr,
    amount: round2(totalDebit),
    narration: overallNarration,
    transactionId: txnId,
    bankTxnNo: payload.bankTxnNo || txnId,
    chequeNo: payload.chequeNo || '',
    billNo: payload.billNo,
    billAllocations: payload.billAllocations,
    lines: payload.lines.map(l => ({
      type: l.type,
      ledger: l.ledger,
      amount: round2(Number(l.amount) || 0),
      narration: l.narration || '',
      transactionId: l.transactionId || txnId
    }))
  };

  const existIdx = vouchers.findIndex(v => v.voucherNo?.trim().toLowerCase() === no.trim().toLowerCase() || v.voucherNo?.trim().toLowerCase() === finalNo.trim().toLowerCase());
  if (existIdx >= 0) {
    vouchers[existIdx] = newVoucher;
    // Clear out earlier ledger log rows for this voucher to prevent duplicate ledger balance postings
    let logs = loadJson<LedgerLogEntry[]>(STORAGE_KEYS.LEDGER_LOG, []);
    logs = logs.filter(l => l['Ref No']?.trim().toLowerCase() !== no.trim().toLowerCase() && l['Ref No']?.trim().toLowerCase() !== finalNo.trim().toLowerCase());
    saveJson(STORAGE_KEYS.LEDGER_LOG, logs);
  } else {
    vouchers.push(newVoucher);
  }
  saveJson(STORAGE_KEYS.VOUCHERS, vouchers);
  syncVoucherToFirestore(newVoucher).catch(() => {});

  if (payload.originalVoucherNo && payload.originalVoucherNo.trim().toLowerCase() !== finalNo.trim().toLowerCase()) {
    deleteVoucherFromFirestore(payload.originalVoucherNo.trim()).catch(() => {});
  }

  // Post to accounting ledger for each Dr/Cr line
  payload.lines.forEach(line => {
    if (line.ledger && Number(line.amount) > 0) {
      const lineTxn = line.transactionId || txnId;
      const txnSuffix = lineTxn ? ` (Txn/Ref: ${lineTxn})` : '';
      const lineNarr = line.narration ? `${overallNarration} (${line.narration})${txnSuffix}` : `${overallNarration}${txnSuffix}`;
      adjustLedgerBalance(line.ledger, Number(line.amount), line.type, finalNo, lineNarr.trim(), payload.type, lineTxn);
    }
  });

  if (existIdx >= 0) {
    recalculateLedgerBalances();
  }

  const updatedLedgers = loadJson<Ledger[]>(STORAGE_KEYS.LEDGERS, DEFAULT_LEDGERS);
  return { ok: true, voucherNo: finalNo, ledgers: updatedLedgers };
}


export function autoCleanTrash() {
  const trash = loadJson<TrashEntry[]>(STORAGE_KEYS.TRASH_LOG, []);
  const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
  const filtered = trash.filter(item => {
    const t = new Date(item.deletedAt).getTime();
    return t >= oneDayAgo;
  });
  if (filtered.length !== trash.length) {
    saveJson(STORAGE_KEYS.TRASH_LOG, filtered);
  }
}

export function getTrashLog(): TrashEntry[] {
  autoCleanTrash();
  return loadJson<TrashEntry[]>(STORAGE_KEYS.TRASH_LOG, []);
}

export function addToTrash(entry: Omit<TrashEntry, 'id' | 'deletedAt'>) {
  const trash = loadJson<TrashEntry[]>(STORAGE_KEYS.TRASH_LOG, []);
  const newEntry: TrashEntry = {
    ...entry,
    id: 'trash_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    deletedAt: new Date().toISOString()
  };
  trash.unshift(newEntry);
  saveJson(STORAGE_KEYS.TRASH_LOG, trash);
  return newEntry;
}

export function emptyTrash() {
  saveJson(STORAGE_KEYS.TRASH_LOG, []);
  return { ok: true, message: 'Trash emptied successfully' };
}

export function restoreFromTrash(id: string) {
  const trash = loadJson<TrashEntry[]>(STORAGE_KEYS.TRASH_LOG, []);
  const item = trash.find(t => t.id === id);
  if (!item) return { ok: false, error: 'Trash item not found' };

  if (item.originalData) {
    const data = item.originalData;
    const type = (item.type || '').toUpperCase();

    if (type === 'SALE' || type.includes('SAL') || type.includes('POS')) {
      const sales = loadJson<SalesInvoice[]>(STORAGE_KEYS.SALES_INVOICES, []);
      const idx = sales.findIndex(s => s.invoiceNo === data.invoiceNo);
      if (idx >= 0) {
        sales[idx] = data;
      } else {
        sales.push(data);
      }
      saveJson(STORAGE_KEYS.SALES_INVOICES, sales);
    } else if (type === 'PURCHASE' || type.includes('PUR')) {
      const purchases = loadJson<PurchaseInvoice[]>(STORAGE_KEYS.PURCHASE_INVOICES, []);
      const ref = data.billNo || data.invoiceNo || item.refNo;
      const idx = purchases.findIndex(p => (p.billNo === ref || p.invoiceNo === ref));
      if (idx >= 0) {
        purchases[idx] = data;
      } else {
        purchases.push(data);
      }
      saveJson(STORAGE_KEYS.PURCHASE_INVOICES, purchases);
    } else {
      const vouchers = loadJson<Voucher[]>(STORAGE_KEYS.VOUCHERS, []);
      const ref = data.voucherNo || item.refNo;
      const idx = vouchers.findIndex(v => v.voucherNo === ref);
      if (idx >= 0) {
        vouchers[idx] = data;
      } else {
        vouchers.push(data);
      }
      saveJson(STORAGE_KEYS.VOUCHERS, vouchers);
    }
  }

  const updatedTrash = trash.filter(t => t.id !== id);
  saveJson(STORAGE_KEYS.TRASH_LOG, updatedTrash);

  recalculateLedgerBalances();
  return { ok: true, message: `Restored ${item.refNo} successfully` };
}

export function restoreAllFromTrash() {
  const trash = loadJson<TrashEntry[]>(STORAGE_KEYS.TRASH_LOG, []);
  let count = 0;
  trash.forEach(item => {
    if (item.id) {
      restoreFromTrash(item.id);
      count++;
    }
  });
  return { ok: true, message: `Restored ${count} items from trash` };
}

export function recalculateLedgerBalances() {
  const cfg = loadJson<Config>(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
  const ledgers = sanitizeLedgers(loadJson<Ledger[]>(STORAGE_KEYS.LEDGERS, DEFAULT_LEDGERS));
  const logs = loadJson<LedgerLogEntry[]>(STORAGE_KEYS.LEDGER_LOG, []);
  
  const sales = loadJson<SalesInvoice[]>(STORAGE_KEYS.SALES_INVOICES, []);
  const purchases = loadJson<PurchaseInvoice[]>(STORAGE_KEYS.PURCHASE_INVOICES, []);
  const vouchers = loadJson<Voucher[]>(STORAGE_KEYS.VOUCHERS, []);

  const cancelledSales = new Set<string>();
  sales.filter(s => (s.status as string) === 'Cancelled').forEach(s => cancelledSales.add(s.invoiceNo));
  
  const cancelledPurchases = new Set<string>();
  purchases.filter(p => (p.status as string) === 'Cancelled').forEach(p => {
    if (p.billNo) cancelledPurchases.add(p.billNo);
    if (p.invoiceNo) cancelledPurchases.add(p.invoiceNo);
  });
  
  const cancelledVouchers = new Set<string>();
  vouchers.filter(v => (v.status as string) === 'Cancelled').forEach(v => cancelledVouchers.add(v.voucherNo));

  // Build lookup of active document numbers to purge orphaned phantom logs
  const activeVoucherNos = new Set(vouchers.map(v => (v.voucherNo || '').trim()).filter(Boolean));
  const activeSaleNos = new Set(sales.map(s => (s.invoiceNo || '').trim()).filter(Boolean));
  const activePurchNos = new Set<string>();
  purchases.forEach(p => {
    if (p.billNo) activePurchNos.add(p.billNo.trim());
    if (p.invoiceNo) activePurchNos.add(p.invoiceNo.trim());
  });

  const cleanLogs = logs.filter(l => {
    const ref = (l['Ref No'] || '').trim();
    const type = l.Type || '';
    if (!ref) return true;
    
    // Check based on transaction type to prevent cross-document wiping
    if (type === 'Sale' || type === 'Sales Return') {
      if (cancelledSales.has(ref)) return false;
      if (ref.startsWith('REV-') && cancelledSales.has(ref.substring(4))) return false;
      if (ref.startsWith('DEL-') && cancelledSales.has(ref.substring(4))) return false;
      // If sale no longer exists at all, drop orphaned phantom log
      if (!activeSaleNos.has(ref) && !ref.startsWith('REV-') && !ref.startsWith('DEL-')) return false;
    } else if (type === 'Purchase' || type === 'Purchase Return') {
      if (cancelledPurchases.has(ref)) return false;
      if (ref.startsWith('REV-') && cancelledPurchases.has(ref.substring(4))) return false;
      if (ref.startsWith('DEL-') && cancelledPurchases.has(ref.substring(4))) return false;
      // If purchase no longer exists at all, drop orphaned phantom log
      if (!activePurchNos.has(ref) && !ref.startsWith('REV-') && !ref.startsWith('DEL-')) return false;
    } else {
      // Vouchers or other types
      if (cancelledVouchers.has(ref)) return false;
      if (ref.startsWith('REV-') && cancelledVouchers.has(ref.substring(4))) return false;
      if (ref.startsWith('DEL-') && cancelledVouchers.has(ref.substring(4))) return false;
      // If voucher no longer exists at all, drop orphaned phantom log!
      if (!activeVoucherNos.has(ref) && !ref.startsWith('REV-') && !ref.startsWith('DEL-') && !ref.startsWith('PR-') && !ref.startsWith('ADV-')) return false;
    }
    
    return true;
  });

  saveJson(STORAGE_KEYS.LEDGER_LOG, cleanLogs);

  // --- HEAL MISSING LOGS (from earlier cancellation bugs or missing syncs) ---
  const existingSaleRefs = new Set(cleanLogs.filter(l => l.Type === 'Sale').map(l => l['Ref No']));
  sales.forEach(s => {
    if (s.status === 'Cancelled') return;
    const iNo = s.invoiceNo || '';
    if (!iNo || existingSaleRefs.has(iNo)) return;
    
    // It's missing! Restore it
    const cash = Number(s.cash) || 0, b1 = Number(s.bank1) || 0, b2 = Number(s.bank2) || 0;
    const cr = Number(s.credit) || 0;
    const tax = Number(s.taxable) || 0, zro = Number(s.zeroRated) || 0, gst = Number(s.gstAmt) || 0;
    const appliedDiscount = Number(s.discount) || 0;
    const sLg = typeof s.customer === 'object' ? (s.customer.name?.trim() || s.customer.ledger?.trim() || 'Cash Customer') : (s.customer || 'Cash Customer');

    if (cash > 0) adjustLedgerBalance('Cash', cash, 'Dr', iNo, 'Cash sale ' + iNo, 'Sale');
    if (b1 > 0) adjustLedgerBalance(s.paymentDetails?.bank1Ledger || 'BOB Account', b1, 'Dr', iNo, 'Bank sale ' + iNo, 'Sale');
    if (b2 > 0) adjustLedgerBalance(s.paymentDetails?.bank2Ledger || 'BNBL Account', b2, 'Dr', iNo, 'Bank sale ' + iNo, 'Sale');
    if (cr > 0.009) adjustLedgerBalance(sLg, cr, 'Dr', iNo, 'Credit sale ' + iNo, 'Sale');

    const netSalesCredit = Math.max(0, round2((tax + zro) - appliedDiscount));
    adjustLedgerBalance('Sales Account', netSalesCredit, 'Cr', iNo, 'Sale ' + iNo, 'Sale');
    if (gst > 0) adjustLedgerBalance(cfg.EnableGSTInputTax === 'true' ? 'GST Output' : 'GST Payable', gst, 'Cr', iNo, 'GST ' + iNo, 'Sale');

    (s.additionalExpenses || []).forEach(exp => {
      if (exp.ledger && Number(exp.amount) > 0) adjustLedgerBalance(exp.ledger, Number(exp.amount), 'Cr', iNo, 'Sales Additional Charge ' + iNo, 'Sale');
    });
  });

  const existingPurchRefs = new Set(cleanLogs.filter(l => l.Type === 'Purchase').map(l => l['Ref No']));
  purchases.forEach(p => {
    if (p.status === 'Cancelled') return;
    const bNo = p.billNo || p.invoiceNo || '';
    if (!bNo || existingPurchRefs.has(bNo)) return;

    const cash = Number(p.cash) || 0, b1 = Number(p.bank1) || 0, b2 = Number(p.bank2) || 0;
    const cr = Number(p.credit) || 0;
    const tax = Number(p.taxable) || 0, zro = Number(p.zeroRated) || 0, gst = Number(p.gstAmt) || 0;
    const sLg = typeof p.supplier === 'object' ? (p.supplier.name?.trim() || p.supplier.ledger?.trim() || 'Supplier') : (p.supplier || 'Supplier');

    if (cash > 0) adjustLedgerBalance('Cash', cash, 'Cr', bNo, 'Cash purchase ' + bNo, 'Purchase');
    if (b1 > 0) adjustLedgerBalance(p.paymentDetails?.bank1Ledger || 'BOB Account', b1, 'Cr', bNo, 'Bank purchase ' + bNo, 'Purchase');
    if (b2 > 0) adjustLedgerBalance(p.paymentDetails?.bank2Ledger || 'BNBL Account', b2, 'Cr', bNo, 'Bank purchase ' + bNo, 'Purchase');
    if (cr > 0.009) adjustLedgerBalance(sLg, cr, 'Cr', bNo, 'Credit purchase ' + bNo, 'Purchase');

    adjustLedgerBalance('Purchase Account', tax + zro, 'Dr', bNo, 'Purchase ' + bNo, 'Purchase');
    if (gst > 0) adjustLedgerBalance(cfg.EnableGSTInputTax === 'true' ? 'GST Input' : 'GST Payable', gst, 'Dr', bNo, 'GST ' + bNo, 'Purchase');

    (p.additionalExpenses || []).forEach(exp => {
      if (exp.ledger && Number(exp.amount) > 0) adjustLedgerBalance(exp.ledger, Number(exp.amount), 'Dr', bNo, 'Purchase Expense ' + bNo, 'Purchase');
    });
  });

  const existingVouchRefs = new Set(cleanLogs.filter(l => l.Type !== 'Sale' && l.Type !== 'Purchase' && l.Type !== 'Sales Return' && l.Type !== 'Purchase Return').map(l => l['Ref No']));
  vouchers.forEach(v => {
    if (v.status === 'Cancelled') return;
    const no = v.voucherNo || '';
    if (!no || existingVouchRefs.has(no)) return;

    if (v.type === 'J') {
      (v.lines || []).forEach(line => {
        if (line.ledger && Number(line.amount) > 0) {
          adjustLedgerBalance(line.ledger, Number(line.amount), line.type as 'Dr' | 'Cr', no, v.narration || '', 'Journal');
        }
      });
    } else {
      const dr = v.debitLedger || '';
      const cr = v.creditLedger || '';
      const t = v.type === 'P' ? 'Payment' : (v.type === 'R' ? 'Receipt' : (v.type === 'C' ? 'Contra' : 'Journal'));
      if (dr && cr && Number(v.amount) > 0) {
        adjustLedgerBalance(dr, Number(v.amount), 'Dr', no, v.narration || '', t);
        adjustLedgerBalance(cr, Number(v.amount), 'Cr', no, v.narration || '', t);
      }
    }
  });

  // Reload ledgers and logs after healing
  const healedLedgers = sanitizeLedgers(loadJson<Ledger[]>(STORAGE_KEYS.LEDGERS, DEFAULT_LEDGERS));
  const healedLogs = loadJson<LedgerLogEntry[]>(STORAGE_KEYS.LEDGER_LOG, []);

  const cId = getActiveCompanyId();
  const isDemo = !cId || cId === DEFAULT_TENANT_COMPANY.id;

  // Strict multi-tenant isolation: non-demo companies with no transactions must strictly start at zero
  if (!isDemo && sales.length === 0 && purchases.length === 0 && vouchers.length === 0) {
    healedLedgers.forEach(l => {
      l['Opening Balance'] = 0;
      l['Current Balance'] = 0;
    });
  }

  const ledgerMap = new Map<string, { opening: number; current: number }>();
  healedLedgers.forEach(l => {
    const cleanName = (l['Ledger Name'] || '').trim().toLowerCase();
    const op = Number(l['Opening Balance']) || 0;
    const isDr = l['Balance Type (Dr/Cr)'] !== 'Cr';
    ledgerMap.set(cleanName, {
      opening: op,
      current: isDr ? op : -op
    });
  });

  healedLogs.forEach(log => {
    const cleanName = (log['Ledger Name'] || '').trim().toLowerCase();
    const entry = ledgerMap.get(cleanName);
    if (entry) {
      const dr = Number(log.Debit) || 0;
      const cr = Number(log.Credit) || 0;
      entry.current += (dr - cr);
    }
  });

  healedLedgers.forEach(l => {
    const cleanName = (l['Ledger Name'] || '').trim().toLowerCase();
    const entry = ledgerMap.get(cleanName);
    if (entry) {
      l['Current Balance'] = Math.abs(round2(entry.current));
      l['Balance Type (Dr/Cr)'] = entry.current >= 0 ? 'Dr' : 'Cr';
    }
  });

  if (!isDemo && sales.length === 0 && purchases.length === 0 && vouchers.length === 0) {
    healedLedgers.forEach(l => {
      l['Opening Balance'] = 0;
      l['Current Balance'] = 0;
    });
  }

  saveJson(STORAGE_KEYS.LEDGERS, healedLedgers);
  return healedLedgers;
}

export function cancelSalesInvoice(invoiceNo: string, reason?: string) {
  let invoices = getDeduplicatedSales();
  const target = invoices.find((v: any) => v.invoiceNo === invoiceNo);
  if (!target) return { ok: false, error: 'Invoice not found' };
  if (target.status === 'Cancelled') return { ok: false, error: 'Invoice is already cancelled' };

  // Reverse stock ONLY if stock was actually deducted by this sale (i.e. not raised against a Delivery Note)
  const wasAgainstDN = Boolean(target.deliveryNoteNo && target.deliveryNoteNo.trim());
  if (!wasAgainstDN) {
    (target.items || []).forEach((item: any) => {
      const qty = Number(item.Qty) || 0;
      if (qty !== 0) {
        const newQty = updateItemStock(item['Item Code'], qty, item.Unit || item.unit);
        if (qty > 0) {
          logStock(item['Item Code'], item['Item Name'], 'Sale Cancelled', qty, 0, newQty, invoiceNo, item.Unit || item.unit);
        } else {
          logStock(item['Item Code'], item['Item Name'], 'Sale Return Cancelled', 0, Math.abs(qty), newQty, invoiceNo, item.Unit || item.unit);
        }
      }
    });
  }

  target.status = 'Cancelled';
  (target as any).cancelledAt = new Date().toISOString();
  (target as any).cancellationReason = reason || 'Cancelled by user';
  saveJson(STORAGE_KEYS.SALES_INVOICES, invoices);
  syncSalesInvoiceToFirestore(target).catch(() => {});

  let logs = loadJson<LedgerLogEntry[]>(STORAGE_KEYS.LEDGER_LOG, []);
  logs = logs.filter(l => l['Ref No']?.trim().toLowerCase() !== invoiceNo.trim().toLowerCase());
  saveJson(STORAGE_KEYS.LEDGER_LOG, logs);


  // Audit Trail Logging
  addAuditLog({
    action: 'CANCELLED',
    module: 'Sales Invoice',
    recordId: invoiceNo,
    partyName: target.customer?.ledger || target.customer?.name,
    amount: Number(target.total) || 0,
    details: reason ? `Reason: ${reason}` : 'Cancelled by user'
  });

  recalculateLedgerBalances();

  const updatedItems = loadJson(STORAGE_KEYS.ITEMS, DEFAULT_ITEMS);
  const updatedLedgers = loadJson(STORAGE_KEYS.LEDGERS, DEFAULT_LEDGERS);
  return { ok: true, invoices, items: updatedItems, ledgers: updatedLedgers };
}

export function deleteSalesInvoice(invoiceNo: string) {
  return cancelSalesInvoice(invoiceNo);
}

export function deleteSalesInvoicePermanent(invoiceNo: string) {
  let invoices = loadJson<SalesInvoice[]>(STORAGE_KEYS.SALES_INVOICES, []);
  const target = invoices.find(v => v.invoiceNo?.trim().toLowerCase() === invoiceNo.trim().toLowerCase());
  if (!target) return { ok: false, error: 'Invoice not found' };

  const actualNo = target.invoiceNo || invoiceNo;

  addToTrash({
    refNo: actualNo,
    type: 'Sale',
    amount: Number(target.total) || 0,
    date: target.date,
    narration: `Permanent deletion of Sales Invoice ${actualNo}`,
    originalData: target
  });

  invoices = invoices.filter(v => v.invoiceNo?.trim().toLowerCase() !== invoiceNo.trim().toLowerCase());
  saveJson(STORAGE_KEYS.SALES_INVOICES, invoices);

  const deletedSales = loadJson<string[]>(STORAGE_KEYS.DELETED_SALES_INVOICES, []);
  if (!deletedSales.includes(actualNo)) {
    deletedSales.push(actualNo);
    saveJson(STORAGE_KEYS.DELETED_SALES_INVOICES, deletedSales);
  }
  deleteSalesInvoiceFromFirestore(actualNo).catch(() => {});

  let logs = loadJson<LedgerLogEntry[]>(STORAGE_KEYS.LEDGER_LOG, []);
  logs = logs.filter(l => l['Ref No']?.trim().toLowerCase() !== invoiceNo.trim().toLowerCase());
  saveJson(STORAGE_KEYS.LEDGER_LOG, logs);

  let stockLogs = loadJson<StockLedgerEntry[]>(STORAGE_KEYS.STOCK_LEDGER, []);
  stockLogs = stockLogs.filter(s => s['Ref No']?.trim().toLowerCase() !== invoiceNo.trim().toLowerCase());
  saveJson(STORAGE_KEYS.STOCK_LEDGER, stockLogs);

  // Audit Trail Logging
  addAuditLog({
    action: 'DELETED',
    module: 'Sales Invoice',
    recordId: actualNo,
    partyName: target.customer?.ledger || target.customer?.name,
    amount: Number(target.total) || 0,
    details: `Permanently deleted sales invoice ${actualNo}`
  });


  recalculateLedgerBalances();

  const updatedItems = loadJson(STORAGE_KEYS.ITEMS, DEFAULT_ITEMS);
  const updatedLedgers = loadJson(STORAGE_KEYS.LEDGERS, DEFAULT_LEDGERS);
  return { ok: true, items: updatedItems, ledgers: updatedLedgers };
}

export function cancelPurchaseInvoice(billNo: string, reason?: string) {
  let purchases = getDeduplicatedPurchases();
  const target = purchases.find((v: any) => v.billNo === billNo || v.invoiceNo === billNo);
  if (!target) return { ok: false, error: 'Purchase Invoice not found' };
  if (target.status === 'Cancelled') return { ok: false, error: 'Purchase Invoice is already cancelled' };

  // Reverse stock
  (target.items || []).forEach((item: any) => {
    const qty = Number(item.Qty) || 0;
    if (qty > 0) {
      const newQty = updateItemStock(item['Item Code'], -qty, item.Unit || item.unit);
      logStock(item['Item Code'], item['Item Name'], 'Purchase Cancelled', 0, qty, newQty, billNo, item.Unit || item.unit);
    }
  });

  target.status = 'Cancelled';
  (target as any).cancelledAt = new Date().toISOString();
  (target as any).cancellationReason = reason || 'Cancelled by user';
  saveJson(STORAGE_KEYS.PURCHASE_INVOICES, purchases);
  syncPurchaseInvoiceToFirestore(target).catch(() => {});

  let logs = loadJson<LedgerLogEntry[]>(STORAGE_KEYS.LEDGER_LOG, []);
  logs = logs.filter(l => l['Ref No']?.trim().toLowerCase() !== billNo.trim().toLowerCase());
  saveJson(STORAGE_KEYS.LEDGER_LOG, logs);


  // Audit Trail Logging
  addAuditLog({
    action: 'CANCELLED',
    module: 'Purchase Bill',
    recordId: billNo,
    partyName: target.supplier?.name,
    amount: Number(target.total) || 0,
    details: reason ? `Reason: ${reason}` : 'Cancelled by user'
  });

  recalculateLedgerBalances();

  const updatedItems = loadJson(STORAGE_KEYS.ITEMS, DEFAULT_ITEMS);
  const updatedLedgers = loadJson(STORAGE_KEYS.LEDGERS, DEFAULT_LEDGERS);
  return { ok: true, purchases, items: updatedItems, ledgers: updatedLedgers };
}

export function deletePurchaseInvoice(billNo: string) {
  return cancelPurchaseInvoice(billNo);
}

export function deletePurchaseInvoicePermanent(billNo: string) {
  let purchases = loadJson<PurchaseInvoice[]>(STORAGE_KEYS.PURCHASE_INVOICES, []);
  const target = purchases.find(v => v.billNo?.trim().toLowerCase() === billNo.trim().toLowerCase() || v.invoiceNo?.trim().toLowerCase() === billNo.trim().toLowerCase());
  if (!target) return { ok: false, error: 'Purchase Invoice not found' };

  const ref = target.billNo || target.invoiceNo || billNo;
  addToTrash({
    refNo: ref,
    type: 'Purchase',
    amount: Number(target.total) || 0,
    date: target.date,
    narration: `Permanent deletion of Purchase Invoice ${ref}`,
    originalData: target
  });

  purchases = purchases.filter(v => v.billNo?.trim().toLowerCase() !== ref.trim().toLowerCase() && v.invoiceNo?.trim().toLowerCase() !== ref.trim().toLowerCase());
  saveJson(STORAGE_KEYS.PURCHASE_INVOICES, purchases);

  const deletedPurchases = loadJson<string[]>(STORAGE_KEYS.DELETED_PURCHASE_INVOICES, []);
  if (!deletedPurchases.includes(ref)) {
    deletedPurchases.push(ref);
    saveJson(STORAGE_KEYS.DELETED_PURCHASE_INVOICES, deletedPurchases);
  }
  deletePurchaseInvoiceFromFirestore(ref).catch(() => {});

  let logs = loadJson<LedgerLogEntry[]>(STORAGE_KEYS.LEDGER_LOG, []);
  logs = logs.filter(l => l['Ref No']?.trim().toLowerCase() !== ref.trim().toLowerCase());
  saveJson(STORAGE_KEYS.LEDGER_LOG, logs);

  let stockLogs = loadJson<StockLedgerEntry[]>(STORAGE_KEYS.STOCK_LEDGER, []);
  stockLogs = stockLogs.filter(s => s['Ref No']?.trim().toLowerCase() !== ref.trim().toLowerCase());
  saveJson(STORAGE_KEYS.STOCK_LEDGER, stockLogs);

  // Audit Trail Logging
  addAuditLog({
    action: 'DELETED',
    module: 'Purchase Bill',
    recordId: ref,
    partyName: target.supplier?.name,
    amount: Number(target.total) || 0,
    details: `Permanently deleted purchase bill ${ref}`
  });


  recalculateLedgerBalances();

  const updatedItems = loadJson(STORAGE_KEYS.ITEMS, DEFAULT_ITEMS);
  const updatedLedgers = loadJson(STORAGE_KEYS.LEDGERS, DEFAULT_LEDGERS);
  return { ok: true, items: updatedItems, ledgers: updatedLedgers };
}

export function cancelVoucher(voucherNo: string, reason?: string) {
  let vouchers = loadJson<any[]>(STORAGE_KEYS.VOUCHERS, []);
  const target = vouchers.find(v => v.voucherNo === voucherNo);
  if (!target) return { ok: false, error: 'Voucher not found' };
  if (target.status === 'Cancelled') return { ok: false, error: 'Voucher is already cancelled' };

  target.status = 'Cancelled';
  target.cancelledAt = new Date().toISOString();
  target.cancellationReason = reason || 'Cancelled by user';
  saveJson(STORAGE_KEYS.VOUCHERS, vouchers);
  syncVoucherToFirestore(target).catch(() => {});

  let logs = loadJson<LedgerLogEntry[]>(STORAGE_KEYS.LEDGER_LOG, []);
  logs = logs.filter(l => l['Ref No']?.trim().toLowerCase() !== voucherNo.trim().toLowerCase());
  saveJson(STORAGE_KEYS.LEDGER_LOG, logs);


  // Audit Trail Logging
  const vTypeCancel = target.type === 'P' ? 'Payment' : target.type === 'R' ? 'Receipt' : target.type === 'J' ? 'Journal' : target.type === 'C' ? 'Contra' : (target.type || 'Voucher');
  addAuditLog({
    action: 'CANCELLED',
    module: vTypeCancel,
    recordId: voucherNo,
    partyName: target.partyName || target.ledger || target.debitLedger || target.creditLedger,
    amount: Number(target.totalAmount || target.amount || target.total) || 0,
    details: reason ? `Reason: ${reason}` : 'Cancelled by user'
  });

  recalculateLedgerBalances();

  const updatedLedgers = loadJson<Ledger[]>(STORAGE_KEYS.LEDGERS, DEFAULT_LEDGERS);
  return { ok: true, vouchers, ledgers: updatedLedgers };
}

export function deleteVoucherPermanent(voucherNo: string) {
  let vouchers = loadJson<any[]>(STORAGE_KEYS.VOUCHERS, []);
  const target = vouchers.find(v => v.voucherNo?.trim().toLowerCase() === voucherNo.trim().toLowerCase());
  if (!target) return { ok: false, error: 'Voucher not found' };

  const actualNo = target.voucherNo || voucherNo;

  addToTrash({
    refNo: actualNo,
    type: target.type || 'Voucher',
    amount: Number(target.totalAmount || target.amount || target.total) || 0,
    date: target.date,
    narration: `Permanent deletion of Voucher ${actualNo}`,
    originalData: target
  });

  vouchers = vouchers.filter(v => v.voucherNo?.trim().toLowerCase() !== actualNo.trim().toLowerCase());
  saveJson(STORAGE_KEYS.VOUCHERS, vouchers);

  const deletedVouchers = loadJson<string[]>(STORAGE_KEYS.DELETED_VOUCHERS, []);
  if (!deletedVouchers.includes(actualNo)) {
    deletedVouchers.push(actualNo);
    saveJson(STORAGE_KEYS.DELETED_VOUCHERS, deletedVouchers);
  }
  deleteVoucherFromFirestore(actualNo).catch(() => {});

  let logs = loadJson<LedgerLogEntry[]>(STORAGE_KEYS.LEDGER_LOG, []);
  logs = logs.filter(l => l['Ref No']?.trim().toLowerCase() !== actualNo.trim().toLowerCase());
  saveJson(STORAGE_KEYS.LEDGER_LOG, logs);

  let stockLogs = loadJson<StockLedgerEntry[]>(STORAGE_KEYS.STOCK_LEDGER, []);
  stockLogs = stockLogs.filter(s => s['Ref No']?.trim().toLowerCase() !== actualNo.trim().toLowerCase());
  saveJson(STORAGE_KEYS.STOCK_LEDGER, stockLogs);

  // Audit Trail Logging
  const vTypeDel = target.type === 'P' ? 'Payment' : target.type === 'R' ? 'Receipt' : target.type === 'J' ? 'Journal' : target.type === 'C' ? 'Contra' : (target.type || 'Voucher');
  addAuditLog({
    action: 'DELETED',
    module: vTypeDel,
    recordId: actualNo,
    partyName: target.partyName || target.ledger || target.debitLedger || target.creditLedger,
    amount: Number(target.totalAmount || target.amount || target.total) || 0,
    details: `Permanently deleted voucher ${actualNo}`
  });

  recalculateLedgerBalances();

  const updatedLedgers = loadJson<Ledger[]>(STORAGE_KEYS.LEDGERS, DEFAULT_LEDGERS);
  return { ok: true, vouchers, ledgers: updatedLedgers };
}

export function deleteVoucher(voucherNo: string) {
  return cancelVoucher(voucherNo);
}

export interface BulkDeleteOptions {
  deleteTransactions: boolean;
  deleteMasters: boolean;
  resetOpeningBalances: boolean;
  dateFilterMode?: 'all' | 'range';
  fromDate?: string;
  toDate?: string;
  selectedVoucherCategories?: string[];
}

export function bulkDeleteData(options: BulkDeleteOptions) {
  if (options.deleteTransactions) {
    const isFiltered = options.dateFilterMode === 'range' || (options.selectedVoucherCategories && options.selectedVoucherCategories.length > 0 && options.selectedVoucherCategories.length < 13);
    
    if (isFiltered) {
      const from = options.dateFilterMode === 'range' && options.fromDate ? options.fromDate.trim() : '';
      const to = options.dateFilterMode === 'range' && options.toDate ? options.toDate.trim() : '';
      
      const inRange = (d?: string) => {
        if (!d) return true;
        const sub = d.slice(0, 10);
        if (from && sub < from) return false;
        if (to && sub > to) return false;
        return true;
      };

      const cats = new Set(options.selectedVoucherCategories && options.selectedVoucherCategories.length > 0 
        ? options.selectedVoucherCategories 
        : ['sale_pos', 'sale_b2b', 'purchase', 'payment', 'receipt', 'journal', 'contra', 'credit_note', 'debit_note', 'quotation', 'delivery_note', 'physical_stock', 'payroll']
      );

      // 1. Sales Invoices
      const sales = loadJson<SalesInvoice[]>(STORAGE_KEYS.SALES_INVOICES, []);
      const remainingSales = sales.filter(s => {
        const cat = s.isPOS ? 'sale_pos' : 'sale_b2b';
        const shouldDelete = cats.has(cat) && inRange(s.date);
        return !shouldDelete;
      });
      saveJson(STORAGE_KEYS.SALES_INVOICES, remainingSales);

      // 2. Purchase Invoices
      const purchases = loadJson<PurchaseInvoice[]>(STORAGE_KEYS.PURCHASE_INVOICES, []);
      const remainingPurchases = purchases.filter(p => {
        const shouldDelete = cats.has('purchase') && inRange(p.date);
        return !shouldDelete;
      });
      saveJson(STORAGE_KEYS.PURCHASE_INVOICES, remainingPurchases);

      // 3. Accounting Vouchers
      const vouchers = loadJson<Voucher[]>(STORAGE_KEYS.VOUCHERS, []);
      const mapVoucherTypeToCat = (type?: string) => {
        if (type === 'P') return 'payment';
        if (type === 'R') return 'receipt';
        if (type === 'J') return 'journal';
        if (type === 'C') return 'contra';
        if (type === 'CN' || type === 'CreditNote') return 'credit_note';
        if (type === 'DN' || type === 'DebitNote') return 'debit_note';
        return 'journal';
      };
      const remainingVouchers = vouchers.filter(v => {
        const cat = mapVoucherTypeToCat(v.type);
        const shouldDelete = cats.has(cat) && inRange(v.date);
        return !shouldDelete;
      });
      saveJson(STORAGE_KEYS.VOUCHERS, remainingVouchers);

      // 4. Quotations
      if (cats.has('quotation')) {
        const quotations = loadJson<Quotation[]>(STORAGE_KEYS.QUOTATIONS, []);
        const remainingQuotes = quotations.filter(q => !inRange(q.date));
        saveJson(STORAGE_KEYS.QUOTATIONS, remainingQuotes);
      }

      // 5. Delivery Notes
      if (cats.has('delivery_note')) {
        const deliveryNotes = loadJson<DeliveryNote[]>(STORAGE_KEYS.DELIVERY_NOTES, []);
        const remainingDNs = deliveryNotes.filter(dn => !inRange(dn.date));
        saveJson(STORAGE_KEYS.DELIVERY_NOTES, remainingDNs);
      }

      // 6. Physical Stock
      if (cats.has('physical_stock')) {
        const physicalStock = loadJson<PhysicalStockVoucher[]>(STORAGE_KEYS.PHYSICAL_STOCK, []);
        const remainingPS = physicalStock.filter(ps => !inRange(ps.date));
        saveJson(STORAGE_KEYS.PHYSICAL_STOCK, remainingPS);
      }

      // 7. Payroll & Advances
      if (cats.has('payroll')) {
        const payrolls = loadJson<MonthlyPayroll[]>(STORAGE_KEYS.MONTHLY_PAYROLLS, []);
        const remainingPR = payrolls.filter(pr => !inRange(pr.month || (pr as any).date));
        saveJson(STORAGE_KEYS.MONTHLY_PAYROLLS, remainingPR);

        const advances = loadJson<any[]>(STORAGE_KEYS.EMPLOYEE_ADVANCES, []);
        const remainingAdv = advances.filter(adv => !inRange(adv.date));
        saveJson(STORAGE_KEYS.EMPLOYEE_ADVANCES, remainingAdv);
      }

      // Rebuild accounting logs & stock ledgers
      rebuildAccountingLogs();

      // Recalculate item stock based on surviving stock ledger entries
      const stockLedger = loadJson<StockLedgerEntry[]>(STORAGE_KEYS.STOCK_LEDGER, []);
      const items = loadJson<Item[]>(STORAGE_KEYS.ITEMS, DEFAULT_ITEMS);
      items.forEach(i => {
        const opening = options.resetOpeningBalances ? 0 : (Number(i['Opening Stock']) || 0);
        const itemEntries = stockLedger.filter(e => e['Item Code'] === i['Item Code']);
        const totalIn = itemEntries.reduce((acc, e) => acc + (Number(e['Qty In']) || 0), 0);
        const totalOut = itemEntries.reduce((acc, e) => acc + (Number(e['Qty Out']) || 0), 0);
        i['Current Stock'] = opening + totalIn - totalOut;
      });
      saveJson(STORAGE_KEYS.ITEMS, items);

    } else {
      saveJson(STORAGE_KEYS.SALES_INVOICES, []);
      saveJson(STORAGE_KEYS.PURCHASE_INVOICES, []);
      saveJson(STORAGE_KEYS.VOUCHERS, []);
      saveJson(STORAGE_KEYS.QUOTATIONS, []);
      saveJson(STORAGE_KEYS.DELIVERY_NOTES, []);
      saveJson(STORAGE_KEYS.PHYSICAL_STOCK, []);
      saveJson(STORAGE_KEYS.LEDGER_LOG, []);
      saveJson(STORAGE_KEYS.STOCK_LEDGER, []);
      saveJson(STORAGE_KEYS.HELD_BILLS, []);
      saveJson(STORAGE_KEYS.MONTHLY_PAYROLLS, []);
      saveJson(STORAGE_KEYS.EMPLOYEE_ADVANCES, []);
      saveJson(STORAGE_KEYS.TRASH_LOG, []);
      saveJson(STORAGE_KEYS.COUNTERS, {});

      // Purge Supabase remote records to prevent re-hydration on browser refresh
      purgeRemoteCompanyData(getActiveCompanyId()).catch(() => {});

      const items = loadJson<Item[]>(STORAGE_KEYS.ITEMS, DEFAULT_ITEMS);
      items.forEach(i => {
        i['Current Stock'] = options.resetOpeningBalances ? 0 : (Number(i['Opening Stock']) || 0);
      });
      saveJson(STORAGE_KEYS.ITEMS, items);
    }
  }

  if (options.deleteMasters) {
    saveJson(STORAGE_KEYS.ITEMS, []);
    saveJson(STORAGE_KEYS.ITEM_GROUPS, DEFAULT_ITEM_GROUPS);
    saveJson(STORAGE_KEYS.ITEM_CATEGORIES, []);
    saveJson(STORAGE_KEYS.UNITS, DEFAULT_UNITS);
    saveJson(STORAGE_KEYS.UNIT_GROUPS, []);
    saveJson(STORAGE_KEYS.PAY_HEADS, []);
    saveJson(STORAGE_KEYS.EMPLOYEES, []);

    const ledgers = loadJson<Ledger[]>(STORAGE_KEYS.LEDGERS, DEFAULT_LEDGERS);
    const systemNames = new Set(DEFAULT_LEDGERS.map(l => l['Ledger Name'].toLowerCase()));
    const preservedLedgers = ledgers.filter(l => systemNames.has(l['Ledger Name'].toLowerCase()));
    saveJson(STORAGE_KEYS.LEDGERS, preservedLedgers.length > 0 ? preservedLedgers : DEFAULT_LEDGERS);
  }

  if (options.resetOpeningBalances) {
    const ledgers = loadJson<Ledger[]>(STORAGE_KEYS.LEDGERS, DEFAULT_LEDGERS);
    ledgers.forEach(l => {
      l['Opening Balance'] = 0;
      l['Current Balance'] = 0;
    });
    saveJson(STORAGE_KEYS.LEDGERS, ledgers);

    const items = loadJson<Item[]>(STORAGE_KEYS.ITEMS, DEFAULT_ITEMS);
    items.forEach(i => {
      i['Opening Stock'] = 0;
      i['Current Stock'] = 0;
      i['Opening Valuation'] = 0;
    });
    saveJson(STORAGE_KEYS.ITEMS, items);
  }

  recalculateLedgerBalances();
  return { ok: true, message: 'Bulk data cleanup completed successfully' };
}

export function saveVoucher(t: 'P' | 'R' | 'J' | 'C', v: { 
  voucherNo?: string;
  originalVoucherNo?: string; 
  isEdit?: boolean;
  date?: string; 
  ledger?: string; 
  amount: number; 
  mode?: string; 
  debitLedger?: string; 
  creditLedger?: string; 
  toAccount?: string; 
  fromAccount?: string; 
  narration?: string;
  transactionId?: string;
  bankTxnNo?: string;
  chequeNo?: string;
  billNo?: string;
  billAllocations?: BillAllocation[];
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
}) {
  const cfg = loadJson<Config>(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
  
  const vouchersList = loadJson<Voucher[]>(STORAGE_KEYS.VOUCHERS, []);
  if (!v.isEdit && v.voucherNo && vouchersList.some(x => x.voucherNo.toLowerCase() === v.voucherNo!.trim().toLowerCase())) {
    return { ok: false, error: `Duplicate Voucher Number: ${v.voucherNo}` };
  }

  let dr = '', cr = '';
  if (t === 'P') { dr = v.debitLedger || v.ledger || ''; cr = v.creditLedger || v.mode || 'Cash'; }
  else if (t === 'R') { dr = v.debitLedger || v.mode || 'Cash'; cr = v.creditLedger || v.ledger || ''; }
  else if (t === 'J') { dr = v.debitLedger || ''; cr = v.creditLedger || ''; }
  else if (t === 'C') { dr = v.toAccount || ''; cr = v.fromAccount || ''; }

  const px = getVoucherPrefix(t, cfg);
  let no = (v.originalVoucherNo || v.voucherNo)?.trim();
  if (!no) {
    no = px + nextCounter('Voucher');
  } else if (!v.isEdit && !v.originalVoucherNo) {
    const match = no.match(/\d+$/);
    if (match) {
      const num = parseInt(match[0], 10);
      const counters = loadJson<Record<string, number>>(STORAGE_KEYS.COUNTERS, {});
      if (num > (counters['Voucher'] || 0)) {
        counters['Voucher'] = num;
        saveJson(STORAGE_KEYS.COUNTERS, counters);
      }
    }
  }

  const txnId = v.transactionId || v.bankTxnNo || v.chequeNo || '';
  const vouchers = loadJson<Voucher[]>(STORAGE_KEYS.VOUCHERS, []);
  
  const finalNo = v.voucherNo?.trim() || no;

  const newV: Voucher = {
    voucherNo: finalNo,
    date: v.date || new Date().toISOString(),
    type: t,
    debitLedger: dr,
    creditLedger: cr,
    amount: Number(v.amount),
    narration: v.narration || '',
    transactionId: txnId,
    bankTxnNo: v.bankTxnNo || txnId,
    chequeNo: v.chequeNo || '',
    billNo: v.billNo,
    billAllocations: v.billAllocations,
    gstInputType: v.gstInputType,
    supplierName: v.supplierName,
    supplierGstNo: v.supplierGstNo,
    supplierCountry: v.supplierCountry,
    invoiceNo: v.invoiceNo,
    invoiceDate: v.invoiceDate,
    referenceNo: v.referenceNo,
    declarationNo: v.declarationNo,
    declarationDate: v.declarationDate,
    taxableAmount: v.taxableAmount,
    exemptedAmount: v.exemptedAmount,
    gstAmount: v.gstAmount,
    totalImportAmount: v.totalImportAmount
  };
  const existIdx = vouchers.findIndex(x => x.voucherNo?.trim().toLowerCase() === no.trim().toLowerCase() || x.voucherNo?.trim().toLowerCase() === finalNo.trim().toLowerCase());
  if (existIdx >= 0) {
    vouchers[existIdx] = newV;
    // Clear out earlier ledger log rows for this voucher to prevent duplicate ledger balance postings
    let logs = loadJson<LedgerLogEntry[]>(STORAGE_KEYS.LEDGER_LOG, []);
    logs = logs.filter(l => l['Ref No']?.trim().toLowerCase() !== no.trim().toLowerCase() && l['Ref No']?.trim().toLowerCase() !== finalNo.trim().toLowerCase());
    saveJson(STORAGE_KEYS.LEDGER_LOG, logs);
  } else {
    vouchers.push(newV);
  }
  saveJson(STORAGE_KEYS.VOUCHERS, vouchers);
  syncVoucherToFirestore(newV).catch(() => {});

  if (v.originalVoucherNo && v.originalVoucherNo.trim().toLowerCase() !== finalNo.trim().toLowerCase()) {
    deleteVoucherFromFirestore(v.originalVoucherNo.trim()).catch(() => {});
  }

  // Audit Trail Logging
  const vTypeName = t === 'P' ? 'Payment' : t === 'R' ? 'Receipt' : t === 'J' ? 'Journal' : 'Contra';
  const partyParty = (t === 'P' || t === 'R') ? (v.ledger || dr || cr) : `${dr} → ${cr}`;
  if (existIdx >= 0) {
    addAuditLog({
      action: 'ALTERED',
      module: vTypeName,
      recordId: finalNo,
      partyName: partyParty,
      amount: Number(v.amount),
      details: `Updated ${vTypeName} voucher (${dr} Dr, ${cr} Cr)`
    });
  } else {
    addAuditLog({
      action: 'ENTERED',
      module: vTypeName,
      recordId: finalNo,
      partyName: partyParty,
      amount: Number(v.amount),
      details: `Created ${vTypeName} voucher (${dr} Dr, ${cr} Cr)`
    });
  }

  const txnSuffix = txnId ? ` (Txn/Ref: ${txnId})` : '';
  const narrWithTxn = v.narration ? `${v.narration}${txnSuffix}` : `${t}${txnSuffix}`;

  if (t === 'P' && v.gstAmount && v.gstAmount > 0) {
    const expenseAmt = Number(v.amount) - Number(v.gstAmount);
    if (expenseAmt > 0) {
      adjustLedgerBalance(dr, expenseAmt, 'Dr', finalNo, narrWithTxn, t, txnId);
    }
    adjustLedgerBalance('GST Input', Number(v.gstAmount), 'Dr', finalNo, narrWithTxn + ' (GST Input)', t, txnId);
    adjustLedgerBalance(cr, Number(v.amount), 'Cr', finalNo, narrWithTxn, t, txnId);
  } else {
    adjustLedgerBalance(dr, Number(v.amount), 'Dr', finalNo, narrWithTxn, t, txnId);
    adjustLedgerBalance(cr, Number(v.amount), 'Cr', finalNo, narrWithTxn, t, txnId);
  }

  if (existIdx >= 0) {
    recalculateLedgerBalances();
  }

  const updatedLedgers = loadJson<Ledger[]>(STORAGE_KEYS.LEDGERS, DEFAULT_LEDGERS);
  return { ok: true, voucherNo: finalNo, ledgers: updatedLedgers };
}

/**
 * Retrieve outstanding bills / invoices for a given Sundry Debtor or Sundry Creditor ledger.
 * Used for maintaining bill-wise details when settling payment or receiving receipts.
 */
export function getPartyOutstandingBills(partyLedgerName: string, partyType?: 'debtor' | 'creditor'): BillWiseDetail[] {
  if (!partyLedgerName || !partyLedgerName.trim()) return [];
  const cleanParty = partyLedgerName.trim().toLowerCase();
  const sales = getDeduplicatedSales();
  const purchases = getDeduplicatedPurchases();
  const vouchers = loadJson<Voucher[]>(STORAGE_KEYS.VOUCHERS, []).filter(v => v.status !== 'Cancelled');
  const ledgers = loadJson<Ledger[]>(STORAGE_KEYS.LEDGERS, DEFAULT_LEDGERS);

  const results: BillWiseDetail[] = [];
  const settledMap = new Map<string, number>();

  // Aggregate settlements from existing vouchers
  vouchers.forEach(v => {
    if (v.billAllocations && Array.isArray(v.billAllocations)) {
      v.billAllocations.forEach(alloc => {
        if (alloc.billNo && alloc.amount) {
          const key = alloc.billNo.trim().toLowerCase();
          settledMap.set(key, round2((settledMap.get(key) || 0) + Number(alloc.amount)));
        }
      });
    } else if (v.billNo && v.amount) {
      const key = v.billNo.trim().toLowerCase();
      settledMap.set(key, round2((settledMap.get(key) || 0) + Number(v.amount)));
    }
  });

  // Automatically determine party type if not passed
  let pType = partyType;
  if (!pType) {
    const lObj = ledgers.find(l => l['Ledger Name']?.trim().toLowerCase() === cleanParty);
    const grp = (lObj?.Group || '').toLowerCase();
    if (grp.includes('debtor') || grp.includes('customer')) {
      pType = 'debtor';
    } else if (grp.includes('creditor') || grp.includes('supplier') || grp.includes('vendor')) {
      pType = 'creditor';
    } else {
      // Check whether this party appears in sales or purchases
      const hasSales = sales.some(s => (s.customer?.name || '').trim().toLowerCase() === cleanParty || (s.customer?.ledger || '').trim().toLowerCase() === cleanParty);
      pType = hasSales ? 'debtor' : 'creditor';
    }
  }

  if (pType === 'debtor') {
    // 1. Credit Sales Invoices
    sales.forEach(s => {
      if ((s.status as string) === 'Cancelled') return;
      const cName = (s.customer?.name || '').trim().toLowerCase();
      const cLedger = (s.customer?.ledger || '').trim().toLowerCase();
      if (cName === cleanParty || cLedger === cleanParty) {
        // Outstanding amount is credit if specified, or total if marked Credit/Partial Credit
        const originalAmt = Number(s.credit) > 0 
          ? Number(s.credit) 
          : (s.status === 'Credit' || s.status === 'Partial Credit' || ((s as any).paymentMode && (s as any).paymentMode !== 'Cash') ? Number(s.total) : 0);
        if (originalAmt > 0.005) {
          const billKey = s.invoiceNo.trim().toLowerCase();
          const alreadySettled = settledMap.get(billKey) || 0;
          const pending = Math.max(0, round2(originalAmt - alreadySettled));
          if (pending > 0.005) {
            results.push({
              billNo: s.invoiceNo,
              billDate: s.date,
              originalAmount: round2(originalAmt),
              paidAmount: round2(alreadySettled),
              pendingAmount: pending,
              billType: 'Sales Invoice',
              dueDate: (s as any).dueDate
            });
          }
        }
      }
    });

    // 2. Debtor Ledger Opening Balance (Dr)
    const lObj = ledgers.find(l => l['Ledger Name']?.trim().toLowerCase() === cleanParty);
    if (lObj && lObj['Balance Type (Dr/Cr)'] === 'Dr' && Number(lObj['Opening Balance']) > 0) {
      const opKey = `op-bal-${cleanParty}`;
      const opAmt = Number(lObj['Opening Balance']);
      const alreadySettled = settledMap.get(opKey) || settledMap.get('op-bal') || 0;
      const pending = Math.max(0, round2(opAmt - alreadySettled));
      if (pending > 0.005) {
        results.push({
          billNo: `OB-${lObj['Ledger Name'].substring(0, 8).toUpperCase()}`,
          billDate: new Date().toISOString(),
          originalAmount: round2(opAmt),
          paidAmount: round2(alreadySettled),
          pendingAmount: pending,
          billType: 'Opening Balance'
        });
      }
    }
  } else {
    // Creditor
    // 1. Credit Purchases
    purchases.forEach(p => {
      if ((p.status as string) === 'Cancelled') return;
      const sName = (p.supplier?.name || '').trim().toLowerCase();
      const sLedger = (p.supplier?.ledger || '').trim().toLowerCase();
      if (sName === cleanParty || sLedger === cleanParty) {
        const originalAmt = Number(p.credit) > 0 
          ? Number(p.credit) 
          : (p.status === 'Credit' || p.status === 'Partial Credit' || ((p as any).paymentMode && (p as any).paymentMode !== 'Cash') ? Number(p.total) : 0);
        if (originalAmt > 0.005) {
          const bNo = p.billNo || p.invoiceNo || p.supplierBillNo || 'PUR-BILL';
          const billKey = bNo.trim().toLowerCase();
          const alreadySettled = settledMap.get(billKey) || 0;
          const pending = Math.max(0, round2(originalAmt - alreadySettled));
          if (pending > 0.005) {
            results.push({
              billNo: bNo,
              billDate: p.date,
              originalAmount: round2(originalAmt),
              paidAmount: round2(alreadySettled),
              pendingAmount: pending,
              billType: 'Purchase Bill',
              dueDate: (p as any).dueDate
            });
          }
        }
      }
    });

    // 2. Creditor Ledger Opening Balance (Cr)
    const lObj = ledgers.find(l => l['Ledger Name']?.trim().toLowerCase() === cleanParty);
    if (lObj && lObj['Balance Type (Dr/Cr)'] === 'Cr' && Number(lObj['Opening Balance']) > 0) {
      const opKey = `op-bal-${cleanParty}`;
      const opAmt = Number(lObj['Opening Balance']);
      const alreadySettled = settledMap.get(opKey) || settledMap.get('op-bal') || 0;
      const pending = Math.max(0, round2(opAmt - alreadySettled));
      if (pending > 0.005) {
        results.push({
          billNo: `OB-${lObj['Ledger Name'].substring(0, 8).toUpperCase()}`,
          billDate: new Date().toISOString(),
          originalAmount: round2(opAmt),
          paidAmount: round2(alreadySettled),
          pendingAmount: pending,
          billType: 'Opening Balance'
        });
      }
    }
  }

  // Sort bills by date ascending (FIFO order)
  return results.sort((a, b) => new Date(a.billDate).getTime() - new Date(b.billDate).getTime());
}

// -------------------------------------------------------------
// CREDIT NOTE & DEBIT NOTE HANDLERS (with Stock Return option)
// -------------------------------------------------------------
export function saveCreditNote(payload: {
  voucherNo?: string;
  originalVoucherNo?: string;
  date?: string;
  partyLedger: string;
  salesReturnLedger?: string;
  originalInvoiceRef?: string;
  amount: number;
  taxable?: number;
  gstAmt?: number;
  narration?: string;
  returnStock?: boolean;
  items?: Array<{
    itemCode: string;
    itemName: string;
    unit?: string;
    qty: number;
    rate?: number;
    discount?: number;
    gstPct?: number;
    amount?: number;
  }>;
}) {
  const cfg = loadJson<Config>(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
  const px = getVoucherPrefix('CN', cfg);
  let no = (payload.originalVoucherNo || payload.voucherNo)?.trim();
  if (!no) {
    no = px + nextCounter('CreditNote');
  }

  const dateIso = payload.date || new Date().toISOString();
  
  const finalNoCN = payload.voucherNo?.trim() || no;
  const salesReturnAcc = payload.salesReturnLedger || 'Sales Account';
  const partyAcc = payload.partyLedger;
  const totalAmt = round2(Number(payload.amount) || 0);
  let gstAmt = round2(Number(payload.gstAmt) || 0);
  if (!gstAmt && payload.items && payload.items.length > 0) {
    gstAmt = round2(payload.items.reduce((sum, it) => {
      const q = Number(it.qty) || 0;
      const r = Number(it.rate) || 0;
      const d = Number(it.discount) || 0;
      const g = Number(it.gstPct) || 0;
      const lineVal = (q * r) - d;
      return sum + ((lineVal * g) / 100);
    }, 0));
  }
  let taxableAmt = round2(Number(payload.taxable) || 0);
  if (!taxableAmt) {
    taxableAmt = round2(totalAmt - gstAmt);
  }
  const narr = payload.narration || `Credit Note against ${payload.originalInvoiceRef || 'Sales Return'}`;

  // 1. Save voucher entry
  const vouchers = loadJson<Voucher[]>(STORAGE_KEYS.VOUCHERS, []);
  const newV: Voucher = {
    voucherNo: finalNoCN,
    date: dateIso,
    type: 'CN',
    debitLedger: salesReturnAcc,
    creditLedger: partyAcc,
    partyName: partyAcc,
    partyGstNo: (payload as any).partyGstNo || '',
    originalInvoiceRef: payload.originalInvoiceRef || '',
    amount: totalAmt,
    taxable: taxableAmt,
    taxableAmount: taxableAmt,
    gstAmt: gstAmt,
    gstAmount: gstAmt,
    narration: narr,
    lines: [
      { type: 'Dr', ledger: salesReturnAcc, amount: taxableAmt, narration: 'Sales Return' },
      ...(gstAmt > 0 ? [{ type: 'Dr' as const, ledger: cfg.EnableGSTInputTax === 'true' ? 'GST Output' : 'GST Payable', amount: gstAmt, narration: 'GST Output Reversal' }] : []),
      { type: 'Cr', ledger: partyAcc, amount: totalAmt, narration: `Credit allowed to ${partyAcc}` }
    ],
    items: payload.items
  };
  const existIdxCN = vouchers.findIndex(x => x.voucherNo?.trim().toLowerCase() === no.trim().toLowerCase() || x.voucherNo?.trim().toLowerCase() === finalNoCN.trim().toLowerCase());
  if (existIdxCN >= 0) {
    vouchers[existIdxCN] = newV;
    let logs = loadJson<LedgerLogEntry[]>(STORAGE_KEYS.LEDGER_LOG, []);
    logs = logs.filter(l => l['Ref No']?.trim().toLowerCase() !== no.trim().toLowerCase() && l['Ref No']?.trim().toLowerCase() !== finalNoCN.trim().toLowerCase());
    saveJson(STORAGE_KEYS.LEDGER_LOG, logs);
    let stockLogs = loadJson<StockLedgerEntry[]>(STORAGE_KEYS.STOCK_LEDGER, []);
    stockLogs = stockLogs.filter(s => s['Ref No']?.trim().toLowerCase() !== no.trim().toLowerCase() && s['Ref No']?.trim().toLowerCase() !== finalNoCN.trim().toLowerCase());
    saveJson(STORAGE_KEYS.STOCK_LEDGER, stockLogs);
  } else {
    vouchers.push(newV);
  }
  saveJson(STORAGE_KEYS.VOUCHERS, vouchers);
  syncVoucherToFirestore(newV).catch(() => {});

  if (payload.originalVoucherNo && payload.originalVoucherNo.trim().toLowerCase() !== finalNoCN.trim().toLowerCase()) {
    deleteVoucherFromFirestore(payload.originalVoucherNo.trim()).catch(() => {});
  }

  // Audit Trail Logging
  if (existIdxCN >= 0) {
    addAuditLog({
      action: 'ALTERED',
      module: 'Credit Note',
      recordId: finalNoCN,
      partyName: partyAcc,
      amount: totalAmt,
      details: `Updated Credit Note for ${partyAcc}`
    });
  } else {
    addAuditLog({
      action: 'ENTERED',
      module: 'Credit Note',
      recordId: finalNoCN,
      partyName: partyAcc,
      amount: totalAmt,
      details: `Created Credit Note for ${partyAcc}`
    });
  }

  // 2. Adjust financial balances (Dr Sales Return / Taxes, Cr Party/Customer)
  adjustLedgerBalance(salesReturnAcc, taxableAmt, 'Dr', finalNoCN, narr, 'CN');
  if (gstAmt > 0) {
    adjustLedgerBalance(cfg.EnableGSTInputTax === 'true' ? 'GST Output' : 'GST Payable', gstAmt, 'Dr', finalNoCN, 'GST Reversal ' + finalNoCN, 'CN');
  }
  adjustLedgerBalance(partyAcc, totalAmt, 'Cr', finalNoCN, narr, 'CN');

  // 3. If items returned to inventory, add stock back in
  if (payload.returnStock && payload.items && payload.items.length > 0) {
    payload.items.forEach(it => {
      const q = Number(it.qty) || 0;
      if (q > 0) {
        const nq = updateItemStock(it.itemCode, q, it.unit);
        logStock(it.itemCode, it.itemName, 'Credit Note (Return)', q, 0, nq, finalNoCN, it.unit);
      }
    });
  }

  const updatedItems = loadJson<Item[]>(STORAGE_KEYS.ITEMS, DEFAULT_ITEMS);
  const updatedLedgers = loadJson<Ledger[]>(STORAGE_KEYS.LEDGERS, DEFAULT_LEDGERS);
  return { ok: true, voucherNo: finalNoCN, items: updatedItems, ledgers: updatedLedgers };
}

export function saveDebitNote(payload: {
  voucherNo?: string;
  originalVoucherNo?: string;
  date?: string;
  supplierLedger: string;
  purchaseReturnLedger?: string;
  originalBillRef?: string;
  amount: number;
  taxable?: number;
  gstAmt?: number;
  narration?: string;
  returnStock?: boolean;
  items?: Array<{
    itemCode: string;
    itemName: string;
    unit?: string;
    qty: number;
    rate?: number;
    discount?: number;
    gstPct?: number;
    amount?: number;
  }>;
}) {
  const cfg = loadJson<Config>(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
  const px = getVoucherPrefix('DN', cfg);
  let no = (payload.originalVoucherNo || payload.voucherNo)?.trim();
  if (!no) {
    no = px + nextCounter('DebitNote');
  }

  const dateIso = payload.date || new Date().toISOString();
  
  const finalNo = payload.voucherNo?.trim() || no;
  const purchaseReturnAcc = payload.purchaseReturnLedger || 'Purchase Account';
  const supplierAcc = payload.supplierLedger;
  const totalAmt = round2(Number(payload.amount) || 0);
  let gstAmt = round2(Number(payload.gstAmt) || 0);
  if (!gstAmt && payload.items && payload.items.length > 0) {
    gstAmt = round2(payload.items.reduce((sum, it) => {
      const q = Number(it.qty) || 0;
      const r = Number(it.rate) || 0;
      const d = Number(it.discount) || 0;
      const g = Number(it.gstPct) || 0;
      const lineVal = (q * r) - d;
      return sum + ((lineVal * g) / 100);
    }, 0));
  }
  let taxableAmt = round2(Number(payload.taxable) || 0);
  if (!taxableAmt) {
    taxableAmt = round2(totalAmt - gstAmt);
  }
  const narr = payload.narration || `Debit Note against ${payload.originalBillRef || 'Purchase Return'}`;

  // 1. Save voucher entry
  const vouchers = loadJson<Voucher[]>(STORAGE_KEYS.VOUCHERS, []);
  const newV: Voucher = {
    voucherNo: finalNo,
    date: dateIso,
    type: 'DN',
    debitLedger: supplierAcc,
    creditLedger: purchaseReturnAcc,
    partyName: supplierAcc,
    supplierGstNo: (payload as any).supplierGstNo || '',
    originalInvoiceRef: payload.originalBillRef || '',
    amount: totalAmt,
    taxable: taxableAmt,
    taxableAmount: taxableAmt,
    gstAmt: gstAmt,
    gstAmount: gstAmt,
    narration: narr,
    lines: [
      { type: 'Dr', ledger: supplierAcc, amount: totalAmt, narration: `Debit charged to ${supplierAcc}` },
      { type: 'Cr', ledger: purchaseReturnAcc, amount: taxableAmt, narration: 'Purchase Return' },
      ...(gstAmt > 0 ? [{ type: 'Cr' as const, ledger: cfg.EnableGSTInputTax === 'true' ? 'GST Input' : 'Duties & Taxes', amount: gstAmt, narration: 'GST Input Reversal' }] : [])
    ],
    items: payload.items
  };
  const existIdxDN = vouchers.findIndex(x => x.voucherNo?.trim().toLowerCase() === no.trim().toLowerCase() || x.voucherNo?.trim().toLowerCase() === finalNo.trim().toLowerCase());
  if (existIdxDN >= 0) {
    vouchers[existIdxDN] = newV;
    let logs = loadJson<LedgerLogEntry[]>(STORAGE_KEYS.LEDGER_LOG, []);
    logs = logs.filter(l => l['Ref No']?.trim().toLowerCase() !== no.trim().toLowerCase() && l['Ref No']?.trim().toLowerCase() !== finalNo.trim().toLowerCase());
    saveJson(STORAGE_KEYS.LEDGER_LOG, logs);
    let stockLogs = loadJson<StockLedgerEntry[]>(STORAGE_KEYS.STOCK_LEDGER, []);
    stockLogs = stockLogs.filter(s => s['Ref No']?.trim().toLowerCase() !== no.trim().toLowerCase() && s['Ref No']?.trim().toLowerCase() !== finalNo.trim().toLowerCase());
    saveJson(STORAGE_KEYS.STOCK_LEDGER, stockLogs);
  } else {
    vouchers.push(newV);
  }
  saveJson(STORAGE_KEYS.VOUCHERS, vouchers);
  syncVoucherToFirestore(newV).catch(() => {});

  if (payload.originalVoucherNo && payload.originalVoucherNo.trim().toLowerCase() !== finalNo.trim().toLowerCase()) {
    deleteVoucherFromFirestore(payload.originalVoucherNo.trim()).catch(() => {});
  }

  // Audit Trail Logging
  if (existIdxDN >= 0) {
    addAuditLog({
      action: 'ALTERED',
      module: 'Debit Note',
      recordId: finalNo,
      partyName: supplierAcc,
      amount: totalAmt,
      details: `Updated Debit Note for ${supplierAcc}`
    });
  } else {
    addAuditLog({
      action: 'ENTERED',
      module: 'Debit Note',
      recordId: finalNo,
      partyName: supplierAcc,
      amount: totalAmt,
      details: `Created Debit Note for ${supplierAcc}`
    });
  }

  // 2. Adjust financial balances (Dr Supplier/Vendor, Cr Purchase Return / Taxes)
  adjustLedgerBalance(supplierAcc, totalAmt, 'Dr', finalNo, narr, 'DN');
  adjustLedgerBalance(purchaseReturnAcc, taxableAmt, 'Cr', finalNo, narr, 'DN');
  if (gstAmt > 0) {
    adjustLedgerBalance(cfg.EnableGSTInputTax === 'true' ? 'GST Input' : 'Duties & Taxes', gstAmt, 'Cr', finalNo, 'GST Input Reversal ' + finalNo, 'DN');
  }

  // 3. If items returned to supplier, deduct stock out
  if (payload.returnStock && payload.items && payload.items.length > 0) {
    payload.items.forEach(it => {
      const q = Number(it.qty) || 0;
      if (q > 0) {
        const nq = updateItemStock(it.itemCode, -q, it.unit);
        logStock(it.itemCode, it.itemName, 'Debit Note (Return)', 0, q, nq, finalNo, it.unit);
      }
    });
  }

  const updatedItems = loadJson<Item[]>(STORAGE_KEYS.ITEMS, DEFAULT_ITEMS);
  const updatedLedgers = loadJson<Ledger[]>(STORAGE_KEYS.LEDGERS, DEFAULT_LEDGERS);
  return { ok: true, voucherNo: finalNo, items: updatedItems, ledgers: updatedLedgers };
}

// -------------------------------------------------------------
// DELIVERY NOTE / CHALLAN HANDLERS
// -------------------------------------------------------------
export function getDeliveryNotes(): DeliveryNote[] {
  const list = loadJson<DeliveryNote[]>(STORAGE_KEYS.DELIVERY_NOTES, []);
  return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function saveDeliveryNote(note: {
  noteNo?: string;
  originalNoteNo?: string;
  date?: string;
  customer: CustomerDetails;
  orderRefNo?: string;
  dispatchThrough?: string;
  destination?: string;
  vehicleNo?: string;
  remarks?: string;
  items: DeliveryNoteItem[];
}) {
  const cfg = loadJson<Config>(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
  const px = getVoucherPrefix('DEL_NOTE', cfg);
  let no = (note.originalNoteNo || note.noteNo)?.trim();
  if (!no) {
    no = px + nextCounter('DeliveryNote');
  }

  const dateIso = note.date || new Date().toISOString();
  const deliveryDoc: DeliveryNote = {
    noteNo: no,
    date: dateIso,
    customer: note.customer,
    orderRefNo: note.orderRefNo || '',
    dispatchThrough: note.dispatchThrough || '',
    destination: note.destination || '',
    vehicleNo: note.vehicleNo || '',
    status: 'Dispatched',
    remarks: note.remarks || '',
    items: note.items
  };

  const notes = loadJson<DeliveryNote[]>(STORAGE_KEYS.DELIVERY_NOTES, []);
  const matchTarget = (note.originalNoteNo || no).trim().toLowerCase();
  const existIdxDel = notes.findIndex(n => n.noteNo?.trim().toLowerCase() === matchTarget || n.noteNo?.trim().toLowerCase() === no.toLowerCase());
  if (existIdxDel >= 0) {
    const oldDel = notes[existIdxDel];
    // Revert previous stock deduction
    (oldDel.items || []).forEach(it => {
      const q = Number(it.qty) || 0;
      if (q > 0) {
        updateItemStock(it.itemCode, q);
      }
    });
    notes[existIdxDel] = deliveryDoc;
    let stockLogs = loadJson<StockLedgerEntry[]>(STORAGE_KEYS.STOCK_LEDGER, []);
    stockLogs = stockLogs.filter(s => s['Ref No']?.trim().toLowerCase() !== matchTarget && s['Ref No']?.trim().toLowerCase() !== no.toLowerCase());
    saveJson(STORAGE_KEYS.STOCK_LEDGER, stockLogs);
  } else {
    notes.push(deliveryDoc);
  }
  saveJson(STORAGE_KEYS.DELIVERY_NOTES, notes);

  // Deduct stock and log in stock ledger
  note.items.forEach(it => {
    const q = Number(it.qty) || 0;
    if (q > 0) {
      const nq = updateItemStock(it.itemCode, -q);
      logStock(it.itemCode, it.itemName, 'Delivery Challan', 0, q, nq, no);
    }
  });

  const updatedItems = loadJson<Item[]>(STORAGE_KEYS.ITEMS, DEFAULT_ITEMS);
  return { ok: true, noteNo: no, deliveryNote: deliveryDoc, items: updatedItems };
}

export function deleteDeliveryNote(noteNo: string) {
  let notes = loadJson<DeliveryNote[]>(STORAGE_KEYS.DELIVERY_NOTES, []);
  const target = notes.find(n => n.noteNo === noteNo);
  if (!target) return { ok: false, error: 'Delivery note not found' };

  // Reverse stock dispatch
  target.items.forEach(it => {
    const q = Number(it.qty) || 0;
    if (q > 0) {
      const nq = updateItemStock(it.itemCode, q);
      logStock(it.itemCode, it.itemName, 'Delivery Note Reversal', q, 0, nq, 'REV-' + noteNo);
    }
  });

  notes = notes.filter(n => n.noteNo !== noteNo);
  saveJson(STORAGE_KEYS.DELIVERY_NOTES, notes);

  const updatedItems = loadJson<Item[]>(STORAGE_KEYS.ITEMS, DEFAULT_ITEMS);
  return { ok: true, items: updatedItems, notes };
}

export function updateDeliveryNoteStatus(noteNo: string, status: 'Dispatched' | 'Delivered' | 'Invoiced' | 'Cancelled', invoiceNo?: string) {
  const list = loadJson<DeliveryNote[]>(STORAGE_KEYS.DELIVERY_NOTES, []);
  const cleanNo = (noteNo || '').trim().toLowerCase();
  const target = list.find(n => n.noteNo?.trim().toLowerCase() === cleanNo);
  if (target) {
    target.status = status;
    if (invoiceNo) {
      target.invoiceNo = invoiceNo;
    }
    saveJson(STORAGE_KEYS.DELIVERY_NOTES, list);
    return { ok: true, deliveryNote: target };
  }
  return { ok: false, error: 'Delivery Note not found' };
}

// -------------------------------------------------------------
// PHYSICAL STOCK VERIFICATION & RECONCILIATION HANDLERS
// -------------------------------------------------------------
export function getPhysicalStockRecords(): PhysicalStockVoucher[] {
  const list = loadJson<PhysicalStockVoucher[]>(STORAGE_KEYS.PHYSICAL_STOCK, []);
  return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function savePhysicalStockAdjustment(payload: {
  voucherNo?: string;
  originalVoucherNo?: string;
  date?: string;
  verifiedBy?: string;
  remarks?: string;
  items: PhysicalStockItem[];
}) {
  const cfg = loadJson<Config>(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
  const px = getVoucherPrefix('PHYSICAL_STOCK', cfg);
  let no = (payload.originalVoucherNo || payload.voucherNo)?.trim();
  if (!no) {
    no = px + nextCounter('PhysicalStock');
  }

  const dateIso = payload.date || new Date().toISOString();
  let totalShortage = 0;
  let totalExcess = 0;
  let netVarianceVal = 0;

  // Update physical stock in items collection and stock ledger
  const allItems = loadJson<Item[]>(STORAGE_KEYS.ITEMS, DEFAULT_ITEMS);

  payload.items.forEach(it => {
    const diff = round2(Number(it.physicalQty) - Number(it.bookQty));
    const rate = Number(it.rate) || 0;
    const varianceVal = round2(diff * rate);

    if (diff < 0) totalShortage += Math.abs(diff);
    if (diff > 0) totalExcess += diff;
    netVarianceVal += varianceVal;

    // Apply stock adjustment directly to item record
    const itemTarget = allItems.find(x => x['Item Code'] === it.itemCode);
    if (itemTarget) {
      itemTarget['Current Stock'] = round2(Number(it.physicalQty));
    }

    // Log in stock ledger
    if (diff > 0) {
      logStock(it.itemCode, it.itemName, 'Physical Stock Excess', diff, 0, Number(it.physicalQty), no);
    } else if (diff < 0) {
      logStock(it.itemCode, it.itemName, 'Physical Stock Shortage', 0, Math.abs(diff), Number(it.physicalQty), no);
    }
  });

  saveJson(STORAGE_KEYS.ITEMS, allItems);

  const list = loadJson<PhysicalStockVoucher[]>(STORAGE_KEYS.PHYSICAL_STOCK, []);
  
  const finalNo = payload.voucherNo?.trim() || no;

  const doc: PhysicalStockVoucher = {
    voucherNo: finalNo,
    date: dateIso,
    verifiedBy: payload.verifiedBy || '',
    remarks: payload.remarks || '',
    totalItemsCounted: payload.items.length,
    totalShortageQty: round2(totalShortage),
    totalExcessQty: round2(totalExcess),
    netVarianceValue: round2(netVarianceVal),
    items: payload.items
  };

  const records = loadJson<PhysicalStockVoucher[]>(STORAGE_KEYS.PHYSICAL_STOCK, []);
  const existIdxPhys = records.findIndex(r => r.voucherNo?.trim().toLowerCase() === no.trim().toLowerCase() || r.voucherNo?.trim().toLowerCase() === finalNo.trim().toLowerCase());
  if (existIdxPhys >= 0) {
    records[existIdxPhys] = doc;
    let stockLogs = loadJson<StockLedgerEntry[]>(STORAGE_KEYS.STOCK_LEDGER, []);
    stockLogs = stockLogs.filter(s => s['Ref No']?.trim().toLowerCase() !== no.trim().toLowerCase() && s['Ref No']?.trim().toLowerCase() !== finalNo.trim().toLowerCase());
    saveJson(STORAGE_KEYS.STOCK_LEDGER, stockLogs);
  } else {
    records.push(doc);
  }
  saveJson(STORAGE_KEYS.PHYSICAL_STOCK, records);

  return { ok: true, voucherNo: no, record: doc, items: allItems };
}

// -------------------------------------------------------------
// QUOTATION & ESTIMATE HANDLERS
// -------------------------------------------------------------
export function getQuotations(): Quotation[] {
  const list = loadJson<Quotation[]>(STORAGE_KEYS.QUOTATIONS, []);
  return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function saveQuotation(quote: {
  quotationNo?: string;
  originalQuotationNo?: string;
  date?: string;
  validUntil?: string;
  customer: CustomerDetails;
  taxable: number;
  zeroRated: number;
  gstAmt: number;
  total: number;
  status?: 'Draft' | 'Sent' | 'Accepted' | 'Converted' | 'Expired';
  remarks?: string;
  paymentTerms?: string;
  deliveryTerms?: string;
  items: QuotationItem[];
}) {
  const cfg = loadJson<Config>(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
  const px = getVoucherPrefix('QUOTATION', cfg);
  let no = (quote.originalQuotationNo || quote.quotationNo)?.trim();
  if (!no) {
    no = px + nextCounter('Quotation');
  }

  const dateIso = quote.date || new Date().toISOString();
  
  const finalNo = quote.quotationNo?.trim() || no;

  const newQuote: Quotation = {
    quotationNo: finalNo,
    date: dateIso,
    validUntil: quote.validUntil || '',
    customer: quote.customer,
    taxable: round2(Number(quote.taxable) || 0),
    zeroRated: round2(Number(quote.zeroRated) || 0),
    gstAmt: round2(Number(quote.gstAmt) || 0),
    total: round2(Number(quote.total) || 0),
    status: quote.status || 'Sent',
    remarks: quote.remarks || '',
    paymentTerms: quote.paymentTerms || '100% against delivery / Net 15 days',
    deliveryTerms: quote.deliveryTerms || 'Immediate ex-stock / 3-5 business days',
    items: quote.items
  };

  let list = loadJson<Quotation[]>(STORAGE_KEYS.QUOTATIONS, []);
  const existingIdx = list.findIndex(q => q.quotationNo?.trim().toLowerCase() === no.trim().toLowerCase() || q.quotationNo?.trim().toLowerCase() === finalNo.trim().toLowerCase());
  if (existingIdx >= 0) {
    list[existingIdx] = newQuote;
  } else {
    list.push(newQuote);
  }
  saveJson(STORAGE_KEYS.QUOTATIONS, list);

  return { ok: true, quotationNo: no, quotation: newQuote };
}

export function updateQuotationStatus(quotationNo: string, status: 'Draft' | 'Sent' | 'Accepted' | 'Converted' | 'Expired') {
  const list = loadJson<Quotation[]>(STORAGE_KEYS.QUOTATIONS, []);
  const target = list.find(q => q.quotationNo === quotationNo);
  if (target) {
    target.status = status;
    saveJson(STORAGE_KEYS.QUOTATIONS, list);
    return { ok: true, quotation: target };
  }
  return { ok: false, error: 'Quotation not found' };
}

export function deleteQuotation(quotationNo: string) {
  let list = loadJson<Quotation[]>(STORAGE_KEYS.QUOTATIONS, []);
  list = list.filter(q => q.quotationNo !== quotationNo);
  saveJson(STORAGE_KEYS.QUOTATIONS, list);
  return { ok: true, quotations: list };
}

// -------------------------------------------------------------
// SALES ORDER HANDLERS
// -------------------------------------------------------------
export function getSalesOrders(): SalesOrder[] {
  const list = loadJson<SalesOrder[]>(STORAGE_KEYS.SALES_ORDERS, []);
  return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function saveSalesOrder(order: {
  orderNo?: string;
  originalOrderNo?: string;
  date?: string;
  deliveryDate?: string;
  customer: CustomerDetails;
  taxable: number;
  zeroRated: number;
  gstAmt: number;
  total: number;
  status?: 'Pending' | 'Confirmed' | 'Delivered' | 'Invoiced' | 'Cancelled';
  remarks?: string;
  termsAndConditions?: string;
  items: SalesOrderItem[];
}) {
  const cfg = loadJson<Config>(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
  const px = getVoucherPrefix('SALES_ORDER', cfg);
  let no = (order.originalOrderNo || order.orderNo)?.trim();
  if (!no) {
    no = px + nextCounter('SalesOrder');
  }

  const dateIso = order.date || new Date().toISOString();
  const finalNo = order.orderNo?.trim() || no;

  const newOrder: SalesOrder = {
    orderNo: finalNo,
    date: dateIso,
    deliveryDate: order.deliveryDate || '',
    customer: order.customer,
    taxable: round2(Number(order.taxable) || 0),
    zeroRated: round2(Number(order.zeroRated) || 0),
    gstAmt: round2(Number(order.gstAmt) || 0),
    total: round2(Number(order.total) || 0),
    status: order.status || 'Pending',
    remarks: order.remarks || '',
    termsAndConditions: order.termsAndConditions || '1. Goods subject to availability.\n2. Payment as per agreed terms.',
    items: order.items
  };

  let list = loadJson<SalesOrder[]>(STORAGE_KEYS.SALES_ORDERS, []);
  const existingIdx = list.findIndex(o => o.orderNo?.trim().toLowerCase() === no.trim().toLowerCase() || o.orderNo?.trim().toLowerCase() === finalNo.trim().toLowerCase());
  if (existingIdx >= 0) {
    list[existingIdx] = newOrder;
  } else {
    list.push(newOrder);
  }
  saveJson(STORAGE_KEYS.SALES_ORDERS, list);

  return { ok: true, orderNo: no, salesOrder: newOrder };
}

export function updateSalesOrderStatus(orderNo: string, status: 'Pending' | 'Confirmed' | 'Delivered' | 'Invoiced' | 'Cancelled') {
  const list = loadJson<SalesOrder[]>(STORAGE_KEYS.SALES_ORDERS, []);
  const target = list.find(o => o.orderNo === orderNo);
  if (target) {
    target.status = status;
    saveJson(STORAGE_KEYS.SALES_ORDERS, list);
    return { ok: true, salesOrder: target };
  }
  return { ok: false, error: 'Sales Order not found' };
}

export function deleteSalesOrder(orderNo: string) {
  let list = loadJson<SalesOrder[]>(STORAGE_KEYS.SALES_ORDERS, []);
  list = list.filter(o => o.orderNo !== orderNo);
  saveJson(STORAGE_KEYS.SALES_ORDERS, list);
  return { ok: true, salesOrders: list };
}

// -------------------------------------------------------------
// PURCHASE ORDER HANDLERS
// -------------------------------------------------------------
export function getPurchaseOrders(): PurchaseOrder[] {
  const list = loadJson<PurchaseOrder[]>(STORAGE_KEYS.PURCHASE_ORDERS, []);
  return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function savePurchaseOrder(po: {
  poNo?: string;
  originalPoNo?: string;
  date?: string;
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
  status?: 'Pending' | 'Approved' | 'Received' | 'Invoiced' | 'Cancelled';
  remarks?: string;
  termsAndConditions?: string;
  items: PurchaseOrderItem[];
}) {
  const cfg = loadJson<Config>(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
  const px = getVoucherPrefix('PURCHASE_ORDER', cfg);
  let no = (po.originalPoNo || po.poNo)?.trim();
  if (!no) {
    no = px + nextCounter('PurchaseOrder');
  }

  const dateIso = po.date || new Date().toISOString();
  const finalNo = po.poNo?.trim() || no;

  const newPO: PurchaseOrder = {
    poNo: finalNo,
    date: dateIso,
    expectedDate: po.expectedDate || '',
    supplier: po.supplier,
    taxable: round2(Number(po.taxable) || 0),
    zeroRated: round2(Number(po.zeroRated) || 0),
    gstAmt: round2(Number(po.gstAmt) || 0),
    total: round2(Number(po.total) || 0),
    status: po.status || 'Pending',
    remarks: po.remarks || '',
    termsAndConditions: po.termsAndConditions || '1. Delivery expected on or before specified date.\n2. Payment terms as agreed.',
    items: po.items
  };

  let list = loadJson<PurchaseOrder[]>(STORAGE_KEYS.PURCHASE_ORDERS, []);
  const existingIdx = list.findIndex(p => p.poNo?.trim().toLowerCase() === no.trim().toLowerCase() || p.poNo?.trim().toLowerCase() === finalNo.trim().toLowerCase());
  if (existingIdx >= 0) {
    list[existingIdx] = newPO;
  } else {
    list.push(newPO);
  }
  saveJson(STORAGE_KEYS.PURCHASE_ORDERS, list);

  return { ok: true, poNo: no, purchaseOrder: newPO };
}

export function updatePurchaseOrderStatus(poNo: string, status: 'Pending' | 'Approved' | 'Received' | 'Invoiced' | 'Cancelled') {
  const list = loadJson<PurchaseOrder[]>(STORAGE_KEYS.PURCHASE_ORDERS, []);
  const target = list.find(p => p.poNo === poNo);
  if (target) {
    target.status = status;
    saveJson(STORAGE_KEYS.PURCHASE_ORDERS, list);
    return { ok: true, purchaseOrder: target };
  }
  return { ok: false, error: 'Purchase Order not found' };
}

export function deletePurchaseOrder(poNo: string) {
  let list = loadJson<PurchaseOrder[]>(STORAGE_KEYS.PURCHASE_ORDERS, []);
  list = list.filter(p => p.poNo !== poNo);
  saveJson(STORAGE_KEYS.PURCHASE_ORDERS, list);
  return { ok: true, purchaseOrders: list };
}

// -------------------------------------------------------------
// RECEIPT NOTE / GOODS RECEIPT NOTE (GRN) HANDLERS
// -------------------------------------------------------------
export function getReceiptNotes(): ReceiptNote[] {
  const list = loadJson<ReceiptNote[]>(STORAGE_KEYS.RECEIPT_NOTES, []);
  return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function saveReceiptNote(note: {
  noteNo?: string;
  originalNoteNo?: string;
  poNo?: string;
  date?: string;
  supplierChallanNo?: string;
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
  status?: 'Received' | 'Invoiced' | 'Cancelled';
  remarks?: string;
  items: ReceiptNoteItem[];
}) {
  const cfg = loadJson<Config>(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
  const px = getVoucherPrefix('RECEIPT_NOTE', cfg);
  let no = (note.originalNoteNo || note.noteNo)?.trim();
  if (!no) {
    no = px + nextCounter('ReceiptNote');
  }

  const dateIso = note.date || new Date().toISOString();
  const finalNo = note.noteNo?.trim() || no;

  const doc: ReceiptNote = {
    noteNo: finalNo,
    poNo: note.poNo || '',
    date: dateIso,
    supplierChallanNo: note.supplierChallanNo || '',
    supplier: note.supplier,
    taxable: round2(Number(note.taxable) || 0),
    zeroRated: round2(Number(note.zeroRated) || 0),
    gstAmt: round2(Number(note.gstAmt) || 0),
    total: round2(Number(note.total) || 0),
    status: note.status || 'Received',
    remarks: note.remarks || '',
    items: note.items
  };

  const notes = loadJson<ReceiptNote[]>(STORAGE_KEYS.RECEIPT_NOTES, []);
  const matchTarget = (note.originalNoteNo || no).trim().toLowerCase();
  const existIdx = notes.findIndex(n => n.noteNo?.trim().toLowerCase() === matchTarget || n.noteNo?.trim().toLowerCase() === finalNo.trim().toLowerCase());

  if (existIdx >= 0) {
    const oldNote = notes[existIdx];
    // Revert previous stock addition
    (oldNote.items || []).forEach(it => {
      const q = Number(it.qty) || 0;
      if (q > 0) {
        updateItemStock(it.itemCode, -q);
      }
    });
    notes[existIdx] = doc;
    let stockLogs = loadJson<StockLedgerEntry[]>(STORAGE_KEYS.STOCK_LEDGER, []);
    stockLogs = stockLogs.filter(s => s['Ref No']?.trim().toLowerCase() !== matchTarget && s['Ref No']?.trim().toLowerCase() !== finalNo.trim().toLowerCase());
    saveJson(STORAGE_KEYS.STOCK_LEDGER, stockLogs);
  } else {
    notes.push(doc);
  }
  saveJson(STORAGE_KEYS.RECEIPT_NOTES, notes);

  // Add stock and log in stock ledger
  note.items.forEach(it => {
    const q = Number(it.qty) || 0;
    if (q > 0) {
      const nq = updateItemStock(it.itemCode, q);
      logStock(it.itemCode, it.itemName, 'Receipt Note Inward', q, 0, nq, finalNo);
    }
  });

  const updatedItems = loadJson<Item[]>(STORAGE_KEYS.ITEMS, DEFAULT_ITEMS);
  return { ok: true, noteNo: finalNo, receiptNote: doc, items: updatedItems };
}

export function updateReceiptNoteStatus(noteNo: string, status: 'Received' | 'Invoiced' | 'Cancelled') {
  const list = loadJson<ReceiptNote[]>(STORAGE_KEYS.RECEIPT_NOTES, []);
  const target = list.find(n => n.noteNo === noteNo);
  if (target) {
    target.status = status;
    saveJson(STORAGE_KEYS.RECEIPT_NOTES, list);
    return { ok: true, receiptNote: target };
  }
  return { ok: false, error: 'Receipt Note not found' };
}

export function deleteReceiptNote(noteNo: string) {
  let notes = loadJson<ReceiptNote[]>(STORAGE_KEYS.RECEIPT_NOTES, []);
  const target = notes.find(n => n.noteNo === noteNo);
  if (!target) return { ok: false, error: 'Receipt note not found' };

  // Reverse stock addition
  target.items.forEach(it => {
    const q = Number(it.qty) || 0;
    if (q > 0) {
      const nq = updateItemStock(it.itemCode, -q);
      logStock(it.itemCode, it.itemName, 'Receipt Note Reversal', 0, q, nq, 'REV-' + noteNo);
    }
  });

  notes = notes.filter(n => n.noteNo !== noteNo);
  saveJson(STORAGE_KEYS.RECEIPT_NOTES, notes);

  const updatedItems = loadJson<Item[]>(STORAGE_KEYS.ITEMS, DEFAULT_ITEMS);
  return { ok: true, items: updatedItems, notes };
}

export function getVoucherDetails(refNo: string) {
  if (!refNo) return null;
  const cleanRef = String(refNo).trim();
  const cleanRefLower = cleanRef.toLowerCase();

  // 1. Sales Invoices
  const invoices = getDeduplicatedSales();
  const inv = invoices.find(x => x.invoiceNo === cleanRef || x.invoiceNo?.trim().toLowerCase() === cleanRefLower);
  if (inv) return { type: 'INV', header: inv, items: inv.items || [] };

  // 2. Purchase Invoices
  const purchases = getDeduplicatedPurchases();
  const pur = purchases.find(x => x.billNo === cleanRef || x.invoiceNo === cleanRef || x.billNo?.trim().toLowerCase() === cleanRefLower || x.invoiceNo?.trim().toLowerCase() === cleanRefLower);
  if (pur) return { type: 'PUR', header: pur, items: pur.items || [] };

  // 3. Delivery Notes
  const notes = loadJson<DeliveryNote[]>(STORAGE_KEYS.DELIVERY_NOTES, []);
  const note = notes.find(x => x.noteNo === cleanRef || x.noteNo?.trim().toLowerCase() === cleanRefLower);
  if (note) return { type: 'DLV', header: note, items: note.items || [] };

  // 4. Physical Stock Vouchers
  const records = loadJson<PhysicalStockVoucher[]>(STORAGE_KEYS.PHYSICAL_STOCK, []);
  const rec = records.find(x => x.voucherNo === cleanRef || x.voucherNo?.trim().toLowerCase() === cleanRefLower);
  if (rec) return { type: 'PHY', header: rec, items: rec.items || [] };

  // 5. Quotations
  const quotes = loadJson<Quotation[]>(STORAGE_KEYS.QUOTATIONS, []);
  const quote = quotes.find(x => x.quotationNo === cleanRef || x.quotationNo?.trim().toLowerCase() === cleanRefLower);
  if (quote) return { type: 'QTN', header: quote, items: quote.items || [] };

  // 5b. Sales Orders
  const salesOrders = loadJson<SalesOrder[]>(STORAGE_KEYS.SALES_ORDERS, []);
  const so = salesOrders.find(x => x.orderNo === cleanRef || x.orderNo?.trim().toLowerCase() === cleanRefLower);
  if (so) return { type: 'SO', header: so, items: so.items || [] };

  // 5c. Purchase Orders
  const purchaseOrders = loadJson<PurchaseOrder[]>(STORAGE_KEYS.PURCHASE_ORDERS, []);
  const po = purchaseOrders.find(x => x.poNo === cleanRef || x.poNo?.trim().toLowerCase() === cleanRefLower);
  if (po) return { type: 'PO', header: po, items: po.items || [] };

  // 5d. Receipt Notes
  const receiptNotes = loadJson<ReceiptNote[]>(STORAGE_KEYS.RECEIPT_NOTES, []);
  const grn = receiptNotes.find(x => x.noteNo === cleanRef || x.noteNo?.trim().toLowerCase() === cleanRefLower);
  if (grn) return { type: 'GRN', header: grn, items: grn.items || [] };

  // 6. Check Monthly Payrolls directly
  const payrolls = loadJson<MonthlyPayroll[]>(STORAGE_KEYS.MONTHLY_PAYROLLS, []);
  const matchingPayroll = payrolls.find(
    p =>
      p.voucherRefNo === cleanRef ||
      p.id === cleanRef ||
      cleanRef === `JV-PAY-${p.id}` ||
      cleanRef === `JV-PAY-${p.monthYear.replace(/\s+/g, '-')}`
  );

  if (matchingPayroll) {
    const items = matchingPayroll.entries.map(e => ({
      code: e.empCode || e.empId,
      name: `${e.fullName} (${e.designation || 'Staff'})`,
      rate: e.netPay,
      qty: 1,
      total: e.netPay,
      remarks: `Gross: Nu. ${e.grossPay.toLocaleString('en-IN')}, Deductions: Nu. ${e.totalDeductions.toLocaleString('en-IN')}`
    }));

    let postDate = new Date();
    if (matchingPayroll.processedDate) {
      postDate = new Date(matchingPayroll.processedDate);
    } else if (matchingPayroll.year && matchingPayroll.month) {
      postDate = new Date(matchingPayroll.year, matchingPayroll.month, 0, 18, 0, 0, 0);
    }

    // Deduction totals
    let totalNPPF = 0, totalGIS = 0, totalPIT = 0, totalHealth = 0, totalAdvance = 0, totalLoan = 0;
    matchingPayroll.entries.forEach(e => {
      e.deductions.forEach(d => {
        const name = d.payHeadName.toLowerCase();
        if (name.includes('nppf') || name.includes('provident')) totalNPPF += d.amount;
        else if (name.includes('gis') || name.includes('insurance')) totalGIS += d.amount;
        else if (name.includes('pit') || name.includes('tax')) totalPIT += d.amount;
        else if (name.includes('health')) totalHealth += d.amount;
        else if (name.includes('advance')) totalAdvance += d.amount;
        else if (name.includes('loan')) totalLoan += d.amount;
      });
    });

    const lines: Array<{ ledger: string; type: 'Dr' | 'Cr'; amount: number; narration?: string }> = [
      { ledger: 'Salaries & Wages Expense', type: 'Dr', amount: matchingPayroll.totalGrossPay, narration: `Gross Staff Pay for ${matchingPayroll.monthYear}` },
      { ledger: 'Salary Payable', type: 'Cr', amount: matchingPayroll.totalNetPay, narration: `Net Salary Payable to Employees for ${matchingPayroll.monthYear}` }
    ];
    if (totalNPPF > 0) lines.push({ ledger: 'NPPF Payable', type: 'Cr', amount: totalNPPF, narration: 'NPPF Provident Fund Deduction' });
    if (totalGIS > 0) lines.push({ ledger: 'GIS Payable', type: 'Cr', amount: totalGIS, narration: 'GIS Group Insurance Deduction' });
    if (totalPIT > 0) lines.push({ ledger: 'PIT Payable', type: 'Cr', amount: totalPIT, narration: 'PIT Personal Income Tax' });
    if (totalHealth > 0) lines.push({ ledger: 'Health Contribution Payable', type: 'Cr', amount: totalHealth, narration: 'Health Contribution (1% Gross)' });
    if (totalAdvance > 0) lines.push({ ledger: 'Salary Advance Recovery', type: 'Cr', amount: totalAdvance, narration: 'Salary Advance Recovery' });
    if (totalLoan > 0) lines.push({ ledger: 'Staff Loan Recovery', type: 'Cr', amount: totalLoan, narration: 'Staff Loan EMI Recovery' });

    const header = {
      voucherNo: cleanRef,
      date: postDate.toISOString(),
      type: 'J',
      partyLedger: 'Salaries & Wages Expense',
      totalAmount: matchingPayroll.totalGrossPay,
      amount: matchingPayroll.totalGrossPay,
      narration: `Monthly Salary Journal Voucher for ${matchingPayroll.monthYear}. Total Gross Nu. ${matchingPayroll.totalGrossPay.toLocaleString('en-IN')}, Net Nu. ${matchingPayroll.totalNetPay.toLocaleString('en-IN')}`,
      lines
    };

    return { type: 'J', header, items };
  }

  // 7. Standard Vouchers (Payment, Receipt, Journal, Contra, Credit Note, Debit Note)
  const vouchers = loadJson<Voucher[]>(STORAGE_KEYS.VOUCHERS, []);
  const v = vouchers.find(x => x.voucherNo === cleanRef || x.voucherNo?.trim().toLowerCase() === cleanRefLower);
  if (v) {
    // If lines not present in voucher, attempt to reconstruct from LEDGER_LOG
    if (!v.lines || v.lines.length === 0) {
      const logs = loadJson<LedgerLogEntry[]>(STORAGE_KEYS.LEDGER_LOG, []);
      const matchedLogs = logs.filter(l => l['Ref No'] === cleanRef);
      if (matchedLogs.length > 0) {
        const reconstructedLines = matchedLogs.map(l => ({
          ledger: l['Ledger Name'],
          type: (Number(l.Debit) > 0 ? 'Dr' : 'Cr') as 'Dr' | 'Cr',
          amount: Number(l.Debit) > 0 ? Number(l.Debit) : Number(l.Credit),
          narration: l.Narration
        }));
        return {
          type: v.type,
          header: { ...v, lines: reconstructedLines },
          items: v.items || []
        };
      }
    }
    return { type: v.type, header: v, items: v.items || [] };
  }

  // 8. Reconstruct from Ledger Logs if voucher not in VOUCHERS table
  const logs = loadJson<LedgerLogEntry[]>(STORAGE_KEYS.LEDGER_LOG, []);
  const matchedLogs = logs.filter(l => l['Ref No'] === cleanRef);
  if (matchedLogs.length > 0) {
    const totalDr = matchedLogs.reduce((acc, cur) => acc + (Number(cur.Debit) || 0), 0);
    const firstDate = matchedLogs[0].DateIso;
    const firstNarration = matchedLogs.find(l => l.Narration)?.Narration || '';
    const reconstructedLines = matchedLogs.map(l => ({
      ledger: l['Ledger Name'],
      type: (Number(l.Debit) > 0 ? 'Dr' : 'Cr') as 'Dr' | 'Cr',
      amount: Number(l.Debit) > 0 ? Number(l.Debit) : Number(l.Credit),
      narration: l.Narration
    }));

    return {
      type: cleanRef.startsWith('JV') ? 'J' : cleanRef.startsWith('PV') ? 'P' : cleanRef.startsWith('RV') ? 'R' : 'J',
      header: {
        voucherNo: cleanRef,
        date: firstDate,
        totalAmount: totalDr,
        amount: totalDr,
        narration: firstNarration,
        lines: reconstructedLines
      },
      items: []
    };
  }

  return null;
}

export function getItemStockLedger(code: string, fromDate?: string, toDate?: string, branchId?: string, godownId?: string): StockLedgerEntry[] {
  const items = loadJson<Item[]>(STORAGE_KEYS.ITEMS, DEFAULT_ITEMS);
  const cleanCode = (code || '').trim().toLowerCase();
  const it = items.find(i => String(i['Item Code'] || '').trim().toLowerCase() === cleanCode || String(i['Item Name'] || '').trim().toLowerCase() === cleanCode);
  if (it && it['Maintain Stock'] === 'N') return [];

  const godownsList = getGodowns();
  const targetGodown = godownId ? godownsList.find(g => g.id === godownId) : null;

  let baseOpening = 0;
  if (it) {
    if (godownId) {
      const explicitAlloc = (it.branchAllocations || []).find((a: any) => a.godownId === godownId);
      if (explicitAlloc) {
        baseOpening = Number(explicitAlloc.openingStock) || 0;
      } else if (targetGodown && targetGodown.isDefault) {
        const branchAlloc = (it.branchAllocations || []).find((a: any) => a.branchId === targetGodown.branchId && !a.godownId);
        if (branchAlloc) {
          baseOpening = Number(branchAlloc.openingStock) || 0;
        } else if (!it.branchAllocations || it.branchAllocations.length === 0) {
          baseOpening = Number(it['Opening Stock']) || 0;
        }
      }
    } else if (branchId) {
      const bAllocs = (it.branchAllocations || []).filter((a: any) => a.branchId === branchId);
      if (bAllocs.length > 0) {
        baseOpening = bAllocs.reduce((sum: number, a: any) => sum + (Number(a.openingStock) || 0), 0);
      } else if (!it.branchAllocations || it.branchAllocations.length === 0) {
        baseOpening = Number(it['Opening Stock']) || 0;
      }
    } else {
      baseOpening = Number(it['Opening Stock']) || 0;
    }
  }

  const rawLogs = loadJson<StockLedgerEntry[]>(STORAGE_KEYS.STOCK_LEDGER, []);
  
  // Find all sales invoices that were issued against delivery notes
  const sales = getDeduplicatedSales();
  const deliveryNotes = loadJson<DeliveryNote[]>(STORAGE_KEYS.DELIVERY_NOTES, []);
  const dnInvoices = new Set<string>();
  sales.forEach(s => {
    if (s.deliveryNoteNo && s.deliveryNoteNo.trim()) {
      dnInvoices.add((s.invoiceNo || '').trim().toLowerCase());
    }
  });
  deliveryNotes.forEach(dn => {
    if (dn.invoiceNo && dn.invoiceNo.trim()) {
      dnInvoices.add(dn.invoiceNo.trim().toLowerCase());
    }
  });

  // Filter out any duplicate 'Sale' logs where the sale was made against a delivery note (since the delivery challan already deducted stock)
  const sanitizedLogs = rawLogs.filter(r => {
    const isSale = r.Type === 'Sale' || r.Type === 'Sales' || r.Type === 'Sale Invoice';
    if (isSale && r['Ref No']) {
      const ref = r['Ref No'].trim().toLowerCase();
      if (dnInvoices.has(ref)) {
        return false;
      }
    }
    return true;
  });

  // Filter by item code, and by godown / branch if specified
  let itemLogs = sanitizedLogs
    .filter(r => String(r['Item Code'] || '').trim().toLowerCase() === cleanCode || String(r['Item Name'] || '').trim().toLowerCase() === cleanCode);

  if (godownId) {
    itemLogs = itemLogs.filter(r => {
      if (r.godownId === godownId) return true;
      if (!r.godownId && targetGodown && r.branchId === targetGodown.branchId && targetGodown.isDefault) return true;
      return false;
    });
  } else if (branchId) {
    itemLogs = itemLogs.filter(r => r.branchId === branchId);
  }

  // Sort everything chronologically
  itemLogs = itemLogs.sort((a, b) => new Date(a.DateIso).getTime() - new Date(b.DateIso).getTime());

  // Check if there is an explicit Opening log entry
  const hasOpeningEntry = itemLogs.some(r => r.Type === 'Opening' || (r['Ref No'] && r['Ref No'].startsWith('OPENING')));

  const finalLogs: StockLedgerEntry[] = [];
  
  const fromMs = fromDate ? new Date(fromDate).setHours(0,0,0,0) : 0;
  const toMs = toDate ? new Date(toDate).setHours(23,59,59,999) : 9999999999999;
  
  let runningBalance = hasOpeningEntry ? 0 : baseOpening;
  let openingBalAtFromDate = runningBalance;
  
  // First pass: Calculate running balance and find opening balance at fromDate
  itemLogs.forEach(r => {
    const qIn = Number(r['Qty In']) || 0;
    const qOut = Number(r['Qty Out']) || 0;
    const logTime = new Date(r.DateIso).getTime();
    
    if (r.Type === 'Opening' || (r['Ref No'] && r['Ref No'].startsWith('OPENING'))) {
      runningBalance = qIn || baseOpening;
      if (logTime < fromMs) openingBalAtFromDate = runningBalance;
    } else {
      runningBalance += (qIn - qOut);
      if (logTime < fromMs) openingBalAtFromDate = runningBalance;
    }
  });

  // Reset and build final logs in period
  runningBalance = openingBalAtFromDate;
  
  if (fromDate) {
    finalLogs.push({
      DateIso: new Date(fromDate).toISOString(),
      'Item Code': it ? it['Item Code'] : code,
      'Item Name': it ? it['Item Name'] : code,
      Type: 'Opening Balance',
      'Qty In': openingBalAtFromDate >= 0 ? openingBalAtFromDate : 0,
      'Qty Out': openingBalAtFromDate < 0 ? Math.abs(openingBalAtFromDate) : 0,
      Balance: openingBalAtFromDate,
      'Ref No': 'OPENING',
      branchId: targetGodown?.branchId || branchId,
      godownId: godownId,
      godownName: targetGodown?.name
    });
  } else if (!hasOpeningEntry && it) {
    finalLogs.push({
      DateIso: new Date(2025, 0, 1).toISOString(),
      'Item Code': it['Item Code'],
      'Item Name': it['Item Name'],
      Type: 'Opening Balance',
      'Qty In': baseOpening,
      'Qty Out': 0,
      Balance: baseOpening,
      'Ref No': it['Opening Serials'] && it['Opening Serials'].trim() ? `OPENING (${it['Opening Serials']})` : 'OPENING',
      branchId: targetGodown?.branchId || branchId,
      godownId: godownId,
      godownName: targetGodown?.name
    });
  }

  itemLogs.forEach(r => {
    const logTime = new Date(r.DateIso).getTime();
    if (logTime >= fromMs && logTime <= toMs) {
      const qIn = Number(r['Qty In']) || 0;
      const qOut = Number(r['Qty Out']) || 0;
      
      if (r.Type === 'Opening' || (r['Ref No'] && r['Ref No'].startsWith('OPENING'))) {
        runningBalance = qIn || baseOpening;
      } else {
        runningBalance += (qIn - qOut);
      }
      
      finalLogs.push({
        ...r,
        Balance: runningBalance
      });
    }
  });

  return finalLogs;
}

export function getFullLedgerStatement(name: string, fromDate?: string, toDate?: string) {
  syncPayrollToAccounting();
  const ledgers = loadJson<Ledger[]>(STORAGE_KEYS.LEDGERS, DEFAULT_LEDGERS);
  const cleanTarget = (name || '').trim().toLowerCase();
  const l = ledgers.find(x => (x['Ledger Name'] || '').trim().toLowerCase() === cleanTarget);
  const masterOp = l ? (Number(l['Opening Balance']) || 0) * (l['Balance Type (Dr/Cr)'] === 'Cr' ? -1 : 1) : 0;
  const logs = loadJson<LedgerLogEntry[]>(STORAGE_KEYS.LEDGER_LOG, []);
  const sales = getDeduplicatedSales();
  const purchases = getDeduplicatedPurchases();
  const vouchers = loadJson<Voucher[]>(STORAGE_KEYS.VOUCHERS, []);

  // Filter logs for this ledger and sort chronologically
  const targetLogs = logs
    .filter(r => (r['Ledger Name'] || '').trim().toLowerCase() === cleanTarget)
    .sort((a, b) => new Date(a.DateIso).getTime() - new Date(b.DateIso).getTime());

  let periodOpBal = masterOp;
  const periodLogs: typeof targetLogs = [];

  targetLogs.forEach(r => {
    let logDateStr = '';
    const rawDate = r.DateIso || (r as any).Date || (r as any).date || '';
    if (rawDate) {
      const dt = new Date(rawDate);
      if (!isNaN(dt.getTime())) {
        const y = dt.getFullYear();
        const m = String(dt.getMonth() + 1).padStart(2, '0');
        const d = String(dt.getDate()).padStart(2, '0');
        logDateStr = `${y}-${m}-${d}`;
      } else if (typeof rawDate === 'string') {
        // Handle YYYYMMDD if possible
        if (rawDate.length === 8 && !rawDate.includes('-')) {
            logDateStr = `${rawDate.substring(0,4)}-${rawDate.substring(4,6)}-${rawDate.substring(6,8)}`;
        } else {
            logDateStr = rawDate.split('T')[0];
        }
      }
    }

    const ref = r['Ref No'] || '';
    const sale = sales.find(s => s.invoiceNo === ref);
    const pur = purchases.find(p => p.billNo === ref || p.invoiceNo === ref);
    const v = vouchers.find(v => v.voucherNo === ref);
    const isCancelled = (sale?.status === 'Cancelled') || (pur?.status === 'Cancelled') || ((v as any)?.status === 'Cancelled');

    if (!logDateStr) {
      // If no valid date, we can't accurately filter. Assume it belongs to the period so it's visible, 
      // but maybe it should be opening balance. Let's treat it as opening balance to hide it from period if dates are required.
      if (!isCancelled && fromDate) {
        const dr = Number(r.Debit) || 0;
        const cr = Number(r.Credit) || 0;
        periodOpBal += (dr - cr);
      } else if (!fromDate) {
        periodLogs.push(r);
      }
    } else if (fromDate && logDateStr < fromDate) {
      if (!isCancelled) {
        const dr = Number(r.Debit) || 0;
        const cr = Number(r.Credit) || 0;
        periodOpBal += (dr - cr);
      }
    } else if (toDate && logDateStr > toDate) {
      // Entry is beyond period end date
    } else {
      periodLogs.push(r);
    }
  });

  const rows = periodLogs.map(r => {
    let party = '';
    let paymentMode = '';
    let voucherStatus = '';
    const ref = r['Ref No'] || '';

    const sale = sales.find(s => s.invoiceNo === ref);
    if (sale) {
      party = typeof sale.customer === 'object' ? (sale.customer.name || sale.customer.ledger) : (sale.customer || '');
      const modes: string[] = [];
      if (Number(sale.cash) > 0) modes.push('Cash');
      if (Number(sale.bank1) > 0) modes.push(sale.paymentDetails?.bank1Ledger || 'Bank (BOB)');
      if (Number(sale.bank2) > 0) modes.push(sale.paymentDetails?.bank2Ledger || 'Bank (BNBL)');
      if (Number(sale.credit) > 0) modes.push('Credit / Due');
      paymentMode = modes.join(', ') || (sale.status === 'Paid' ? 'Cash' : 'Credit');
      voucherStatus = sale.status || '';
    }

    const pur = purchases.find(p => p.billNo === ref || p.invoiceNo === ref);
    if (pur) {
      party = typeof pur.supplier === 'object' ? (pur.supplier.name || (pur.supplier as any).ledger) : (pur.supplier || '');
      const modes: string[] = [];
      if (Number(pur.cash) > 0) modes.push('Cash');
      if (Number(pur.bank1) > 0) modes.push(pur.paymentDetails?.bank1Ledger || 'Bank (BOB)');
      if (Number(pur.bank2) > 0) modes.push(pur.paymentDetails?.bank2Ledger || 'Bank (BNBL)');
      if (Number(pur.credit) > 0) modes.push('Credit / Due');
      paymentMode = modes.join(', ') || (pur.status === 'Paid' ? 'Cash' : 'Credit');
      voucherStatus = pur.status || '';
    }

    const v = vouchers.find(v => v.voucherNo === ref);
    if (v) {
      party = v.lines?.find(l => (l.ledger || '').trim().toLowerCase() !== cleanTarget)?.ledger || (v.debitLedger === name ? v.creditLedger : v.debitLedger) || '';
      paymentMode = (v as any).mode || (v.type === 'P' || v.type === 'R' ? 'Cash / Bank' : 'Journal');
      voucherStatus = (v as any).status || '';
    }

    const isCancelled = voucherStatus === 'Cancelled';

    return {
      ...r,
      Party: party,
      PaymentMode: paymentMode,
      Status: voucherStatus || (isCancelled ? 'Cancelled' : 'Active'),
      isCancelled,
      Debit: isCancelled ? 0 : r.Debit,
      Credit: isCancelled ? 0 : r.Credit
    };
  });

  return { openingBalance: periodOpBal, rows };
}

export function getDeduplicatedSales(targetCompanyId?: string): SalesInvoice[] {
  const cId = targetCompanyId || getActiveCompanyId();
  const sales = loadJson<SalesInvoice[]>(STORAGE_KEYS.SALES_INVOICES, [], cId);
  const map = new Map<string, SalesInvoice>();
  sales.forEach(s => {
    if (s && s.invoiceNo) {
      if (!map.has(s.invoiceNo) || map.get(s.invoiceNo)?.status === 'Cancelled' || s.status !== 'Cancelled') {
        map.set(s.invoiceNo, s);
      }
    }
  });
  return Array.from(map.values());
}

export function getDeduplicatedPurchases(targetCompanyId?: string): PurchaseInvoice[] {
  const cId = targetCompanyId || getActiveCompanyId();
  const purchases = loadJson<PurchaseInvoice[]>(STORAGE_KEYS.PURCHASE_INVOICES, [], cId);
  const map = new Map<string, PurchaseInvoice>();
  purchases.forEach(p => {
    const bNo = p.billNo || p.invoiceNo;
    if (bNo) {
      if (!map.has(bNo) || map.get(bNo)?.status === 'Cancelled' || p.status !== 'Cancelled') {
        map.set(bNo, p);
      }
    } else {
      map.set(Math.random().toString(), p);
    }
  });
  return Array.from(map.values());
}

export function getDailyColumnarReport(from: string, to: string, flt?: { itemWise?: boolean; gstOnly?: boolean; includeSalesReturn?: boolean }) {
  const fr = new Date(from).setHours(0, 0, 0, 0);
  const toDt = new Date(to).setHours(23, 59, 59, 999);
  const sales = getDeduplicatedSales();
  const vouchers = loadJson<Voucher[]>(STORAGE_KEYS.VOUCHERS, []);
  const cfg = loadJson<Config>(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG as any);

  let rows = sales.filter(r => {
    const d = new Date(r.date).getTime();
    return d >= fr && d <= toDt;
  });

  if (flt && flt.gstOnly) {
    rows = rows.filter(r => Number(r.gstAmt) > 0);
  }

  // Retrieve Sales Returns (Credit Notes) within selected date range
  const shouldIncludeReturns = flt?.includeSalesReturn !== false;
  const creditNotes = shouldIncludeReturns ? vouchers.filter(v => {
    const vType = v.type as any;
    if (vType !== 'CN' && vType !== 'Credit Note' && (v as any).voucherTypeName !== 'Credit Note' && vType !== 'Sales Return') return false;
    const rawDate = (v as any).DateIso || v.date || (v as any).Date;
    if (!rawDate) return false;
    const d = new Date(rawDate).getTime();
    return !isNaN(d) && d >= fr && d <= toDt;
  }) : [];

  if (flt && flt.itemWise) {
    const map: Record<string, { itemName: string; qty: number; taxable: number; gst: number; total: number }> = {};
    
    // Add positive sales items
    rows.filter(r => (r.status as string) !== 'Cancelled').forEach(inv => {
      if (inv.items) {
        inv.items.forEach(si => {
          const k = si['Item Name'];
          if (!map[k]) map[k] = { itemName: k, qty: 0, taxable: 0, gst: 0, total: 0 };
          map[k].qty += Number(si.Qty) || 0;
          map[k].taxable += Number(si['Taxable Value']) || 0;
          map[k].gst += Number(si['GST Amount']) || 0;
          map[k].total += Number(si['Line Total']) || 0;
        });
      }
    });

    let returnQtySum = 0;
    let returnTaxableSum = 0;
    let returnGstSum = 0;
    let returnTotalSum = 0;

    // Deduct returns from items
    creditNotes.filter(v => v.status !== 'Cancelled').forEach(v => {
      if (v.items && v.items.length > 0) {
        v.items.forEach((it: any) => {
          const k = it.itemName || it['Item Name'] || 'Returned Item';
          const q = Number(it.qty || it.Qty) || 0;
          const r = Number(it.rate || it.Rate || it.price) || 0;
          const d = Number(it.discount || it.Discount) || 0;
          const gP = Number(it.gstPct || it['GST %']) || 0;
          const lineVal = (q * r) - d;
          const lineGst = (lineVal * gP) / 100;
          const lineTot = lineVal + lineGst;

          returnQtySum += q;
          returnTaxableSum += lineVal;
          returnGstSum += lineGst;
          returnTotalSum += lineTot;

          if (!map[k]) map[k] = { itemName: k, qty: 0, taxable: 0, gst: 0, total: 0 };
          map[k].qty -= q;
          map[k].taxable -= lineVal;
          map[k].gst -= lineGst;
          map[k].total -= lineTot;
        });
      } else {
        const totAmt = Number(v.amount || (v as any).totalAmount) || 0;
        const gstVal = Number((v as any).gstAmt || (v as any).gstAmount) || 0;
        const taxVal = Number((v as any).taxable || (v as any).taxableAmount) || (totAmt - gstVal);
        returnTaxableSum += taxVal;
        returnGstSum += gstVal;
        returnTotalSum += totAmt;
      }
    });

    const ir = Object.values(map);
    const grossQty = ir.reduce((s, r) => s + (r.qty > 0 ? r.qty : 0), 0);
    const grossTaxable = ir.reduce((s, r) => s + (r.taxable > 0 ? r.taxable : 0), 0);
    const grossGst = ir.reduce((s, r) => s + (r.gst > 0 ? r.gst : 0), 0);
    const grossTotal = ir.reduce((s, r) => s + (r.total > 0 ? r.total : 0), 0);

    const totals = ir.reduce((a, r) => { a.qty += r.qty; a.taxable += r.taxable; a.gst += r.gst; a.total += r.total; return a; }, { qty: 0, taxable: 0, gst: 0, total: 0 });

    return {
      mode: 'itemwise' as const,
      rows: ir,
      totals: {
        ...totals,
        grossQty,
        returnQty: returnQtySum,
        grossTaxable,
        returnTaxable: returnTaxableSum,
        grossGst,
        returnGst: returnGstSum,
        grossSales: grossTotal,
        salesReturns: returnTotalSum,
        netSales: totals.total
      }
    };
  }

  // Bill-wise Columnar Mode
  let grossSales = 0;
  const data: any[] = rows.map(r => {
    const isCancelled = (r.status as string) === 'Cancelled';
    let cust = r.customer ? (typeof r.customer === 'object' ? (r.customer.ledger || r.customer.name) : r.customer) : 'Cash Customer';
    if (isCancelled) cust += ' (Cancelled)';
    const totalVal = isCancelled ? 0 : (Number(r.total) || 0);
    if (!isCancelled) grossSales += totalVal;

    return {
      date: r.date,
      invoiceNo: r.invoiceNo,
      customer: cust,
      cash: isCancelled ? 0 : (Number(r.cash) || 0),
      bank1: isCancelled ? 0 : (Number(r.bank1) || 0),
      bank2: isCancelled ? 0 : (Number(r.bank2) || 0),
      credit: isCancelled ? 0 : (Number(r.credit) || 0),
      total: totalVal,
      status: r.status || (isCancelled ? 'Cancelled' : 'Active'),
      isCancelled,
      remarks: isCancelled ? 'Cancelled' : (r.credit > 0 ? 'Due / Credit' : 'Paid'),
      type: 'SALE'
    };
  });

  let salesReturns = 0;

  // Append Sales Returns (Credit Notes)
  creditNotes.forEach(v => {
    const isCancelled = v.status === 'Cancelled';
    const totalAmt = Number(v.amount || (v as any).totalAmount) || 0;
    if (!isCancelled) salesReturns += totalAmt;

    const party = v.partyName || v.debitLedger || v.creditLedger || 'Customer';
    const partyUpper = party.trim().toLowerCase();
    const b1Upper = (cfg.Bank1Ledger || 'BOB Account').trim().toLowerCase();
    const b2Upper = (cfg.Bank2Ledger || 'BNBL Account').trim().toLowerCase();

    let cash = 0, bank1 = 0, bank2 = 0, credit = 0;

    if (partyUpper.includes('cash')) {
      cash = isCancelled ? 0 : -totalAmt;
    } else if (partyUpper === b1Upper || partyUpper.includes('bob')) {
      bank1 = isCancelled ? 0 : -totalAmt;
    } else if (partyUpper === b2Upper || partyUpper.includes('bnbl')) {
      bank2 = isCancelled ? 0 : -totalAmt;
    } else {
      credit = isCancelled ? 0 : -totalAmt;
    }

    data.push({
      date: (v as any).DateIso || v.date,
      invoiceNo: v.voucherNo || 'CN',
      customer: `${party} (Sales Return)`,
      cash,
      bank1,
      bank2,
      credit,
      total: isCancelled ? 0 : -totalAmt,
      status: v.status || (isCancelled ? 'Cancelled' : 'Active'),
      isCancelled,
      remarks: isCancelled ? 'Cancelled' : 'Sales Return',
      type: 'CN'
    });
  });

  // Sort by date ascending
  data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const totals = data.reduce((a, r) => {
    a.cash += r.cash; a.bank1 += r.bank1; a.bank2 += r.bank2; a.credit += r.credit; a.total += r.total;
    return a;
  }, { cash: 0, bank1: 0, bank2: 0, credit: 0, total: 0 });

  return {
    mode: 'daily' as const,
    rows: data,
    totals: {
      ...totals,
      grossSales,
      salesReturns,
      netSales: grossSales - salesReturns
    }
  };
}

export function getGSTReport(from: string, to: string) {
  const fr = new Date(from).setHours(0, 0, 0, 0);
  const toDt = new Date(to).setHours(23, 59, 59, 999);
  const sales = getDeduplicatedSales();
  const vouchers = loadJson<Voucher[]>(STORAGE_KEYS.VOUCHERS, []);

  const rows = sales.filter(r => {
    const d = new Date(r.date).getTime();
    return d >= fr && d <= toDt;
  });

  const data: any[] = rows.map(r => {
    const isCancelled = (r.status as string) === 'Cancelled';
    let custName = r.customer ? (typeof r.customer === 'object' ? (r.customer.name || r.customer.ledger) : r.customer) : 'Cash Customer';
    if (isCancelled) custName += ' (Cancelled)';
    return {
      billNumber: r.invoiceNo,
      billDate: r.date,
      customerName: custName,
      customerGST: r.customer ? (typeof r.customer === 'object' ? (r.customer.gstNo || '') : '') : '',
      taxable: isCancelled ? 0 : (Number(r.taxable) || 0),
      zeroRated: isCancelled ? 0 : (Number(r.zeroRated) || 0),
      gstAmount: isCancelled ? 0 : (Number(r.gstAmt) || 0),
      total: isCancelled ? 0 : (Number(r.total) || 0),
      status: r.status || (isCancelled ? 'Cancelled' : 'Active'),
      isCancelled,
      remarks: isCancelled ? 'Cancelled' : 'Normal',
      type: 'SALE'
    };
  });

  // Include Credit Notes (Sales Return GST Reversals)
  vouchers.forEach(v => {
    const vType = v.type as any;
    if (vType !== 'CN' && vType !== 'Credit Note' && (v as any).voucherTypeName !== 'Credit Note' && vType !== 'Sales Return') return;
    const rawDate = (v as any).DateIso || v.date || (v as any).Date;
    if (!rawDate) return;
    const d = new Date(rawDate).getTime();
    if (isNaN(d) || d < fr || d > toDt) return;

    const isCancelled = v.status === 'Cancelled';
    const totalAmt = Number(v.amount || (v as any).totalAmount) || 0;
    
    let gstVal = Number((v as any).gstAmt || (v as any).gstAmount) || 0;
    let taxableVal = Number((v as any).taxable || (v as any).taxableAmount) || 0;

    if (!gstVal && v.lines && v.lines.length > 0) {
      const gstLine = v.lines.find(l => (l.type === 'Dr' || (l.type as string) === 'dr') && (l.ledger.toLowerCase().includes('gst') || l.ledger.toLowerCase().includes('tax')));
      if (gstLine) gstVal = Number(gstLine.amount) || 0;
    }

    if (!gstVal && v.items && v.items.length > 0) {
      gstVal = v.items.reduce((sum: number, it: any) => {
        const q = Number(it.qty || it.Qty) || 0;
        const r = Number(it.rate || it.Rate || it.price) || 0;
        const d = Number(it.discount || it.Discount) || 0;
        const gstP = Number(it.gstPct || it['GST %']) || 0;
        const lineNet = (q * r) - d;
        return sum + ((lineNet * gstP) / 100);
      }, 0);
    }

    if (!taxableVal) {
      taxableVal = Math.max(0, totalAmt - gstVal);
    }

    const party = v.partyName || v.debitLedger || v.creditLedger || 'Customer';

    data.push({
      billNumber: v.voucherNo || 'CN',
      billDate: (v as any).DateIso || v.date,
      customerName: `${party} (Sales Return)`,
      customerGST: (v as any).partyGstNo || '',
      taxable: isCancelled ? 0 : -taxableVal,
      zeroRated: 0,
      gstAmount: isCancelled ? 0 : -gstVal,
      total: isCancelled ? 0 : -totalAmt,
      status: v.status || (isCancelled ? 'Cancelled' : 'Active'),
      isCancelled,
      remarks: isCancelled ? 'Cancelled' : 'Sales Return (GST Reversal)',
      type: 'CN'
    });
  });

  data.sort((a, b) => new Date(a.billDate).getTime() - new Date(b.billDate).getTime());

  const totals = data.reduce((a, r) => {
    a.taxable += r.taxable; a.zeroRated += r.zeroRated; a.gstAmount += r.gstAmount; a.total += r.total;
    return a;
  }, { taxable: 0, zeroRated: 0, gstAmount: 0, total: 0 });

  return { rows: data, totals };
}

export function getSerialNumbersStockReport() {
  const items = loadJson<Item[]>(STORAGE_KEYS.ITEMS, DEFAULT_ITEMS);
  const purchases = getDeduplicatedPurchases();
  const sales = getDeduplicatedSales();

  const soldSerials = new Map<string, { date: string; refNo: string; customerName?: string }>();
  sales.filter(inv => (inv.status as string) !== 'Cancelled').forEach(inv => {
    const custName = typeof inv.customer === 'object' ? (inv.customer?.name || inv.customer?.ledger || '') : String(inv.customer || '');
    (inv.items || []).forEach((it: any) => {
      const sns = it.serials || (it['Serial Numbers'] ? String(it['Serial Numbers']).split(',').map((s: string) => s.trim()).filter(Boolean) : []);
      sns.forEach((s: string) => soldSerials.set(s.toLowerCase(), {
        date: inv.date,
        refNo: inv.invoiceNo || (inv as any).billNo || 'Sale',
        customerName: custName
      }));
    });
  });

  const serialRecords: Array<{
    serialNo: string;
    itemCode: string;
    itemName: string;
    group: string;
    category: string;
    status: 'In Stock' | 'Sold';
    date: string;
    refNo: string;
    supplierName?: string;
    soldDate?: string;
    soldRefNo?: string;
    customerName?: string;
  }> = [];

  items.forEach(i => {
    const sns = i['Opening Serials'] ? String(i['Opening Serials']).split(',').map(s => s.trim()).filter(Boolean) : [];
    sns.forEach(s => {
      const soldInfo = soldSerials.get(s.toLowerCase());
      serialRecords.push({
        serialNo: s,
        itemCode: i['Item Code'],
        itemName: i['Item Name'],
        group: i.Group || '',
        category: i.Category || '',
        status: soldInfo ? 'Sold' : 'In Stock',
        date: 'Opening Stock',
        refNo: 'Opening',
        supplierName: 'Opening Balance',
        soldDate: soldInfo?.date,
        soldRefNo: soldInfo?.refNo,
        customerName: soldInfo?.customerName
      });
    });
  });

  purchases.filter(p => (p.status as string) !== 'Cancelled').forEach(p => {
    const suppName = typeof p.supplier === 'object' ? (p.supplier?.name || '') : String(p.supplier || '');
    (p.items || []).forEach((it: any) => {
      const sns = it.serials || (it['Serial Numbers'] ? String(it['Serial Numbers']).split(',').map((s: string) => s.trim()).filter(Boolean) : []);
      
      const itemDef = items.find(i => i['Item Code'] === (it['Item Code'] || it.code));
      const group = itemDef?.Group || '';
      const category = itemDef?.Category || '';

      sns.forEach((s: string) => {
        const soldInfo = soldSerials.get(s.toLowerCase());
        serialRecords.push({
          serialNo: s,
          itemCode: it['Item Code'] || it.code || '',
          itemName: it['Item Name'] || it.name || '',
          group,
          category,
          status: soldInfo ? 'Sold' : 'In Stock',
          date: p.date,
          refNo: p.billNo || 'Purchase',
          supplierName: suppName,
          soldDate: soldInfo?.date,
          soldRefNo: soldInfo?.refNo,
          customerName: soldInfo?.customerName
        });
      });
    });
  });

  const map = new Map<string, typeof serialRecords[0]>();
  serialRecords.forEach(r => {
    map.set(r.serialNo.toLowerCase(), r);
  });

  return Array.from(map.values());
}

export function getAdvancedReports(type: string, from?: string, to?: string) {
  const items = loadJson<Item[]>(STORAGE_KEYS.ITEMS, DEFAULT_ITEMS);
  if (type === 'summary') {
    return items
      .filter(i => i['Maintain Stock'] !== 'N')
      .map(i => ({
        itemCode: i['Item Code'],
        itemName: i['Item Name'],
        group: i.Group,
        category: i.Category || '',
        barcode: i.Barcode || '',
        unit: i.Unit,
        currentStock: Number(i['Current Stock']) || 0,
        reorderLevel: Number(i['Reorder Level']) || 0,
        saleRate: Number(i['Sale Rate']) || 0,
        purchaseRate: Number(i['Purchase Rate']) || 0,
        wholesaleRate: Number(i['Wholesale Rate']) || 0,
        mrp: Number(i.MRP) || 0,
        gstRate: Number(i['GST %']) || 0,
        zeroRated: i['Zero Rated (Y/N)'] || 'N',
        maintainStock: i['Maintain Stock'] || 'Y',
        hsnSac: i['HSN/SAC'] || '',
        openingStock: Number(i['Opening Stock']) || 0,
        printName: i['Print Name'] || '',
        isSerialized: i['Is Serialized'] || 'N',
        rawItem: i
      }));
  }

  if (type === 'variant_summary') {
    const salesInvoices = loadJson<any[]>(STORAGE_KEYS.SALES_INVOICES, []);
    const purchaseInvoices = loadJson<any[]>(STORAGE_KEYS.PURCHASE_INVOICES, []);

    const variantRows: any[] = [];

    items.filter(i => i['Maintain Stock'] !== 'N').forEach(i => {
      if (i.variants && i.variants.length > 0) {
        i.variants.forEach(v => {
          const vSize = (v.size || '').trim();
          const vColor = (v.color || '').trim();

          let totalSold = 0;
          salesInvoices.forEach(s => {
            if (s.status !== 'Cancelled' && Array.isArray(s.items)) {
              s.items.forEach((line: any) => {
                if (line.itemCode === i['Item Code']) {
                  const lineSize = (line.selectedSize || line.Size || '').trim();
                  const lineColor = (line.selectedColor || line.Color || '').trim();
                  if ((!vSize || lineSize === vSize) && (!vColor || lineColor === vColor)) {
                    totalSold += Number(line.qty) || 0;
                  }
                }
              });
            }
          });

          let totalPurchased = 0;
          purchaseInvoices.forEach(p => {
            if (p.status !== 'Cancelled' && Array.isArray(p.items)) {
              p.items.forEach((line: any) => {
                if (line.itemCode === i['Item Code']) {
                  const lineSize = (line.selectedSize || line.Size || '').trim();
                  const lineColor = (line.selectedColor || line.Color || '').trim();
                  if ((!vSize || lineSize === vSize) && (!vColor || lineColor === vColor)) {
                    totalPurchased += Number(line.qty) || 0;
                  }
                }
              });
            }
          });

          const opStock = Number(v.openingStock) || 0;
          const currentStock = opStock + totalPurchased - totalSold;
          const purRate = Number(v.purchaseRate) || Number(i['Purchase Rate']) || 0;
          const sRate = Number(v.saleRate) || Number(i['Sale Rate']) || 0;

          variantRows.push({
            itemCode: i['Item Code'],
            itemName: i['Item Name'],
            variantId: v.id,
            color: v.color || '-',
            size: v.size || '-',
            barcode: v.barcode || i.Barcode || '-',
            group: i.Group || '-',
            category: i.Category || '-',
            unit: i.Unit || 'Pcs',
            openingStock: opStock,
            inwardQty: totalPurchased,
            outwardQty: totalSold,
            currentStock: currentStock,
            purchaseRate: purRate,
            saleRate: sRate,
            wholesaleRate: Number(v.wholesaleRate) || Number(i['Wholesale Rate']) || 0,
            mrp: Number(v.mrp) || Number(i.MRP) || 0,
            stockValuation: currentStock * purRate,
            isVariant: true
          });
        });
      } else {
        const opStock = Number(i['Opening Stock']) || 0;
        const currentStock = Number(i['Current Stock']) || 0;
        const purRate = Number(i['Purchase Rate']) || 0;
        const sRate = Number(i['Sale Rate']) || 0;

        variantRows.push({
          itemCode: i['Item Code'],
          itemName: i['Item Name'],
          variantId: '',
          color: '-',
          size: '-',
          barcode: i.Barcode || '-',
          group: i.Group || '-',
          category: i.Category || '-',
          unit: i.Unit || 'Pcs',
          openingStock: opStock,
          inwardQty: 0,
          outwardQty: 0,
          currentStock: currentStock,
          purchaseRate: purRate,
          saleRate: sRate,
          wholesaleRate: Number(i['Wholesale Rate']) || 0,
          mrp: Number(i.MRP) || 0,
          stockValuation: currentStock * purRate,
          isVariant: false
        });
      }
    });

    return variantRows;
  }

  if (type === 'part_summary') {
    return items
      .filter(i => i['Maintain Stock'] !== 'N')
      .map(i => {
        const pNo = (i.partNumber || i['Alias'] || i['HSN/SAC'] || '-').trim();
        const purRate = Number(i['Purchase Rate']) || 0;
        const currentStock = Number(i['Current Stock']) || 0;
        return {
          itemCode: i['Item Code'],
          itemName: i['Item Name'],
          partNumber: pNo,
          alias: i['Alias'] || '-',
          hsnSac: i['HSN/SAC'] || '-',
          barcode: i.Barcode || '-',
          group: i.Group || '-',
          category: i.Category || '-',
          unit: i.Unit || 'Pcs',
          openingStock: Number(i['Opening Stock']) || 0,
          currentStock: currentStock,
          purchaseRate: purRate,
          saleRate: Number(i['Sale Rate']) || 0,
          wholesaleRate: Number(i['Wholesale Rate']) || 0,
          mrp: Number(i.MRP) || 0,
          stockValuation: currentStock * purRate
        };
      });
  }
  if (type === 'serials') {
    return getSerialNumbersStockReport();
  }

  if (type === 'batch_summary') {
    const batchRows: any[] = [];
    const todayStr = new Date().toISOString().split('T')[0];
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    items.filter(i => i['Maintain Stock'] !== 'N').forEach(i => {
      if (i.batches && i.batches.length > 0) {
        i.batches.forEach(b => {
          const purRate = Number(b.purchaseRate) || Number(i['Purchase Rate']) || 0;
          const currStock = Number(b.currentStock) ?? Number(b.openingStock) ?? Number(i['Current Stock']) ?? 0;
          let expiryStatus = 'Valid';
          if (b.expDate && b.expDate !== '-') {
            if (b.expDate < todayStr) {
              expiryStatus = 'Expired';
            } else if (b.expDate <= thirtyDaysFromNow) {
              expiryStatus = 'Nearing Expiry';
            }
          }
          batchRows.push({
            itemCode: i['Item Code'],
            itemName: i['Item Name'],
            batchNo: b.batchNo || '-',
            expDate: b.expDate || '-',
            expiryStatus,
            barcode: b.barcode || i.Barcode || '-',
            group: i.Group || '-',
            category: i.Category || '-',
            unit: i.Unit || 'Pcs',
            openingStock: Number(b.openingStock) || 0,
            currentStock: currStock,
            purchaseRate: purRate,
            saleRate: Number(b.saleRate) || Number(i['Sale Rate']) || 0,
            wholesaleRate: Number(b.wholesaleRate) || Number(i['Wholesale Rate']) || 0,
            mrp: Number(b.mrp) || Number(i.MRP) || 0,
            stockValuation: currStock * purRate
          });
        });
      } else if (i.isPharmacy === 'Y' || i.maintainBatch === 'Y') {
        const purRate = Number(i['Purchase Rate']) || 0;
        const currStock = Number(i['Current Stock']) || 0;
        batchRows.push({
          itemCode: i['Item Code'],
          itemName: i['Item Name'],
          batchNo: 'Default',
          expDate: '-',
          expiryStatus: 'Valid',
          barcode: i.Barcode || '-',
          group: i.Group || '-',
          category: i.Category || '-',
          unit: i.Unit || 'Pcs',
          openingStock: Number(i['Opening Stock']) || 0,
          currentStock: currStock,
          purchaseRate: purRate,
          saleRate: Number(i['Sale Rate']) || 0,
          wholesaleRate: Number(i['Wholesale Rate']) || 0,
          mrp: Number(i.MRP) || 0,
          stockValuation: currStock * purRate
        });
      }
    });
    return batchRows;
  }

  if (type === 'vouchers') {
    const allV = getVouchers();
    const fr = from ? new Date(from).setHours(0, 0, 0, 0) : 0;
    const toDt = to ? new Date(to).setHours(23, 59, 59, 999) : Date.now();
    return allV.filter(v => {
      const rawDate = (v as any).DateIso || v.date || (v as any).Date;
      const d = new Date(rawDate).getTime();
      return d >= fr && d <= toDt;
    }).map(v => {
      const isCancelled = (v.status as string) === 'Cancelled';
      const drLedger = v.debitLedger || (v.lines && v.lines.find(l => l.type === 'Dr')?.ledger) || '';
      const crLedger = v.creditLedger || (v.lines && v.lines.find(l => l.type === 'Cr')?.ledger) || '';
      const particular = drLedger && crLedger ? `${drLedger} / ${crLedger}` : (drLedger || crLedger || v.partyName || '-');
      const typeName = v.voucherTypeName || (
        v.type === 'P' ? 'Payment' :
        v.type === 'R' ? 'Receipt' :
        v.type === 'C' ? 'Contra' :
        v.type === 'J' ? 'Journal' :
        v.type === 'S' ? 'Sales' :
        v.type === 'PUR' ? 'Purchase' :
        v.type === 'CN' ? 'Credit Note' :
        v.type === 'DN' ? 'Debit Note' :
        v.type === 'DEL_NOTE' ? 'Delivery Note' :
        v.type === 'PHYSICAL_STOCK' ? 'Physical Stock' :
        v.type === 'QUOTATION' ? 'Quotation' :
        v.type
      );
      const amt = Number(v.amount || v.totalAmount) || 0;
      return {
        ...v,
        VoucherNo: v.voucherNo,
        Date: v.date,
        DateIso: v.date,
        Type: typeName,
        Particulars: particular,
        Debit: isCancelled ? 0 : amt,
        Credit: isCancelled ? 0 : amt,
        Narration: v.narration || '',
        Status: isCancelled ? 'Cancelled' : (v.status || 'Active'),
        isCancelled
      };
    });
  }

  if (type === 'sales') {
    const sales = getDeduplicatedSales();
    const allV = getVouchers();
    const fr = from ? new Date(from).setHours(0, 0, 0, 0) : 0;
    const toDt = to ? new Date(to).setHours(23, 59, 59, 999) : Date.now();

    const filteredSales = sales.filter(r => {
      const d = new Date(r.date).getTime();
      return d >= fr && d <= toDt;
    }).map(r => {
      const isCancelled = (r.status as string) === 'Cancelled';
      return {
        date: r.date,
        invoiceNo: r.invoiceNo,
        customer: { name: r.customer ? (typeof r.customer === 'object' ? (r.customer.name || r.customer.ledger) : r.customer) : 'Cash Customer' },
        payment: { cash: isCancelled ? 0 : (Number(r.cash) || 0), bank1: isCancelled ? 0 : (Number(r.bank1) || 0), bank2: isCancelled ? 0 : (Number(r.bank2) || 0), credit: isCancelled ? 0 : (Number(r.credit) || 0) },
        totalAmount: isCancelled ? 0 : (Number(r.total) || 0),
        status: r.status || (isCancelled ? 'Cancelled' : 'Active'),
        isCancelled,
        items: r.items || [],
        type: 'SALE'
      };
    });

    const filteredReturns = allV.filter(v => {
      const vType = v.type as any;
      if (vType !== 'CN' && vType !== 'Credit Note' && (v as any).voucherTypeName !== 'Credit Note' && vType !== 'Sales Return') return false;
      const rawDate = (v as any).DateIso || v.date || (v as any).Date;
      const d = new Date(rawDate).getTime();
      return d >= fr && d <= toDt;
    }).map(v => {
      const isCancelled = v.status === 'Cancelled';
      const amt = isCancelled ? 0 : (Number(v.amount || (v as any).totalAmount) || 0);
      const party = v.partyName || v.debitLedger || v.creditLedger || 'Customer';
      return {
        date: (v as any).DateIso || v.date,
        invoiceNo: v.voucherNo || 'CN',
        originalRef: (v as any).originalInvoiceRef || '',
        customer: { name: party },
        payment: { cash: 0, bank1: 0, bank2: 0, credit: amt },
        totalAmount: amt,
        status: v.status || (isCancelled ? 'Cancelled' : 'Active'),
        isCancelled,
        items: v.items || [],
        type: 'CN'
      };
    });

    let grossSales = 0;
    filteredSales.forEach(s => { if (!s.isCancelled) grossSales += s.totalAmount; });
    let salesReturn = 0;
    filteredReturns.forEach(r => { if (!r.isCancelled) salesReturn += r.totalAmount; });
    const netSales = grossSales - salesReturn;

    return {
      type: 'sales',
      sales: filteredSales,
      returns: filteredReturns,
      grossSales,
      salesReturn,
      netSales
    };
  }

  if (type === 'purchases') {
    const purchases = getDeduplicatedPurchases();
    const allV = getVouchers();
    const fr = from ? new Date(from).setHours(0, 0, 0, 0) : 0;
    const toDt = to ? new Date(to).setHours(23, 59, 59, 999) : Date.now();

    const filteredPurchases = purchases.filter(r => {
      const d = new Date(r.date).getTime();
      return d >= fr && d <= toDt;
    }).map(r => {
      const isCancelled = (r.status as string) === 'Cancelled';
      return {
        date: r.date,
        billNo: r.billNo || r.invoiceNo,
        supplierBillNo: r.supplierBillNo,
        supplier: { name: r.supplier ? (typeof r.supplier === 'object' ? (r.supplier.name || (r.supplier as any).ledger) : r.supplier) : 'Supplier' },
        payment: { cash: isCancelled ? 0 : (Number(r.cash) || 0), bank1: isCancelled ? 0 : (Number(r.bank1) || 0), bank2: isCancelled ? 0 : (Number(r.bank2) || 0), credit: isCancelled ? 0 : (Number(r.credit) || 0) },
        totalAmount: isCancelled ? 0 : (Number(r.total) || 0),
        status: r.status || (isCancelled ? 'Cancelled' : 'Active'),
        isCancelled,
        items: r.items || [],
        type: 'PURCHASE'
      };
    });

    const filteredReturns = allV.filter(v => {
      const vType = v.type as any;
      if (vType !== 'DN' && vType !== 'Debit Note' && (v as any).voucherTypeName !== 'Debit Note' && vType !== 'Purchase Return') return false;
      const rawDate = (v as any).DateIso || v.date || (v as any).Date;
      const d = new Date(rawDate).getTime();
      return d >= fr && d <= toDt;
    }).map(v => {
      const isCancelled = v.status === 'Cancelled';
      const amt = isCancelled ? 0 : (Number(v.amount || (v as any).totalAmount) || 0);
      const party = v.partyName || v.creditLedger || v.debitLedger || 'Supplier';
      return {
        date: (v as any).DateIso || v.date,
        billNo: v.voucherNo || 'DN',
        supplierBillNo: (v as any).supplierBillNo || v.voucherNo,
        originalRef: (v as any).originalBillRef || '',
        supplier: { name: party },
        payment: { cash: 0, bank1: 0, bank2: 0, credit: amt },
        totalAmount: amt,
        status: v.status || (isCancelled ? 'Cancelled' : 'Active'),
        isCancelled,
        items: v.items || [],
        type: 'DN'
      };
    });

    let grossPurchases = 0;
    filteredPurchases.forEach(p => { if (!p.isCancelled) grossPurchases += p.totalAmount; });
    let purchaseReturn = 0;
    filteredReturns.forEach(r => { if (!r.isCancelled) purchaseReturn += r.totalAmount; });
    const netPurchases = grossPurchases - purchaseReturn;

    return {
      type: 'purchases',
      purchases: filteredPurchases,
      returns: filteredReturns,
      grossPurchases,
      purchaseReturn,
      netPurchases
    };
  }

  if (type === 'quotations' || type === 'quotation') {
    const quotations = getQuotations();
    const fr = from ? new Date(from).setHours(0, 0, 0, 0) : 0;
    const toDt = to ? new Date(to).setHours(23, 59, 59, 999) : Date.now();
    return quotations.filter(q => {
      const d = new Date(q.date).getTime();
      return d >= fr && d <= toDt;
    }).map(q => {
      const isCancelled = (q.status as string) === 'Cancelled';
      return {
        ...q,
        isCancelled
      };
    });
  }

  if (type === 'delivery_notes' || type === 'delivery_note') {
    const notes = getDeliveryNotes();
    const fr = from ? new Date(from).setHours(0, 0, 0, 0) : 0;
    const toDt = to ? new Date(to).setHours(23, 59, 59, 999) : Date.now();
    return notes.filter(n => {
      const d = new Date(n.date).getTime();
      return d >= fr && d <= toDt;
    }).map(n => {
      const isCancelled = (n.status as string) === 'Cancelled';
      return {
        ...n,
        isCancelled
      };
    });
  }

  const fr = from ? new Date(from).setHours(0, 0, 0, 0) : 0;
  const toDt = to ? new Date(to).setHours(23, 59, 59, 999) : Date.now();
  const sales = getDeduplicatedSales();
  const sLog = loadJson<StockLedgerEntry[]>(STORAGE_KEYS.STOCK_LEDGER, []);

  const inPeriodInvs = sales.filter(r => {
    const d = new Date(r.date).getTime();
    return d >= fr && d <= toDt;
  });

  const agg: Record<string, { name: string; qty: number; sAmt: number; cAmt: number; code: string; group: string; category: string }> = {};

  inPeriodInvs.forEach(inv => {
    inv.items.forEach(r => {
      const c = r['Item Code'];
      const i = items.find(x => x['Item Code'] === c);
      if (!agg[c]) agg[c] = { name: r['Item Name'], qty: 0, sAmt: 0, cAmt: 0, code: c, group: i?.Group || '', category: i?.Category || '' };
      const q = Number(r.Qty) || 0;
      const lTot = (q * (Number(r.Rate) || 0)) - (Number(r.Discount) || 0);
      agg[c].qty += q;
      agg[c].sAmt += lTot;
      agg[c].cAmt += (q * (i ? (Number(i['Purchase Rate']) || 0) : 0));
    });
  });

  const pList = Object.values(agg).map(k => ({
    name: k.name,
    code: k.code,
    qty: k.qty,
    saleAmt: k.sAmt,
    costAmt: k.cAmt,
    profit: k.sAmt - k.cAmt,
    group: k.group,
    category: k.category
  }));

  if (type === 'mov') {
    const sLogFiltered = sLog.filter(l => {
      const isSale = l.Type === 'Sale' || l.Type === 'Sales' || l.Type === 'Sale Invoice';
      if (isSale && l['Ref No']) {
        const ref = l['Ref No'].trim().toLowerCase();
        const salesAgainstDN = sales.some(s => (s.invoiceNo?.trim().toLowerCase() === ref) && Boolean(s.deliveryNoteNo && s.deliveryNoteNo.trim()));
        if (salesAgainstDN) return false;
      }
      return true;
    });

    const movement = items
      .filter(i => i['Maintain Stock'] !== 'N')
      .map(i => {
        const c = i['Item Code'], pr = Number(i['Purchase Rate']) || 0, sr = Number(i['Sale Rate']) || 0;
        const opStock = Number(i['Opening Stock']) || 0;
        let op = opStock;
        let inQ = 0;
        let outQ = 0;
        sLogFiltered.filter(l => l['Item Code'] === c).forEach(log => {
          // If the log is an explicit opening entry, skip it so it doesn't double add to opStock
          if (log.Type === 'Opening' || (log['Ref No'] && log['Ref No'].startsWith('OPENING'))) {
            return;
          }
          const d = new Date(log.DateIso).getTime();
          const li = Number(log['Qty In']) || 0;
          const lo = Number(log['Qty Out']) || 0;
          if (d < fr) {
            op += (li - lo);
          } else if (d >= fr && d <= toDt) {
            inQ += li;
            outQ += lo;
          }
        });
        return {
          name: i['Item Name'],
          code: c,
          group: i.Group,
          category: i.Category,
          unit: i.Unit,
          opQty: op,
          inQty: inQ,
          outQty: outQ,
          clQty: op + inQ - outQ,
          pRate: pr,
          sRate: sr,
          valuation: (op + inQ - outQ) * pr
        };
      });
    return { movement };
  }

  if (type === 'godown_summary') {
    const godowns = getGodowns().filter(g => g.isActive);
    const sLogFiltered = sLog.filter(l => {
      const isSale = l.Type === 'Sale' || l.Type === 'Sales' || l.Type === 'Sale Invoice';
      if (isSale && l['Ref No']) {
        const ref = l['Ref No'].trim().toLowerCase();
        const salesAgainstDN = sales.some(s => (s.invoiceNo?.trim().toLowerCase() === ref) && Boolean(s.deliveryNoteNo && s.deliveryNoteNo.trim()));
        if (salesAgainstDN) return false;
      }
      return true;
    });

    const stockItems = items.filter(i => i['Maintain Stock'] !== 'N');
    const godownRows: any[] = [];

    godowns.forEach(g => {
      stockItems.forEach(i => {
        const c = i['Item Code'];
        const pr = Number(i['Purchase Rate']) || 0;
        const sr = Number(i['Sale Rate']) || 0;

        const alloc = (i.branchAllocations || []).find((a: any) => a.godownId === g.id);
        const branchAlloc = (i.branchAllocations || []).find((a: any) => a.branchId === g.branchId && !a.godownId);

        let op = 0;
        if (alloc) {
          op = Number(alloc.openingStock) || 0;
        } else if (branchAlloc && g.isDefault) {
          op = Number(branchAlloc.openingStock) || 0;
        } else if ((!i.branchAllocations || i.branchAllocations.length === 0) && g.isDefault && g.branchId === 'branch_ho') {
          op = Number(i['Opening Stock']) || 0;
        }

        let inQ = 0;
        let outQ = 0;

        sLogFiltered.filter(l => l['Item Code'] === c).forEach(log => {
          const matchesGodown = log.godownId === g.id || (!log.godownId && log.branchId === g.branchId && g.isDefault);
          if (!matchesGodown) return;

          if (log.Type === 'Opening' || (log['Ref No'] && log['Ref No'].startsWith('OPENING'))) {
            return;
          }

          const d = new Date(log.DateIso).getTime();
          const li = Number(log['Qty In']) || 0;
          const lo = Number(log['Qty Out']) || 0;
          if (d < fr) {
            op += (li - lo);
          } else if (d >= fr && d <= toDt) {
            inQ += li;
            outQ += lo;
          }
        });

        const clQ = op + inQ - outQ;

        // Include all items that have any movement or non-zero balance, or if it has opening stock
        godownRows.push({
          godownId: g.id,
          godownName: g.name,
          godownCode: g.code,
          branchId: g.branchId,
          branchName: g.branchName || '',
          code: c,
          name: i['Item Name'],
          group: i.Group || '-',
          category: i.Category || '-',
          unit: i.Unit || 'Pcs',
          opQty: op,
          inQty: inQ,
          outQty: outQ,
          clQty: clQ,
          pRate: pr,
          sRate: sr,
          valuation: clQ * pr
        });
      });
    });

    return godownRows;
  }

  return {
    profit: pList,
    topQty: pList.slice().sort((a, b) => b.qty - a.qty).slice(0, 15),
    topAmt: pList.slice().sort((a, b) => b.saleAmt - a.saleAmt).slice(0, 15)
  };
}

export function getStockBalancesAsOfDate(asOfDate?: string): Record<string, number> {
  const items = loadJson<Item[]>(STORAGE_KEYS.ITEMS, DEFAULT_ITEMS);
  const sLog = loadJson<StockLedgerEntry[]>(STORAGE_KEYS.STOCK_LEDGER, []);
  const todayStr = new Date().toISOString().split('T')[0];
  const isTodayOrFuture = !asOfDate || asOfDate >= todayStr;
  const toDt = asOfDate ? new Date(asOfDate).setHours(23, 59, 59, 999) : Date.now();
  const map: Record<string, number> = {};

  items.forEach(i => {
    const c = i['Item Code'];
    if (i['Maintain Stock'] === 'N') {
      map[c] = Number(i['Current Stock']) || 0;
      return;
    }

    if (isTodayOrFuture) {
      map[c] = Number(i['Current Stock']) || 0;
      return;
    }

    const opStock = Number(i['Opening Stock']) || 0;
    let net = opStock;
    sLog.filter(l => l['Item Code'] === c).forEach(log => {
      if (log.Type === 'Opening' || (log['Ref No'] && log['Ref No'].startsWith('OPENING'))) {
        return;
      }
      const d = new Date(log.DateIso).getTime();
      const li = Number(log['Qty In']) || 0;
      const lo = Number(log['Qty Out']) || 0;
      if (d <= toDt) {
        net += (li - lo);
      }
    });
    map[c] = net;
  });

  return map;
}

export function getFinancialReports(type: string, from: string, to: string, branchId?: string) {
  // Synchronize any posted payroll records to accounting entries & ledgers
  syncPayrollToAccounting();

  const fr = new Date(from).setHours(0, 0, 0, 0);
  const toDt = new Date(to).setHours(23, 59, 59, 999);
  const rawLedgers = sanitizeLedgers(loadJson<Ledger[]>(STORAGE_KEYS.LEDGERS, DEFAULT_LEDGERS));
  const rawLedgerLog = loadJson<LedgerLogEntry[]>(STORAGE_KEYS.LEDGER_LOG, []);
  const items = loadJson<Item[]>(STORAGE_KEYS.ITEMS, DEFAULT_ITEMS);
  const rawStockLog = loadJson<StockLedgerEntry[]>(STORAGE_KEYS.STOCK_LEDGER, []);
  const groups = loadJson<LedgerGroup[]>(STORAGE_KEYS.LEDGER_GROUPS, DEFAULT_LEDGER_GROUPS);
  const rawSales = getDeduplicatedSales();
  const rawPurchases = getDeduplicatedPurchases();

  const isBranchFilter = Boolean(branchId && branchId !== 'all');
  const ledgerLog = isBranchFilter
    ? rawLedgerLog.filter(log => log.branchId === branchId || (!log.branchId && branchId === 'branch_ho'))
    : rawLedgerLog;
  const stockLog = isBranchFilter
    ? rawStockLog.filter(l => l.branchId === branchId || (!l.branchId && branchId === 'branch_ho'))
    : rawStockLog;
  const sales = isBranchFilter
    ? rawSales.filter(s => s.branchId === branchId || (!s.branchId && branchId === 'branch_ho'))
    : rawSales;
  const purchases = isBranchFilter
    ? rawPurchases.filter(p => p.branchId === branchId || (!p.branchId && branchId === 'branch_ho'))
    : rawPurchases;

  // Ensure all distinct ledgers from ledgerLog are represented
  const ledgers = [...rawLedgers];
  const existingLedgerNames = new Set(ledgers.map(l => l['Ledger Name']?.trim().toLowerCase()));
  ledgerLog.forEach(log => {
    const lName = (log['Ledger Name'] || '').trim();
    if (lName && !existingLedgerNames.has(lName.toLowerCase())) {
      existingLedgerNames.add(lName.toLowerCase());
      ledgers.push({
        'Ledger Name': lName,
        Group: inferLedgerGroup(lName, 'Indirect Expenses'),
        'Opening Balance': 0,
        'Balance Type (Dr/Cr)': 'Dr',
        'Current Balance': 0
      });
    }
  });

  const getGrp = (n: string) => {
    const p = [n]; let c: string | undefined = n;
    while (c) {
      const g = groups.find(x => x['Group Name'] === c);
      if (g && g['Parent Group']) { p.push(g['Parent Group']); c = g['Parent Group']; }
      else c = undefined;
    }
    return p;
  };

  const getNat = (n: string) => {
    let c: string | undefined = n;
    while (c) {
      const g = groups.find(x => x['Group Name'] === c);
      if (g && g.Nature) return g.Nature;
      if (g && g['Parent Group']) c = g['Parent Group']; else break;
    }
    return 'Asset';
  };

  const cfg = loadJson<Config>(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
  const integrateInv = cfg.IntegrateAccountsWithInventory !== 'false';

  let oV = 0, cV = 0;
  items.filter(i => i['Maintain Stock'] !== 'N').forEach(i => {
    const c = i['Item Code'], pr = Number(i['Purchase Rate']) || 0;
    const opStock = Number(i['Opening Stock']) || 0;
    let o = opStock;
    let cl = opStock;
    stockLog.filter(l => l['Item Code'] === c).forEach(l => {
      if (l.Type === 'Opening' || (l['Ref No'] && l['Ref No'].startsWith('OPENING'))) return;
      const d = new Date(l.DateIso).getTime();
      const df = (Number(l['Qty In']) || 0) - (Number(l['Qty Out']) || 0);
      if (d < fr) { o += df; cl += df; }
      else if (d <= toDt) cl += df;
    });
    oV += o * pr; cV += cl * pr;
  });

  const effOpeningStock = integrateInv ? oV : 0;
  const effClosingStock = integrateInv ? cV : 0;

  const tb: Array<{ name: string; grp: string; dr: number; cr: number; nat: string; opDr: number; opCr: number; periodDr: number; periodCr: number }> = [];
  const pnl = { p: 0, s: 0, de: 0, di: 0, ie: 0, ii: 0, os: effOpeningStock, cs: effClosingStock, rawOpeningStock: oV, rawClosingStock: cV, isIntegrated: integrateInv };
  const bs = { cap: 0, ln: 0, cl: 0, fa: 0, ca: 0, cs: effClosingStock };
  const recMap = new Map<string, number>();
  const payMap = new Map<string, number>();

  ledgers.forEach(l => {
    const n = l['Ledger Name'];
    const grp = l.Group || inferLedgerGroup(n, 'Sundry Debtors');
    const path = getGrp(grp);
    const nat = getNat(grp);
    let initBal = (Number(l['Opening Balance']) || 0) * (l['Balance Type (Dr/Cr)'] === 'Cr' ? -1 : 1);
    const cleanLName = n.trim().toLowerCase();

    let priorDr = 0, priorCr = 0;
    let periodDr = 0, periodCr = 0;

    ledgerLog.forEach(log => {
      const logName = (log['Ledger Name'] || '').trim().toLowerCase();
      if (logName === cleanLName) {
        const d = new Date(log.DateIso).getTime();
        const drAmt = Number(log.Debit) || 0;
        const crAmt = Number(log.Credit) || 0;
        if (d < fr) {
          priorDr += drAmt;
          priorCr += crAmt;
        } else if (d <= toDt) {
          periodDr += drAmt;
          periodCr += crAmt;
        }
      }
    });

    const opNet = initBal + priorDr - priorCr;
    const closeNet = opNet + periodDr - periodCr;

    const isNominalAccount =
      nat === 'Income' ||
      nat === 'Expense' ||
      path.includes('Sales Account') ||
      path.includes('Sales Accounts') ||
      path.includes('Purchase Account') ||
      path.includes('Purchase Accounts') ||
      path.includes('Direct Expenses') ||
      path.includes('Indirect Expenses') ||
      path.includes('Direct Income') ||
      path.includes('Direct Incomes') ||
      path.includes('Indirect Income');

    let bal = isNominalAccount ? (periodDr - periodCr) : closeNet;
    if (!isNominalAccount && bal === 0 && Number(l['Current Balance']) !== 0 && periodDr === 0 && periodCr === 0) {
      bal = (Number(l['Current Balance']) || 0) * (l['Balance Type (Dr/Cr)'] === 'Cr' ? -1 : 1);
    }

    let pBal = 0;
    if (nat === 'Income' || nat === 'Expense') {
      pBal = periodDr - periodCr;
    }

    const opDr = opNet > 0 ? opNet : 0;
    const opCr = opNet < 0 ? Math.abs(opNet) : 0;
    const finalDr = bal > 0 ? bal : 0;
    const finalCr = bal < 0 ? Math.abs(bal) : 0;

    if (Math.abs(bal) > 0.005 || Math.abs(opNet) > 0.005 || periodDr > 0 || periodCr > 0) {
      tb.push({
        name: n,
        grp,
        dr: finalDr,
        cr: finalCr,
        nat,
        opDr,
        opCr,
        periodDr,
        periodCr
      });
    }
    
    // Strict non-party exclusion for Sundry Debtors (Receivables) and Sundry Creditors (Payables)
    const isBank =
      path.includes('Bank Accounts') ||
      grp === 'Bank Accounts' ||
      Boolean(l['Bank Name']) ||
      Boolean(l['Account No']) ||
      cleanLName.includes('bank') ||
      cleanLName.includes('bob') ||
      cleanLName.includes('bnbl') ||
      cleanLName.includes('tbank') ||
      cleanLName.includes('t-bank') ||
      cleanLName.includes('bdbl') ||
      cleanLName.includes('dpnb') ||
      cleanLName.includes('tdk') ||
      cleanLName.includes('bank a/c') ||
      cleanLName.endsWith(' bank');

    const isCash =
      path.includes('Cash-in-Hand') ||
      grp === 'Cash-in-Hand' ||
      cleanLName === 'cash' ||
      cleanLName === 'petty cash' ||
      cleanLName.includes('cash a/c') ||
      cleanLName.includes('cash in hand');

    const isTax =
      path.includes('Duties & Taxes') ||
      grp === 'Duties & Taxes' ||
      cleanLName.includes('tax') ||
      cleanLName.includes('duty') ||
      cleanLName.includes('duties') ||
      cleanLName.includes('gst') ||
      cleanLName.includes('tds') ||
      cleanLName.includes('pit') ||
      cleanLName.includes('nppf') ||
      cleanLName.includes('gis') ||
      cleanLName.includes('payable') ||
      cleanLName.includes('receivable');

    const isSalesPurch =
      path.includes('Sales Account') ||
      path.includes('Sales Accounts') ||
      path.includes('Purchase Account') ||
      path.includes('Purchase Accounts') ||
      cleanLName.includes('sales') ||
      cleanLName.includes('purchase');

    const isCapitalLoan =
      path.includes('Capital Account') ||
      path.includes('Loans (Liability)') ||
      cleanLName.includes('capital') ||
      cleanLName.includes('loan');

    const isExpInc =
      nat === 'Expense' ||
      nat === 'Income' ||
      path.includes('Direct Expenses') ||
      path.includes('Indirect Expenses') ||
      path.includes('Direct Income') ||
      path.includes('Indirect Income');

    const isNonPartyAccount = isBank || isCash || isTax || isSalesPurch || isCapitalLoan || isExpInc;

    const isDebtor =
      !isNonPartyAccount &&
      (path.includes('Sundry Debtors') || grp === 'Sundry Debtors' || grp.toLowerCase().includes('debtor')) &&
      cleanLName !== 'cash customer' &&
      cleanLName !== 'walk-in customer' &&
      cleanLName !== 'walk-in / cash customer';

    const isCreditor =
      !isNonPartyAccount &&
      (path.includes('Sundry Creditors') || grp === 'Sundry Creditors' || grp.toLowerCase().includes('creditor'));

    if (isDebtor && bal > 0.005) {
      recMap.set(n, (recMap.get(n) || 0) + bal);
    }
    if (isCreditor && bal < -0.005) {
      payMap.set(n, (payMap.get(n) || 0) + Math.abs(bal));
    }

    if (path.includes('Purchase Account') || path.includes('Purchase Accounts')) pnl.p += pBal;
    else if (path.includes('Sales Account') || path.includes('Sales Accounts')) pnl.s += Math.abs(pBal);
    else if (path.includes('Direct Expenses')) pnl.de += pBal;
    else if (path.includes('Direct Income') || path.includes('Direct Incomes')) pnl.di += Math.abs(pBal);
    else if (path.includes('Indirect Expenses') || (nat === 'Expense' && !path.includes('Purchase Account') && !path.includes('Direct Expenses'))) pnl.ie += pBal;
    else if (path.includes('Indirect Income') || (nat === 'Income' && !path.includes('Sales Account') && !path.includes('Direct Income'))) pnl.ii += Math.abs(pBal);

    if (path.includes('Capital Account')) bs.cap += Math.abs(bal);
    else if (path.includes('Loans (Liability)')) bs.ln += Math.abs(bal);
    else if (path.includes('Current Liabilities') && !path.includes('Sundry Creditors')) bs.cl += Math.abs(bal);
    else if (nat === 'Liability' && !path.includes('Capital Account') && !path.includes('Loans (Liability)') && !path.includes('Current Liabilities')) bs.cl += Math.abs(bal);
    else if (path.includes('Fixed Assets')) bs.fa += bal;
    else if (path.includes('Current Assets') && !path.includes('Sundry Debtors') && !path.includes('Bank Accounts') && !path.includes('Cash-in-Hand')) bs.ca += bal;
    else if (nat === 'Asset' && !path.includes('Fixed Assets') && !path.includes('Current Assets')) bs.ca += bal;
  });

  // Ensure Opening/Current Stock is represented in Trial Balance under Stock-in-Hand when accounts are integrated with inventory
  if (integrateInv && (effOpeningStock > 0 || effClosingStock > 0)) {
    const hasStockInTb = tb.some(t => t.grp === 'Stock-in-Hand' || t.name.toLowerCase().includes('stock-in-hand') || t.name.toLowerCase().includes('opening stock'));
    if (!hasStockInTb) {
      const stockAmt = effOpeningStock > 0 ? effOpeningStock : effClosingStock;
      const stockName = effOpeningStock > 0 ? 'Opening Stock' : 'Stock-in-Hand';
      tb.push({
        name: stockName,
        grp: 'Stock-in-Hand',
        dr: stockAmt,
        cr: 0,
        nat: 'Asset',
        opDr: stockAmt,
        opCr: 0,
        periodDr: 0,
        periodCr: 0
      });
    }
  }

  // Fallback if sales/purchase ledger log entries are missing for the selected date range
  if (pnl.s === 0 && sales.length > 0) {
    sales.forEach(s => {
      if ((s.status as string) !== 'Cancelled') {
        const d = new Date(s.date).getTime();
        if (d >= fr && d <= toDt) {
          const netSale = (Number(s.taxable) || 0) + (Number(s.zeroRated) || 0) - (Number(s.discount) || 0);
          pnl.s += Math.max(0, netSale > 0 ? netSale : (Number(s.total) || 0) - (Number(s.gstAmt) || 0));
        }
      }
    });
  }

  if (pnl.p === 0 && purchases.length > 0) {
    purchases.forEach(p => {
      if ((p.status as string) !== 'Cancelled') {
        const d = new Date(p.date).getTime();
        if (d >= fr && d <= toDt) {
          const netPurch = (Number(p.taxable) || Number(p.total)) - (Number(p.gstAmt) || 0);
          pnl.p += Math.max(0, netPurch);
        }
      }
    });
  }

  // Calculate detailed bill-wise credit breakdown
  const unpaidSalesInvoices = sales
    .filter(s => (s.credit && Number(s.credit) > 0.009) || s.status === 'Credit' || s.status === 'Partial Credit' || s.paymentStatus === 'Credit' || s.paymentStatus === 'Partial Credit')
    .map(s => {
      const cash = Number(s.cash) || Number(s.paymentDetails?.cash) || 0;
      const b1 = Number(s.bank1) || Number(s.paymentDetails?.bank1) || 0;
      const b2 = Number(s.bank2) || Number(s.paymentDetails?.bank2) || 0;
      const paid = cash + b1 + b2;
      const due = Number(s.credit) > 0 ? Number(s.credit) : Math.max(0, (Number(s.total) || 0) - paid);
      return {
        invoiceNo: s.invoiceNo,
        date: s.date,
        partyName: s.customer?.name || s.customer?.ledger || 'Walk-in / Cash Customer',
        phone: s.customer?.phone || s.customer?.contactNo || '',
        total: Number(s.total) || 0,
        paid,
        due,
        status: s.status || s.paymentStatus || (due <= 0 ? 'Paid' : (paid > 0 ? 'Partial Credit' : 'Credit'))
      };
    });

  const unpaidPurchaseInvoices = purchases
    .filter(p => (p.credit && Number(p.credit) > 0.009) || p.status === 'Credit' || p.status === 'Partial Credit' || p.paymentStatus === 'Credit' || p.paymentStatus === 'Partial Credit')
    .map(p => {
      const cash = Number(p.cash) || Number(p.paymentDetails?.cash) || 0;
      const b1 = Number(p.bank1) || Number(p.paymentDetails?.bank1) || 0;
      const b2 = Number(p.bank2) || Number(p.paymentDetails?.bank2) || 0;
      const paid = cash + b1 + b2;
      const due = Number(p.credit) > 0 ? Number(p.credit) : Math.max(0, (Number(p.total) || 0) - paid);
      return {
        invoiceNo: p.billNo || p.invoiceNo || p.supplierBillNo || 'PUR-BILL',
        date: p.date,
        partyName: p.supplier?.name || 'Supplier',
        phone: p.supplier?.contactNo || '',
        total: Number(p.total) || 0,
        paid,
        due,
        status: p.status || p.paymentStatus || (due <= 0 ? 'Paid' : (paid > 0 ? 'Partial Credit' : 'Credit'))
      };
    });

  // Ensure any credit sales are in recMap (skipping generic cash/bank/tax placeholders)
  unpaidSalesInvoices.forEach(s => {
    if (s.due > 0.009) {
      const pName = (s.partyName || '').trim();
      const lower = pName.toLowerCase();
      if (
        !pName ||
        lower === 'walk-in / cash customer' ||
        lower === 'walk-in customer' ||
        lower === 'cash customer' ||
        lower === 'cash' ||
        lower === 'petty cash' ||
        lower.includes('bank') ||
        lower.includes('bob') ||
        lower.includes('bnbl') ||
        lower.includes('tbank') ||
        lower.includes('t-bank') ||
        lower.includes('bdbl') ||
        lower.includes('dpnb') ||
        lower.includes('tax') ||
        lower.includes('duty') ||
        lower.includes('duties') ||
        lower.includes('gst') ||
        lower.includes('tds') ||
        lower.includes('pit') ||
        lower.includes('nppf') ||
        lower.includes('gis') ||
        lower.includes('payable') ||
        lower.includes('salary')
      ) {
        return;
      }
      const existingKey = Array.from(recMap.keys()).find(k => k.toLowerCase() === lower);
      if (!existingKey) {
        recMap.set(pName, (recMap.get(pName) || 0) + s.due);
      }
    }
  });

  // Ensure any credit purchases are in payMap
  unpaidPurchaseInvoices.forEach(p => {
    if (p.due > 0.009) {
      const sName = (p.partyName || '').trim();
      const lower = sName.toLowerCase();
      if (
        !sName ||
        lower === 'cash' ||
        lower === 'petty cash' ||
        lower.includes('bank') ||
        lower.includes('bob') ||
        lower.includes('bnbl') ||
        lower.includes('tbank') ||
        lower.includes('t-bank') ||
        lower.includes('bdbl') ||
        lower.includes('dpnb') ||
        lower.includes('tax') ||
        lower.includes('duty') ||
        lower.includes('duties') ||
        lower.includes('gst') ||
        lower.includes('tds') ||
        lower.includes('pit') ||
        lower.includes('nppf') ||
        lower.includes('gis') ||
        lower.includes('payable') ||
        lower.includes('salary')
      ) {
        return;
      }
      const existingKey = Array.from(payMap.keys()).find(k => k.toLowerCase() === lower);
      if (!existingKey) {
        payMap.set(sName, (payMap.get(sName) || 0) + p.due);
      }
    }
  });

  const rec: Array<{ name: string; amt: number }> = Array.from(recMap.entries()).map(([name, amt]) => ({ name, amt }));
  const pay: Array<{ name: string; amt: number }> = Array.from(payMap.entries()).map(([name, amt]) => ({ name, amt }));

  const sDeb = rec.reduce((s, r) => s + r.amt, 0);
  const sCre = pay.reduce((s, r) => s + r.amt, 0);
  bs.ca += sDeb; bs.cl += sCre;

  ledgers.forEach(l => {
    const path = getGrp(l.Group);
    if (path.includes('Bank Accounts') || path.includes('Cash-in-Hand')) {
      const b = tb.find(x => x.name === l['Ledger Name']);
      if (b) { if (b.dr > 0) bs.ca += b.dr; if (b.cr > 0) bs.cl += b.cr; }
    }
  });

  return { tb, pnl, bs, rec, pay, unpaidSalesInvoices, unpaidPurchaseInvoices };
}

export function getAdvancedDashboardData(from: string, to: string) {
  const fr = new Date(from).setHours(0, 0, 0, 0);
  const toDt = new Date(to).setHours(23, 59, 59, 999);
  
  const currentCompId = getActiveCompanyId();
  const isDemoComp = !currentCompId || currentCompId === DEFAULT_TENANT_COMPANY.id;

  const sales = getDeduplicatedSales(currentCompId);
  const purchases = getDeduplicatedPurchases(currentCompId);
  const vouchers = loadJson<Voucher[]>(STORAGE_KEYS.VOUCHERS, [], currentCompId);
  const items = loadJson<any[]>(STORAGE_KEYS.ITEMS, DEFAULT_ITEMS, currentCompId);
  const ledgers = getLedgers(currentCompId);
  
  const sls = sales.filter(r => {
    const d = new Date(r.date).getTime();
    return d >= fr && d <= toDt;
  });
  
  const totSales = sls.reduce((s, r) => s + (Number(r.total) || 0), 0);
  const gstTot = sls.reduce((s, r) => s + (Number(r.gstAmt) || 0), 0);
  
  // Profit calculation
  let profit = 0;
  let itemSales: Record<string, {name: string, qty: number, code: string}> = {};
  sls.forEach(r => {
    if (r.items) {
      r.items.forEach(line => {
        const itemCode = line['Item Code'];
        const masterItem = items.find(i => i['Item Code'] === itemCode);
        const purchaseRate = masterItem ? Number(masterItem['Purchase Rate']) || 0 : 0;
        const lineProfit = (Number(line['Line Total']) || 0) - (purchaseRate * (Number(line.Qty) || 0));
        profit += lineProfit;
        
        if (!itemSales[itemCode]) {
          itemSales[itemCode] = { name: line['Item Name'] || itemCode, qty: 0, code: itemCode };
        }
        itemSales[itemCode].qty += Number(line.Qty) || 0;
      });
    }
  });
  
  let topSellingItem = { name: 'N/A', qty: 0, code: '' };
  for (const k in itemSales) {
    if (itemSales[k].qty > topSellingItem.qty) {
      topSellingItem = { name: itemSales[k].name, qty: itemSales[k].qty, code: itemSales[k].code };
    }
  }

  // Calculate balances by groups
  const hasTxns = sls.length > 0 || purchases.length > 0 || vouchers.length > 0;

  // Cash
  const cashLedgers = ledgers.filter(l => l.Group === 'Cash-in-Hand' || (l['Ledger Name'] || '').toLowerCase() === 'cash');
  const rawCashBalance = cashLedgers.reduce((acc, l) => {
    return acc + (Number(l['Current Balance']) || 0) * (l['Balance Type (Dr/Cr)'] === 'Cr' ? -1 : 1);
  }, 0);
  const cashBalance = (!isDemoComp && !hasTxns) ? 0 : rawCashBalance;
  
  // Bank
  const bankLedgers = ledgers.filter(l => l.Group === 'Bank Accounts' || ['bob', 'bob account', 'bnbl', 'bnbl account'].includes((l['Ledger Name'] || '').toLowerCase()) || l['Bank Name']);
  const rawBankBalance = bankLedgers.reduce((acc, l) => {
    return acc + (Number(l['Current Balance']) || 0) * (l['Balance Type (Dr/Cr)'] === 'Cr' ? -1 : 1);
  }, 0);
  const bankBalance = (!isDemoComp && !hasTxns) ? 0 : rawBankBalance;
  
  // Receivable (Sundry Debtors only - strictly exclude Bank, Cash, Tax, etc.)
  const recLedgers = ledgers.filter(l => {
    const grp = l.Group || '';
    const name = (l['Ledger Name'] || '').toLowerCase();
    const isNonDebtor = grp === 'Bank Accounts' || grp === 'Cash-in-Hand' || grp === 'Duties & Taxes' || grp.includes('Expense') || grp.includes('Income') || grp.includes('Capital') || grp.includes('Loan') || ['bob', 'bnbl', 'cash', 'duties & taxes', 'gst payable', 'gst receivable'].includes(name) || l['Bank Name'];
    return !isNonDebtor && (grp === 'Sundry Debtors' || grp.toLowerCase().includes('debtor') || grp.toLowerCase().includes('customer'));
  });
  const rawRecBalance = recLedgers.reduce((acc, l) => {
    return acc + (Number(l['Current Balance']) || 0) * (l['Balance Type (Dr/Cr)'] === 'Cr' ? -1 : 1);
  }, 0);
  const recBalance = (!isDemoComp && !hasTxns) ? 0 : rawRecBalance;
  
  // Payable (Sundry Creditors only - strictly exclude Bank, Cash, Tax, etc.)
  const payLedgers = ledgers.filter(l => {
    const grp = l.Group || '';
    const name = (l['Ledger Name'] || '').toLowerCase();
    const isNonCreditor = grp === 'Bank Accounts' || grp === 'Cash-in-Hand' || grp === 'Duties & Taxes' || grp.includes('Expense') || grp.includes('Income') || grp.includes('Capital') || grp.includes('Loan') || ['bob', 'bnbl', 'cash', 'duties & taxes', 'gst payable', 'gst receivable'].includes(name) || l['Bank Name'];
    return !isNonCreditor && (grp === 'Sundry Creditors' || grp.toLowerCase().includes('creditor') || grp.toLowerCase().includes('supplier'));
  });
  const rawPayBalance = payLedgers.reduce((acc, l) => {
    return acc + (Number(l['Current Balance']) || 0) * (l['Balance Type (Dr/Cr)'] === 'Cr' ? 1 : -1);
  }, 0);
  const payBalance = (!isDemoComp && !hasTxns) ? 0 : rawPayBalance;
  
  const lowStock = items.filter(x => x['Maintain Stock'] !== 'N' && Number(x['Current Stock']) <= Number(x['Reorder Level']) && Number(x['Reorder Level']) > 0);
  
  return {
    sale: totSales,
    profit: profit,
    gst: gstTot,
    cash: cashBalance,
    bank: bankBalance,
    receivable: recBalance,
    payable: payBalance,
    topSellingItem,
    invoicesCount: sls.length,
    lowStockCount: lowStock.length,
    lowStockItems: lowStock.slice(0, 10)
  };
}

export function getDashboardData() {
  const st = new Date().setHours(0, 0, 0, 0);
  const sales = getDeduplicatedSales();
  const sls = sales.filter(r => new Date(r.date).getTime() >= st);
  const tot = sls.reduce((s, r) => s + (Number(r.total) || 0), 0);
  const items = loadJson<Item[]>(STORAGE_KEYS.ITEMS, DEFAULT_ITEMS);
  const ls = items.filter(x => x['Maintain Stock'] !== 'N' && Number(x['Current Stock']) <= Number(x['Reorder Level']) && Number(x['Reorder Level']) > 0);

  return {
    todaySalesCount: sls.length,
    todaySalesTotal: tot,
    totalItems: items.length,
    lowStockCount: ls.length,
    lowStockItems: ls.slice(0, 10)
  };
}

export function getCategoryLedgerBreakdown(category: string, from?: string, to?: string) {
  // Synchronize any posted payroll records to accounting entries & ledgers
  syncPayrollToAccounting();

  const fr = from ? new Date(from).setHours(0, 0, 0, 0) : 0;
  const toDt = to ? new Date(to).setHours(23, 59, 59, 999) : new Date(2099, 11, 31).getTime();
  const catLower = (category || '').trim().toLowerCase();

  // 1. Opening Stock Breakdown
  if (
    catLower === 'opening stock' ||
    catLower === 'opening stock valuation' ||
    catLower === 'opening inventory' ||
    catLower.includes('opening stock')
  ) {
    const items = loadJson<Item[]>(STORAGE_KEYS.ITEMS, DEFAULT_ITEMS);
    const stockLog = loadJson<StockLedgerEntry[]>(STORAGE_KEYS.STOCK_LEDGER, []);
    let totalQty = 0;
    let totalValuation = 0;
    const rows = items
      .filter(i => i['Maintain Stock'] !== 'N')
      .map(i => {
        const c = i['Item Code'];
        const pr = Number(i['Purchase Rate']) || 0;
        const opStock = Number(i['Opening Stock']) || 0;
        let o = opStock;
        stockLog.filter(l => l['Item Code'] === c).forEach(l => {
          if (l.Type === 'Opening' || (l['Ref No'] && l['Ref No'].startsWith('OPENING'))) return;
          const d = new Date(l.DateIso).getTime();
          const df = (Number(l['Qty In']) || 0) - (Number(l['Qty Out']) || 0);
          if (d < fr) { o += df; }
        });
        const val = (o === opStock && i['Opening Amount'] !== undefined)
          ? (Number(i['Opening Amount']) || (o * pr))
          : (o * pr);
        totalQty += o;
        totalValuation += val;
        return {
          code: c,
          name: i['Item Name'],
          group: i['Item Group'] || i.Group || '',
          unit: i['Base Unit'] || i.Unit || 'Pcs',
          stock: o,
          rate: pr,
          valuation: val
        };
      })
      .filter(x => Math.abs(x.valuation) > 0.001 || Math.abs(x.stock) > 0);

    return {
      type: 'stock',
      stockType: 'opening',
      stockLabel: 'Opening Qty',
      title: 'Opening Stock Breakdown',
      totalQty,
      totalValuation,
      rows
    };
  }

  // 2. Closing Stock / Stock Valuation Breakdown
  if (
    catLower === 'stock valuation' ||
    catLower === 'closing stock' ||
    catLower === 'closing stock valuation' ||
    catLower === 'closing inventory' ||
    catLower.includes('closing stock') ||
    catLower === 'stock-in-hand' ||
    catLower === 'stock in hand' ||
    catLower.includes('stock-in-hand')
  ) {
    const items = loadJson<Item[]>(STORAGE_KEYS.ITEMS, DEFAULT_ITEMS);
    const stockLog = loadJson<StockLedgerEntry[]>(STORAGE_KEYS.STOCK_LEDGER, []);
    let totalQty = 0;
    let totalValuation = 0;
    const rows = items
      .filter(i => i['Maintain Stock'] !== 'N')
      .map(i => {
        const c = i['Item Code'];
        const pr = Number(i['Purchase Rate']) || 0;
        const opStock = Number(i['Opening Stock']) || 0;
        let cl = opStock;
        stockLog.filter(l => l['Item Code'] === c).forEach(l => {
          if (l.Type === 'Opening' || (l['Ref No'] && l['Ref No'].startsWith('OPENING'))) return;
          const d = new Date(l.DateIso).getTime();
          const df = (Number(l['Qty In']) || 0) - (Number(l['Qty Out']) || 0);
          if (d <= toDt) cl += df;
        });
        const val = cl * pr;
        totalQty += cl;
        totalValuation += val;
        return {
          code: c,
          name: i['Item Name'],
          group: i['Item Group'] || i.Group || '',
          unit: i['Base Unit'] || i.Unit || 'Pcs',
          stock: cl,
          rate: pr,
          valuation: val
        };
      })
      .filter(x => Math.abs(x.valuation) > 0.001 || Math.abs(x.stock) > 0);

    return {
      type: 'stock',
      stockType: 'closing',
      stockLabel: 'Closing Qty',
      title: 'Closing Stock Valuation Breakdown',
      totalQty,
      totalValuation,
      rows
    };
  }

  // 2. Net Profit Breakdown
  if (catLower === 'net profit' || catLower.includes('net profit') || catLower === 'net loss' || catLower.includes('net loss')) {
    const fromStr = from || '2000-01-01';
    const toStr = to || new Date().toISOString().split('T')[0];
    const { pnl } = getFinancialReports('', fromStr, toStr);
    const grossProfit = (pnl.s + pnl.di + pnl.cs) - (pnl.p + pnl.de + pnl.os);
    const netProfit = grossProfit + pnl.ii - pnl.ie;

    const rows: Array<{ name: string; group: string; amount: number; type: 'Dr' | 'Cr' }> = [
      { name: 'Sales Revenue', group: 'Sales Accounts', amount: pnl.s, type: 'Cr' as 'Cr' },
      { name: 'Direct Incomes', group: 'Direct Incomes', amount: pnl.di, type: 'Cr' as 'Cr' },
      { name: 'Cost of Purchases', group: 'Purchase Accounts', amount: pnl.p, type: 'Dr' as 'Dr' },
      { name: 'Direct Expenses', group: 'Direct Expenses', amount: pnl.de, type: 'Dr' as 'Dr' },
      { name: 'Gross Profit / (Loss)', group: 'Trading Margin', amount: Math.abs(grossProfit), type: grossProfit >= 0 ? 'Cr' : 'Dr' as 'Dr' | 'Cr' },
      { name: 'Indirect Incomes', group: 'Indirect Incomes', amount: pnl.ii, type: 'Cr' as 'Cr' },
      { name: 'Indirect Expenses (Salaries, Rent, Admin, etc.)', group: 'Indirect Expenses', amount: pnl.ie, type: 'Dr' as 'Dr' },
      { name: 'Net Profit / (Loss) for Period', group: "Owner's Equity", amount: Math.abs(netProfit), type: netProfit >= 0 ? 'Cr' : 'Dr' as 'Dr' | 'Cr' }
    ].filter(r => r.amount > 0.001) as Array<{ name: string; group: string; amount: number; type: 'Dr' | 'Cr' }>;

    return { type: 'ledger', rows };
  }

  // 3. Fixed Assets Category Breakdown (Shows Categories with In / Addition, Out / Disposal, Depreciation, Balance - No individual asset names)
  if (
    catLower === 'fixed assets' ||
    catLower === 'fixed asset' ||
    catLower.includes('fixed asset')
  ) {
    const categories = loadJson<AssetCategory[]>('deep_pos_am_categories', DEFAULT_CATEGORIES);
    const assets = loadJson<FixedAsset[]>('deep_pos_am_assets', DEFAULT_ASSETS);
    const disposals = loadJson<AssetDisposal[]>('deep_pos_am_disposals', []);

    let totalIn = 0;
    let totalOut = 0;
    let totalDep = 0;
    let totalNet = 0;

    const rows = categories
      .filter(c => c.active !== false)
      .map(cat => {
        const catAssets = assets.filter(a => a.categoryId === cat.id || (a.subCategory && a.subCategory.toLowerCase() === cat.name.toLowerCase()) || (a.assetGlAccountId && a.assetGlAccountId.toLowerCase() === cat.name.toLowerCase()));
        const inAmount = catAssets.reduce((sum, a) => sum + (Number(a.totalCapitalizedCost) || Number(a.cost) || 0), 0);
        
        const disposedAssets = catAssets.filter(a => a.status === 'Disposed' || a.status === 'Sold' || a.status === 'Written Off');
        const outFromAssets = disposedAssets.reduce((sum, a) => sum + (Number(a.totalCapitalizedCost) || Number(a.cost) || 0), 0);
        const outFromDisposals = disposals
          .filter(d => catAssets.some(a => a.id === d.assetId || a.assetId === d.assetId))
          .reduce((sum, d) => sum + (Number(d.assetCost) || Number(d.netBookValue) || 0), 0);
        const outAmount = Math.max(outFromAssets, outFromDisposals);

        const depreciation = catAssets
          .filter(a => a.status === 'Active' || !a.status)
          .reduce((sum, a) => sum + (Number(a.accumulatedDepreciation) || 0), 0);

        const activeAssets = catAssets.filter(a => a.status === 'Active' || !a.status);
        const netBalance = activeAssets.reduce((sum, a) => sum + (Number(a.netBookValue) !== undefined ? Number(a.netBookValue) : (Number(a.totalCapitalizedCost || a.cost || 0) - Number(a.accumulatedDepreciation || 0))), 0);

        totalIn += inAmount;
        totalOut += outAmount;
        totalDep += depreciation;
        totalNet += netBalance;

        return {
          id: cat.id,
          category: cat.name,
          code: cat.code || '',
          inAmount,
          outAmount,
          depreciation,
          netBalance
        };
      })
      .filter(r => r.inAmount > 0 || r.netBalance > 0 || r.outAmount > 0);

    return {
      type: 'fixed-asset',
      title: 'Fixed Assets Category Summary',
      totalIn,
      totalOut,
      totalDep,
      totalNet,
      rows
    };
  }

  const rawLedgers = sanitizeLedgers(loadJson<Ledger[]>(STORAGE_KEYS.LEDGERS, DEFAULT_LEDGERS));
  const ledgerLog = loadJson<LedgerLogEntry[]>(STORAGE_KEYS.LEDGER_LOG, []);
  const groups = loadJson<LedgerGroup[]>(STORAGE_KEYS.LEDGER_GROUPS, DEFAULT_LEDGER_GROUPS);

  // Ensure all distinct ledgers from ledgerLog are represented
  const ledgers = [...rawLedgers];
  const existingLedgerNames = new Set(ledgers.map(l => (l['Ledger Name'] || '').trim().toLowerCase()));
  ledgerLog.forEach(log => {
    const lName = (log['Ledger Name'] || '').trim();
    if (lName && !existingLedgerNames.has(lName.toLowerCase())) {
      existingLedgerNames.add(lName.toLowerCase());
      ledgers.push({
        'Ledger Name': lName,
        Group: inferLedgerGroup(lName, 'Indirect Expenses'),
        'Opening Balance': 0,
        'Balance Type (Dr/Cr)': 'Dr',
        'Current Balance': 0
      });
    }
  });

  const getGrp = (n: string) => {
    const p = [n]; let c: string | undefined = n;
    let guard = 0;
    while (c && guard < 20) {
      guard++;
      const currentName = c;
      const g = groups.find(x => x['Group Name'].toLowerCase() === currentName.toLowerCase());
      if (g && g['Parent Group'] && g['Parent Group'] !== c) {
        p.push(g['Parent Group']);
        c = g['Parent Group'];
      } else {
        c = undefined;
      }
    }
    return p;
  };

  const getNat = (n: string) => {
    let c: string | undefined = n;
    let guard = 0;
    while (c && guard < 20) {
      guard++;
      const currentName = c;
      const g = groups.find(x => x['Group Name'].toLowerCase() === currentName.toLowerCase());
      if (g && g.Nature) return g.Nature;
      if (g && g['Parent Group'] && g['Parent Group'] !== c) {
        c = g['Parent Group'];
      } else {
        break;
      }
    }
    return 'Asset';
  };

  const rows: Array<{ name: string; group: string; amount: number; type: 'Dr' | 'Cr' }> = [];
  const addedLedgerKeys = new Set<string>();

  // Fetch report data for rec & pay breakdown
  const fromStr = from || '2000-01-01';
  const toStr = to || new Date().toISOString().split('T')[0];
  const repData = getFinancialReports('', fromStr, toStr);

  const isCurrentAssetsCat =
    catLower === 'current assets' ||
    catLower.includes('current assets') ||
    catLower.includes('cash/bank/debtors') ||
    catLower.includes('sundry debtors');

  const isCurrentLiabilitiesCat =
    catLower === 'current liabilities' ||
    catLower.includes('current liabilities') ||
    catLower.includes('sundry creditors') ||
    catLower.includes('payables');

  // If drilling into Current Assets, inject Sundry Debtors from rec
  if (isCurrentAssetsCat && repData.rec && repData.rec.length > 0) {
    repData.rec.forEach(debtor => {
      if (debtor.amt > 0.005) {
        const cleanName = debtor.name.trim();
        rows.push({
          name: cleanName,
          group: 'Sundry Debtors',
          amount: debtor.amt,
          type: 'Dr'
        });
        addedLedgerKeys.add(cleanName.toLowerCase());
      }
    });
  }

  // If drilling into Current Liabilities, inject Sundry Creditors from pay
  if (isCurrentLiabilitiesCat && repData.pay && repData.pay.length > 0) {
    repData.pay.forEach(creditor => {
      if (creditor.amt > 0.005) {
        const cleanName = creditor.name.trim();
        rows.push({
          name: cleanName,
          group: 'Sundry Creditors',
          amount: creditor.amt,
          type: 'Cr'
        });
        addedLedgerKeys.add(cleanName.toLowerCase());
      }
    });
  }

  ledgers.forEach(l => {
    const n = l['Ledger Name'];
    const cleanLName = (n || '').trim().toLowerCase();
    if (addedLedgerKeys.has(cleanLName)) return;

    const grp = l.Group || inferLedgerGroup(n, 'Indirect Expenses');
    const path = getGrp(grp);
    const nat = getNat(grp);

    let bal = (Number(l['Opening Balance']) || 0) * (l['Balance Type (Dr/Cr)'] === 'Cr' ? -1 : 1);
    ledgerLog.forEach(log => {
      const logName = (log['Ledger Name'] || '').trim().toLowerCase();
      if (logName === cleanLName) {
        const d = new Date(log.DateIso).getTime();
        if (d <= toDt) bal += ((Number(log.Debit) || 0) - (Number(log.Credit) || 0));
      }
    });

    if (bal === 0 && Number(l['Current Balance']) !== 0) {
      bal = (Number(l['Current Balance']) || 0) * (l['Balance Type (Dr/Cr)'] === 'Cr' ? -1 : 1);
    }

    let pBal = 0;
    if (nat === 'Income' || nat === 'Expense') {
      ledgerLog.forEach(log => {
        const logName = (log['Ledger Name'] || '').trim().toLowerCase();
        if (logName === cleanLName) {
          const d = new Date(log.DateIso).getTime();
          if (d >= fr && d <= toDt) pBal += ((Number(log.Debit) || 0) - (Number(log.Credit) || 0));
        }
      });
      if (pBal === 0 && (Number(l['Current Balance']) !== 0 || bal !== 0)) {
        pBal = bal !== 0 ? bal : ((Number(l['Current Balance']) || 0) * (l['Balance Type (Dr/Cr)'] === 'Cr' ? -1 : 1));
      }
    }

    let match = false;
    let amtToUse = bal;

    const isDirectExpense =
      path.some(p => p.toLowerCase().includes('direct expens') || p.toLowerCase().includes('wages & factory') || p.toLowerCase().includes('freight')) ||
      grp.toLowerCase().includes('direct expens') ||
      grp.toLowerCase().includes('wages & factory') ||
      grp.toLowerCase().includes('freight');

    const isPurchaseAccount =
      path.some(p => p.toLowerCase().includes('purchase account') || p.toLowerCase().includes('purchase accounts')) ||
      grp.toLowerCase().includes('purchase') ||
      cleanLName.includes('purchase');

    const isIndirectExpense =
      path.some(p => p.toLowerCase().includes('indirect expens') || p.toLowerCase().includes('administrative') || p.toLowerCase().includes('selling & distribution') || p.toLowerCase().includes('financial expens')) ||
      grp.toLowerCase().includes('indirect expens') ||
      grp.toLowerCase().includes('administrative') ||
      grp.toLowerCase().includes('selling') ||
      grp.toLowerCase().includes('financial') ||
      ( !cleanLName.includes('payable') && (cleanLName.includes('salary') || cleanLName.includes('rent') || cleanLName.includes('expense')) ) ||
      (nat === 'Expense' && !isPurchaseAccount && !isDirectExpense);

    const isDirectIncome =
      path.some(p => p.toLowerCase().includes('direct income') || p.toLowerCase().includes('direct incomes')) ||
      grp.toLowerCase().includes('direct income');

    const isSalesAccount =
      path.some(p => p.toLowerCase().includes('sales account') || p.toLowerCase().includes('sales accounts')) ||
      grp.toLowerCase().includes('sales') ||
      cleanLName.includes('sales');

    const isIndirectIncome =
      path.some(p => p.toLowerCase().includes('indirect income') || p.toLowerCase().includes('indirect incomes')) ||
      grp.toLowerCase().includes('indirect income') ||
      (nat === 'Income' && !isSalesAccount && !isDirectIncome);

    if ((catLower === 'indirect expenses' || catLower.includes('indirect expens')) && isIndirectExpense) {
      match = true;
      amtToUse = Math.abs(pBal) > 0.001 ? pBal : (Math.abs(bal) > 0.001 ? bal : (Number(l['Current Balance']) || 0));
    } else if ((catLower === 'direct expenses' || catLower.includes('direct expens')) && isDirectExpense) {
      match = true;
      amtToUse = Math.abs(pBal) > 0.001 ? pBal : bal;
    } else if ((catLower === 'sales revenue' || catLower === 'sales accounts' || catLower === 'sales account' || catLower === 'sales') && isSalesAccount) {
      match = true;
      amtToUse = Math.abs(pBal) > 0.001 ? pBal : bal;
    } else if ((catLower === 'cost of purchases' || catLower === 'purchase accounts' || catLower === 'purchase account' || catLower === 'purchases') && isPurchaseAccount) {
      match = true;
      amtToUse = Math.abs(pBal) > 0.001 ? pBal : bal;
    } else if ((catLower === 'direct income' || catLower === 'direct incomes') && isDirectIncome) {
      match = true;
      amtToUse = Math.abs(pBal) > 0.001 ? pBal : bal;
    } else if ((catLower === 'indirect income' || catLower === 'indirect incomes') && isIndirectIncome) {
      match = true;
      amtToUse = Math.abs(pBal) > 0.001 ? pBal : bal;
    } else if ((catLower === 'capital account' || catLower.includes('capital') || catLower.includes('equity')) && (path.some(p => p.toLowerCase().includes('capital') || p.toLowerCase().includes('reserves')) || grp.toLowerCase().includes('capital') || nat === 'Capital')) {
      match = true;
      amtToUse = bal !== 0 ? bal : (Number(l['Current Balance']) || Number(l['Opening Balance']) || 0);
    } else if ((catLower === 'loans (liability)' || catLower === 'loans & liabilities' || catLower === 'loans' || catLower === 'loan') && (path.some(p => p.toLowerCase().includes('loan') || p.toLowerCase().includes('bank od')) || grp.toLowerCase().includes('loan'))) {
      match = true;
      amtToUse = bal;
    } else if (isCurrentLiabilitiesCat && (path.some(p => p.toLowerCase().includes('current liabilit') || p.toLowerCase().includes('sundry creditor') || p.toLowerCase().includes('duties & tax') || p.toLowerCase().includes('provisions')) || (nat === 'Liability' && !path.some(p => p.toLowerCase().includes('capital') || p.toLowerCase().includes('loan'))))) {
      match = true;
      amtToUse = bal !== 0 ? bal : (Number(l['Current Balance']) || 0);
    } else if ((catLower === 'fixed assets' || catLower === 'fixed assets (properties/equip)' || catLower === 'fixed assets (properties & equipment)') && (path.some(p => p.toLowerCase().includes('fixed asset')) || grp.toLowerCase().includes('fixed asset'))) {
      match = true;
      amtToUse = bal;
    } else if (isCurrentAssetsCat && (path.some(p => p.toLowerCase().includes('current asset') || p.toLowerCase().includes('sundry debtor') || p.toLowerCase().includes('bank') || p.toLowerCase().includes('cash') || p.toLowerCase().includes('deposit') || p.toLowerCase().includes('loans & advances')) || (nat === 'Asset' && !path.some(p => p.toLowerCase().includes('fixed asset'))))) {
      match = true;
      amtToUse = bal !== 0 ? bal : (Number(l['Current Balance']) || 0);
    } else if (path.some(p => p.toLowerCase() === catLower) || grp.toLowerCase() === catLower) {
      match = true;
      amtToUse = (nat === 'Expense' || nat === 'Income') ? pBal : bal;
    }

    if (match && Math.abs(amtToUse) > 0.001) {
      rows.push({
        name: n,
        group: grp,
        amount: Math.abs(amtToUse),
        type: (nat === 'Expense' || nat === 'Asset')
          ? (amtToUse >= 0 ? 'Dr' : 'Cr')
          : (amtToUse <= 0 ? 'Cr' : 'Dr')
      });
      addedLedgerKeys.add(cleanLName);
    }
  });

  // If drilling into Capital Account and no rows, ensure primary Capital Account ledger exists
  if ((catLower === 'capital account' || catLower.includes('capital')) && rows.length === 0) {
    const capLedger = ledgers.find(l => (l['Ledger Name'] || '').toLowerCase().includes('capital'));
    if (capLedger) {
      rows.push({
        name: capLedger['Ledger Name'],
        group: 'Capital Account',
        amount: Number(capLedger['Opening Balance']) || Number(capLedger['Current Balance']) || 0,
        type: 'Cr'
      });
    }
  }

  // Sort rows by amount descending
  rows.sort((a, b) => b.amount - a.amount);

  return { type: 'ledger', rows };
}

// ==================== PAYROLL SERVICES ====================

export function getPayHeads(): PayHead[] {
  const heads = loadJson<PayHead[]>(STORAGE_KEYS.PAY_HEADS, DEFAULT_PAY_HEADS);
  return heads.map(h => {
    if (h.id === 'ph_health') {
      return {
        ...h,
        calculationType: 'PercentGross',
        defaultValue: h.defaultValue || 1,
        description: 'Statutory Bhutan Health Contribution (1% of Gross Salary)'
      };
    }
    if (h.id === 'ph_pit') {
      return {
        ...h,
        calculationType: 'Manual',
        description: 'DRC Bhutan Personal Income Tax (Annexure-III Slab on Gross minus 15% Standard Deduction)'
      };
    }
    return h;
  });
}

export function savePayHeads(heads: PayHead[]): void {
  saveJson(STORAGE_KEYS.PAY_HEADS, heads);
}

export function getEmployees(): Employee[] {
  return loadJson<Employee[]>(STORAGE_KEYS.EMPLOYEES, DEFAULT_EMPLOYEES);
}

export function saveEmployees(employees: Employee[]): void {
  saveJson(STORAGE_KEYS.EMPLOYEES, employees);
}

export function getMonthlyPayrolls(): MonthlyPayroll[] {
  return loadJson<MonthlyPayroll[]>(STORAGE_KEYS.MONTHLY_PAYROLLS, []);
}

export function saveMonthlyPayroll(payroll: MonthlyPayroll): void {
  const list = getMonthlyPayrolls();
  const idx = list.findIndex(p => p.id === payroll.id);
  if (idx >= 0) {
    list[idx] = payroll;
  } else {
    list.push(payroll);
  }
  saveJson(STORAGE_KEYS.MONTHLY_PAYROLLS, list);
}

export function syncPayrollToAccounting(): void {
  const payrolls = loadJson<MonthlyPayroll[]>(STORAGE_KEYS.MONTHLY_PAYROLLS, []);
  if (!payrolls || payrolls.length === 0) return;

  const logs = loadJson<LedgerLogEntry[]>(STORAGE_KEYS.LEDGER_LOG, []);
  const vouchers = loadJson<Voucher[]>(STORAGE_KEYS.VOUCHERS, []);
  const ledgers = loadJson<Ledger[]>(STORAGE_KEYS.LEDGERS, DEFAULT_LEDGERS);
  let logsModified = false;
  let vouchersModified = false;
  let ledgersModified = false;

  const ensureLedger = (name: string, grp: string, drCr: 'Dr' | 'Cr') => {
    const cleanName = name.trim().toLowerCase();
    let found = ledgers.find(l => l['Ledger Name']?.trim().toLowerCase() === cleanName);
    if (!found) {
      found = {
        'Ledger Name': name,
        Group: grp,
        'Opening Balance': 0,
        'Balance Type (Dr/Cr)': drCr,
        'Current Balance': 0
      };
      ledgers.push(found);
      ledgersModified = true;
    } else if (!found.Group || found.Group === 'Sundry Debtors') {
      found.Group = grp;
      ledgersModified = true;
    }
  };

  // Ensure all standard payroll accounts exist
  ensureLedger('Salaries & Wages Expense', 'Indirect Expenses', 'Dr');
  ensureLedger('Salary Payable', 'Duties & Taxes', 'Cr');
  ensureLedger('NPPF Payable', 'Duties & Taxes', 'Cr');
  ensureLedger('GIS Payable', 'Duties & Taxes', 'Cr');
  ensureLedger('PIT Payable', 'Duties & Taxes', 'Cr');
  ensureLedger('Health Contribution Payable', 'Duties & Taxes', 'Cr');
  ensureLedger('Salary Advance Recovery', 'Loans & Advances (Asset)', 'Dr');
  ensureLedger('Staff Loan Recovery', 'Loans & Advances (Asset)', 'Dr');

  payrolls.forEach(payroll => {
    if (!payroll.isPostedToAccounting) return;

    // Calculate month end date
    let postDate = new Date();
    if (payroll.year && payroll.month) {
      postDate = new Date(payroll.year, payroll.month, 0, 18, 0, 0, 0);
    } else if (payroll.id && /^\d{4}-\d{2}$/.test(payroll.id)) {
      const [y, m] = payroll.id.split('-').map(Number);
      postDate = new Date(y, m, 0, 18, 0, 0, 0);
    }
    const dateIso = postDate.toISOString();
    const vNo = payroll.voucherRefNo || `JV-PAY-${payroll.id || payroll.monthYear.replace(/\s+/g, '-')}`;

    // Check if logs already exist for this payroll voucher
    const existingLogIdxs: number[] = [];
    logs.forEach((log, idx) => {
      if (
        log['Ref No'] === vNo ||
        (log.Narration && log.Narration.includes(payroll.monthYear)) ||
        (log['Ref No'] === payroll.voucherRefNo && payroll.voucherRefNo)
      ) {
        existingLogIdxs.push(idx);
      }
    });

    // Calculate deduction totals
    let totalNPPF = 0;
    let totalGIS = 0;
    let totalPIT = 0;
    let totalHealth = 0;
    let totalAdvance = 0;
    let totalLoan = 0;

    payroll.entries.forEach(e => {
      e.deductions.forEach(d => {
        const name = d.payHeadName.toLowerCase();
        if (name.includes('nppf') || name.includes('provident')) totalNPPF += d.amount;
        else if (name.includes('gis') || name.includes('insurance')) totalGIS += d.amount;
        else if (name.includes('pit') || name.includes('tax')) totalPIT += d.amount;
        else if (name.includes('health')) totalHealth += d.amount;
        else if (name.includes('advance')) totalAdvance += d.amount;
        else if (name.includes('loan')) totalLoan += d.amount;
      });
    });

    const newLogsForPayroll: LedgerLogEntry[] = [
      {
        DateIso: dateIso,
        'Ledger Name': 'Salaries & Wages Expense',
        Type: 'Journal',
        Debit: round2(payroll.totalGrossPay),
        Credit: 0,
        'Ref No': vNo,
        Narration: `Monthly Salary Expenses for ${payroll.monthYear}`
      },
      {
        DateIso: dateIso,
        'Ledger Name': 'Salary Payable',
        Type: 'Journal',
        Debit: 0,
        Credit: round2(payroll.totalNetPay),
        'Ref No': vNo,
        Narration: `Net Salary Payable for ${payroll.monthYear}`
      }
    ];

    if (totalNPPF > 0) {
      newLogsForPayroll.push({
        DateIso: dateIso,
        'Ledger Name': 'NPPF Payable',
        Type: 'Journal',
        Debit: 0,
        Credit: round2(totalNPPF),
        'Ref No': vNo,
        Narration: `NPPF Provident Fund Deduction for ${payroll.monthYear}`
      });
    }

    if (totalGIS > 0) {
      newLogsForPayroll.push({
        DateIso: dateIso,
        'Ledger Name': 'GIS Payable',
        Type: 'Journal',
        Debit: 0,
        Credit: round2(totalGIS),
        'Ref No': vNo,
        Narration: `GIS Group Insurance Deduction for ${payroll.monthYear}`
      });
    }

    if (totalPIT > 0) {
      newLogsForPayroll.push({
        DateIso: dateIso,
        'Ledger Name': 'PIT Payable',
        Type: 'Journal',
        Debit: 0,
        Credit: round2(totalPIT),
        'Ref No': vNo,
        Narration: `PIT Income Tax Deduction for ${payroll.monthYear}`
      });
    }

    if (totalHealth > 0) {
      newLogsForPayroll.push({
        DateIso: dateIso,
        'Ledger Name': 'Health Contribution Payable',
        Type: 'Journal',
        Debit: 0,
        Credit: round2(totalHealth),
        'Ref No': vNo,
        Narration: `Health Contribution (1% Gross) for ${payroll.monthYear}`
      });
    }

    if (totalAdvance > 0) {
      newLogsForPayroll.push({
        DateIso: dateIso,
        'Ledger Name': 'Salary Advance Recovery',
        Type: 'Journal',
        Debit: 0,
        Credit: round2(totalAdvance),
        'Ref No': vNo,
        Narration: `Salary Advance Recovery for ${payroll.monthYear}`
      });
    }

    if (totalLoan > 0) {
      newLogsForPayroll.push({
        DateIso: dateIso,
        'Ledger Name': 'Staff Loan Recovery',
        Type: 'Journal',
        Debit: 0,
        Credit: round2(totalLoan),
        'Ref No': vNo,
        Narration: `Staff Loan EMI Recovery for ${payroll.monthYear}`
      });
    }

    if (existingLogIdxs.length === 0) {
      logs.push(...newLogsForPayroll);
      logsModified = true;
    } else {
      // Ensure existing logs have the exact payroll month-end dateIso
      existingLogIdxs.forEach(idx => {
        if (logs[idx].DateIso !== dateIso) {
          logs[idx].DateIso = dateIso;
          logsModified = true;
        }
      });
    }

    // Ensure voucher exists in vouchers list
    let existingVoucher = vouchers.find(v => v.voucherNo === vNo || (v.narration && v.narration.includes(payroll.monthYear)));
    if (!existingVoucher) {
      vouchers.push({
        voucherNo: vNo,
        date: dateIso,
        type: 'J',
        debitLedger: 'Salaries & Wages Expense',
        creditLedger: 'Salary Payable',
        amount: round2(payroll.totalGrossPay),
        narration: `Payroll JV for ${payroll.monthYear} (Net Pay Nu. ${payroll.totalNetPay})`
      });
      vouchersModified = true;
    } else if (existingVoucher.date !== dateIso) {
      existingVoucher.date = dateIso;
      vouchersModified = true;
    }
  });

  if (logsModified) saveJson(STORAGE_KEYS.LEDGER_LOG, logs);
  if (vouchersModified) saveJson(STORAGE_KEYS.VOUCHERS, vouchers);
  if (ledgersModified) saveJson(STORAGE_KEYS.LEDGERS, ledgers);
}

export function postPayrollJournalVoucher(payrollId: string): { success: boolean; voucherNo?: string;
  originalVoucherNo?: string; error?: string } {
  const payrolls = getMonthlyPayrolls();
  const payroll = payrolls.find(p => p.id === payrollId);
  if (!payroll) return { success: false, error: 'Payroll record not found.' };

  if (payroll.isPostedToAccounting) {
    return { success: false, error: 'Payroll is already posted to Accounting.' };
  }

  const vNo = 'JV-' + nextCounter('JournalVoucher');
  
  // Align transaction date to the end of the payroll month
  let postDate = new Date();
  if (payroll.year && payroll.month) {
    postDate = new Date(payroll.year, payroll.month, 0, 18, 0, 0, 0);
  } else if (payroll.id && /^\d{4}-\d{2}$/.test(payroll.id)) {
    const [y, m] = payroll.id.split('-').map(Number);
    postDate = new Date(y, m, 0, 18, 0, 0, 0);
  }
  const dateIso = postDate.toISOString();

  const logs = loadJson<LedgerLogEntry[]>(STORAGE_KEYS.LEDGER_LOG, []);
  const vouchers = loadJson<Voucher[]>(STORAGE_KEYS.VOUCHERS, []);
  const ledgers = loadJson<Ledger[]>(STORAGE_KEYS.LEDGERS, DEFAULT_LEDGERS);

  const ensureLedger = (name: string, grp: string, drCr: 'Dr' | 'Cr') => {
    const cleanName = name.trim().toLowerCase();
    let found = ledgers.find(l => l['Ledger Name']?.trim().toLowerCase() === cleanName);
    if (!found) {
      found = {
        'Ledger Name': name,
        Group: grp,
        'Opening Balance': 0,
        'Balance Type (Dr/Cr)': drCr,
        'Current Balance': 0
      };
      ledgers.push(found);
    } else if (!found.Group || found.Group === 'Sundry Debtors') {
      found.Group = grp;
    }
  };

  ensureLedger('Salaries & Wages Expense', 'Indirect Expenses', 'Dr');
  ensureLedger('Salary Payable', 'Duties & Taxes', 'Cr');
  ensureLedger('NPPF Payable', 'Duties & Taxes', 'Cr');
  ensureLedger('GIS Payable', 'Duties & Taxes', 'Cr');
  ensureLedger('PIT Payable', 'Duties & Taxes', 'Cr');
  ensureLedger('Health Contribution Payable', 'Duties & Taxes', 'Cr');
  ensureLedger('Salary Advance Recovery', 'Loans & Advances (Asset)', 'Dr');
  ensureLedger('Staff Loan Recovery', 'Loans & Advances (Asset)', 'Dr');

  // Debit: Salaries & Wages Expense (Total Gross Pay)
  logs.push({
    DateIso: dateIso,
    'Ledger Name': 'Salaries & Wages Expense',
    Type: 'Journal',
    Debit: round2(payroll.totalGrossPay),
    Credit: 0,
    'Ref No': vNo,
    Narration: `Monthly Salary Expenses for ${payroll.monthYear}`
  });

  // Credit: Salary Payable
  logs.push({
    DateIso: dateIso,
    'Ledger Name': 'Salary Payable',
    Type: 'Journal',
    Debit: 0,
    Credit: round2(payroll.totalNetPay),
    'Ref No': vNo,
    Narration: `Net Salary Payable for ${payroll.monthYear}`
  });

  // Calculate total NPPF, GIS, PIT, Health, Advance, Loan deductions across entries
  let totalNPPF = 0;
  let totalGIS = 0;
  let totalPIT = 0;
  let totalHealth = 0;
  let totalAdvance = 0;
  let totalLoan = 0;

  payroll.entries.forEach(e => {
    e.deductions.forEach(d => {
      const name = d.payHeadName.toLowerCase();
      if (name.includes('nppf') || name.includes('provident')) totalNPPF += d.amount;
      else if (name.includes('gis') || name.includes('insurance')) totalGIS += d.amount;
      else if (name.includes('pit') || name.includes('tax')) totalPIT += d.amount;
      else if (name.includes('health')) totalHealth += d.amount;
      else if (name.includes('advance')) totalAdvance += d.amount;
      else if (name.includes('loan')) totalLoan += d.amount;
    });
  });

  if (totalNPPF > 0) {
    logs.push({
      DateIso: dateIso,
      'Ledger Name': 'NPPF Payable',
      Type: 'Journal',
      Debit: 0,
      Credit: round2(totalNPPF),
      'Ref No': vNo,
      Narration: `NPPF Provident Fund Deduction for ${payroll.monthYear}`
    });
  }

  if (totalGIS > 0) {
    logs.push({
      DateIso: dateIso,
      'Ledger Name': 'GIS Payable',
      Type: 'Journal',
      Debit: 0,
      Credit: round2(totalGIS),
      'Ref No': vNo,
      Narration: `GIS Group Insurance Deduction for ${payroll.monthYear}`
    });
  }

  if (totalPIT > 0) {
    logs.push({
      DateIso: dateIso,
      'Ledger Name': 'PIT Payable',
      Type: 'Journal',
      Debit: 0,
      Credit: round2(totalPIT),
      'Ref No': vNo,
      Narration: `PIT Income Tax Deduction for ${payroll.monthYear}`
    });
  }

  if (totalHealth > 0) {
    logs.push({
      DateIso: dateIso,
      'Ledger Name': 'Health Contribution Payable',
      Type: 'Journal',
      Debit: 0,
      Credit: round2(totalHealth),
      'Ref No': vNo,
      Narration: `Health Contribution (1% Gross) for ${payroll.monthYear}`
    });
  }

  if (totalAdvance > 0) {
    logs.push({
      DateIso: dateIso,
      'Ledger Name': 'Salary Advance Recovery',
      Type: 'Journal',
      Debit: 0,
      Credit: round2(totalAdvance),
      'Ref No': vNo,
      Narration: `Salary Advance Recovery for ${payroll.monthYear}`
    });
  }

  if (totalLoan > 0) {
    logs.push({
      DateIso: dateIso,
      'Ledger Name': 'Staff Loan Recovery',
      Type: 'Journal',
      Debit: 0,
      Credit: round2(totalLoan),
      'Ref No': vNo,
      Narration: `Staff Loan EMI Recovery for ${payroll.monthYear}`
    });
  }

  vouchers.push({
    voucherNo: vNo,
    date: dateIso,
    type: 'J',
    debitLedger: 'Salaries & Wages Expense',
    creditLedger: 'Salary Payable',
    amount: round2(payroll.totalGrossPay),
    narration: `Payroll JV for ${payroll.monthYear} (Net Pay Nu. ${payroll.totalNetPay})`
  });

  saveJson(STORAGE_KEYS.LEDGER_LOG, logs);
  saveJson(STORAGE_KEYS.VOUCHERS, vouchers);
  saveJson(STORAGE_KEYS.LEDGERS, ledgers);

  // Mark payroll as posted
  payroll.isPostedToAccounting = true;
  payroll.voucherRefNo = vNo;
  saveMonthlyPayroll(payroll);

  return { success: true, voucherNo: vNo };
}

export function getUsers(targetCompanyId?: string): AppUser[] {
  const cId = targetCompanyId || getActiveCompanyId();
  const list = loadJson<AppUser[]>(STORAGE_KEYS.USERS, [], cId);
  if (list && list.length > 0) return list;

  // If client company has no users loaded in storage yet, check cached company data
  if (cId !== DEFAULT_TENANT_COMPANY.id) {
    const defaultAdminPerms: UserPermission[] = [
      { module: 'pos', display: true, create: true, edit: true, delete: true, print: true },
      { module: 'purchase', display: true, create: true, edit: true, delete: true, print: true },
      { module: 'vouchers', display: true, create: true, edit: true, delete: true, print: true },
      { module: 'masters', display: true, create: true, edit: true, delete: true, print: true },
      { module: 'barcode', display: true, create: true, edit: true, delete: true, print: true },
      { module: 'payroll', display: true, create: true, edit: true, delete: true, print: true },
      { module: 'reports', display: true, create: true, edit: true, delete: true, print: true },
      { module: 'settings', display: true, create: true, edit: true, delete: true, print: true }
    ];

    try {
      const cached = typeof localStorage !== 'undefined' ? localStorage.getItem('supabase_user_companies_cache') : null;
      if (cached) {
        const comps = JSON.parse(cached);
        const comp = comps.find((c: any) => c.id === cId);
        if (comp) {
          const adminUser: AppUser = {
            id: `admin_${cId}`,
            username: (comp.admin_username || 'admin').trim().toLowerCase(),
            fullName: (comp.admin_name || `${comp.company_name} Administrator`).trim(),
            role: 'Administrator',
            status: 'Active',
            pinCode: (comp.admin_pin || '1234').trim(),
            permissions: defaultAdminPerms
          };
          saveJson(STORAGE_KEYS.USERS, [adminUser], cId);
          return [adminUser];
        }
      }
    } catch {}

    // Fallback client admin user
    const clientAdmin: AppUser = {
      id: `admin_${cId}`,
      username: 'admin',
      fullName: 'Administrator',
      role: 'Administrator',
      status: 'Active',
      pinCode: '1234',
      permissions: defaultAdminPerms
    };
    saveJson(STORAGE_KEYS.USERS, [clientAdmin], cId);
    return [clientAdmin];
  }

  return DEFAULT_USERS;
}

export function saveUsers(users: AppUser[], targetCompanyId?: string): void {
  const cId = targetCompanyId || getActiveCompanyId();
  saveJson(STORAGE_KEYS.USERS, users, cId);

  // Cross-PC sync: Save to Supabase tenant_settings so staff accounts appear on all computers
  if (isSupabaseConfigured && cId) {
    Promise.resolve(
      supabase
        .from('tenant_settings')
        .upsert({
          company_id: cId,
          record_id: 'company_staff_users',
          data: { users, updated_at: new Date().toISOString() }
        }, { onConflict: 'company_id,record_id' })
    ).catch((err) => {
      console.warn('[Supabase saveUsers cloud sync error]:', err);
    });
  }
}

export async function syncUsersFromSupabase(targetCompanyId?: string): Promise<AppUser[]> {
  const cId = targetCompanyId || getActiveCompanyId();
  if (!isSupabaseConfigured || !cId) return getUsers(cId);

  try {
    const { data, error } = await supabase
      .from('tenant_settings')
      .select('data')
      .eq('company_id', cId)
      .eq('record_id', 'company_staff_users')
      .maybeSingle();

    if (!error && data?.data?.users && Array.isArray(data.data.users) && data.data.users.length > 0) {
      saveJson(STORAGE_KEYS.USERS, data.data.users, cId);
      return data.data.users;
    }
  } catch (err) {
    console.warn('[Supabase syncUsersFromSupabase notice]:', err);
  }
  return getUsers(cId);
}

export function getActiveUser(targetCompanyId?: string): AppUser {
  const cId = targetCompanyId || getActiveCompanyId();
  const users = getUsers(cId);
  const activeId = loadJson<string>('deep_pos_active_user_id', users[0]?.id || `admin_${cId}`, cId);
  return users.find(u => u.id === activeId) || users[0];
}

export function setActiveUser(userId: string, targetCompanyId?: string): void {
  const cId = targetCompanyId || getActiveCompanyId();
  saveJson('deep_pos_active_user_id', userId, cId);
}

export function canUserViewAuditTrail(user?: AppUser): boolean {
  const u = user || getActiveUser();
  if (!u) return true;
  const role = (u.role || '').toLowerCase();
  if (!role || role.includes('admin') || role.includes('manag') || role.includes('owner') || role.includes('super')) {
    return true;
  }
  // Default to allowing audit viewing across managers, administrators and authorized operators
  return true;
}

export function getAuditLogs(): AuditLogEntry[] {
  const cId = getActiveCompanyId();
  const isDemo = cId === DEFAULT_TENANT_COMPANY.id;
  const logs = loadJson<AuditLogEntry[]>(STORAGE_KEYS.AUDIT_LOG, []);
  if (logs.length === 0 && isDemo) {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const initialLogs: AuditLogEntry[] = [
      {
        id: 'aud_seed_1',
        timestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
        date: todayStr,
        time: '09:00:00 AM',
        action: 'ENTERED',
        userId: 'usr_admin',
        userName: 'System Administrator',
        userRole: 'Administrator',
        module: 'System Settings',
        recordId: 'CFG-001',
        details: 'Initial system and company profile setup'
      },
      {
        id: 'aud_seed_2',
        timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
        date: todayStr,
        time: '10:15:30 AM',
        action: 'ENTERED',
        userId: 'usr_admin',
        userName: 'System Administrator',
        userRole: 'Administrator',
        module: 'Item Master',
        recordId: 'ITM-DEMO-01',
        partyName: 'Red Bull Energy Drink 250ml',
        amount: 110,
        details: 'New stock item created (Rate: Nu. 110.00, Opening: 50 pcs)'
      },
      {
        id: 'aud_seed_3',
        timestamp: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
        date: todayStr,
        time: '11:45:12 AM',
        action: 'ENTERED',
        userId: 'usr_cashier',
        userName: 'Karma Store Cashier',
        userRole: 'Cashier',
        module: 'POS Billing',
        recordId: 'POS-0001',
        partyName: 'Cash Sale',
        amount: 1250,
        details: 'Created invoice (4 items, Cash Paid)'
      },
      {
        id: 'aud_seed_4',
        timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
        date: todayStr,
        time: '02:20:05 PM',
        action: 'ALTERED',
        userId: 'usr_admin',
        userName: 'System Administrator',
        userRole: 'Administrator',
        module: 'Sales Invoice',
        recordId: 'INV-0002',
        partyName: 'Tashi Commercial Corp',
        amount: 8500,
        prevAmount: 7200,
        details: 'Updated total: Nu. 7,200.00 → Nu. 8,500.00 (3 items)'
      },
      {
        id: 'aud_seed_5',
        timestamp: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
        date: todayStr,
        time: '03:10:40 PM',
        action: 'CANCELLED',
        userId: 'usr_admin',
        userName: 'System Administrator',
        userRole: 'Administrator',
        module: 'Sales Invoice',
        recordId: 'INV-0003',
        partyName: 'Norbu Trading',
        amount: 3400,
        details: 'Reason: Duplicate billing requested by customer'
      }
    ];
    saveJson(STORAGE_KEYS.AUDIT_LOG, initialLogs);
    return initialLogs;
  }
  return logs;
}

export function saveAuditLogs(logs: AuditLogEntry[]): void {
  saveJson(STORAGE_KEYS.AUDIT_LOG, logs);
}

export function clearAuditLogs(): void {
  saveJson(STORAGE_KEYS.AUDIT_LOG, []);
}

export function addAuditLog(params: {
  action: AuditActionType;
  module: string;
  recordId: string;
  partyName?: string;
  amount?: number;
  prevAmount?: number;
  details?: string;
  user?: AppUser;
  timestamp?: string;
}): void {
  try {
    const cfg = loadJson<Config>(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
    if (cfg.EnableAuditTrail === 'false') {
      return;
    }

    const user = params.user || getActiveUser();
    const now = params.timestamp ? new Date(params.timestamp) : new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const entry: AuditLogEntry = {
      id: 'aud_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      timestamp: now.toISOString(),
      date: dateStr,
      time: timeStr,
      action: params.action,
      userId: user?.id || 'usr_unknown',
      userName: user?.fullName || user?.username || 'System User',
      userRole: user?.role || 'Administrator',
      module: params.module,
      recordId: params.recordId || '',
      partyName: params.partyName,
      amount: params.amount !== undefined ? Number(params.amount) : undefined,
      prevAmount: params.prevAmount !== undefined ? Number(params.prevAmount) : undefined,
      details: params.details
    };

    const logs = getAuditLogs();
    logs.unshift(entry);
    if (logs.length > 5000) {
      logs.length = 5000;
    }
    saveAuditLogs(logs);
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}

export function cancelVoucherByRef(refNo: string, reason?: string) {
  if (!refNo) return { ok: false, error: 'Reference number required' };
  const cleanRef = String(refNo).trim();
  
  // 1. Sales Invoices
  const sales = getDeduplicatedSales();
  if (sales.some(s => s.invoiceNo === cleanRef)) {
    return cancelSalesInvoice(cleanRef, reason);
  }

  // 2. Purchase Invoices
  const purchases = getDeduplicatedPurchases();
  if (purchases.some(p => p.billNo === cleanRef || p.invoiceNo === cleanRef)) {
    return cancelPurchaseInvoice(cleanRef, reason);
  }

  // 3. Standard Vouchers (P, R, J, C, CN, DN)
  const vouchers = loadJson<Voucher[]>(STORAGE_KEYS.VOUCHERS, []);
  if (vouchers.some(v => v.voucherNo === cleanRef)) {
    return cancelVoucher(cleanRef, reason);
  }

  // 4. Delivery Notes
  const dlvRes = deleteDeliveryNote(cleanRef);
  if (dlvRes.ok) return dlvRes;

  // 5. Quotations
  const qtnRes = deleteQuotation(cleanRef);
  if (qtnRes.ok) return qtnRes;

  return { ok: false, error: 'Voucher not found or could not be cancelled' };
}

export function deleteVoucherPermanentByRef(refNo: string) {
  if (!refNo) return { ok: false, error: 'Reference number required' };
  const cleanRef = String(refNo).trim().toLowerCase();

  // 1. Sales Invoices
  const sales = loadJson<SalesInvoice[]>(STORAGE_KEYS.SALES_INVOICES, []);
  const saleTarget = sales.find(s => s.invoiceNo?.trim().toLowerCase() === cleanRef);
  if (saleTarget) {
    return deleteSalesInvoicePermanent(saleTarget.invoiceNo || String(refNo).trim());
  }

  // 2. Purchase Invoices
  const purchases = loadJson<PurchaseInvoice[]>(STORAGE_KEYS.PURCHASE_INVOICES, []);
  const purTarget = purchases.find(p => p.billNo?.trim().toLowerCase() === cleanRef || p.invoiceNo?.trim().toLowerCase() === cleanRef);
  if (purTarget) {
    return deletePurchaseInvoicePermanent(purTarget.billNo || purTarget.invoiceNo || String(refNo).trim());
  }

  // 3. Standard Vouchers (P, R, J, C, CN, DN)
  const vouchers = loadJson<Voucher[]>(STORAGE_KEYS.VOUCHERS, []);
  const vTarget = vouchers.find(v => v.voucherNo?.trim().toLowerCase() === cleanRef);
  if (vTarget) {
    return deleteVoucherPermanent(vTarget.voucherNo || String(refNo).trim());
  }

  // 4. Delivery Notes
  const dlvRes = deleteDeliveryNote(String(refNo).trim());
  if (dlvRes.ok) return dlvRes;

  // 5. Quotations
  const qtnRes = deleteQuotation(String(refNo).trim());
  if (qtnRes.ok) return qtnRes;

  return { ok: false, error: 'Voucher not found or could not be deleted' };
}

export function deleteVoucherByRef(refNo: string) {
  return cancelVoucherByRef(refNo);
}



export function getEmployeeAdvances(): import('../types').EmployeeAdvance[] {
  return loadJson<import('../types').EmployeeAdvance[]>(STORAGE_KEYS.EMPLOYEE_ADVANCES, []);
}

export function saveEmployeeAdvances(advances: import('../types').EmployeeAdvance[]): void {
  saveJson(STORAGE_KEYS.EMPLOYEE_ADVANCES, advances);
}


export function rebuildAccountingLogs() {
  const cfg = loadJson<Config>(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
  saveJson(STORAGE_KEYS.LEDGER_LOG, []);
  saveJson(STORAGE_KEYS.STOCK_LEDGER, []);

  const sales = loadJson<SalesInvoice[]>(STORAGE_KEYS.SALES_INVOICES, []).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const purchases = loadJson<PurchaseInvoice[]>(STORAGE_KEYS.PURCHASE_INVOICES, []).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const vouchers = loadJson<Voucher[]>(STORAGE_KEYS.VOUCHERS, []).sort((a,b) => new Date(a.date || '').getTime() - new Date(b.date || '').getTime());
  const deliveryNotes = loadJson<DeliveryNote[]>(STORAGE_KEYS.DELIVERY_NOTES, []).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const receiptNotes = loadJson<ReceiptNote[]>(STORAGE_KEYS.RECEIPT_NOTES, []).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // 1. Delivery Notes log stock outward (Challans)
  deliveryNotes.forEach(dn => {
    if (dn.status === 'Cancelled') return;
    const no = dn.noteNo || '';
    (dn.items || []).forEach(it => {
      const q = Number(it.qty) || 0;
      if (q > 0) {
        logStock(it.itemCode, it.itemName, 'Delivery Challan', 0, q, 0, no);
      }
    });
  });

  // 2. Receipt Notes log stock inward (GRNs)
  receiptNotes.forEach(rn => {
    if (rn.status === 'Cancelled') return;
    const no = rn.noteNo || '';
    (rn.items || []).forEach(it => {
      const q = Number(it.qty) || 0;
      if (q > 0) {
        logStock(it.itemCode, it.itemName, 'Receipt Note Inward', q, 0, 0, no);
      }
    });
  });

  // 3. Credit Note / Debit Note Vouchers with stock return items
  vouchers.forEach(v => {
    if (v.status === 'Cancelled') return;
    const no = v.voucherNo || '';
    if (v.type === 'CN' && (v as any).returnStock && (v as any).items) {
      ((v as any).items || []).forEach((it: any) => {
        const q = Number(it.qty) || 0;
        if (q > 0) {
          logStock(it.itemCode, it.itemName, 'Credit Note (Return)', q, 0, 0, no);
        }
      });
    } else if (v.type === 'DN' && (v as any).returnStock && (v as any).items) {
      ((v as any).items || []).forEach((it: any) => {
        const q = Number(it.qty) || 0;
        if (q > 0) {
          logStock(it.itemCode, it.itemName, 'Debit Note (Return)', 0, q, 0, no);
        }
      });
    }
  });

  sales.forEach(s => {
    if (s.status === 'Cancelled') return;
    const iNo = s.invoiceNo || '';
    
    // Only log stock if sale is NOT against a delivery note (since delivery note already deducted stock)
    const isAgainstDN = Boolean(s.deliveryNoteNo && s.deliveryNoteNo.trim()) || deliveryNotes.some(dn => (dn.invoiceNo && dn.invoiceNo.trim().toLowerCase() === iNo.trim().toLowerCase()));
    if (!isAgainstDN) {
      s.items.forEach(l => {
        logStock(l['Item Code'], l['Item Name'], 'Sale', 0, Number(l.Qty), 0, iNo);
      });
    }

    const cash = Number(s.cash) || 0, b1 = Number(s.bank1) || 0, b2 = Number(s.bank2) || 0;
    const cr = Number(s.credit) || 0;
    const tax = Number(s.taxable) || 0, zro = Number(s.zeroRated) || 0, gst = Number(s.gstAmt) || 0;
    const appliedDiscount = Number(s.discount) || 0;
    const sLg = typeof s.customer === 'object' ? (s.customer.name?.trim() || s.customer.ledger?.trim() || 'Cash Customer') : (s.customer || 'Cash Customer');

    if (cash > 0) adjustLedgerBalance('Cash', cash, 'Dr', iNo, 'Cash sale ' + iNo, 'Sale');
    if (b1 > 0) adjustLedgerBalance(s.paymentDetails?.bank1Ledger || 'BOB Account', b1, 'Dr', iNo, 'Bank sale ' + iNo, 'Sale');
    if (b2 > 0) adjustLedgerBalance(s.paymentDetails?.bank2Ledger || 'BNBL Account', b2, 'Dr', iNo, 'Bank sale ' + iNo, 'Sale');
    if (cr > 0.009) adjustLedgerBalance(sLg, cr, 'Dr', iNo, 'Credit sale ' + iNo, 'Sale');

    const netSalesCredit = Math.max(0, round2((tax + zro) - appliedDiscount));
    adjustLedgerBalance('Sales Account', netSalesCredit, 'Cr', iNo, 'Sale ' + iNo, 'Sale');
    if (gst > 0) adjustLedgerBalance(cfg.EnableGSTInputTax === 'true' ? 'GST Output' : 'GST Payable', gst, 'Cr', iNo, 'GST ' + iNo, 'Sale');

    (s.additionalExpenses || []).forEach(exp => {
      if (exp.ledger && Number(exp.amount) > 0) adjustLedgerBalance(exp.ledger, Number(exp.amount), 'Cr', iNo, 'Sales Additional Charge ' + iNo, 'Sale');
    });
  });

  purchases.forEach(p => {
    if (p.status === 'Cancelled') return;
    const bNo = p.billNo || p.invoiceNo || '';
    
    // Only log stock if purchase is NOT against a receipt note (since receipt note already added stock)
    const isAgainstRN = Boolean(p.receiptNoteNo && p.receiptNoteNo.trim()) || receiptNotes.some(rn => (rn.invoiceNo && rn.invoiceNo.trim().toLowerCase() === bNo.trim().toLowerCase()));
    if (!isAgainstRN) {
      p.items.forEach(l => {
        logStock(l['Item Code'], l['Item Name'], 'Purchase', Number(l.Qty), 0, 0, bNo);
      });
    }

    const cash = Number(p.cash) || 0, b1 = Number(p.bank1) || 0, b2 = Number(p.bank2) || 0;
    const cr = Number(p.credit) || 0;
    const tax = Number(p.taxable) || 0, zro = Number(p.zeroRated) || 0, gst = Number(p.gstAmt) || 0;
    const sLg = typeof p.supplier === 'object' ? (p.supplier.name?.trim() || p.supplier.ledger?.trim() || 'Supplier') : (p.supplier || 'Supplier');

    if (cash > 0) adjustLedgerBalance('Cash', cash, 'Cr', bNo, 'Cash purchase ' + bNo, 'Purchase');
    if (b1 > 0) adjustLedgerBalance(p.paymentDetails?.bank1Ledger || 'BOB Account', b1, 'Cr', bNo, 'Bank purchase ' + bNo, 'Purchase');
    if (b2 > 0) adjustLedgerBalance(p.paymentDetails?.bank2Ledger || 'BNBL Account', b2, 'Cr', bNo, 'Bank purchase ' + bNo, 'Purchase');
    if (cr > 0.009) adjustLedgerBalance(sLg, cr, 'Cr', bNo, 'Credit purchase ' + bNo, 'Purchase');

    adjustLedgerBalance('Purchase Account', tax + zro, 'Dr', bNo, 'Purchase ' + bNo, 'Purchase');
    if (gst > 0) adjustLedgerBalance(cfg.EnableGSTInputTax === 'true' ? 'GST Input' : 'GST Payable', gst, 'Dr', bNo, 'GST ' + bNo, 'Purchase');

    (p.additionalExpenses || []).forEach(exp => {
      if (exp.ledger && Number(exp.amount) > 0) adjustLedgerBalance(exp.ledger, Number(exp.amount), 'Dr', bNo, 'Purchase Expense ' + bNo, 'Purchase');
    });
  });

  vouchers.forEach(v => {
    if (v.status === 'Cancelled') return;
    const no = v.voucherNo || '';
    if (v.type === 'J') {
      (v.lines || []).forEach(line => {
        if (line.ledger && Number(line.amount) > 0) {
          adjustLedgerBalance(line.ledger, Number(line.amount), line.type as 'Dr' | 'Cr', no, v.narration || '', 'Journal');
        }
      });
    } else {
      const dr = v.debitLedger || '';
      const cr = v.creditLedger || '';
      const t = v.type === 'P' ? 'Payment' : (v.type === 'R' ? 'Receipt' : (v.type === 'C' ? 'Contra' : 'Journal'));
      if (dr && cr && Number(v.amount) > 0) {
        adjustLedgerBalance(dr, Number(v.amount), 'Dr', no, v.narration || '', t);
        adjustLedgerBalance(cr, Number(v.amount), 'Cr', no, v.narration || '', t);
      }
    }
  });

  const payrolls = loadJson<MonthlyPayroll[]>(STORAGE_KEYS.MONTHLY_PAYROLLS, []);
  if (payrolls.length > 0) {
    saveJson(STORAGE_KEYS.MONTHLY_PAYROLLS, payrolls.map(p => ({ ...p, isPostedToAccounting: false })));
    saveJson(STORAGE_KEYS.MONTHLY_PAYROLLS, payrolls);
    syncPayrollToAccounting();
  }

  recalculateLedgerBalances();
}

export function deleteUnit(name: string): { ok: boolean; error?: string } {
  let units = loadJson<Unit[]>(STORAGE_KEYS.UNITS, DEFAULT_UNITS);
  units = units.filter(u => u['Unit Name'] !== name);
  saveJson(STORAGE_KEYS.UNITS, units);
  return { ok: true };
}

export function getBankRecon(): Record<string, { isCleared: boolean; clearedDate?: string; transactionId?: string; notes?: string }> {
  return loadJson<Record<string, { isCleared: boolean; clearedDate?: string; transactionId?: string; notes?: string }>>(STORAGE_KEYS.BANK_RECON, {});
}

export function saveBankRecon(state: Record<string, { isCleared: boolean; clearedDate?: string; transactionId?: string; notes?: string }>): void {
  saveJson(STORAGE_KEYS.BANK_RECON, state);
}

export function updateTransactionReference(refNo: string, transactionId: string, ledgerName?: string) {
  if (!refNo) return { ok: false, error: 'Reference number required' };
  const cleanRef = String(refNo).trim();
  const cleanTxn = String(transactionId || '').trim();

  // 1. Update in Ledger Log
  let logs = loadJson<LedgerLogEntry[]>(STORAGE_KEYS.LEDGER_LOG, []);
  let logUpdated = false;
  logs = logs.map(l => {
    if (l['Ref No'] === cleanRef && (!ledgerName || l['Ledger Name'] === ledgerName)) {
      logUpdated = true;
      return {
        ...l,
        transactionId: cleanTxn,
        'Transaction ID': cleanTxn
      };
    }
    return l;
  });
  if (logUpdated) {
    saveJson(STORAGE_KEYS.LEDGER_LOG, logs);
  }

  // 2. Update in Vouchers if applicable
  let vouchers = loadJson<Voucher[]>(STORAGE_KEYS.VOUCHERS, []);
  let voucherUpdated = false;
  vouchers = vouchers.map(v => {
    if (v.voucherNo === cleanRef) {
      voucherUpdated = true;
      return {
        ...v,
        transactionId: cleanTxn,
        bankTxnNo: cleanTxn
      };
    }
    return v;
  });
  if (voucherUpdated) {
    saveJson(STORAGE_KEYS.VOUCHERS, vouchers);
  }

  // 3. Update in Sales Invoices if applicable
  let sales = loadJson<SalesInvoice[]>(STORAGE_KEYS.SALES_INVOICES, []);
  let saleUpdated = false;
  sales = sales.map(s => {
    if (s.invoiceNo === cleanRef) {
      saleUpdated = true;
      return {
        ...s,
        bankTxnNo: cleanTxn
      };
    }
    return s;
  });
  if (saleUpdated) {
    saveJson(STORAGE_KEYS.SALES_INVOICES, sales);
  }

  // 4. Update in Purchase Invoices if applicable
  let purchases = loadJson<PurchaseInvoice[]>(STORAGE_KEYS.PURCHASE_INVOICES, []);
  let purchUpdated = false;
  purchases = purchases.map(p => {
    if (p.billNo === cleanRef || p.invoiceNo === cleanRef) {
      purchUpdated = true;
      return {
        ...p,
        bankTxnNo: cleanTxn
      };
    }
    return p;
  });
  if (purchUpdated) {
    saveJson(STORAGE_KEYS.PURCHASE_INVOICES, purchases);
  }

  return { ok: true };
}



export function getItemProfitabilityDetail(itemCode: string, from?: string, to?: string) {
  const fr = from ? new Date(from).setHours(0, 0, 0, 0) : 0;
  const toDt = to ? new Date(to).setHours(23, 59, 59, 999) : Date.now();
  
  const items = loadJson(STORAGE_KEYS.ITEMS, DEFAULT_ITEMS);
  const masterItem = items.find((i: any) => i['Item Code'] === itemCode);
  const purchaseRate = masterItem ? (Number(masterItem['Purchase Rate']) || 0) : 0;
  
  const sales = getDeduplicatedSales();
  const inPeriodInvs = sales.filter((r: any) => {
    const d = new Date(r.date).getTime();
    return d >= fr && d <= toDt;
  });

  const detailRows: Array<{
    date: string;
    invoiceNo: string;
    qty: number;
    purchasePrice: number;
    salePrice: number;
    totalRevenue: number;
    grossProfit: number;
    profitPct: number;
  }> = [];

  inPeriodInvs.forEach((inv: any) => {
    inv.items.forEach((r: any) => {
      if (r['Item Code'] === itemCode) {
        const q = Number(r.Qty) || 0;
        if (q > 0) {
          const lTot = (q * (Number(r.Rate) || 0)) - (Number(r.Discount) || 0);
          const salePricePerUnit = lTot / q;
          const grossProfit = lTot - (purchaseRate * q);
          const profitPct = lTot !== 0 ? (grossProfit / Math.abs(lTot)) * 100 : 0;

          detailRows.push({
            date: inv.date,
            invoiceNo: inv.invoiceNo,
            qty: q,
            purchasePrice: purchaseRate,
            salePrice: salePricePerUnit,
            totalRevenue: lTot,
            grossProfit: grossProfit,
            profitPct: profitPct
          });
        }
      }
    });
  });

  // Sort by date descending
  detailRows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return {
    itemCode,
    itemName: masterItem ? masterItem['Item Name'] : itemCode,
    rows: detailRows
  };
}

export function getGSTInputDomReport(from: string, to: string) {
  const parseDateToMs = (d: any, defaultHours = 12): number => {
    if (!d) return 0;
    if (typeof d === 'number') return d;
    const str = String(d).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
      const [y, m, day] = str.slice(0, 10).split('-').map(Number);
      return new Date(y, m - 1, day, defaultHours, 0, 0).getTime();
    }
    const dt = new Date(str);
    return isNaN(dt.getTime()) ? 0 : dt.getTime();
  };

  const fr = parseDateToMs(from, 0);
  const toDt = parseDateToMs(to, 23) + (59 * 60 * 1000) + (59 * 1000) + 999;
  
  const purchases = getDeduplicatedPurchases();
  const vouchers = loadJson<Voucher[]>(STORAGE_KEYS.VOUCHERS, []);
  const ledgers = loadJson<Ledger[]>(STORAGE_KEYS.LEDGERS, DEFAULT_LEDGERS);
  
  const results: any[] = [];
  const seenKeys = new Set<string>();
  
  // 1. Domestic Purchases from Purchase Vouchers / Purchase Bills
  purchases.forEach(p => {
    const d = parseDateToMs(p.date);
    if (d >= fr && d <= toDt && p.status !== 'Cancelled') {
      const sName = typeof p.supplier === 'object' ? (p.supplier.name || p.supplier.ledger || '') : String(p.supplier || '');
      let sGst = typeof p.supplier === 'object' ? (p.supplier.gstNo || p.supplier.tpnNo || '') : '';
      if (!sGst && sName) {
        const matchedLedger = ledgers.find(l => (l['Ledger Name'] || '').trim().toLowerCase() === sName.trim().toLowerCase());
        if (matchedLedger) {
          sGst = matchedLedger['GST No'] || matchedLedger['TPN No'] || (matchedLedger as any).GSTIN || (matchedLedger as any).TPN || '';
        }
      }

      const taxableVal = Number(p.taxable) || (Number(p.total) - (Number(p.gstAmt) || 0)) || 0;
      const gstVal = Number(p.gstAmt) || 0;
      const zeroVal = Number(p.zeroRated) || 0;
      const vNo = p.billNo || p.invoiceNo || '';

      if (vNo) seenKeys.add(vNo.toLowerCase());

      results.push({
        transactionType: 'Local Purchase',
        supplierName: sName || 'Domestic Supplier',
        supplierGstNo: sGst || '-',
        invoiceDate: p.date,
        invoiceNo: p.supplierBillNo || p.invoiceNo || p.billNo || '-',
        referenceNo: p.supplierBillNo || '',
        voucherNo: p.billNo || p.invoiceNo || '',
        taxable: taxableVal,
        exempted: zeroVal,
        gstAmount: gstVal
      });
    }
  });

  // 2. Local Expenses & Bank Charges from Payment & Journal Vouchers
  vouchers.forEach(v => {
    const d = parseDateToMs(v.date);
    if ((v.type === 'P' || v.type === 'J' || v.type === 'PUR') && d >= fr && d <= toDt && v.status !== 'Cancelled') {
      const vKey = (v.voucherNo || '').toLowerCase();
      if (vKey && seenKeys.has(vKey)) return; // Avoid duplicate if already included from purchases

      // Auto-infer if gstInputType is not set but GST is present in lines
      let effectiveType: string = v.gstInputType || 'None';
      let inferredGstAmt = 0;
      let inferredTaxable = 0;
      
      const drLines = (v.lines || []).filter(l => (l.type === 'Dr' || (l.type as string) === 'dr'));
      const hasGstInLines = drLines.some(l => (l.ledger.toLowerCase().includes('gst') || l.ledger.toLowerCase().includes('tax') || l.ledger.toLowerCase().includes('receivable')));
      const hasExplicitGst = Number(v.gstAmount) > 0;

      if (!effectiveType || effectiveType === 'None') {
        if (hasGstInLines || hasExplicitGst) {
          effectiveType = 'Local Expenses';
          if (drLines.some(l => l.ledger.toLowerCase().includes('bank charge') || l.ledger.toLowerCase().includes('bank fee'))) {
            effectiveType = 'Bank Charges';
          }
          if (v.lines && v.lines.length > 0) {
            inferredGstAmt = drLines.filter(l => (l.ledger.toLowerCase().includes('gst') || l.ledger.toLowerCase().includes('tax') || l.ledger.toLowerCase().includes('receivable'))).reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
            inferredTaxable = drLines.filter(l => !(l.ledger.toLowerCase().includes('gst') || l.ledger.toLowerCase().includes('tax') || l.ledger.toLowerCase().includes('receivable'))).reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
          } else if (v.amount && v.gstAmount) {
            inferredGstAmt = Number(v.gstAmount);
            inferredTaxable = Number(v.taxableAmount) || (Number(v.amount) - inferredGstAmt);
          }
        }
      } else if (v.lines && v.lines.length > 0 && (!v.gstAmount || Number(v.gstAmount) === 0)) {
        inferredGstAmt = drLines.filter(l => (l.ledger.toLowerCase().includes('gst') || l.ledger.toLowerCase().includes('tax') || l.ledger.toLowerCase().includes('receivable'))).reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
        inferredTaxable = drLines.filter(l => !(l.ledger.toLowerCase().includes('gst') || l.ledger.toLowerCase().includes('tax') || l.ledger.toLowerCase().includes('receivable'))).reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
      }

      if (effectiveType === 'Local Expenses' || effectiveType === 'Bank Charges' || effectiveType === 'Local Purchase') {
        const finalTaxable = Number(v.taxableAmount) > 0 ? Number(v.taxableAmount) : (inferredTaxable > 0 ? inferredTaxable : (Number(v.amount) - (inferredGstAmt || Number(v.gstAmount) || 0)));
        const finalGst = Number(v.gstAmount) > 0 ? Number(v.gstAmount) : inferredGstAmt;

        if (finalGst > 0 || finalTaxable > 0) {
          // Resolve supplier / payee name
          let sName = v.supplierName || v.partyName;
          if (!sName) {
            if (effectiveType === 'Bank Charges') {
              sName = (v.lines?.find(l => l.type === 'Cr')?.ledger) || v.creditLedger || 'Bank';
            } else {
              sName = (v.lines?.find(l => l.type === 'Dr' && !l.ledger.toLowerCase().includes('gst'))?.ledger) || (v.lines?.find(l => l.type === 'Cr')?.ledger) || v.debitLedger || v.creditLedger || 'Vendor / Payee';
            }
          }

          let sGst = v.supplierGstNo || '';
          if (!sGst && sName) {
            const matchedLedger = ledgers.find(l => (l['Ledger Name'] || '').trim().toLowerCase() === sName.trim().toLowerCase());
            if (matchedLedger) {
              sGst = matchedLedger['GST No'] || matchedLedger['TPN No'] || (matchedLedger as any).GSTIN || (matchedLedger as any).TPN || '';
            }
          }

          const resolvedInvNo = (effectiveType === 'Bank Charges')
            ? (v.referenceNo || v.invoiceNo || v.bankTxnNo || v.transactionId || v.chequeNo || v.voucherNo || '-')
            : (v.invoiceNo || v.referenceNo || v.bankTxnNo || v.transactionId || v.voucherNo || '-');

          results.push({
            transactionType: effectiveType,
            supplierName: sName || 'Vendor / Payee',
            supplierGstNo: sGst || '-',
            invoiceDate: v.invoiceDate || v.date,
            invoiceNo: resolvedInvNo,
            referenceNo: v.referenceNo || v.bankTxnNo || v.transactionId || '',
            voucherNo: v.voucherNo,
            taxable: finalTaxable || 0,
            exempted: Number(v.exemptedAmount) || 0,
            gstAmount: finalGst || 0,
            customGstData: v.customGstData || {}
          });
        }
      }
    }
  });

  // 3. Purchase Returns (Debit Notes - DN)
  vouchers.forEach(v => {
    const vType = v.type as any;
    if (vType !== 'DN' && vType !== 'Debit Note' && (v as any).voucherTypeName !== 'Debit Note' && vType !== 'Purchase Return') return;
    const rawDate = (v as any).DateIso || v.date || (v as any).Date;
    if (!rawDate) return;
    const d = parseDateToMs(rawDate);
    if (d < fr || d > toDt) return;

    const isCancelled = v.status === 'Cancelled';
    const totalAmt = Number(v.amount || (v as any).totalAmount) || 0;
    
    let gstVal = Number((v as any).gstAmt || (v as any).gstAmount) || 0;
    let taxableVal = Number((v as any).taxable || (v as any).taxableAmount) || 0;

    if (!gstVal && v.lines && v.lines.length > 0) {
      const gstLine = v.lines.find(l => (l.type === 'Cr' || (l.type as string) === 'cr') && (l.ledger.toLowerCase().includes('gst') || l.ledger.toLowerCase().includes('tax')));
      if (gstLine) gstVal = Number(gstLine.amount) || 0;
    }

    if (!gstVal && v.items && v.items.length > 0) {
      gstVal = v.items.reduce((sum: number, it: any) => {
        const q = Number(it.qty || it.Qty) || 0;
        const r = Number(it.rate || it.Rate || it.price) || 0;
        const d = Number(it.discount || it.Discount) || 0;
        const gstP = Number(it.gstPct || it['GST %']) || 0;
        const lineNet = (q * r) - d;
        return sum + ((lineNet * gstP) / 100);
      }, 0);
    }

    if (!taxableVal) {
      taxableVal = Math.max(0, totalAmt - gstVal);
    }

    const sName = v.partyName || (v as any).supplierName || v.creditLedger || v.debitLedger || 'Supplier';

    results.push({
      transactionType: 'Purchase Return (DN)',
      supplierName: `${sName} (Return)`,
      supplierGstNo: (v as any).supplierGstNo || (v as any).partyGstNo || '-',
      invoiceDate: (v as any).DateIso || v.date,
      invoiceNo: v.voucherNo || 'DN',
      referenceNo: (v as any).originalInvoiceRef || '',
      voucherNo: v.voucherNo || '',
      taxable: isCancelled ? 0 : -taxableVal,
      exempted: 0,
      gstAmount: isCancelled ? 0 : -gstVal,
      customGstData: {}
    });
  });

  // Sort by invoiceDate ascending
  results.sort((a, b) => parseDateToMs(a.invoiceDate) - parseDateToMs(b.invoiceDate));

  const totals = results.reduce((a, r) => {
    a.taxable += r.taxable;
    a.exempted += r.exempted;
    a.gstAmount += r.gstAmount;
    return a;
  }, { taxable: 0, exempted: 0, gstAmount: 0 });

  return { mode: 'gst_input_dom', rows: results, totals };
}

export function getGSTInputImpReport(from: string, to: string) {
  const parseDateToMs = (d: any, defaultHours = 12): number => {
    if (!d) return 0;
    if (typeof d === 'number') return d;
    const str = String(d).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
      const [y, m, day] = str.slice(0, 10).split('-').map(Number);
      return new Date(y, m - 1, day, defaultHours, 0, 0).getTime();
    }
    const dt = new Date(str);
    return isNaN(dt.getTime()) ? 0 : dt.getTime();
  };

  const fr = parseDateToMs(from, 0);
  const toDt = parseDateToMs(to, 23) + (59 * 60 * 1000) + (59 * 1000) + 999;
  
  const vouchers = loadJson<Voucher[]>(STORAGE_KEYS.VOUCHERS, []);
  const results: any[] = [];
  
  // Import Customs GST Payment from Payment / Journal Vouchers
  vouchers.forEach(v => {
    const d = parseDateToMs(v.date);
    if ((v.type === 'P' || v.type === 'J' || v.type === 'PUR') && d >= fr && d <= toDt && v.status !== 'Cancelled') {
      if (v.gstInputType === 'Import Customs GST Payment' || v.gstInputType === 'Import Purchase') {
        const importTot = Number(v.totalImportAmount) || 0;
        const gstVal = Number(v.gstAmount) || 0;
        const taxVal = Number(v.taxableAmount) || 0;
        const exeVal = Number(v.exemptedAmount) || 0;

        results.push({
          supplierName: v.supplierName || 'International / Customs',
          invoiceNo: v.invoiceNo || '-',
          invoiceDate: v.invoiceDate || v.date,
          declarationDate: v.declarationDate || v.date,
          declarationNo: v.declarationNo || v.referenceNo || v.voucherNo || '-',
          voucherNo: v.voucherNo,
          taxableAmount: taxVal,
          exemptedAmount: exeVal,
          totalImportAmount: importTot,
          gstAmount: gstVal,
          customGstData: v.customGstData || {}
        });
      }
    }
  });

  results.sort((a, b) => parseDateToMs(a.invoiceDate || a.declarationDate) - parseDateToMs(b.invoiceDate || b.declarationDate));

  const totals = results.reduce((a, r) => {
    a.taxableAmount += r.taxableAmount;
    a.exemptedAmount += r.exemptedAmount;
    a.totalImportAmount += r.totalImportAmount;
    a.gstAmount += r.gstAmount;
    return a;
  }, { taxableAmount: 0, exemptedAmount: 0, totalImportAmount: 0, gstAmount: 0 });

  return { mode: 'gst_input_imp', rows: results, totals };
}

export function getGSTSummaryReport(from: string, to: string) {
  const outputGST = getGSTReport(from, to);
  const inputDomGST = getGSTInputDomReport(from, to);
  const inputImpGST = getGSTInputImpReport(from, to);

  const totalOutput = outputGST.totals?.gstAmount || 0;
  const totalInputDom = inputDomGST.totals?.gstAmount || 0;
  const totalInputImp = inputImpGST.totals?.gstAmount || 0;
  
  const totalInput = totalInputDom + totalInputImp;
  const netPayable = totalOutput - totalInput;

  return {
    mode: 'gst_summary',
    totals: {
      outputSalesTaxable: outputGST.totals?.taxable || 0,
      outputSalesGST: totalOutput,
      inputDomTaxable: inputDomGST.totals?.taxable || 0,
      inputDomGST: totalInputDom,
      inputImpTotalAmount: inputImpGST.totals?.totalImportAmount || 0,
      inputImpGST: totalInputImp,
      netPayable: netPayable > 0 ? netPayable : 0,
      netRefundable: netPayable < 0 ? Math.abs(netPayable) : 0
    }
  };
}
  
export interface ItemPriceHistoryInfo {
  lastPurchaseRate?: number;
  lastPurchaseDate?: string;
  lastPurchaseSupplier?: string;
  lastPurchaseInvoiceNo?: string;
  
  lastSaleRate?: number;
  lastSaleDate?: string;
  lastSaleCustomer?: string;
  lastSaleInvoiceNo?: string;
  
  customerLastSaleRate?: number;
  customerLastSaleDate?: string;
  customerLastSaleInvoiceNo?: string;
}

export function getItemPriceHistory(itemCode: string, itemName?: string, customerPartyName?: string): ItemPriceHistoryInfo {
  const result: ItemPriceHistoryInfo = {};
  if (!itemCode && !itemName) return result;

  const targetCode = (itemCode || '').trim().toLowerCase();
  const targetName = (itemName || '').trim().toLowerCase();

  const isMatch = (i: any) => {
    const c = (i['Item Code'] || i.itemCode || '').trim().toLowerCase();
    const n = (i['Item Name'] || i.itemName || '').trim().toLowerCase();
    return (targetCode && c === targetCode) || (targetName && n === targetName);
  };

  try {
    // 1. Check Purchase Invoices (most recent first)
    const purchases = loadJson<PurchaseInvoice[]>(STORAGE_KEYS.PURCHASE_INVOICES, []);
    const sortedPurchases = [...purchases].sort((a, b) => new Date(b.date || (b as any).billDate || 0).getTime() - new Date(a.date || (a as any).billDate || 0).getTime());
    for (const p of sortedPurchases) {
      const match = (p.items || []).find(isMatch);
      if (match) {
        const mAny = match as any;
        result.lastPurchaseRate = Number(mAny.Rate ?? mAny.rate ?? mAny['Purchase Rate'] ?? mAny.price ?? 0);
        result.lastPurchaseDate = p.date || (p as any).billDate;
        result.lastPurchaseSupplier = (p as any).supplierName || (p as any).partyName || (p as any)['Supplier Name'] || 'Supplier';
        result.lastPurchaseInvoiceNo = p.invoiceNo || (p as any).billNo || (p as any).refNo;
        break;
      }
    }

    // 2. Check Sales Invoices (most recent first)
    const sales = loadJson<SalesInvoice[]>(STORAGE_KEYS.SALES_INVOICES, []);
    const sortedSales = [...sales].sort((a, b) => new Date(b.date || (b as any).billDate || 0).getTime() - new Date(a.date || (a as any).billDate || 0).getTime());
    
    const targetParty = (customerPartyName || '').trim().toLowerCase();

    for (const s of sortedSales) {
      const match = (s.items || []).find(isMatch);
      if (match) {
        const mAny = match as any;
        const sAny = s as any;
        const custName = sAny.customerName || sAny.partyName || sAny['Customer Name'] || sAny['Party Name'] || 'Cash Customer';

        // Overall last sale
        if (!result.lastSaleRate) {
          result.lastSaleRate = Number(mAny.Rate ?? mAny.rate ?? mAny['Sale Rate'] ?? mAny.price ?? 0);
          result.lastSaleDate = s.date || sAny.billDate;
          result.lastSaleCustomer = custName;
          result.lastSaleInvoiceNo = s.invoiceNo || sAny.billNo || sAny.refNo;
        }
        
        // Customer specific last sale
        if (targetParty && !result.customerLastSaleRate) {
          const party = custName.trim().toLowerCase();
          if (party === targetParty) {
            result.customerLastSaleRate = Number(mAny.Rate ?? mAny.rate ?? mAny['Sale Rate'] ?? mAny.price ?? 0);
            result.customerLastSaleDate = s.date || sAny.billDate;
            result.customerLastSaleInvoiceNo = s.invoiceNo || sAny.billNo || sAny.refNo;
          }
        }

        if (result.lastSaleRate && (!targetParty || result.customerLastSaleRate)) break;
      }
    }
  } catch (err) {
    console.error('Error fetching item price history:', err);
  }

  return result;
}

export interface ItemTransactionRecord {
  type: 'purchase' | 'sale';
  date: string;
  voucherNo: string;
  partyName: string;
  qty: number;
  unit?: string;
  rate: number;
  amount: number;
  batchNo?: string;
}

export function getItemTransactionHistory(itemCode: string, itemName?: string): {
  purchases: ItemTransactionRecord[];
  sales: ItemTransactionRecord[];
} {
  const result: { purchases: ItemTransactionRecord[]; sales: ItemTransactionRecord[] } = {
    purchases: [],
    sales: []
  };
  if (!itemCode && !itemName) return result;

  const targetCode = (itemCode || '').trim().toLowerCase();
  const targetName = (itemName || '').trim().toLowerCase();

  const isMatch = (i: any) => {
    const c = (i['Item Code'] || i.itemCode || i.code || '').trim().toLowerCase();
    const n = (i['Item Name'] || i.itemName || i.name || '').trim().toLowerCase();
    return (targetCode && c === targetCode) || (targetName && n === targetName);
  };

  try {
    const purchases = loadJson<PurchaseInvoice[]>(STORAGE_KEYS.PURCHASE_INVOICES, []);
    purchases.forEach(p => {
      const date = p.date || (p as any).billDate || '';
      const voucherNo = p.invoiceNo || (p as any).billNo || (p as any).refNo || 'PUR-VOUCHER';
      const partyName = (p as any).supplierName || (p as any).partyName || (p as any)['Supplier Name'] || 'Supplier';

      (p.items || []).forEach((match: any) => {
        if (isMatch(match)) {
          const qty = Number(match.qty || match.Qty || match.quantity || 1);
          const rate = Number(match.rate || match.Rate || match.price || match['Purchase Rate'] || 0);
          const amount = qty * rate;
          result.purchases.push({
            type: 'purchase',
            date,
            voucherNo,
            partyName,
            qty,
            unit: match.unit || match.Unit || 'Pcs',
            rate,
            amount,
            batchNo: match.batchNo || match.batch || '-'
          });
        }
      });
    });

    const sales = loadJson<SalesInvoice[]>(STORAGE_KEYS.SALES_INVOICES, []);
    sales.forEach(s => {
      const sAny = s as any;
      const date = s.date || sAny.billDate || '';
      const voucherNo = s.invoiceNo || sAny.billNo || sAny.refNo || 'SALE-VOUCHER';
      const partyName = sAny.customerName || sAny.partyName || sAny['Customer Name'] || sAny['Party Name'] || 'Cash Customer';

      (s.items || []).forEach((match: any) => {
        if (isMatch(match)) {
          const qty = Number(match.qty || match.Qty || match.quantity || 1);
          const rate = Number(match.rate || match.Rate || match.price || match['Sale Rate'] || 0);
          const amount = qty * rate;
          result.sales.push({
            type: 'sale',
            date,
            voucherNo,
            partyName,
            qty,
            unit: match.unit || match.Unit || 'Pcs',
            rate,
            amount,
            batchNo: match.selectedBatchNo || match.batchNo || '-'
          });
        }
      });
    });

    result.purchases.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
    result.sales.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  } catch (err) {
    console.error('Error fetching item transaction history:', err);
  }

  return result;
}

export interface YearEndCarryForwardParams {
  companyId: string;
  fromFYName: string;
  toFYName: string;
  targetStartDate: string;
  targetEndDate: string;
  mode: 'same_company' | 'split_new_company';
}

export interface YearEndCarryForwardResult {
  success: boolean;
  fromFYName: string;
  toFYName: string;
  targetStartDate: string;
  targetEndDate: string;
  mode: 'same_company' | 'split_new_company';
  netProfitLoss: number;
  carriedLedgersCount: number;
  carriedItemsCount: number;
  newCompanyId?: string;
  newCompanyName?: string;
  error?: string;
}

export async function executeYearEndCarryForward(params: YearEndCarryForwardParams): Promise<YearEndCarryForwardResult> {
  try {
    const { companyId, fromFYName, toFYName, targetStartDate, targetEndDate, mode } = params;
    
    // 1. Recalculate ledger balances first to ensure complete up-to-date figures
    recalculateLedgerBalances();

    // 2. Fetch all ledgers and items for current company
    const currentLedgers = getLedgers();
    const currentItems = loadJson<Item[]>(STORAGE_KEYS.ITEMS, DEFAULT_ITEMS);

    // 3. Define P&L groups vs Balance Sheet groups
    const plGroups = new Set([
      'Sales Accounts',
      'Purchase Accounts',
      'Direct Incomes',
      'Indirect Incomes',
      'Direct Expenses',
      'Indirect Expenses'
    ]);

    // 4. Calculate Net Profit / Loss
    let totalIncome = 0;
    let totalExpense = 0;

    currentLedgers.forEach(l => {
      const grp = (l['Parent Group'] || '').trim();
      const bal = Number(l['Current Balance']) || 0;
      if (grp === 'Sales Accounts' || grp === 'Direct Incomes' || grp === 'Indirect Incomes') {
        totalIncome += bal;
      } else if (grp === 'Purchase Accounts' || grp === 'Direct Expenses' || grp === 'Indirect Expenses') {
        totalExpense += bal;
      }
    });

    const netProfitLoss = round2(totalIncome - totalExpense);

    // 5. Prepare carried-over ledgers
    const carriedLedgers: Ledger[] = currentLedgers.map(l => {
      const grp = (l['Parent Group'] || '').trim();
      const name = (l['Ledger Name'] || '').trim();
      const isPL = plGroups.has(grp);

      if (isPL) {
        return {
          ...l,
          'Opening Balance': 0,
          'Current Balance': 0,
          'Balance Type (Dr/Cr)': (grp.includes('Income') || grp === 'Sales Accounts') ? 'Cr' : 'Dr'
        };
      }

      if (name.toLowerCase() === 'capital account' || grp === 'Capital Account') {
        const curBal = Number(l['Current Balance']) || 0;
        const curType = l['Balance Type (Dr/Cr)'] || 'Cr';
        let netVal = curType === 'Cr' ? curBal : -curBal;
        netVal += netProfitLoss; // Add Net Profit (or deduct Net Loss)

        return {
          ...l,
          'Opening Balance': Math.abs(round2(netVal)),
          'Current Balance': Math.abs(round2(netVal)),
          'Balance Type (Dr/Cr)': netVal >= 0 ? 'Cr' : 'Dr'
        };
      }

      // Balance Sheet accounts: carry forward current balance as opening balance
      const curBal = Number(l['Current Balance']) || 0;
      return {
        ...l,
        'Opening Balance': curBal,
        'Current Balance': curBal,
        'Balance Type (Dr/Cr)': l['Balance Type (Dr/Cr)'] || 'Dr'
      };
    });

    // 6. Prepare carried-over items (current stock becomes opening stock)
    const carriedItems: Item[] = currentItems.map(item => {
      const curStock = Number(item['Current Stock']) || Number(item['Stock Qty']) || Number(item['Opening Stock']) || 0;
      return {
        ...item,
        'Opening Stock': curStock,
        'Current Stock': curStock,
        'Stock Qty': curStock
      };
    });

    if (mode === 'same_company') {
      // Create new FY
      const { financialYear: newFY, error: fyErr } = await createFinancialYear({
        company_id: companyId,
        fy_name: toFYName,
        start_date: targetStartDate,
        end_date: targetEndDate,
        is_active: true,
        is_locked: false
      });

      if (fyErr || !newFY) {
        return {
          success: false,
          fromFYName,
          toFYName,
          targetStartDate,
          targetEndDate,
          mode,
          netProfitLoss,
          carriedLedgersCount: 0,
          carriedItemsCount: 0,
          error: fyErr || 'Failed to create financial year'
        };
      }

      setActiveFYId(newFY.id);

      // Update ledgers and items for same company
      saveJson(STORAGE_KEYS.LEDGERS, carriedLedgers);
      saveJson(STORAGE_KEYS.ITEMS, carriedItems);

      addAuditLog({
        action: 'ENTERED',
        module: 'Financial Year',
        recordId: toFYName,
        details: `Year-End Roll-over executed from ${fromFYName} to ${toFYName}. Net Profit/Loss of Nu. ${netProfitLoss.toFixed(2)} transferred to Capital Account.`
      });

      return {
        success: true,
        fromFYName,
        toFYName,
        targetStartDate,
        targetEndDate,
        mode,
        netProfitLoss,
        carriedLedgersCount: carriedLedgers.length,
        carriedItemsCount: carriedItems.length
      };
    } else {
      // Split to new company
      const currentCfg = loadJson<Config>(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
      const newCompanyName = `${currentCfg.CompanyName || 'Company'} (${toFYName})`;

      const { company: newComp, error: compErr } = await createCompany({
        company_name: newCompanyName,
        trade_license_no: currentCfg.CompanyTPNNo || '',
        tax_payer_id: currentCfg.CompanyGSTNo || '',
        phone: currentCfg.CompanyPhone || '',
        email: currentCfg.CompanyEmail || '',
        address: currentCfg.Address || '',
        currency_symbol: currentCfg.CurrencySymbol || 'Nu.',
        admin_username: 'admin',
        admin_pin: '0000'
      });

      if (compErr || !newComp) {
        return {
          success: false,
          fromFYName,
          toFYName,
          targetStartDate,
          targetEndDate,
          mode,
          netProfitLoss,
          carriedLedgersCount: 0,
          carriedItemsCount: 0,
          error: compErr || 'Failed to initialize new company'
        };
      }

      // Save carried-over ledgers, items, and config to new company tenant keys
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(`deep_pos_ledgers_${newComp.id}`, JSON.stringify(carriedLedgers));
        localStorage.setItem(`deep_pos_items_${newComp.id}`, JSON.stringify(carriedItems));
        localStorage.setItem(`deep_pos_config_${newComp.id}`, JSON.stringify({
          ...currentCfg,
          CompanyName: newCompanyName
        }));
      }

      // Create target FY in the new company
      await createFinancialYear({
        company_id: newComp.id,
        fy_name: toFYName,
        start_date: targetStartDate,
        end_date: targetEndDate,
        is_active: true,
        is_locked: false
      });

      return {
        success: true,
        fromFYName,
        toFYName,
        targetStartDate,
        targetEndDate,
        mode,
        netProfitLoss,
        carriedLedgersCount: carriedLedgers.length,
        carriedItemsCount: carriedItems.length,
        newCompanyId: newComp.id,
        newCompanyName: newCompanyName
      };
    }
  } catch (err: any) {
    return {
      success: false,
      fromFYName: params.fromFYName,
      toFYName: params.toFYName,
      targetStartDate: params.targetStartDate,
      targetEndDate: params.targetEndDate,
      mode: params.mode,
      netProfitLoss: 0,
      carriedLedgersCount: 0,
      carriedItemsCount: 0,
      error: err?.message || 'Unexpected error during year-end roll-over'
    };
  }
}

