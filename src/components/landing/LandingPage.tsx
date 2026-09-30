import React, { useState } from 'react';
import { DrukErpLogo } from '../common/DrukErpLogo';
import {
  Receipt,
  ShoppingCart,
  Utensils,
  Smartphone,
  QrCode,
  Boxes,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  ArrowRight,
  Clock,
  Users,
  Sparkles,
  Calculator,
  ScanLine,
  Share2,
  MessageCircle,
  Phone,
  MapPin,
  Check,
  ChevronRight,
  Layers,
  Pill,
  Wrench,
  Shirt,
  LogIn,
  BarChart3,
  Calendar,
  Send,
  ExternalLink,
  X,
  BadgeDollarSign,
  Building2,
  ShieldCheck,
  HelpCircle,
  Laptop
} from 'lucide-react';

interface AppDetail {
  id: string;
  name: string;
  category: string;
  color: string; // Gradient Tailwind classes
  icon: React.ElementType;
  tagline: string;
  description: string;
  features: string[];
  bhutanBenefit: string;
}

const APPS: AppDetail[] = [
  {
    id: 'drc-tax',
    name: 'DRC Tax & GST',
    category: 'Finance & Compliance',
    color: 'from-emerald-500 to-teal-600',
    icon: ShieldCheck,
    tagline: 'Upload-ready GST & TDS files matching DRC portal formats',
    description: 'Eliminate manual tax reconciliation and spreadsheets. DrukERP exports standardized schedules verified against Bhutan Revenue & Customs (DRC / BURS) specifications.',
    features: [
      'GST Output Tax Return Schedule with customer TPN/GSTIN, taxable values, and rate breakdown',
      'GST Input Tax Credit Reconciliation with purchase verification and Bill of Entry matching',
      'TDS Withholding Tax Schedule (2%, 3%, 5%) with automated deduction & certificate generation',
      'Monthly Salary Schedule for PIT filing with department-wise payroll export'
    ],
    bhutanBenefit: 'Files export in 1-click to Excel (.xlsx) ready for direct submission to the DRC online portal without reformatting.'
  },
  {
    id: 'pos',
    name: 'Point of Sale',
    category: 'Sales & Retail',
    color: 'from-amber-500 to-orange-600',
    icon: ShoppingCart,
    tagline: 'High-speed barcode checkout with offline-first reliability',
    description: 'Built for checkout counters requiring 60+ customer bills per hour. Operates seamlessly offline during internet blackouts and syncs automatically when reconnected.',
    features: [
      'Dual customer mode: Walk-in Cash or Credit customers with TPN, phone, and address',
      'Instant barcode scanner recognition and keyboard shortcut speed (Alt+P, Alt+S, F2)',
      'Multiple payment modes: Cash, mBoB / B-Mobile QR, Credit, and split tenders',
      'Thermal receipt printing (58mm / 80mm) with customizable Bhutanese greetings and tax summaries'
    ],
    bhutanBenefit: 'Store cashiers never get blocked when local internet drops in Thimphu or outstations.'
  },
  {
    id: 'accounting',
    name: 'Accounting',
    category: 'Finance & Compliance',
    color: 'from-blue-600 to-indigo-600',
    icon: Calculator,
    tagline: 'Double-entry ledgers with intelligent auto-narration',
    description: 'Complete double-entry accounting engine with continuous-loop voucher entry. Features intelligent narration that writes transaction descriptions automatically.',
    features: [
      'Intelligent Voucher Narration Engine: synthesizes accurate narration from transaction context',
      'Context-Aware Ledger Filter: prevents cashiers from selecting incorrect expense or asset accounts',
      'Real-time Balance Sheet, Profit & Loss, Trial Balance, and Cash/Bank Daybooks',
      'Bank Reconciliation with transaction reference ID tracking'
    ],
    bhutanBenefit: 'Accountants get Tally-style rapid data entry with modern cloud security and live reports.'
  },
  {
    id: 'restaurant',
    name: 'Restaurant & QR',
    category: 'Hospitality',
    color: 'from-rose-500 to-orange-500',
    icon: Utensils,
    tagline: 'Table dine-in, mobile waiter captain app, and QR self-ordering',
    description: 'Transform your restaurant, cafe, or bar operations. Waiters take orders tableside on their smartphones, while guests can scan table QR codes to browse and order directly.',
    features: [
      'Visual Table Floor Plan with live status: Vacant, Occupied, Billed, and Table Transfer',
      'Smartphone Captain App: Waiters punch orders at tables with instant Kitchen Order Ticket (KOT) printing',
      'Contactless QR Ordering: Diners scan table QR codes on their phones to place orders directly',
      'Split billing, service charge configuration, and multi-counter bar/kitchen routing'
    ],
    bhutanBenefit: 'Speeds up food service and eliminates wrong orders during busy dinner rushes.'
  },
  {
    id: 'inventory',
    name: 'Inventory & Stock',
    category: 'Supply Chain',
    color: 'from-violet-600 to-purple-600',
    icon: Boxes,
    tagline: 'Multi-unit conversions and automatic stock valuation',
    description: 'Full visibility across warehouse stock. Handles multi-unit conversions like Carton to Box to Piece with automated cost and selling price adjustments during billing.',
    features: [
      'Multi-unit conversions: Master Unit to Sub-units (e.g. 1 Carton = 12 Boxes = 144 Pieces)',
      'Real-time stock valuation using Moving Weighted Average / FIFO',
      'Low stock warning alerts and automated reorder purchase requisitions',
      'Physical stock verification and variance reconciliation ledger'
    ],
    bhutanBenefit: 'Never oversell or lose track of stock when breaking wholesale bulk cartons into retail pieces.'
  },
  {
    id: 'electronics',
    name: 'Electronics & IMEI',
    category: 'Specialized Verticals',
    color: 'from-sky-500 to-blue-600',
    icon: Smartphone,
    tagline: 'Serial number and IMEI tracking for phones and appliances',
    description: 'Designed specifically for mobile showrooms, computer shops, and electronics dealers. Tracks every individual unit by its unique Serial / IMEI number from purchase to sale.',
    features: [
      'Mandatory or optional IMEI/Serial tracking at Goods Receipt and POS billing',
      'Customer warranty tracking and repair/replacement service history ledger',
      'Barcode scanner IMEI capture to prevent typing mistakes on 15-digit numbers',
      'Bulk import of device serial numbers directly from distributor Excel invoices'
    ],
    bhutanBenefit: 'Instant warranty verification when customers bring devices back for service.'
  },
  {
    id: 'pharmacy',
    name: 'Pharmacy & Batch',
    category: 'Specialized Verticals',
    color: 'from-emerald-600 to-green-700',
    icon: Pill,
    tagline: 'Batch numbers, expiry date tracking, and FEFO automated dispatch',
    description: 'Strict pharmaceutical inventory compliance. Ensures medicines are tracked by batch number and dispatched using First Expiry, First Out (FEFO) logic to prevent expired stock losses.',
    features: [
      'Batch Number & Expiry Date tracking on all pharmaceutical products',
      'FEFO Automated Dispatch: cashier is automatically prompted to dispense the earliest expiring batch',
      'Near-Expiry Warning Dashboard showing stock expiring within 30, 60, or 90 days',
      'Detailed batch-wise sales and purchase audit trails for health regulatory inspections'
    ],
    bhutanBenefit: 'Protects patient health and eliminates financial losses from expired medicine write-offs.'
  },
  {
    id: 'spares',
    name: 'Auto Spares & Parts',
    category: 'Specialized Verticals',
    color: 'from-amber-600 to-orange-700',
    icon: Wrench,
    tagline: 'Part numbers, rack/bin locations, and vehicle compatibility',
    description: 'Engineered for auto spare parts stores, workshops, and hardware distributors. Quickly locate parts in sprawling warehouses by Part Number and Rack/Bin locations.',
    features: [
      'OEM Part Number & Alternative Part Number cross-referencing for rapid search',
      'Warehouse Rack, Shelf, and Bin Location tracking printed directly on pick slips',
      'Vehicle Make, Model, and Year compatibility search during counter inquiries',
      'Dead stock analysis to identify slow-moving vehicle parts'
    ],
    bhutanBenefit: 'Warehouse staff find the exact spare part in seconds instead of searching shelves manually.'
  },
  {
    id: 'garments',
    name: 'Garments & Footwear',
    category: 'Specialized Verticals',
    color: 'from-pink-500 to-rose-600',
    icon: Shirt,
    tagline: 'Color, Size, and Style matrix with variant barcode tags',
    description: 'Matrix-based inventory for fashion retail, apparel, and shoe stores. Enter 50 size/color variations on a single screen and print custom price tags with barcodes.',
    features: [
      'Variant Matrix: track products across Color, Size, Style, and Brand attributes',
      'Matrix Bulk Stock Entry: enter quantities for all sizes and colors in a single grid',
      'Custom Barcode Sticker Printing with Brand, Size, Color, and MRP',
      'Size-wise sales breakdown to identify fast-selling sizes for reordering'
    ],
    bhutanBenefit: 'Simplifies apparel inventory without having to create dozens of separate product items.'
  },
  {
    id: 'hr-payroll',
    name: 'HR & Payroll',
    category: 'Human Resources',
    color: 'from-indigo-500 to-purple-600',
    icon: Users,
    tagline: 'Automated salary calculations, PF, and PIT deductions',
    description: 'Complete employee management and payroll processing. Automatically computes Basic Salary, Allowances, Provident Fund (PF), and PIT tax deductions.',
    features: [
      'One-click monthly payroll processing with employee master profiles',
      'Automated deduction of Employee PF (5-10%), Employer Contribution, and PIT tax brackets',
      'Printable and WhatsApp-shareable monthly employee payslips',
      'Monthly Salary Schedule export formatted for direct DRC tax upload'
    ],
    bhutanBenefit: 'Disburse staff salaries and generate DRC monthly salary tax schedules in minutes.'
  },
  {
    id: 'attendance',
    name: 'GPS Attendance',
    category: 'Human Resources',
    color: 'from-teal-500 to-emerald-600',
    icon: Clock,
    tagline: 'Smartphone clock-in/out with GPS location geofencing',
    description: 'Empower staff to clock in and out from their own smartphones. Geo-fencing coordinates ensure employees are physically present on store premises before clocking in.',
    features: [
      'Staff Mobile Clock-In / Clock-Out from any smartphone browser without installing apps',
      'GPS Location Geofencing: verifies staff are inside the store perimeter',
      'Shift tracking, late arrivals, overtime, and leave management',
      'Direct integration with the payroll engine for automated attendance salary deductions'
    ],
    bhutanBenefit: 'Eliminates expensive biometric hardware and prevents proxy buddy-punching.'
  },
  {
    id: 'barcode',
    name: 'Barcode Studio',
    category: 'Retail & Warehouse',
    color: 'from-cyan-500 to-blue-600',
    icon: ScanLine,
    tagline: 'Custom barcode generator for thermal rolls and A4 sticker sheets',
    description: 'Generate and print custom product barcode stickers. Supports standard thermal barcode printers (roll format) as well as regular office laser printers using multi-column A4 sticker sheets.',
    features: [
      'Supports Code128, EAN-13, and custom internal store barcode formats',
      'Flexible label designer: include Item Name, Price, Size, Expiry, and Company Logo',
      'Thermal printer presets (e.g. 50x25mm, 38x25mm) and multi-column A4 sticker sheets (24/30/40 up)',
      'Batch printing directly from Purchase bills or inventory master'
    ],
    bhutanBenefit: 'Tag unbarcoded goods instantly without buying third-party labeling software.'
  },
  {
    id: 'pricing',
    name: 'Wholesale & Retail',
    category: 'Sales & Retail',
    color: 'from-yellow-500 to-amber-600',
    icon: BadgeDollarSign,
    tagline: 'Dual price tiers for wholesale distributors and retail customers',
    description: 'Operate wholesale distribution and retail walk-in sales from the same system. Configure dual pricing tiers with minimum quantity triggers and customer-specific price lists.',
    features: [
      'Dual pricing per product: Wholesale Rate vs Retail Walk-in Rate',
      'Automatic Wholesale Rate trigger when quantity exceeds minimum wholesale threshold',
      'Customer-specific credit limits, discounts, and payment terms (e.g. Net 15, Net 30)',
      'Price change history audit to monitor margin changes over time'
    ],
    bhutanBenefit: 'Serve both retail walk-in shoppers and wholesale bulk re-sellers from one system.'
  },
  {
    id: 'multi-branch',
    name: 'Multi-Branch Sync',
    category: 'Enterprise Scaling',
    color: 'from-blue-700 to-indigo-800',
    icon: Building2,
    tagline: 'Connect Head Office with Phuntsholing, Paro & Outstations',
    description: 'Scale from a single shop to a nationwide chain. Maintain centralized inventory and consolidated accounts while providing each branch with dedicated voucher numbering.',
    features: [
      'Dedicated branch prefixes: HQ-POS-1 (Thimphu), PHU-POS-1 (Phuntsholing), PAR-POS-1 (Paro)',
      'Branch-to-branch Stock Transfer with in-transit tracking and receipt confirmation',
      'Branch-isolated inventory and sales reporting with consolidated HQ financial statements',
      'Staff branch assignment: locks cashier access to their authorized branch only'
    ],
    bhutanBenefit: 'Complete multi-location control across Bhutan with zero invoice number collisions.'
  },
  {
    id: 'whatsapp-share',
    name: 'WhatsApp & Email',
    category: 'Communication',
    color: 'from-green-500 to-emerald-600',
    icon: MessageCircle,
    tagline: '1-click direct sharing of invoices, receipts, and ledger statements',
    description: 'Go completely paperless. Send professional PDF tax invoices, thermal receipts, and customer account statements directly to your client’s WhatsApp or Email with a single click.',
    features: [
      '1-Click WhatsApp share: opens WhatsApp with pre-composed professional message and invoice link',
      'Direct Email dispatch with attached PDF tax invoices and receipts',
      'Send outstanding balance payment reminders directly to customer phones',
      'Thermal receipt digital link sharing for paperless eco-friendly checkout'
    ],
    bhutanBenefit: 'Customers in Bhutan love receiving bills directly on WhatsApp on their phones.'
  },
  {
    id: 'excel-import',
    name: 'Excel Import / Export',
    category: 'Productivity',
    color: 'from-teal-600 to-green-700',
    icon: FileSpreadsheet,
    tagline: '1-click bulk import of products, serials, and opening balances',
    description: 'Migrate your entire business in minutes. Import thousands of items with barcodes, serial numbers, rack numbers, wholesale rates, and opening balances in 1 second from Excel.',
    features: [
      'Bulk Excel item import with template download and validation check',
      'Imports barcodes, categories, cost prices, selling rates, and serial numbers in bulk',
      '1-Click Export of all financial reports, stock statements, and registers to Excel (.xlsx)',
      'Zero downtime migration when switching from legacy software or paper registers'
    ],
    bhutanBenefit: 'Onboard your entire store catalog in minutes without manual typing.'
  },
  {
    id: 'assets',
    name: 'Fixed Assets',
    category: 'Finance & Compliance',
    color: 'from-rose-600 to-red-700',
    icon: Layers,
    tagline: 'Asset registry, depreciation schedules, and custodian tracking',
    description: 'Track your organization’s physical capital investments. Manage furniture, computers, vehicles, and machinery with automated Straight Line (SLM) and Written Down (WDV) depreciation.',
    features: [
      'Comprehensive Fixed Asset Register with serial numbers, warranty, and purchase bills',
      'Automated Depreciation Schedule calculation (SLM / WDV) feeding balance sheet',
      'Asset custodian assignment: track which employee or department holds each asset',
      'Asset disposal, scrap, and write-off ledger tracking'
    ],
    bhutanBenefit: 'Clean, auditable asset records required by company auditors and tax authorities.'
  },
  {
    id: 'tasks',
    name: 'Notes & Tasks',
    category: 'Productivity',
    color: 'from-amber-600 to-yellow-600',
    icon: FileText,
    tagline: 'Internal team assignments, reminders, and payment follow-ups',
    description: 'Keep your team coordinated and accountable. Assign customer payment collection follow-ups, physical stock audit tasks, and internal reminders with due dates and priority tags.',
    features: [
      'Create and assign tasks to specific employees with deadlines and priority levels',
      'Link tasks directly to customer ledgers or unpaid invoices for collection follow-ups',
      'Internal team notes and communication trail per transaction',
      'Activity status tracking: Pending, In-Progress, Completed, and Overdue'
    ],
    bhutanBenefit: 'Ensure critical store duties and customer credit follow-ups never slip through the cracks.'
  }
];

