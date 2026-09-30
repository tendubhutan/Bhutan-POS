import React, { useState } from 'react';
import {
  Building2,
  ShieldCheck,
  Receipt,
  ShoppingCart,
  Utensils,
  Smartphone,
  Laptop,
  QrCode,
  Boxes,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  ArrowRight,
  Clock,
  Users,
  Award,
  Sparkles,
  Calculator,
  ScanLine,
  Share2,
  MessageCircle,
  Mail,
  Phone,
  MapPin,
  Check,
  ChevronRight,
  Layers,
  Cpu,
  Pill,
  Wrench,
  Shirt,
  BadgePercent,
  Lock,
  LogIn,
  BarChart3,
  Database,
  Calendar,
  Send,
  ExternalLink,
  ChevronDown
} from 'lucide-react';

interface LandingPageProps {
  onOpenLogin: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenLogin }) => {
  const [activeVertical, setActiveVertical] = useState<'retail' | 'restaurant' | 'electronics' | 'pharmacy' | 'spares' | 'garments'>('retail');
  const [activeTaxTab, setActiveTaxTab] = useState<'gst_output' | 'gst_input' | 'tds' | 'salary'>('gst_output');
  const [demoFormData, setDemoFormData] = useState({
    name: '',
    businessName: '',
    phone: '',
    dzongkhag: 'Thimphu',
    businessType: 'Retail & Supermarket',
    notes: ''
  });
  const [demoSubmitted, setDemoSubmitted] = useState(false);

  const verticals = [
    {
      id: 'retail' as const,
      label: 'Retail & Supermarkets',
      icon: ShoppingCart,
      tagline: 'High-speed POS, wholesale & retail dual pricing, and automated multi-units',
      highlights: [
        'Multi-Unit Conversion: Automatically convert Carton → Box → Piece with instantaneous rate adjustments',
        'Wholesale & Retail Dual Price Tiers for B2B bulk buyers vs walk-in retail customers',
        'High-Speed Thermal Barcode Billing capable of 60+ customer checkouts per hour',
        'Capture both Walk-in Cash & Credit Customer profiles with TPN/GSTIN, phone, and balance limits'
      ]
    },
    {
      id: 'restaurant' as const,
      label: 'Restaurants & Bars',
      icon: Utensils,
      tagline: 'Table-wise dine-in, mobile waiter captain app, and customer QR self-ordering',
      highlights: [
        'Interactive Table Floor Plan with live color-coded status (Vacant, Occupied, Billed)',
        'Smartphone Mobile Waiter App: Captains take food & drink orders tableside on their phones',
        'Contactless Customer QR Ordering: Diners scan table QR codes to browse menu and order',
        'Instant Kitchen Order Ticket (KOT) multi-printer dispatch and Kitchen Display integration'
      ]
    },
    {
      id: 'electronics' as const,
      label: 'Electronics & Mobiles',
      icon: Smartphone,
      tagline: 'Serial number and IMEI tracking for phones, laptops, and appliances',
      highlights: [
        'Individual IMEI & Serial Number registration during Goods Receipt and POS billing',
        'Comprehensive Warranty Tracking and device repair/replacement history ledger',
        'Barcode scanner instant IMEI identification without manual typing errors',
        'Bulk import of device serial numbers directly from supplier Excel shipments'
      ]
    },
    {
      id: 'pharmacy' as const,
      label: 'Pharmacies & Healthcare',
      icon: Pill,
      tagline: 'Batch number & expiry date control with FEFO automated dispatch',
      highlights: [
        'Batch Number & Expiry Date tracking for every medicine, syrup, and healthcare product',
        'FEFO (First Expiry, First Out) dispatch prompt preventing expired shelf inventory',
        'Near-Expiry Warning Dashboard showing stock expiring within 30, 60, or 90 days',
        'Detailed Batch-wise stock reports required by drug regulatory authorities'
      ]
    },
    {
      id: 'spares' as const,
      label: 'Auto Spares & Hardware',
      icon: Wrench,
      tagline: 'Part number & rack/bin location management for fast warehouse picking',
      highlights: [
        'OEM Part Number & Alternative Part Number cross-referencing for rapid search',
        'Warehouse Rack, Shelf, and Bin Location tracking printed directly on pick-lists',
        'Vehicle Make & Model compatibility lookup during customer counter inquiries',
        'Fast physical stock verification and audit discrepancy reconciliation'
      ]
    },
    {
      id: 'garments' as const,
      label: 'Garments & Footwear',
      icon: Shirt,
      tagline: 'Color, Size, and Style matrix management with dedicated variant barcodes',
      highlights: [
        'Comprehensive Variant Matrix: track inventory across Color, Size, and Style codes',
        'Matrix Bulk Stock Entry: enter 50 size/color variations in a single screen in seconds',
        'Instant Barcode Sticker Printing with customized tags displaying Brand, Size & Price',
        'Seasonal stock aging and category margin reports'
      ]
    }
  ];

  const handleDemoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!demoFormData.phone || !demoFormData.name) return;
    setDemoSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Top Header / Sticky Navigation */}
      <header className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-amber-500 via-orange-600 to-amber-400 p-0.5 shadow-lg shadow-amber-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <span className="font-black text-xl text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">D</span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-2xl font-black tracking-tight text-white">Druk</span>
                <span className="text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">ERP</span>
                <span className="ml-2 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  Bhutan Edition
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
                Enterprise Cloud POS &amp; Accounting ERP
              </p>
            </div>
          </div>

          {/* Nav Links */}
          <nav className="hidden lg:flex items-center gap-7 text-sm font-semibold text-slate-300">
            <a href="#features" className="hover:text-amber-400 transition-colors">Core Features</a>
            <a href="#tax-compliance" className="hover:text-amber-400 transition-colors">DRC &amp; GST Tax</a>
            <a href="#industries" className="hover:text-amber-400 transition-colors">Industry Solutions</a>
            <a href="#restaurant" className="hover:text-amber-400 transition-colors">Restaurant &amp; QR</a>
            <a href="#demo" className="hover:text-amber-400 transition-colors">Request Demo</a>
          </nav>

          {/* Action CTAs */}
          <div className="flex items-center gap-3">
            <a
              href="#demo"
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-200 border border-slate-700 hover:border-slate-500 hover:bg-slate-900 transition-colors"
            >
              <Phone className="w-3.5 h-3.5 text-amber-400" />
              <span>Contact Support</span>
            </a>
            <button
              type="button"
              onClick={onOpenLogin}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-sm shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 transition-all cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>Client Login</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-12 pb-20 lg:pt-20 lg:pb-32 overflow-hidden">
        {/* Subtle Background Glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 left-1/4 w-[300px] h-[300px] bg-orange-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          {/* Bhutan Tag Kicker */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs font-bold text-amber-400 mb-6 shadow-sm">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>DRC / BURS Tax Ready · Multi-Branch (Thimphu, Phuntsholing, Paro)</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white max-w-5xl mx-auto leading-[1.15]">
            Bhutan’s Premier Cloud ERP &amp; POS Built for Complete Business Control.
          </h1>

          <p className="mt-6 text-base sm:text-lg lg:text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed font-normal">
            From <strong>ready-to-upload DRC GST &amp; TDS schedules</strong> to intelligent double-entry accounting, 
            multi-unit inventory, mobile QR restaurant ordering, and smartphone GPS staff attendance — 
            everything your Bhutanese enterprise needs under one unified roof.
          </p>

          {/* Primary CTAs */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              type="button"
              onClick={onOpenLogin}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-base shadow-xl shadow-amber-500/25 transition-transform hover:-translate-y-0.5 cursor-pointer"
            >
              <LogIn className="w-5 h-5" />
              <span>Launch ERP / Client Login</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <a
              href="#demo"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 hover:border-slate-600 font-bold text-base transition-colors"
            >
              <Calendar className="w-5 h-5 text-amber-400" />
              <span>Request Free Demo &amp; Setup</span>
            </a>
          </div>

          {/* Key Value Pill Highlights */}
          <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto text-left">
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="text-amber-400 font-black text-lg">100% DRC Ready</div>
              <div className="text-xs text-slate-400 mt-1">Upload-ready GST Input/Output, TDS, and PIT Salary Schedules</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="text-emerald-400 font-black text-lg">Offline-First POS</div>
              <div className="text-xs text-slate-400 mt-1">Billing never stops even during internet outages; auto-syncs when online</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="text-cyan-400 font-black text-lg">Multi-Branch Sync</div>
              <div className="text-xs text-slate-400 mt-1">Independent series prefixes (HQ, PHU, PAR) with branch transfers</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="text-violet-400 font-black text-lg">Smart Mobile App</div>
              <div className="text-xs text-slate-400 mt-1">Smartphone GPS attendance, waiter captain order taking, QR menus</div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Showcase: DRC / BURS Tax & Compliance */}
      <section id="tax-compliance" className="py-20 bg-slate-900 border-y border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="text-xs font-black uppercase tracking-wider text-emerald-400">Bhutan Revenue Compliance</span>
            <h2 className="text-3xl sm:text-4xl font-black text-white mt-2">
              Ready-to-Upload DRC Tax &amp; GST Reports
            </h2>
            <p className="text-slate-400 mt-3 text-sm sm:text-base">
              Say goodbye to manual Excel reconciliations every tax filing deadline. DrukERP exports official, verified report formats ready for direct upload to the DRC online portal.
            </p>
          </div>

          {/* Interactive Tax Tabs */}
          <div className="flex flex-wrap items-center justify-center gap-2 p-1.5 bg-slate-950 rounded-2xl max-w-3xl mx-auto mb-10 border border-slate-800">
            <button
              onClick={() => setActiveTaxTab('gst_output')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTaxTab === 'gst_output' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              GST Output Report
            </button>
            <button
              onClick={() => setActiveTaxTab('gst_input')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTaxTab === 'gst_input' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              GST Input Reconciliation
            </button>
            <button
              onClick={() => setActiveTaxTab('tds')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTaxTab === 'tds' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              TDS Withholding Schedule
            </button>
            <button
              onClick={() => setActiveTaxTab('salary')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTaxTab === 'salary' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              Monthly Salary Schedule
            </button>
          </div>

          {/* Tab Content Display */}
          <div className="bg-slate-950 rounded-2xl border border-slate-800 p-6 sm:p-8 max-w-4xl mx-auto shadow-2xl">
            {activeTaxTab === 'gst_output' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base">DRC GST Output Tax Return Schedule</h3>
                      <p className="text-xs text-slate-400">Standardized B2B &amp; B2C sales register formatted for DRC upload</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-black text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-3 py-1 rounded-lg">
                    Format Verified
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300 pt-2">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Auto-segregates B2B Credit Sales with Customer TPN/GSTIN and retail Walk-in Cash receipts</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Calculates exact Taxable Value, Zero-Rated, Exempt, and standard GST slab rates</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>1-Click Excel (.xlsx) export directly matching DRC file specifications</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Auditable invoice-by-invoice trail with branch identification</span>
                  </div>
                </div>
              </div>
            )}

            {activeTaxTab === 'gst_input' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                      <Receipt className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base">DRC GST Input Tax Credit Reconciliation</h3>
                      <p className="text-xs text-slate-400">Purchase bill tax verification and supplier TPN reconciliation</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-black text-cyan-400 bg-cyan-950/60 border border-cyan-800/40 px-3 py-1 rounded-lg">
                    ITC Reconciled
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300 pt-2">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <span>Validates supplier TPNs, Bill of Entry (imports from India/overseas), and purchase invoice numbers</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <span>Prevents double-claiming of Input Tax Credit on duplicate purchase invoices</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <span>Automated separation of eligible business inputs vs non-claimable items</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <span>Ready for direct filing or submission to certified Bhutanese tax accountants</span>
                  </div>
                </div>
              </div>
            )}

            {activeTaxTab === 'tds' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                      <Calculator className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base">TDS (Tax Deducted at Source) Schedule</h3>
                      <p className="text-xs text-slate-400">Automated 2%, 3%, 5% withholding tax tracking on contracts, rent &amp; services</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-black text-amber-400 bg-amber-950/60 border border-amber-800/40 px-3 py-1 rounded-lg">
                    DRC Schedule
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300 pt-2">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>Auto-deducts and tracks TDS during voucher payment entry with vendor TPN mapping</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>Generates printable TDS Certificates for contractors, landlords, and suppliers</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>Pre-formatted DRC TDS Return Schedule with exact Challan / Payment tracking</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>Never miss the monthly TDS deposit deadline again</span>
                  </div>
                </div>
              </div>
            )}

            {activeTaxTab === 'salary' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base">Monthly Salary Schedule (PIT Return)</h3>
                      <p className="text-xs text-slate-400">Official monthly payroll schedule with Basic, Allowances, PF &amp; PIT</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-black text-violet-400 bg-violet-950/60 border border-violet-800/40 px-3 py-1 rounded-lg">
                    Payroll Upload Ready
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300 pt-2">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                    <span>Calculates Personal Income Tax (PIT) brackets, employee PF, and employer contributions</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                    <span>Integrates with smartphone GPS staff attendance for automatic overtime &amp; leave deductions</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                    <span>Monthly Salary Schedule ready for direct upload to the DRC electronic filing portal</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                    <span>Generates professional printable and WhatsApp-shareable monthly payslips</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Specialized Vertical Solutions */}
      <section id="industries" className="py-20 bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="text-xs font-black uppercase tracking-wider text-amber-400">Industry-Specific Modules</span>
            <h2 className="text-3xl sm:text-4xl font-black text-white mt-2">
              Engineered for Every Type of Business
            </h2>
            <p className="text-slate-400 mt-3 text-sm sm:text-base">
              Unlike generic foreign software that forces your store into a rigid box, DrukERP comes equipped with native workflows for retail, restaurants, electronics, healthcare, and wholesale.
            </p>
          </div>

          {/* Vertical Selector Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-10">
            {verticals.map((vert) => {
              const Icon = vert.icon;
              const isActive = activeVertical === vert.id;
              return (
                <button
                  key={vert.id}
                  onClick={() => setActiveVertical(vert.id)}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col items-start gap-2.5 ${
                    isActive
                      ? 'bg-amber-500/10 border-amber-500 text-white shadow-lg shadow-amber-500/10'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${isActive ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold leading-tight">{vert.label}</span>
                </button>
              );
            })}
          </div>

          {/* Active Vertical Detail Showcase */}
          {(() => {
            const current = verticals.find(v => v.id === activeVertical)!;
            const Icon = current.icon;
            return (
              <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8 max-w-5xl mx-auto shadow-2xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-white">{current.label} Management</h3>
                      <p className="text-xs text-slate-400 mt-0.5">{current.tagline}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenLogin}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs self-start md:self-auto cursor-pointer"
                  >
                    <span>Launch in ERP</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                  {current.highlights.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950/50 border border-slate-800/80">
                      <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span className="text-xs text-slate-300 leading-relaxed">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </section>

      {/* Feature Deep Dive Grid: Intelligent Accounting, HR, Barcode, Restaurant */}
      <section id="features" className="py-20 bg-slate-900 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-black uppercase tracking-wider text-cyan-400">Full-Suite Enterprise Engine</span>
            <h2 className="text-3xl sm:text-4xl font-black text-white mt-2">
              Everything Under One Powerful Platform
            </h2>
            <p className="text-slate-400 mt-3 text-sm sm:text-base">
              Built with cutting-edge intelligence to eliminate manual errors and make business operations fast, joyful, and automated.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* 1. Intelligent Voucher Narration & Ledger Filters */}
            <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">Intelligent Narration &amp; Ledger Filters</h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Automatically generates professional transaction narrations based on payment mode, party ledger, and bill items. Context-sensitive ledger filters prevent cashiers from accidentally picking wrong expense or asset accounts.
                </p>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-800 text-[11px] text-amber-400 font-semibold flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                <span>Zero accounting posting mistakes</span>
              </div>
            </div>

            {/* 2. Restaurant Smartphone QR & Captain App */}
            <div id="restaurant" className="p-6 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 mb-4">
                  <QrCode className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">Restaurant QR &amp; Waiter Smartphone App</h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Captains take orders directly at tables on smartphones. Diners can also scan QR codes at their table to view digital menus and place self-orders. Dispatches instant KOT to kitchen printers.
                </p>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-800 text-[11px] text-orange-400 font-semibold flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                <span>Eliminates food order mix-ups &amp; delays</span>
              </div>
            </div>

            {/* 3. Smartphone GPS Staff Attendance & Payroll */}
            <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4">
                  <Clock className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">Smartphone GPS Attendance &amp; Payroll</h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Staff clock in and out from their own smartphones with geo-fencing validation to confirm they are physically inside the store. Automatically compiles attendance hours, overtime, leave, and monthly payslips.
                </p>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-800 text-[11px] text-emerald-400 font-semibold flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                <span>Geofenced location protection</span>
              </div>
            </div>

            {/* 4. Complete Accounting & Live Balance Sheet */}
            <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-4">
                  <Calculator className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">Full Double-Entry Accounting</h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Real-time Balance Sheet, Profit &amp; Loss, Trial Balance, Cash Book, Bank Reconciliation, and Daybook. Full voucher suite: Sales, Purchase, Payment, Receipt, Journal, Contra, Debit/Credit Notes.
                </p>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-800 text-[11px] text-blue-400 font-semibold flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                <span>Strict Tally-style entry keyboard speed</span>
              </div>
            </div>

            {/* 5. Barcode Printing & Unit Conversion */}
            <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 mb-4">
                  <ScanLine className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">Custom Barcodes &amp; Unit Conversion</h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Print custom barcode stickers to thermal rolls or A4 sticker sheets. Configure complex units (Carton $\rightarrow$ Box $\rightarrow$ Piece) with automatic cost &amp; selling price calculations during billing.
                </p>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-800 text-[11px] text-violet-400 font-semibold flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                <span>Multi-tier packaging support</span>
              </div>
            </div>

            {/* 6. WhatsApp & Email 1-Click Sharing */}
            <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400 mb-4">
                  <Share2 className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">Instant WhatsApp &amp; Email Sharing</h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Send clean PDF tax invoices, thermal receipts, payment vouchers, and customer account statements directly to your customer or supplier’s WhatsApp or Email with 1 click.
                </p>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-800 text-[11px] text-green-400 font-semibold flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                <span>Paperless instant communication</span>
              </div>
            </div>

            {/* 7. Excel Bulk Import & Export */}
            <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 mb-4">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">Excel Bulk Import &amp; Export</h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Easily migrate your entire catalog. Import thousands of stock items with barcodes, serial numbers, rack numbers, wholesale rates, and opening balances in 1 second. Export all financial reports to Excel.
                </p>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-800 text-[11px] text-teal-400 font-semibold flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                <span>Zero downtime during onboarding</span>
              </div>
            </div>

            {/* 8. Fixed Asset Management System */}
            <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-4">
                  <Boxes className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">Complete Fixed Asset Management</h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Track company assets across office furniture, machinery, computers, and vehicles. Automatic depreciation calculations (SLM / WDV), custodian assignment, and asset disposal tracking.
                </p>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-800 text-[11px] text-rose-400 font-semibold flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                <span>Auditable balance sheet asset registers</span>
              </div>
            </div>

            {/* 9. Notes, Tasks & Team Assignments */}
            <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4">
                  <Layers className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">Notes, Tasks &amp; Assignment System</h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Assign payment follow-ups, inventory audit checks, and customer tasks to specific team members. Set due dates, priority tags, and maintain an internal team communication log.
                </p>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-800 text-[11px] text-indigo-400 font-semibold flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                <span>Keeps your staff accountable</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Multi-Branch Architecture */}
      <section className="py-20 bg-slate-950 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 rounded-3xl border border-slate-800 p-8 sm:p-12 relative overflow-hidden">
            <div className="max-w-3xl">
              <span className="text-xs font-black uppercase tracking-wider text-amber-400">Multi-Location Scaling</span>
              <h2 className="text-3xl sm:text-4xl font-black text-white mt-2">
                Connect Thimphu, Phuntsholing, Paro &amp; Beyond
              </h2>
              <p className="text-slate-300 mt-4 text-sm sm:text-base leading-relaxed">
                Whether you run a single retail shop in Thimphu or a multi-location enterprise with distribution hubs in Phuntsholing and branches in Paro or Gelephu, DrukERP provides isolated branch numbering (<code className="text-amber-400">HQ-POS-1</code>, <code className="text-amber-400">PHU-POS-1</code>, <code className="text-amber-400">PAR-POS-1</code>) and centralized real-time stock transfer management.
              </p>

              <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-slate-300">
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="font-bold text-white text-sm">Dedicated Voucher Prefix</div>
                  <div className="text-slate-400 mt-1">Each terminal locks to its branch identity automatically</div>
                </div>
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="font-bold text-white text-sm">Stock Transfer In-Transit</div>
                  <div className="text-slate-400 mt-1">Track goods moved between Head Office and Outstations</div>
                </div>
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="font-bold text-white text-sm">Consolidated Financials</div>
                  <div className="text-slate-400 mt-1">View overall business profit or drill down by location</div>
                </div>
              </div>

              <div className="mt-8 flex items-center gap-4">
                <button
                  type="button"
                  onClick={onOpenLogin}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-sm shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Access Multi-Branch Portal</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Demo Booking & Contact Section */}
      <section id="demo" className="py-20 bg-slate-900 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left: Contact Info & Support */}
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-amber-400">Get Started with DrukERP</span>
              <h2 className="text-3xl sm:text-4xl font-black text-white mt-2">
                Book a Free On-Site Demonstration &amp; Setup
              </h2>
              <p className="text-slate-300 mt-4 text-sm sm:text-base leading-relaxed">
                Our local Bhutanese ERP specialists will help you migrate your inventory from Excel, set up your thermal barcode printers, configure DRC tax reports, and train your store cashiers and accountants.
              </p>

              <div className="mt-8 space-y-4">
                <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="w-10 h-10 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400">
                    <MessageCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Direct WhatsApp Support</div>
                    <a
                      href="https://wa.me/97517000000?text=Hello%20DrukERP,%20I%20am%20interested%20in%20a%20demo%20for%20my%20business"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-bold text-white hover:text-green-400 flex items-center gap-1"
                    >
                      <span>Chat on WhatsApp (+975)</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Service Locations</div>
                    <div className="text-sm font-bold text-white">Thimphu · Phuntsholing · Paro · Gelephu</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Demo Request Form */}
            <div className="bg-slate-950 p-8 rounded-3xl border border-slate-800 shadow-2xl">
              {demoSubmitted ? (
                <div className="text-center py-10 space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-2xl font-black text-white">Demo Request Received!</h3>
                  <p className="text-sm text-slate-300 max-w-sm mx-auto">
                    Thank you, <strong>{demoFormData.name}</strong>. Our team will contact you via WhatsApp / Phone at <strong>{demoFormData.phone}</strong> shortly to schedule your on-site demo.
                  </p>
                  <button
                    type="button"
                    onClick={() => setDemoSubmitted(false)}
                    className="text-xs font-bold text-amber-400 hover:underline pt-4"
                  >
                    Submit another inquiry
                  </button>
                </div>
              ) : (
                <form onSubmit={handleDemoSubmit} className="space-y-4">
                  <h3 className="text-xl font-bold text-white">Request a Consultation</h3>
                  <p className="text-xs text-slate-400">Fill out your business details and we’ll get back to you promptly.</p>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Your Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Karma Dorji"
                      value={demoFormData.name}
                      onChange={(e) => setDemoFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:outline-hidden focus:border-amber-400"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Business Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Druk Store"
                        value={demoFormData.businessName}
                        onChange={(e) => setDemoFormData(prev => ({ ...prev, businessName: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:outline-hidden focus:border-amber-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Phone / WhatsApp</label>
                      <input
                        type="tel"
                        required
                        placeholder="e.g. +975 17123456"
                        value={demoFormData.phone}
                        onChange={(e) => setDemoFormData(prev => ({ ...prev, phone: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:outline-hidden focus:border-amber-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Dzongkhag / City</label>
                      <select
                        value={demoFormData.dzongkhag}
                        onChange={(e) => setDemoFormData(prev => ({ ...prev, dzongkhag: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:outline-hidden focus:border-amber-400"
                      >
                        <option value="Thimphu">Thimphu</option>
                        <option value="Chhukha / Phuntsholing">Chhukha / Phuntsholing</option>
                        <option value="Paro">Paro</option>
                        <option value="Sarpang / Gelephu">Sarpang / Gelephu</option>
                        <option value="Punakha">Punakha</option>
                        <option value="Wangdue">Wangdue</option>
                        <option value="Bumthang">Bumthang</option>
                        <option value="Samdrup Jongkhar">Samdrup Jongkhar</option>
                        <option value="Other Dzongkhag">Other Dzongkhag</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Business Type</label>
                      <select
                        value={demoFormData.businessType}
                        onChange={(e) => setDemoFormData(prev => ({ ...prev, businessType: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:outline-hidden focus:border-amber-400"
                      >
                        <option value="Retail & Supermarket">Retail &amp; Supermarket</option>
                        <option value="Restaurant / Cafe / Bar">Restaurant / Cafe / Bar</option>
                        <option value="Electronics & Mobile">Electronics &amp; Mobile</option>
                        <option value="Pharmacy / Healthcare">Pharmacy / Healthcare</option>
                        <option value="Auto Spare Parts / Hardware">Auto Spare Parts / Hardware</option>
                        <option value="Garments & Footwear">Garments &amp; Footwear</option>
                        <option value="Wholesale & Distribution">Wholesale &amp; Distribution</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Special Requirements / Notes (Optional)</label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Need barcode printer setup, 3 POS counters, and mobile captain ordering..."
                      value={demoFormData.notes}
                      onChange={(e) => setDemoFormData(prev => ({ ...prev, notes: e.target.value }))}
                      className="w-full px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-hidden focus:border-amber-400"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-sm shadow-lg shadow-amber-500/25 transition-transform hover:-translate-y-0.5 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    <span>Submit Demo Request</span>
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-800 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-slate-950 font-black text-sm">
                D
              </div>
              <div>
                <span className="font-bold text-white text-sm">DrukERP</span>
                <span className="text-xs text-slate-400 block">The Smart Cloud ERP &amp; POS of Bhutan</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
              <a href="#features" className="hover:text-white transition-colors">Features</a>
              <a href="#tax-compliance" className="hover:text-white transition-colors">DRC &amp; GST Compliance</a>
              <a href="#industries" className="hover:text-white transition-colors">Verticals</a>
              <a href="#demo" className="hover:text-white transition-colors">Contact</a>
              <button
                type="button"
                onClick={onOpenLogin}
                className="text-amber-400 font-bold hover:underline cursor-pointer"
              >
                Client Sign In
              </button>
            </div>

            <div className="text-xs text-slate-400 text-center md:text-right">
              &copy; {new Date().getFullYear()} DrukERP. All rights reserved. 🇧🇹 Made for Bhutan.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
