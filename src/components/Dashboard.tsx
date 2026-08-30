import React, { useEffect, useState } from 'react';
import { Config, Item, Ledger } from '../types';
import { getAdvancedDashboardData } from '../services/storageService';
import { ReportTarget } from './Reports';
import {
  TrendingUp,
  Package,
  AlertTriangle,
  Plus,
  Wallet,
  Landmark,
  ArrowDownRight,
  ArrowUpRight,
  Receipt,
  Award,
  ChevronRight,
  BarChart3,
  FileSpreadsheet,
  Layers,
  Hash
} from 'lucide-react';

interface DashboardProps {
  config: Config;
  items: Item[];
  ledgers?: Ledger[];
  onNavigate: (view: string) => void;
  onDrillStock: (code: string) => void;
  onDrillLedger?: (name: string) => void;
  onDrillGroup?: (grp: string) => void;
  onDrillVoucher?: (refNo: string) => void;
  onDrillReport?: (target: ReportTarget) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  config,
  items,
  ledgers = [],
  onNavigate,
  onDrillStock,
  onDrillLedger,
  onDrillGroup,
  onDrillVoucher,
  onDrillReport
}) => {
  const [fromDate, setFromDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0]);

  const [dashData, setDashData] = useState<{
    sale: number;
    profit: number;
    gst: number;
    cash: number;
    bank: number;
    receivable: number;
    payable: number;
    topSellingItem: { name: string; qty: number; code?: string };
    invoicesCount: number;
    lowStockCount: number;
    lowStockItems: Item[];
  }>({
    sale: 0,
    profit: 0,
    gst: 0,
    cash: 0,
    bank: 0,
    receivable: 0,
    payable: 0,
    topSellingItem: { name: 'N/A', qty: 0, code: '' },
    invoicesCount: 0,
    lowStockCount: 0,
    lowStockItems: []
  });

  useEffect(() => {
    const data = getAdvancedDashboardData(fromDate, toDate);
    setDashData(data as any);
  }, [items, fromDate, toDate]);

  const currency = config.CurrencySymbol || 'Nu.';

  // Identify default cash & bank ledgers
  const cashLedger = ledgers.find(l => l.Group === 'Cash-in-Hand')?.['Ledger Name'] || 'Cash';
  const bankLedger = ledgers.find(l => l.Group === 'Bank Accounts')?.['Ledger Name'] || 'Bank';

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Top Banner & Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Dashboard Overview</h1>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Real-time financial & inventory snapshot <span className="text-indigo-600 font-bold text-xs bg-indigo-50 px-2 py-0.5 rounded-full ml-1">Click any card to drill down</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-xl px-2 py-1 shadow-sm">
            <input 
              type="date" 
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="bg-transparent text-sm font-semibold text-slate-700 outline-none cursor-pointer"
            />
            <span className="text-slate-400 font-bold text-xs">to</span>
            <input 
              type="date" 
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="bg-transparent text-sm font-semibold text-slate-700 outline-none cursor-pointer"
            />
          </div>
          <button
            onClick={() => onNavigate('pos')}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-md hover:bg-indigo-700 hover:shadow-lg transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="h-4.5 w-4.5" />
            New Sale
          </button>
        </div>
      </div>

      {/* Main KPI Grid with Deep-down links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        
        {/* Sales Card -> Deep down to Daily Sales Register */}
        <div 
          onClick={() => onDrillReport?.({ category: 'daily', itemWise: false, fromDate, toDate })}
          className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-5 shadow-lg text-white cursor-pointer hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all"
          title="Click to drill down into Daily Sales Register"
        >
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <span className="text-emerald-100 font-bold uppercase tracking-wider text-xs flex items-center gap-1.5">
                Total Sales
              </span>
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm group-hover:bg-white/30 transition-colors">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
            </div>
            <div className="text-3xl font-black tracking-tight mb-1">
              {currency} {dashData.sale.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="flex items-center justify-between text-emerald-100 text-xs font-semibold mt-2 pt-2 border-t border-emerald-400/30">
              <span>{dashData.invoicesCount} Invoices generated</span>
              <span className="flex items-center gap-1 text-white font-bold group-hover:translate-x-0.5 transition-transform">
                View Register <ChevronRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </div>
          <div className="absolute -bottom-8 -right-8 opacity-10 group-hover:opacity-20 transition-opacity">
            <TrendingUp className="h-40 w-40" />
          </div>
        </div>

        {/* Profit Card -> Deep down to Item Profitability Report */}
        <div 
          onClick={() => onDrillReport?.({ category: 'inv', invSubTab: 'prof', fromDate, toDate })}
          className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 p-5 shadow-lg text-white cursor-pointer hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all"
          title="Click to drill down into Item Profitability breakdown"
        >
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <span className="text-indigo-100 font-bold uppercase tracking-wider text-xs flex items-center gap-1.5">
                Est. Profit
              </span>
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm group-hover:bg-white/30 transition-colors">
                <Wallet className="h-5 w-5 text-white" />
              </div>
            </div>
            <div className="text-3xl font-black tracking-tight mb-1">
              {currency} {dashData.profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="flex items-center justify-between text-indigo-100 text-xs font-semibold mt-2 pt-2 border-t border-indigo-400/30">
              <span>Gross margin on sales</span>
              <span className="flex items-center gap-1 text-white font-bold group-hover:translate-x-0.5 transition-transform">
                View Profitability <ChevronRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </div>
          <div className="absolute -bottom-8 -right-8 opacity-10 group-hover:opacity-20 transition-opacity">
            <Wallet className="h-40 w-40" />
          </div>
        </div>

        {/* GST Card -> Deep down to GST Tax Report */}
        <div 
          onClick={() => onDrillReport?.({ category: 'gst', fromDate, toDate })}
          className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 p-5 shadow-lg text-white cursor-pointer hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all"
          title="Click to drill down into GST Tax liabilities report"
        >
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <span className="text-amber-100 font-bold uppercase tracking-wider text-xs flex items-center gap-1.5">
                GST Collected
              </span>
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm group-hover:bg-white/30 transition-colors">
                <Receipt className="h-5 w-5 text-white" />
              </div>
            </div>
            <div className="text-3xl font-black tracking-tight mb-1">
              {currency} {dashData.gst.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="flex items-center justify-between text-amber-100 text-xs font-semibold mt-2 pt-2 border-t border-amber-400/30">
              <span>Tax liabilities from sales</span>
              <span className="flex items-center gap-1 text-white font-bold group-hover:translate-x-0.5 transition-transform">
                View GST Report <ChevronRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </div>
          <div className="absolute -bottom-8 -right-8 opacity-10 group-hover:opacity-20 transition-opacity">
            <Receipt className="h-40 w-40" />
          </div>
        </div>

        {/* Top Selling Item -> Deep down to Top 15 Sellers or Item Ledger */}
        <div 
          onClick={() => {
            if (dashData.topSellingItem.code) {
              onDrillStock(dashData.topSellingItem.code);
            } else {
              onDrillReport?.({ category: 'inv', invSubTab: 'top', fromDate, toDate });
            }
          }}
          className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-fuchsia-500 to-purple-600 p-5 shadow-lg text-white cursor-pointer hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all"
          title="Click to view stock history or top sellers list"
        >
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <span className="text-fuchsia-100 font-bold uppercase tracking-wider text-xs flex items-center gap-1.5">
                Top Selling
              </span>
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm group-hover:bg-white/30 transition-colors">
                <Award className="h-5 w-5 text-white" />
              </div>
            </div>
            <div className="text-xl font-bold tracking-tight mb-1 line-clamp-1 truncate" title={dashData.topSellingItem.name}>
              {dashData.topSellingItem.name}
            </div>
            <div className="flex items-center justify-between text-fuchsia-100 text-xs font-semibold mt-2 pt-2 border-t border-fuchsia-400/30">
              <span className="bg-white/20 px-2 py-0.5 rounded-md font-bold text-[11px]">{dashData.topSellingItem.qty} Units Sold</span>
              <span className="flex items-center gap-1 text-white font-bold group-hover:translate-x-0.5 transition-transform">
                {dashData.topSellingItem.code ? 'Stock Ledger' : 'Top Sellers'} <ChevronRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </div>
          <div className="absolute -bottom-8 -right-8 opacity-10 group-hover:opacity-20 transition-opacity">
            <Award className="h-40 w-40" />
          </div>
        </div>

      </div>

      {/* Quick Direct Drilldown Shortcuts Bar */}
      <div className="bg-slate-100/80 border border-slate-200/80 rounded-2xl p-2.5 flex flex-wrap items-center gap-2 justify-between shadow-xs">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider px-2 flex items-center gap-1.5">
          <BarChart3 className="h-3.5 w-3.5 text-indigo-600" />
          Quick Reports Drilldown:
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => onDrillReport?.({ category: 'fin', finSubTab: 'TB', fromDate, toDate })}
            className="px-3 py-1 bg-white hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
          >
            <FileSpreadsheet className="h-3 w-3" />
            Trial Balance
          </button>
          <button
            onClick={() => onDrillReport?.({ category: 'fin', finSubTab: 'PNL', fromDate, toDate })}
            className="px-3 py-1 bg-white hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
          >
            <TrendingUp className="h-3 w-3" />
            Profit & Loss
          </button>
          <button
            onClick={() => onDrillReport?.({ category: 'inv', invSubTab: 'mov', fromDate, toDate })}
            className="px-3 py-1 bg-white hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
          >
            <Layers className="h-3 w-3" />
            Stock Movement (In/Out)
          </button>
          <button
            onClick={() => onDrillReport?.({ category: 'inv', invSubTab: 'serials', fromDate, toDate })}
            className="px-3 py-1 bg-white hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
          >
            <Hash className="h-3 w-3" />
            Serial Numbers Stock Report
          </button>
        </div>
      </div>

      {/* Secondary KPI Row with Direct Statement & Ledger Drilldown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Cash Balance */}
        <div 
          onClick={() => {
            if (onDrillLedger) {
              onDrillLedger(cashLedger);
            } else {
              onDrillReport?.({ category: 'fin', finSubTab: 'LED', ledgerName: cashLedger, fromDate, toDate });
            }
          }}
          className="group rounded-2xl border border-slate-200 bg-white p-4 flex items-center justify-between gap-3 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all cursor-pointer"
          title={`Click to open ${cashLedger} statement drilldown`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-11 w-11 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0 group-hover:scale-110 transition-transform">
              <Wallet className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider truncate">Cash Balance</p>
              <p className="text-lg font-black text-slate-900 mt-0.5 truncate">{currency} {dashData.cash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p className="text-[10px] font-bold text-emerald-600 group-hover:underline flex items-center gap-0.5 mt-0.5">
                View Cash Book <ChevronRight className="h-2.5 w-2.5" />
              </p>
            </div>
          </div>
        </div>

        {/* Bank Balance */}
        <div 
          onClick={() => {
            if (onDrillLedger) {
              onDrillLedger(bankLedger);
            } else {
              onDrillReport?.({ category: 'fin', finSubTab: 'LED', ledgerName: bankLedger, fromDate, toDate });
            }
          }}
          className="group rounded-2xl border border-slate-200 bg-white p-4 flex items-center justify-between gap-3 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer"
          title={`Click to open ${bankLedger} statement drilldown`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-11 w-11 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0 group-hover:scale-110 transition-transform">
              <Landmark className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider truncate">Bank Balance</p>
              <p className="text-lg font-black text-slate-900 mt-0.5 truncate">{currency} {dashData.bank.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p className="text-[10px] font-bold text-blue-600 group-hover:underline flex items-center gap-0.5 mt-0.5">
                View Bank Statement <ChevronRight className="h-2.5 w-2.5" />
              </p>
            </div>
          </div>
        </div>

        {/* Receivables (Debtors) */}
        <div 
          onClick={() => onDrillReport?.({ category: 'fin', finSubTab: 'REC', fromDate, toDate })}
          className="group rounded-2xl border border-slate-200 bg-white p-4 flex items-center justify-between gap-3 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer"
          title="Click to view Debtors & Receivables breakdown"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-11 w-11 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 group-hover:scale-110 transition-transform">
              <ArrowDownRight className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider truncate">Receivable (Dr)</p>
              <p className="text-lg font-black text-slate-900 mt-0.5 truncate">{currency} {dashData.receivable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p className="text-[10px] font-bold text-indigo-600 group-hover:underline flex items-center gap-0.5 mt-0.5">
                View Debtors List <ChevronRight className="h-2.5 w-2.5" />
              </p>
            </div>
          </div>
        </div>

        {/* Payables (Creditors) */}
        <div 
          onClick={() => onDrillReport?.({ category: 'fin', finSubTab: 'PAY', fromDate, toDate })}
          className="group rounded-2xl border border-slate-200 bg-white p-4 flex items-center justify-between gap-3 shadow-sm hover:shadow-md hover:border-rose-300 transition-all cursor-pointer"
          title="Click to view Creditors & Payables breakdown"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-11 w-11 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shrink-0 group-hover:scale-110 transition-transform">
              <ArrowUpRight className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider truncate">Payable (Cr)</p>
              <p className="text-lg font-black text-slate-900 mt-0.5 truncate">{currency} {dashData.payable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p className="text-[10px] font-bold text-rose-600 group-hover:underline flex items-center gap-0.5 mt-0.5">
                View Creditors List <ChevronRight className="h-2.5 w-2.5" />
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Low Stock Table with direct item ledger drilldowns */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4.5 w-4.5 text-rose-500" />
            <h3 className="text-sm font-bold text-slate-800">
              Inventory Alerts (Low Stock)
            </h3>
            <span className="bg-rose-100 text-rose-700 text-xs font-bold px-2.5 py-0.5 rounded-full">
              {dashData.lowStockCount} Items Need Reorder
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => onDrillReport?.({ category: 'inv', invSubTab: 'summary', fromDate, toDate })}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1 cursor-pointer bg-indigo-50 px-2.5 py-1 rounded-lg"
            >
              Full Stock Valuation <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-600">
            <thead className="sticky top-0 z-10 text-xs text-slate-500 uppercase bg-white font-bold border-b border-slate-200">
              <tr>
                <th className="px-6 py-3">Item Name</th>
                <th className="px-6 py-3">Group</th>
                <th className="px-6 py-3 text-right">Current Stock</th>
                <th className="px-6 py-3 text-right">Reorder Level</th>
                <th className="px-6 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dashData.lowStockItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <Package className="h-10 w-10 mb-2 opacity-50" />
                      <p className="font-medium">All items are above reorder level.</p>
                      <p className="text-xs mt-1">Your inventory is healthy.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                dashData.lowStockItems.map(item => (
                  <tr
                    key={item['Item Code']}
                    onClick={() => onDrillStock(item['Item Code'])}
                    className="bg-white hover:bg-indigo-50/50 cursor-pointer transition-colors group"
                    title="Click to drill down into Item Stock Ledger"
                  >
                    <td className="px-6 py-3 font-semibold text-slate-900 group-hover:text-indigo-600">
                      {item['Item Name']}
                      <span className="text-[10px] text-slate-400 font-mono ml-2">({item['Item Code']})</span>
                    </td>
                    <td className="px-6 py-3 text-slate-500 text-xs font-medium">{item.Group}</td>
                    <td className="px-6 py-3 text-right">
                      <span className="bg-rose-100 text-rose-700 font-bold px-2 py-0.5 rounded">
                        {item['Current Stock']}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right font-medium text-slate-700">
                      {item['Reorder Level']}
                    </td>
                    <td className="px-6 py-3 text-center">
                      <span className="text-xs font-bold text-indigo-600 group-hover:underline inline-flex items-center gap-0.5">
                        Stock Ledger <ChevronRight className="h-3 w-3" />
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