interface LandingPageProps {
  onOpenLogin: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenLogin }) => {
  const [selectedApp, setSelectedApp] = useState<AppDetail | null>(null);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [demoFormData, setDemoFormData] = useState({
    name: '',
    businessName: '',
    phone: '',
    dzongkhag: 'Thimphu',
    businessType: 'Retail & Supermarket',
    notes: ''
  });
  const [demoSubmitted, setDemoSubmitted] = useState(false);

  const handleDemoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!demoFormData.phone || !demoFormData.name) return;
    setDemoSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-sky-400 selection:text-slate-950">
      
      {/* Top Clean Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 sm:h-20 flex items-center justify-between">
          
          {/* Brand Logo */}
          <div className="flex items-center">
            <DrukErpLogo size="md" variant="full" />
          </div>

          {/* Center Nav Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600">
            <a href="#apps" className="hover:text-blue-600 transition-colors">All Apps</a>
            <button 
              type="button" 
              onClick={() => setSelectedApp(APPS[0])} 
              className="hover:text-blue-600 transition-colors cursor-pointer"
            >
              DRC Tax
            </button>
            <button 
              type="button" 
              onClick={() => setSelectedApp(APPS[3])} 
              className="hover:text-blue-600 transition-colors cursor-pointer"
            >
              Restaurant
            </button>
            <button 
              type="button" 
              onClick={() => setShowDemoModal(true)} 
              className="hover:text-blue-600 transition-colors cursor-pointer"
            >
              Book Demo
            </button>
          </nav>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onOpenLogin}
              className="text-xs sm:text-sm font-bold text-slate-700 hover:text-blue-600 px-3 py-2 transition-colors cursor-pointer"
            >
              Sign In
            </button>

            <button
              type="button"
              onClick={onOpenLogin}
              className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-blue-700 to-sky-500 hover:from-blue-700 hover:to-sky-600 text-white font-black text-xs sm:text-sm shadow-md shadow-blue-500/20 transition-all cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>Launch ERP</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section (Proposed Look: Luminous, Clean, Centered with Capsule Badge) */}
      <section className="relative pt-12 pb-16 sm:pt-18 sm:pb-24 text-center overflow-hidden bg-gradient-to-b from-sky-50/40 via-white to-slate-50/40">
        {/* Soft Ambient Corner Glows matching the proposed image */}
        <div className="absolute -bottom-16 -left-16 w-80 h-80 rounded-full bg-amber-100/60 blur-3xl pointer-events-none" />
        <div className="absolute -top-16 -right-16 w-96 h-96 rounded-full bg-sky-100/60 blur-3xl pointer-events-none" />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          
          {/* Main Headline */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold text-[#0a1e44] tracking-tight leading-[1.12]">
            Everything Your<br />
            Business Needs,<br />
            <span className="inline-block bg-[#fec84b] text-[#0a1e44] px-8 sm:px-12 py-1.5 sm:py-2 rounded-full font-black mt-2 sm:mt-3 shadow-xs">
              in One Place
            </span>
          </h1>

          {/* Sub-headline in Serif Italic */}
          <p className="font-serif italic font-bold text-2xl sm:text-3xl lg:text-4xl text-[#0a1e44] mt-5 sm:mt-6">
            Simple, efficient, yet affordable!
          </p>

          {/* Small Golden-Yellow Divider Line */}
          <div className="w-16 h-1 bg-[#fec84b] rounded-full mx-auto my-4 sm:my-5" />

          {/* Explanatory Paragraph */}
          <p className="text-slate-600 text-sm sm:text-base max-w-xl mx-auto font-normal leading-relaxed">
            Built specifically for businesses in Bhutan — from DRC GST filings<br className="hidden sm:inline" /> to restaurant QR ordering and mobile staff attendance.
          </p>

          {/* Centered Sleek Navy Capsule Button */}
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={onOpenLogin}
              className="bg-[#0a1e44] hover:bg-[#061530] text-white px-9 py-3.5 sm:py-4 rounded-full font-bold text-sm sm:text-base shadow-xl hover:shadow-2xl transition-all duration-200 inline-flex items-center gap-2.5 cursor-pointer group"
            >
              <span>Get Started</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </section>

      {/* Interactive Odoo-Style App Icon Grid Section */}
      <section id="apps" className="py-12 bg-slate-50/70 border-t border-slate-200/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center mb-10">
            <span className="text-xs font-black uppercase tracking-wider text-amber-600 block">
              18 Integrated Applications
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
              Click any app to see its complete capabilities
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Every app is interconnected. One single database, zero duplicate entries.
            </p>
          </div>

          {/* Grid of Apps (3 cols mobile, 4 cols tablet, 6 cols desktop) */}
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-6">
            {APPS.map((app) => {
              const Icon = app.icon;
              return (
                <button
                  key={app.id}
                  type="button"
                  onClick={() => setSelectedApp(app)}
                  className="group flex flex-col items-center text-center p-3 sm:p-4 rounded-2xl bg-white hover:bg-white border border-slate-200/80 hover:border-amber-300 shadow-xs hover:shadow-xl transition-all duration-200 hover:-translate-y-1 cursor-pointer"
                >
                  {/* App Icon Tile */}
                  <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr ${app.color} p-0.5 shadow-md group-hover:scale-105 transition-transform duration-200 flex items-center justify-center text-white`}>
                    <div className="w-full h-full rounded-[14px] bg-white/10 backdrop-blur-xs flex items-center justify-center">
                      <Icon className="w-7 h-7 sm:w-8 sm:h-8 drop-shadow-xs" />
                    </div>
                  </div>

                  {/* App Name */}
                  <span className="mt-3 text-xs sm:text-sm font-bold text-slate-800 group-hover:text-amber-600 transition-colors leading-tight line-clamp-1">
                    {app.name}
                  </span>
                  <span className="text-[10px] text-slate-400 group-hover:text-slate-500 transition-colors line-clamp-1 mt-0.5">
                    {app.category}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Odoo Style Bottom Toggle bar */}
          <div className="mt-14 pt-8 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-semibold text-slate-800">100% DRC BURS Tax &amp; GST Compliant</span>
              <span>· Built for Bhutan 🇧🇹</span>
            </div>

            <div className="flex items-center gap-4 font-bold text-slate-800">
              <button 
                type="button" 
                onClick={onOpenLogin}
                className="hover:text-amber-600 flex items-center gap-1 cursor-pointer"
              >
                <span>Client Sign In</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Selected App Detail Modal (Opens when user clicks any App Icon) */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in zoom-in-95 duration-200">
            
            {/* Modal Top Header with App Gradient */}
            <div className={`p-6 sm:p-8 bg-gradient-to-r ${selectedApp.color} text-white relative`}>
              <button
                type="button"
                onClick={() => setSelectedApp(null)}
                className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/20 hover:bg-black/40 text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-inner">
                  {React.createElement(selectedApp.icon, { className: 'w-9 h-9' })}
                </div>
                <div>
                  <span className="text-[11px] font-black uppercase tracking-wider text-white/80 bg-black/15 px-2.5 py-0.5 rounded-md">
                    {selectedApp.category}
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-black mt-1">{selectedApp.name}</h3>
                  <p className="text-xs sm:text-sm text-white/90 font-medium mt-0.5">{selectedApp.tagline}</p>
                </div>
              </div>
            </div>

            {/* Modal Body: Complete Detail of Feature */}
            <div className="p-6 sm:p-8 space-y-6 max-h-[65vh] overflow-y-auto">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Overview</h4>
                <p className="mt-1 text-sm text-slate-700 leading-relaxed font-normal">
                  {selectedApp.description}
                </p>
              </div>

              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">Key Capabilities</h4>
                <div className="space-y-2.5">
                  {selectedApp.features.map((feat, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span className="leading-snug">{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bhutan Advantage Highlight Box */}
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-950">
                <div className="font-extrabold flex items-center gap-1.5 text-amber-900 mb-1">
                  <span>🇧🇹 The Bhutan Advantage</span>
                </div>
                <p className="leading-relaxed text-amber-900/90">{selectedApp.bhutanBenefit}</p>
              </div>
            </div>

            {/* Modal Footer with Launch Button */}
            <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setSelectedApp(null)}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 transition cursor-pointer"
              >
                Close App Preview
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedApp(null);
                  onOpenLogin();
                }}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-700 hover:to-sky-600 text-white font-extrabold text-xs shadow-md shadow-blue-500/20 transition cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Launch {selectedApp.name} in ERP</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Book a Demo Modal */}
      {showDemoModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto p-6 sm:p-8">
            <button
              type="button"
              onClick={() => {
                setShowDemoModal(false);
                setDemoSubmitted(false);
              }}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {demoSubmitted ? (
              <div className="text-center py-8 space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-black text-slate-900">Demo Request Received!</h3>
                <p className="text-xs text-slate-600 max-w-sm mx-auto">
                  Thank you, <strong>{demoFormData.name}</strong>. Our local Bhutanese ERP specialist will contact you via WhatsApp / Phone at <strong>{demoFormData.phone}</strong> to schedule your demonstration.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowDemoModal(false);
                    setDemoSubmitted(false);
                  }}
                  className="px-6 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleDemoSubmit} className="space-y-4">
                <div>
                  <h3 className="text-xl font-black text-slate-900">Meet an Advisor / Free Demo</h3>
                  <p className="text-xs text-slate-500 mt-0.5">We will help you set up thermal printers, DRC tax exports, and migrate stock from Excel.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Your Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Karma Dorji"
                    value={demoFormData.name}
                    onChange={(e) => setDemoFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs focus:outline-hidden focus:border-amber-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Business Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Druk Store"
                      value={demoFormData.businessName}
                      onChange={(e) => setDemoFormData(prev => ({ ...prev, businessName: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs focus:outline-hidden focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Phone / WhatsApp</label>
                    <input
                      type="tel"
                      required
                      placeholder="e.g. +975 17123456"
                      value={demoFormData.phone}
                      onChange={(e) => setDemoFormData(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs focus:outline-hidden focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Dzongkhag / City</label>
                    <select
                      value={demoFormData.dzongkhag}
                      onChange={(e) => setDemoFormData(prev => ({ ...prev, dzongkhag: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs focus:outline-hidden focus:border-amber-500"
                    >
                      <option value="Thimphu">Thimphu</option>
                      <option value="Phuntsholing">Phuntsholing</option>
                      <option value="Paro">Paro</option>
                      <option value="Gelephu">Gelephu</option>
                      <option value="Punakha">Punakha</option>
                      <option value="Wangdue">Wangdue</option>
                      <option value="Bumthang">Bumthang</option>
                      <option value="Samdrup Jongkhar">Samdrup Jongkhar</option>
                      <option value="Other">Other Dzongkhag</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Business Type</label>
                    <select
                      value={demoFormData.businessType}
                      onChange={(e) => setDemoFormData(prev => ({ ...prev, businessType: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs focus:outline-hidden focus:border-amber-500"
                    >
                      <option value="Retail & Supermarket">Retail &amp; Supermarket</option>
                      <option value="Restaurant / Cafe / Bar">Restaurant / Bar</option>
                      <option value="Electronics & Mobile">Electronics &amp; Mobile</option>
                      <option value="Pharmacy / Healthcare">Pharmacy</option>
                      <option value="Auto Spare Parts / Hardware">Auto Spare Parts</option>
                      <option value="Garments & Footwear">Garments &amp; Footwear</option>
                      <option value="Wholesale">Wholesale &amp; Distribution</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-700 hover:to-sky-600 text-white font-extrabold text-xs shadow-md shadow-blue-500/20 transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  <span>Submit Demo Request</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Clean Minimal Footer */}
      <footer className="bg-white border-t border-slate-200 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <DrukErpLogo size="sm" variant="compact" />
          </div>

          <div className="flex items-center gap-6">
            <a href="https://wa.me/97517000000" target="_blank" rel="noopener noreferrer" className="hover:text-amber-600 flex items-center gap-1">
              <MessageCircle className="w-3.5 h-3.5 text-green-600" />
              <span>WhatsApp Support (+975)</span>
            </a>
            <button type="button" onClick={() => setShowDemoModal(true)} className="hover:text-amber-600 cursor-pointer">
              Book Demo
            </button>
            <button type="button" onClick={onOpenLogin} className="hover:text-amber-600 font-bold cursor-pointer">
              Client Sign In
            </button>
          </div>

          <div>
            &copy; {new Date().getFullYear()} DrukERP. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};
