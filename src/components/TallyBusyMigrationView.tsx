import React, { useState, useRef } from 'react';
import { 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  HelpCircle, 
  ArrowRight, 
  ShieldCheck, 
  Layers, 
  Hash, 
  DollarSign, 
  Download, 
  BookOpen, 
  RefreshCw, 
  Check, 
  ChevronRight,
  Database,
  Sliders,
  FileSpreadsheet,
  Cpu
} from 'lucide-react';
import { 
  MigrationSource, 
  MigrationMode, 
  MigrationParsedData, 
  parseTallyXml, 
  parseBusyExcel, 
  execute1ClickMigration, 
  MigrationResult 
} from '../services/tallyBusyMigrationService';

interface TallyBusyMigrationViewProps {
  onSuccess?: () => void;
}

export const TallyBusyMigrationView: React.FC<TallyBusyMigrationViewProps> = ({ onSuccess }) => {
  const [source, setSource] = useState<MigrationSource>('tally');
  const [mode, setMode] = useState<MigrationMode>('cutoff_opening');
  const [mergeOption, setMergeOption] = useState<'merge' | 'replace'>('merge');
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [parsedData, setParsedData] = useState<MigrationParsedData | null>(null);
  const [executionResult, setExecutionResult] = useState<MigrationResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activePreviewTab, setActivePreviewTab] = useState<'summary' | 'ledgers' | 'items' | 'bills' | 'vouchers'>('summary');
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [helpGuideTab, setHelpGuideTab] = useState<'tally' | 'busy' | 'best_practices'>('tally');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file upload and parsing
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    setErrorMessage(null);
    setExecutionResult(null);

    try {
      const ext = file.name.split('.').pop()?.toLowerCase();

      if (source === 'tally') {
        if (ext !== 'xml' && ext !== 'txt') {
          throw new Error('Please select a valid Tally XML export file (e.g. Master.xml or DayBook.xml).');
        }
        const text = await file.text();
        const parsed = parseTallyXml(text, mode, file.name);
        setParsedData(parsed);
      } else {
        // Busy Accounting
        if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
          const parsed = await parseBusyExcel(file, mode);
          setParsedData(parsed);
        } else if (ext === 'xml') {
          const text = await file.text();
          const parsed = parseTallyXml(text, mode, file.name); // XML fallback
          parsed.source = 'busy';
          setParsedData(parsed);
        } else {
          throw new Error('Please select an Excel (.xlsx, .xls) or XML file exported from Busy Accounting.');
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to parse file. Please verify format.');
      setParsedData(null);
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Run 1-Click Migration
  const handleExecuteMigration = async () => {
    if (!parsedData) return;

    setIsExecuting(true);
    setErrorMessage(null);

    try {
      const res = await execute1ClickMigration(parsedData, {
        mergeOrReplace: mergeOption,
        createMissingGroups: true,
        createOpeningBillsAsPending: true
      });

      setExecutionResult(res);
      if (res.success && onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Migration execution failed.');
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-3xl bg-linear-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-7 text-white shadow-xl border border-indigo-900/50 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-bold uppercase tracking-wider">
              <Cpu className="h-3.5 w-3.5" />
              <span>Universal Migration Engine</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              TallyPrime & Busy Accounting 1-Click Migration
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Seamlessly shift client accounts, bill-by-bill debtor/creditor outstandings, stock items with groups, buying/selling rates, serial numbers, and opening balances with 100% accuracy.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowHelpModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/15 shadow-sm transition backdrop-blur-xs cursor-pointer"
            >
              <BookOpen className="h-4 w-4 text-amber-300" />
              <span>Export Help Guide</span>
            </button>
          </div>
        </div>
      </div>

      {/* Error & Success Messages */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-900 flex items-start gap-3 shadow-xs">
          <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <span className="font-bold block">Migration Notice</span>
            <p className="text-rose-800 mt-0.5">{errorMessage}</p>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-700 hover:text-rose-900 font-bold text-xs p-1">✕</button>
        </div>
      )}

      {executionResult && (
        <div className={`p-5 rounded-2xl border flex items-start gap-3.5 shadow-sm ${
          executionResult.success ? 'bg-emerald-50 border-emerald-300 text-emerald-950' : 'bg-rose-50 border-rose-300 text-rose-950'
        }`}>
          {executionResult.success ? (
            <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-6 w-6 text-rose-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 text-xs space-y-2">
            <div>
              <h4 className="font-black text-sm">{executionResult.success ? '🎉 Migration Completed Successfully!' : 'Migration Failed'}</h4>
              <p className="mt-0.5 text-slate-700 font-medium">{executionResult.message}</p>
            </div>

            {executionResult.success && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                <div className="bg-white/80 p-2 rounded-xl border border-emerald-200">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Ledgers Imported</span>
                  <span className="text-sm font-black text-emerald-700 font-mono">{executionResult.importedLedgers}</span>
                </div>
                <div className="bg-white/80 p-2 rounded-xl border border-emerald-200">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Items Imported</span>
                  <span className="text-sm font-black text-emerald-700 font-mono">{executionResult.importedItems}</span>
                </div>
                <div className="bg-white/80 p-2 rounded-xl border border-emerald-200">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Pending Bills</span>
                  <span className="text-sm font-black text-emerald-700 font-mono">{executionResult.importedOpeningBills}</span>
                </div>
                <div className="bg-white/80 p-2 rounded-xl border border-emerald-200">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Vouchers</span>
                  <span className="text-sm font-black text-emerald-700 font-mono">{executionResult.importedVouchers}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 1 & 2: Setup Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Source Selection */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
            1. Select Source Accounting Software
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setSource('tally');
                setParsedData(null);
              }}
              className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                source === 'tally' 
                  ? 'bg-indigo-50/80 border-indigo-600 ring-2 ring-indigo-200' 
                  : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-900">TallyPrime</span>
                {source === 'tally' && <CheckCircle2 className="h-4 w-4 text-indigo-600" />}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Native XML Export (Master.xml, DayBook.xml)</p>
            </button>

            <button
              type="button"
              onClick={() => {
                setSource('busy');
                setParsedData(null);
              }}
              className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                source === 'busy' 
                  ? 'bg-indigo-50/80 border-indigo-600 ring-2 ring-indigo-200' 
                  : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-900">Busy Accounting</span>
                {source === 'busy' && <CheckCircle2 className="h-4 w-4 text-indigo-600" />}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Excel Export (.xlsx, .xls) or XML</p>
            </button>
          </div>
        </div>

        {/* Mode Selection */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
            2. Choose Migration Strategy
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setMode('cutoff_opening');
                if (parsedData) setParsedData(null);
              }}
              className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                mode === 'cutoff_opening' 
                  ? 'bg-blue-50/80 border-blue-600 ring-2 ring-blue-200' 
                  : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-900">Cut-Off Opening Balance</span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">Recommended</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Masters + Outstanding Bills + Live Stock & Rates (Zero Legacy Errors)</p>
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('full_historical');
                if (parsedData) setParsedData(null);
              }}
              className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                mode === 'full_historical' 
                  ? 'bg-blue-50/80 border-blue-600 ring-2 ring-blue-200' 
                  : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-900">Full Historical Daybook</span>
                {mode === 'full_historical' && <CheckCircle2 className="h-4 w-4 text-blue-600" />}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Replays all past year vouchers, invoices and payments</p>
            </button>
          </div>
        </div>
      </div>

      {/* Step 3: File Upload Area */}
      <div className="bg-white border-2 border-dashed border-slate-300 rounded-3xl p-8 text-center hover:border-indigo-400 transition bg-slate-50/40">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept={source === 'tally' ? '.xml,.txt' : '.xlsx,.xls,.csv,.xml'}
          className="hidden"
        />

        <div className="max-w-md mx-auto space-y-4">
          <div className="h-14 w-14 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center mx-auto shadow-xs">
            {source === 'tally' ? <FileText className="h-7 w-7" /> : <FileSpreadsheet className="h-7 w-7" />}
          </div>

          <div>
            <h3 className="text-sm font-black text-slate-900">
              Select {source === 'tally' ? 'TallyPrime XML Export' : 'Busy Accounting File'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {source === 'tally' 
                ? 'Drop "Master.xml" or "DayBook.xml" exported from TallyPrime (Alt + E)' 
                : 'Drop Excel workbook (.xlsx, .xls) with Accounts, Items, and Bills'}
            </p>
          </div>

          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isParsing}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold shadow-md hover:shadow-lg transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isParsing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Analyzing File...</span>
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  <span>Browse {source === 'tally' ? 'XML' : 'Excel/XML'} File</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowHelpModal(true)}
              className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              <span>How to Export?</span>
            </button>
          </div>

          {parsedData && (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-mono font-bold">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <span>Loaded: {parsedData.sourceFileName}</span>
            </div>
          )}
        </div>
      </div>

      {/* Step 4: Inspection & Preview of Parsed Data */}
      {parsedData && (
        <div className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-6 shadow-xs space-y-5 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
                Pre-Migration Audit & Reconciliation
              </span>
              <h3 className="text-base font-black text-slate-900 mt-1">
                Data Verification Summary
              </h3>
              <p className="text-xs text-slate-500">
                Review verified metrics extracted from {parsedData.sourceFileName} before committing to your ERP database.
              </p>
            </div>

            {/* Merge vs Replace Toggle */}
            <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200 text-xs shrink-0">
              <button
                type="button"
                onClick={() => setMergeOption('merge')}
                className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                  mergeOption === 'merge' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-500'
                }`}
              >
                Merge with Existing
              </button>
              <button
                type="button"
                onClick={() => setMergeOption('replace')}
                className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                  mergeOption === 'replace' ? 'bg-rose-600 text-white shadow-2xs' : 'text-slate-500'
                }`}
                title="Clears current demo data and imports fresh masters"
              >
                Clean Slate Replace
              </button>
            </div>
          </div>

          {/* Metric KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-100">
              <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">Account Ledgers</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-xl font-black text-indigo-950 font-mono">{parsedData.stats.totalLedgers}</span>
                <span className="text-[11px] text-indigo-600">accounts</span>
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                {parsedData.stats.totalDebtors} Debtors • {parsedData.stats.totalCreditors} Creditors
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-100">
              <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">Stock Items</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-xl font-black text-blue-950 font-mono">{parsedData.stats.totalItems}</span>
                <span className="text-[11px] text-blue-600">products</span>
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                Total Stock Qty: {parsedData.stats.totalStockQty}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100">
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Bill-by-Bill Outstanding</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-xl font-black text-emerald-950 font-mono">{parsedData.stats.totalPendingBills}</span>
                <span className="text-[11px] text-emerald-600">pending bills</span>
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                Amount: Nu. {parsedData.stats.totalPendingBillsAmount.toLocaleString()}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-100">
              <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">Trial Balance Difference</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className={`text-xl font-black font-mono ${parsedData.stats.drCrDifference === 0 ? 'text-emerald-700' : 'text-amber-800'}`}>
                  Nu. {parsedData.stats.drCrDifference.toLocaleString()}
                </span>
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                {parsedData.stats.drCrDifference === 0 ? '✓ Balanced 100%' : 'Opening Suspense Diff'}
              </span>
            </div>
          </div>

          {/* Sub-Tabs for Detailed Table Inspection */}
          <div className="flex items-center gap-2 border-b border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setActivePreviewTab('summary')}
              className={`pb-2.5 px-3 font-bold transition cursor-pointer ${
                activePreviewTab === 'summary' ? 'border-b-2 border-indigo-600 text-indigo-700' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Reconciliation Details
            </button>
            <button
              type="button"
              onClick={() => setActivePreviewTab('ledgers')}
              className={`pb-2.5 px-3 font-bold transition cursor-pointer ${
                activePreviewTab === 'ledgers' ? 'border-b-2 border-indigo-600 text-indigo-700' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Ledgers ({parsedData.ledgers.length})
            </button>
            <button
              type="button"
              onClick={() => setActivePreviewTab('items')}
              className={`pb-2.5 px-3 font-bold transition cursor-pointer ${
                activePreviewTab === 'items' ? 'border-b-2 border-indigo-600 text-indigo-700' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Stock Items ({parsedData.items.length})
            </button>
            <button
              type="button"
              onClick={() => setActivePreviewTab('bills')}
              className={`pb-2.5 px-3 font-bold transition cursor-pointer ${
                activePreviewTab === 'bills' ? 'border-b-2 border-indigo-600 text-indigo-700' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Pending Bills ({parsedData.openingBills.length})
            </button>
            {parsedData.vouchers.length > 0 && (
              <button
                type="button"
                onClick={() => setActivePreviewTab('vouchers')}
                className={`pb-2.5 px-3 font-bold transition cursor-pointer ${
                  activePreviewTab === 'vouchers' ? 'border-b-2 border-indigo-600 text-indigo-700' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Vouchers ({parsedData.vouchers.length})
              </button>
            )}
          </div>

          {/* Tab 1: Summary Table */}
          {activePreviewTab === 'summary' && (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
                  <span className="font-extrabold text-slate-800 block">Balance Reconciliation</span>
                  <div className="flex justify-between py-1 border-b border-slate-200/60 text-slate-600">
                    <span>Total Opening Debit (Dr):</span>
                    <span className="font-mono font-bold text-slate-900">Nu. {parsedData.stats.totalOpeningDr.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60 text-slate-600">
                    <span>Total Opening Credit (Cr):</span>
                    <span className="font-mono font-bold text-slate-900">Nu. {parsedData.stats.totalOpeningCr.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-1 font-bold">
                    <span>Opening Difference / Suspense:</span>
                    <span className={`font-mono ${parsedData.stats.drCrDifference === 0 ? 'text-emerald-700' : 'text-amber-800'}`}>
                      Nu. {parsedData.stats.drCrDifference.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
                  <span className="font-extrabold text-slate-800 block">Inventory & Tracking Highlights</span>
                  <div className="flex justify-between py-1 border-b border-slate-200/60 text-slate-600">
                    <span>Total Inventory Valuation:</span>
                    <span className="font-mono font-bold text-slate-900">Nu. {parsedData.stats.totalStockValue.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60 text-slate-600">
                    <span>Serialized / Batch Items:</span>
                    <span className="font-mono font-bold text-slate-900">{parsedData.stats.serialNumbersCount} items</span>
                  </div>
                  <div className="flex justify-between py-1 text-slate-600">
                    <span>Total Outstanding Debtors/Creditors:</span>
                    <span className="font-mono font-bold text-slate-900">Nu. {parsedData.stats.totalPendingBillsAmount.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Ledgers Table */}
          {activePreviewTab === 'ledgers' && (
            <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="py-2 px-3 font-bold">Ledger Name</th>
                    <th className="py-2 px-3 font-bold">Mapped Group</th>
                    <th className="py-2 px-3 font-bold text-right">Opening Bal</th>
                    <th className="py-2 px-3 font-bold text-center">Dr/Cr</th>
                    <th className="py-2 px-3 font-bold">GSTIN/TPN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {parsedData.ledgers.slice(0, 50).map((l, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="py-1.5 px-3 font-bold text-slate-900">{l['Ledger Name']}</td>
                      <td className="py-1.5 px-3 text-slate-600">{l.Group}</td>
                      <td className="py-1.5 px-3 text-right font-mono font-bold">{l['Opening Balance'].toLocaleString()}</td>
                      <td className="py-1.5 px-3 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${l['Balance Type (Dr/Cr)'] === 'Dr' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'}`}>
                          {l['Balance Type (Dr/Cr)']}
                        </span>
                      </td>
                      <td className="py-1.5 px-3 text-slate-500 font-mono text-[11px]">{l['GST No'] || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedData.ledgers.length > 50 && (
                <div className="p-2 text-center text-[11px] text-slate-400 bg-slate-50 border-t border-slate-200">
                  Showing first 50 of {parsedData.ledgers.length} ledgers
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Items Table */}
          {activePreviewTab === 'items' && (
            <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="py-2 px-3 font-bold">Item Name</th>
                    <th className="py-2 px-3 font-bold">Group / Category</th>
                    <th className="py-2 px-3 font-bold">Unit</th>
                    <th className="py-2 px-3 font-bold text-right">Purchase Rate</th>
                    <th className="py-2 px-3 font-bold text-right">Sale Rate</th>
                    <th className="py-2 px-3 font-bold text-right">Opening Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {parsedData.items.slice(0, 50).map((it, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="py-1.5 px-3 font-bold text-slate-900">{it['Item Name']}</td>
                      <td className="py-1.5 px-3 text-slate-600">{it.Group}</td>
                      <td className="py-1.5 px-3 text-slate-500">{it.Unit}</td>
                      <td className="py-1.5 px-3 text-right font-mono">{it['Purchase Rate'].toLocaleString()}</td>
                      <td className="py-1.5 px-3 text-right font-mono font-bold text-indigo-700">{it['Sale Rate'].toLocaleString()}</td>
                      <td className="py-1.5 px-3 text-right font-mono font-bold">{it['Opening Stock']}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedData.items.length > 50 && (
                <div className="p-2 text-center text-[11px] text-slate-400 bg-slate-50 border-t border-slate-200">
                  Showing first 50 of {parsedData.items.length} items
                </div>
              )}
            </div>
          )}

          {/* Tab 4: Pending Bills Table */}
          {activePreviewTab === 'bills' && (
            <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="py-2 px-3 font-bold">Party Name</th>
                    <th className="py-2 px-3 font-bold">Party Type</th>
                    <th className="py-2 px-3 font-bold">Bill No / Ref</th>
                    <th className="py-2 px-3 font-bold">Bill Date</th>
                    <th className="py-2 px-3 font-bold text-right">Pending Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {parsedData.openingBills.slice(0, 50).map((b, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="py-1.5 px-3 font-bold text-slate-900">{b.partyName}</td>
                      <td className="py-1.5 px-3">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${b.partyType === 'debtor' ? 'bg-indigo-100 text-indigo-800' : 'bg-amber-100 text-amber-800'}`}>
                          {b.partyType === 'debtor' ? 'Customer / Debtor' : 'Supplier / Creditor'}
                        </span>
                      </td>
                      <td className="py-1.5 px-3 font-mono font-bold text-slate-800">{b.billNo}</td>
                      <td className="py-1.5 px-3 text-slate-500 font-mono">{b.billDate}</td>
                      <td className="py-1.5 px-3 text-right font-mono font-bold text-emerald-700">Nu. {b.amount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedData.openingBills.length > 50 && (
                <div className="p-2 text-center text-[11px] text-slate-400 bg-slate-50 border-t border-slate-200">
                  Showing first 50 of {parsedData.openingBills.length} pending bills
                </div>
              )}
            </div>
          )}

          {/* Action Button: Execute 1-Click Import */}
          <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-xs text-slate-500">
              Ready to migrate <strong className="text-slate-800 font-bold">{parsedData.ledgers.length} ledgers</strong>, <strong className="text-slate-800 font-bold">{parsedData.items.length} items</strong>, and <strong className="text-slate-800 font-bold">{parsedData.openingBills.length} bills</strong>.
            </span>

            <button
              type="button"
              onClick={handleExecuteMigration}
              disabled={isExecuting}
              className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-lg hover:shadow-xl transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isExecuting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Importing Everything into ERP...</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>Start 1-Click Import from {parsedData.source === 'tally' ? 'TallyPrime' : 'Busy'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          HELP GUIDE MODAL / SLIDEOVER
         ======================================================== */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">How to Export from TallyPrime & Busy</h3>
                  <p className="text-[11px] text-slate-500">Step-by-step instructions for 100% data export</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs"
              >
                ✕
              </button>
            </div>

            {/* Help Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setHelpGuideTab('tally')}
                className={`pb-2 px-3 font-bold transition cursor-pointer ${
                  helpGuideTab === 'tally' ? 'border-b-2 border-indigo-600 text-indigo-700' : 'text-slate-500'
                }`}
              >
                TallyPrime XML Export
              </button>
              <button
                type="button"
                onClick={() => setHelpGuideTab('busy')}
                className={`pb-2 px-3 font-bold transition cursor-pointer ${
                  helpGuideTab === 'busy' ? 'border-b-2 border-indigo-600 text-indigo-700' : 'text-slate-500'
                }`}
              >
                Busy Accounting Export
              </button>
              <button
                type="button"
                onClick={() => setHelpGuideTab('best_practices')}
                className={`pb-2 px-3 font-bold transition cursor-pointer ${
                  helpGuideTab === 'best_practices' ? 'border-b-2 border-indigo-600 text-indigo-700' : 'text-slate-500'
                }`}
              >
                Migration Best Practices
              </button>
            </div>

            {/* Help Tab 1: TallyPrime */}
            {helpGuideTab === 'tally' && (
              <div className="space-y-4 text-xs text-slate-700 leading-relaxed">
                <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-100 space-y-1">
                  <span className="font-bold text-indigo-950 block">Step 1: Export Masters (Ledgers, Items & Opening Bills)</span>
                  <ol className="list-decimal pl-4 space-y-1 text-slate-700">
                    <li>Open your company in **TallyPrime**.</li>
                    <li>From Gateway of Tally, press **`Alt + E`** (or click **Export** at top header) and select **Masters**.</li>
                    <li>Press **`C` (Configure)** and set:
                      <ul className="list-disc pl-4 mt-0.5 space-y-0.5 text-slate-600">
                        <li><strong>File Format:</strong> XML (Data Interchange)</li>
                        <li><strong>Type of Master:</strong> All Masters</li>
                        <li><strong>Include Dependent Masters:</strong> Yes</li>
                        <li><strong>Export Location:</strong> Choose Desktop or any folder</li>
                        <li><strong>Output File Name:</strong> `Master.xml`</li>
                      </ul>
                    </li>
                    <li>Press **`Esc`**, then press **`E` (Send / Export)**. Tally will generate `Master.xml`.</li>
                  </ol>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="font-bold text-slate-900 block">Step 2 (Optional): Export Historical Vouchers</span>
                  <ol className="list-decimal pl-4 space-y-1 text-slate-700">
                    <li>From Gateway of Tally, go to **Display More Reports → Day Book**.</li>
                    <li>Press **`Alt + F2`** to select the complete period (e.g., 01-Apr-2023 to 31-Mar-2024).</li>
                    <li>Press **`Alt + E` → Current → Configure**.</li>
                    <li>Change format to **XML (Data Interchange)** and export as `DayBook.xml`.</li>
                  </ol>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950">
                  <span className="font-bold block">✓ Ready to Import:</span>
                  Drop the generated `Master.xml` file into the box above and click **"Start 1-Click Import"**!
                </div>
              </div>
            )}

            {/* Help Tab 2: Busy Accounting */}
            {helpGuideTab === 'busy' && (
              <div className="space-y-4 text-xs text-slate-700 leading-relaxed">
                <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-100 space-y-1">
                  <span className="font-bold text-blue-950 block">Step 1: Export Masters to Excel</span>
                  <ol className="list-decimal pl-4 space-y-1 text-slate-700">
                    <li>Open **Busy Accounting Software**.</li>
                    <li>Go to **`Administration → Data Export/Import → Export Masters to Excel`**.</li>
                    <li>Select **Account Master** and choose export columns (Name, Group, Op. Balance, Address, GSTIN, Contact).</li>
                    <li>Select **Item Master** and choose export columns (Item Name, Code, Group, Unit, Purchase Price, Sale Price, MRP, Tax Rate, Opening Stock, Serial Numbers).</li>
                    <li>Save the Excel workbook (.xlsx).</li>
                  </ol>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="font-bold text-slate-900 block">Step 2: Export Outstanding Bills</span>
                  <ol className="list-decimal pl-4 space-y-1 text-slate-700">
                    <li>Go to **`Display → Outstanding Analysis → Bills Receivable / Payable`**.</li>
                    <li>Press **`Alt + M`** or click **Export to Excel**.</li>
                    <li>Include: Party Name, Bill No, Bill Date, Due Date, and Pending Amount.</li>
                  </ol>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950">
                  <span className="font-bold block">✓ Ready to Import:</span>
                  Drop the exported Busy Excel workbook directly into the upload area above!
                </div>
              </div>
            )}

            {/* Help Tab 3: Best Practices */}
            {helpGuideTab === 'best_practices' && (
              <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
                <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 space-y-1">
                  <span className="font-bold text-amber-950 block">1. Recommended Cut-Off Date Approach</span>
                  <p className="text-slate-600">
                    Chartered Accountants recommend migrating on a clean cut-off date (e.g. 1st of the current month). This brings across all Ledgers, Item Masters, Serial Numbers, and exact pending bills without copying any old bugs or mismatched journals from past years.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="font-bold text-slate-900 block">2. Verification in ERP</span>
                  <p className="text-slate-600">
                    After migration, open **Reports → Trial Balance** in your ERP. The Debit and Credit totals will match your Tally or Busy trial balance sheet to the cent.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="font-bold text-slate-900 block">3. Bill-by-Bill Settlement Ready</span>
                  <p className="text-slate-600">
                    All pending customer bills will immediately appear when you record a **Receipt Voucher**, allowing you to allocate payments against those exact historical invoice numbers.
                  </p>
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs"
              >
                Close Guide
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
