import React, { useState, useMemo, useEffect } from 'react';
import { Search, ChevronDown, ChevronRight, CheckCircle2, AlertTriangle, TrendingUp, TrendingDown, Scale, PieChart } from 'lucide-react';
import { saveConfig } from '../services/storageService';

export type ReportDetailDepth = 'summary' | 'detailed' | 'super_detailed';

interface FinancialStatementViewProps {
  reportType: 'TB' | 'PNL' | 'BS';
  reportData: any;
  fromDate: string;
  toDate: string;
  initialDepth?: ReportDetailDepth;
  onDepthChange?: (depth: ReportDetailDepth) => void;
  onDrillLedger?: (ledgerName: string) => void;
  onDrillGroup?: (groupName: string, from?: string, to?: string) => void;
  config?: any;
}

interface GroupNode {
  id: string;
  name: string;
  type: 'group' | 'ledger';
  parentGroup?: string;
  nature?: string;
  level: number;
  opDr: number;
  opCr: number;
  periodDr: number;
  periodCr: number;
  closingDr: number;
  closingCr: number;
  children?: GroupNode[];
}

export const FinancialStatementView: React.FC<FinancialStatementViewProps> = ({
  reportType,
  reportData,
  fromDate,
  toDate,
  initialDepth = 'detailed',
  onDepthChange,
  onDrillLedger,
  onDrillGroup,
  config
}) => {
  const [depth, setDepth] = useState<ReportDetailDepth>(initialDepth);
  const [searchTerm, setSearchTerm] = useState('');
  const [userToggledGroups, setUserToggledGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setDepth(initialDepth);
  }, [initialDepth]);

  const fmt = (val: number) => {
    const num = Number(val) || 0;
    return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Construct Trial Balance Tree Hierarchy
  const tbTree = useMemo(() => {
    if (!reportData?.tb) return [];

    const rawTb: Array<{
      name: string;
      grp: string;
      dr: number;
      cr: number;
      nat: string;
      opDr: number;
      opCr: number;
      periodDr: number;
      periodCr: number;
    }> = reportData.tb;

    const filteredTb = rawTb.filter(item => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        item.name.toLowerCase().includes(term) ||
        (item.grp && item.grp.toLowerCase().includes(term)) ||
        (item.nat && item.nat.toLowerCase().includes(term))
      );
    });

    const primaryGroupOrder = [
      'Capital Account',
      'Loans (Liability)',
      'Current Liabilities',
      'Fixed Assets',
      'Investments',
      'Current Assets',
      'Branch / Divisions',
      'Suspense Account',
      'Sales Accounts',
      'Direct Incomes',
      'Indirect Incomes',
      'Purchase Accounts',
      'Direct Expenses',
      'Indirect Expenses'
    ];

    const groupMap: Record<string, Record<string, typeof filteredTb>> = {};

    filteredTb.forEach(item => {
      const groupName = item.grp || 'Unassigned';
      if (!groupMap[groupName]) {
        groupMap[groupName] = {};
      }
      groupMap[groupName][groupName] = groupMap[groupName][groupName] || [];
      groupMap[groupName][groupName].push(item);
    });

    const tree: GroupNode[] = [];

    const sortedGroupNames = Object.keys(groupMap).sort((a, b) => {
      const idxA = primaryGroupOrder.indexOf(a);
      const idxB = primaryGroupOrder.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });

    sortedGroupNames.forEach(grpName => {
      const ledgersInGrp = groupMap[grpName][grpName] || [];
      if (ledgersInGrp.length === 0) return;

      let gOpDr = 0, gOpCr = 0, gPeriodDr = 0, gPeriodCr = 0, gDr = 0, gCr = 0;

      const childrenNodes: GroupNode[] = ledgersInGrp.map(l => {
        gOpDr += l.opDr || 0;
        gOpCr += l.opCr || 0;
        gPeriodDr += l.periodDr || 0;
        gPeriodCr += l.periodCr || 0;
        gDr += l.dr || 0;
        gCr += l.cr || 0;

        return {
          id: `led_${l.name}`,
          name: l.name,
          type: 'ledger',
          parentGroup: grpName,
          nature: l.nat,
          level: 1,
          opDr: l.opDr || 0,
          opCr: l.opCr || 0,
          periodDr: l.periodDr || 0,
          periodCr: l.periodCr || 0,
          closingDr: l.dr || 0,
          closingCr: l.cr || 0
        };
      });

      tree.push({
        id: `grp_${grpName}`,
        name: grpName,
        type: 'group',
        level: 0,
        nature: ledgersInGrp[0]?.nat || 'Asset',
        opDr: gOpDr,
        opCr: gOpCr,
        periodDr: gPeriodDr,
        periodCr: gPeriodCr,
        closingDr: gDr,
        closingCr: gCr,
        children: childrenNodes
      });
    });

    return tree;
  }, [reportData, searchTerm]);

  const isNodeExpanded = (nodeId: string): boolean => {
    if (userToggledGroups[nodeId] !== undefined) {
      return userToggledGroups[nodeId];
    }
    if (depth === 'super_detailed' || depth === 'detailed') return true;
    return false;
  };

  const toggleNode = (nodeId: string) => {
    setUserToggledGroups(prev => ({
      ...prev,
      [nodeId]: !isNodeExpanded(nodeId)
    }));
  };

  const tbTotals = useMemo(() => {
    if (!reportData?.tb) return { opDr: 0, opCr: 0, periodDr: 0, periodCr: 0, closingDr: 0, closingCr: 0 };
    return reportData.tb.reduce(
      (acc: any, l: any) => ({
        opDr: acc.opDr + (l.opDr || 0),
        opCr: acc.opCr + (l.opCr || 0),
        periodDr: acc.periodDr + (l.periodDr || 0),
        periodCr: acc.periodCr + (l.periodCr || 0),
        closingDr: acc.closingDr + (l.dr || 0),
        closingCr: acc.closingCr + (l.cr || 0)
      }),
      { opDr: 0, opCr: 0, periodDr: 0, periodCr: 0, closingDr: 0, closingCr: 0 }
    );
  }, [reportData]);

  const pnlData = useMemo(() => {
    if (!reportData?.pnl) return null;
    const p = reportData.pnl;
    const s = Number(p.s) || 0;
    const di = Number(p.di) || 0;
    const os = Number(p.os) || 0;
    const pur = Number(p.p) || 0;
    const de = Number(p.de) || 0;
    const cs = Number(p.cs) || 0;
    const ii = Number(p.ii) || 0;
    const ie = Number(p.ie) || 0;

    const cogs = os + pur + de - cs;
    const grossProfit = s + di - cogs;
    const netProfit = grossProfit + ii - ie;

    const rawTb = reportData.tb || [];

    const getPnlAmt = (l: any, isIncome: boolean) => {
      if (l.periodAmount !== undefined) return l.periodAmount;
      const pDr = Number(l.periodDr) || 0;
      const pCr = Number(l.periodCr) || 0;
      if (pDr > 0 || pCr > 0) {
        return isIncome ? Math.abs(pCr - pDr) : Math.max(0, pDr - pCr);
      }
      return isIncome ? Math.abs((Number(l.cr) || 0) - (Number(l.dr) || 0)) : Math.max(0, (Number(l.dr) || 0) - (Number(l.cr) || 0));
    };

    const mapPnlLedger = (l: any, isIncome: boolean) => ({
      ...l,
      amount: getPnlAmt(l, isIncome)
    });

    const filterPnlLedgers = (ledgers: any[], isIncome: boolean) => {
      const mapped = ledgers.map(l => mapPnlLedger(l, isIncome));
      if (depth === 'detailed') {
        return mapped.filter(l => l.amount > 0);
      }
      return mapped;
    };

    const salesLedgers = filterPnlLedgers(rawTb.filter((l: any) => (l.grp || '').includes('Sales')), true);
    const purchLedgers = filterPnlLedgers(rawTb.filter((l: any) => (l.grp || '').includes('Purchase')), false);
    const directExpLedgers = filterPnlLedgers(rawTb.filter((l: any) => (l.grp || '').includes('Direct Expense')), false);
    const indirectExpLedgers = filterPnlLedgers(rawTb.filter((l: any) => (l.grp || '').includes('Indirect Expense')), false);
    const indirectIncLedgers = filterPnlLedgers(rawTb.filter((l: any) => (l.grp || '').includes('Indirect Income')), true);

    return {
      s, di, os, pur, de, cs, ii, ie, cogs, grossProfit, netProfit,
      salesLedgers, purchLedgers, directExpLedgers, indirectExpLedgers, indirectIncLedgers
    };
  }, [reportData, depth]);

  const bsData = useMemo(() => {
    if (!reportData?.bs || !reportData?.pnl) return null;
    const p = reportData.pnl;
    const netProfit = (Number(p.s) || 0) + (Number(p.di) || 0) - ((Number(p.os) || 0) + (Number(p.p) || 0) + (Number(p.de) || 0) - (Number(p.cs) || 0)) + (Number(p.ii) || 0) - (Number(p.ie) || 0);

    const cap = Number(reportData.bs.cap) || 0;
    const netEquity = cap + netProfit;
    const loans = Number(reportData.bs.ln) || 0;
    const cl = Number(reportData.bs.cl) || 0;
    const fa = Number(reportData.bs.fa) || 0;
    const ca = Number(reportData.bs.ca) || 0;
    const stockVal = Number(reportData.bs.cs) || 0;

    const rawTb = reportData.tb || [];
    const capitalLedgers = rawTb.filter((l: any) => (l.grp || '').includes('Capital'));
    const loanLedgers = rawTb.filter((l: any) => (l.grp || '').includes('Loan'));
    const currentLiabLedgers = rawTb.filter((l: any) => (l.grp || '').includes('Liabilit') || (l.grp || '').includes('Creditor') || (l.grp || '').includes('Dut'));
    const fixedAssetLedgers = rawTb.filter((l: any) => (l.grp || '').includes('Fixed Asset'));
    const currentAssetLedgers = rawTb.filter((l: any) => (l.grp || '').includes('Current Asset') || (l.grp || '').includes('Debtor') || (l.grp || '').includes('Bank') || (l.grp || '').includes('Cash'));

    const totalLiab = netEquity + loans + cl;
    const totalAssets = fa + ca + stockVal;
    const diff = totalAssets - totalLiab;

    return {
      cap, netEquity, netProfit, loans, cl, fa, ca, stockVal,
      capitalLedgers, loanLedgers, currentLiabLedgers, fixedAssetLedgers, currentAssetLedgers,
      totalLiab, totalAssets, diff, isBalanced: Math.abs(diff) < 0.01
    };
  }, [reportData]);

  return (
    <div className="w-full space-y-4 font-sans text-xs sm:text-sm">
      {/* 1. TRIAL BALANCE VIEW */}
      {reportType === 'TB' && (
        <div className="w-full space-y-3">
          {/* Header & Filter Controls Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xs">
            <div className="flex items-center gap-2.5 flex-wrap">
              <Scale className="h-4 w-4 text-indigo-400 shrink-0" />
              <span className="font-extrabold text-sm sm:text-base text-white tracking-wide uppercase">Trial Balance</span>
              <span className="text-xs text-slate-300 font-medium bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-700">
                Period: {fromDate} to {toDate}
              </span>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search group or ledger..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/90 pl-8 pr-3 py-1 text-xs text-white placeholder-slate-400 focus:border-indigo-400 focus:outline-hidden"
                />
              </div>

              <div className="text-right whitespace-nowrap text-xs font-mono text-slate-300">
                <span className="font-bold text-emerald-400">Nu. {fmt(tbTotals.closingDr)}</span>
              </div>
            </div>
          </div>

          {/* Full Screen Table */}
          <div className="w-full overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
            <table className="w-full border-separate border-spacing-0 text-xs sm:text-sm">
              <thead className="sticky top-0 z-30 bg-slate-100 shadow-xs ring-1 ring-slate-200">
                <tr className="bg-slate-100 text-slate-700 uppercase font-bold text-[11px] tracking-wider border-b border-slate-200">
                  <th className="bg-slate-100 bg-clip-padding py-2.5 px-4 text-left">Particulars / Account Head</th>
                  <th className="bg-slate-100 bg-clip-padding py-2.5 px-4 text-left w-48 hidden md:table-cell">Account Group</th>
                  <th className="bg-slate-100 bg-clip-padding py-2.5 px-4 text-right w-36 sm:w-48">Debit (Nu.)</th>
                  <th className="bg-slate-100 bg-clip-padding py-2.5 px-4 text-right w-36 sm:w-48">Credit (Nu.)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tbTree.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-400 italic">
                      No accounts or ledger entries match your criteria.
                    </td>
                  </tr>
                ) : (
                  tbTree.map(groupNode => {
                    const isExpanded = isNodeExpanded(groupNode.id);
                    const groupNetClose = groupNode.closingDr - groupNode.closingCr;
                    const isDr = groupNetClose >= 0;
                    const groupVal = Math.abs(groupNetClose);

                    return (
                      <React.Fragment key={groupNode.id}>
                        {/* Group Header Row */}
                        <tr
                          onClick={() => toggleNode(groupNode.id)}
                          className="bg-slate-50/70 hover:bg-indigo-50/60 cursor-pointer font-bold text-slate-900 transition"
                        >
                          <td className="py-2.5 px-4">
                            <div className="flex items-center gap-2">
                              {groupNode.children && groupNode.children.length > 0 ? (
                                <span className="text-slate-500 hover:text-indigo-600 transition">
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4 text-indigo-600" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4 text-slate-400" />
                                  )}
                                </span>
                              ) : (
                                <span className="w-4" />
                              )}
                              <span className="text-slate-900 tracking-wide font-bold">{groupNode.name}</span>
                              {groupNode.children && (
                                <span className="text-[10px] text-slate-500 font-normal bg-slate-200/70 px-1.5 py-0.2 rounded-md">
                                  {groupNode.children.length}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-4 text-xs font-semibold text-slate-500 hidden md:table-cell">
                            {groupNode.nature || 'Primary Group'}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                            {isDr && groupVal > 0 ? (
                              <span className="border-b border-slate-400 pb-0.5">{fmt(groupVal)}</span>
                            ) : '-'}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                            {!isDr && groupVal > 0 ? (
                              <span className="border-b border-slate-400 pb-0.5">{fmt(groupVal)}</span>
                            ) : '-'}
                          </td>
                        </tr>

                        {/* Child Ledger Rows */}
                        {isExpanded && depth !== 'summary' && groupNode.children?.map(child => {
                          const childCloseNet = child.closingDr - child.closingCr;
                          const childIsDr = childCloseNet >= 0;
                          const childVal = Math.abs(childCloseNet);

                          return (
                            <tr
                              key={child.id}
                              onClick={() => onDrillLedger && onDrillLedger(child.name)}
                              className="hover:bg-indigo-50/40 cursor-pointer text-slate-700 transition"
                            >
                              <td className="py-2 px-4 pl-10 font-normal text-slate-700 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 group-hover:bg-indigo-500" />
                                <span className="hover:text-indigo-600 hover:font-semibold transition underline decoration-dotted decoration-slate-300 underline-offset-4">
                                  {child.name}
                                </span>
                              </td>
                              <td className="py-2 px-4 text-xs text-slate-400 hidden md:table-cell">
                                {groupNode.name}
                              </td>
                              <td className="py-2 px-4 text-right font-mono text-slate-800">
                                {childIsDr && childVal > 0 ? fmt(childVal) : '-'}
                              </td>
                              <td className="py-2 px-4 text-right font-mono text-slate-800">
                                {!childIsDr && childVal > 0 ? fmt(childVal) : '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
              <tfoot className="sticky bottom-0 z-30 bg-slate-100 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] ring-1 ring-slate-200">
                <tr className="bg-slate-100 border-t-2 border-slate-900 font-extrabold text-slate-900 text-xs sm:text-sm">
                  <td className="bg-slate-100 bg-clip-padding py-3 px-4 uppercase tracking-wider font-extrabold">
                    GRAND TOTAL
                  </td>
                  <td className="bg-slate-100 bg-clip-padding py-3 px-4 hidden md:table-cell text-xs text-slate-500">
                    Difference: Nu. {fmt(Math.abs(tbTotals.closingDr - tbTotals.closingCr))}
                  </td>
                  <td className="bg-slate-100 bg-clip-padding py-3 px-4 text-right font-mono text-sm sm:text-base font-extrabold text-slate-900">
                    Nu. {fmt(tbTotals.closingDr)}
                  </td>
                  <td className="bg-slate-100 bg-clip-padding py-3 px-4 text-right font-mono text-sm sm:text-base font-extrabold text-slate-900">
                    Nu. {fmt(tbTotals.closingCr)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* 2. PROFIT & LOSS ACCOUNT VIEW */}
      {reportType === 'PNL' && pnlData && (
        <div className="w-full space-y-3">
          {/* Header Summary Strip */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xs">
            <div className="flex items-center gap-2.5 flex-wrap">
              <TrendingUp className="h-4 w-4 text-emerald-400 shrink-0" />
              <span className="font-extrabold text-sm sm:text-base text-white tracking-wide uppercase">Profit & Loss Account</span>
              <span className="text-xs text-slate-300 font-medium bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-700">
                Period: {fromDate} to {toDate}
              </span>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 bg-slate-800/90 px-3 py-1 rounded-lg border border-slate-700">
                <span className="text-[11px] text-slate-400 uppercase font-semibold">Gross Profit:</span>
                <span className={`text-xs font-bold font-mono ${pnlData.grossProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  Nu. {fmt(pnlData.grossProfit)}
                </span>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-800/90 px-3 py-1 rounded-lg border border-slate-700">
                <span className="text-[11px] text-slate-400 uppercase font-semibold">Nett Profit:</span>
                <span className={`text-xs font-bold font-mono ${pnlData.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  Nu. {fmt(pnlData.netProfit)}
                </span>
              </div>
            </div>
          </div>

          {/* Full-Screen Dual Column Statement */}
          <div className="w-full rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            {/* 2.1 TRADING ACCOUNT SECTION */}
            <div className="border-b-2 border-slate-800">
              <div className="bg-slate-100/90 px-4 py-1.5 text-slate-700 font-extrabold text-xs uppercase tracking-wider border-b border-slate-200">
                1. Trading Account (Gross Margin)
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
                {/* Left Side: Debits / Cost of Goods Sold */}
                <div className="flex flex-col justify-between p-3 sm:p-4 space-y-4">
                  <div>
                    <div className="flex justify-between items-center pb-2 mb-3 border-b border-slate-200 text-slate-700 font-bold uppercase text-[11px] tracking-wider">
                      <span>Particulars (Debit / Expenses)</span>
                      <span>Amount (Nu.)</span>
                    </div>

                    <div className="space-y-3.5">
                      {/* Opening Stock */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center font-bold text-slate-900">
                          <span>Opening Stock</span>
                          <span className="font-mono border-b border-slate-300 pb-0.5">{fmt(pnlData.os)}</span>
                        </div>
                        {depth !== 'summary' && pnlData.os > 0 && (
                          <div className="pl-4 flex justify-between items-center text-xs text-slate-600">
                            <span>Stock on Hand (Opening)</span>
                            <span className="font-mono">{fmt(pnlData.os)}</span>
                          </div>
                        )}
                      </div>

                      {/* Purchase Accounts */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center font-bold text-slate-900">
                          <span>Purchase Accounts</span>
                          <span className="font-mono border-b border-slate-300 pb-0.5">{fmt(pnlData.pur)}</span>
                        </div>
                        {depth !== 'summary' && pnlData.purchLedgers.map((l: any, i: number) => (
                          <div
                            key={i}
                            onClick={() => onDrillLedger && onDrillLedger(l.name)}
                            className="pl-4 flex justify-between items-center text-xs text-slate-600 hover:text-indigo-600 cursor-pointer transition"
                          >
                            <span className="underline decoration-dotted decoration-slate-300 underline-offset-2">{l.name}</span>
                            <span className="font-mono">{fmt(l.amount !== undefined ? l.amount : (l.dr || l.cr))}</span>
                          </div>
                        ))}
                      </div>

                      {/* Direct Expenses */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center font-bold text-slate-900">
                          <span>Direct Expenses</span>
                          <span className="font-mono border-b border-slate-300 pb-0.5">{fmt(pnlData.de)}</span>
                        </div>
                        {depth !== 'summary' && pnlData.directExpLedgers.map((l: any, i: number) => (
                          <div
                            key={i}
                            onClick={() => onDrillLedger && onDrillLedger(l.name)}
                            className="pl-4 flex justify-between items-center text-xs text-slate-600 hover:text-indigo-600 cursor-pointer transition"
                          >
                            <span className="underline decoration-dotted decoration-slate-300 underline-offset-2">{l.name}</span>
                            <span className="font-mono">{fmt(l.amount !== undefined ? l.amount : (l.dr || l.cr))}</span>
                          </div>
                        ))}
                      </div>

                      {/* Gross Profit c/o */}
                      {pnlData.grossProfit >= 0 && (
                        <div className="flex justify-between items-center font-extrabold text-emerald-800 bg-emerald-50/60 px-2 py-1.5 rounded-lg border border-emerald-200">
                          <span className="flex items-center gap-1.5">
                            <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                            Gross Profit c/o
                          </span>
                          <span className="font-mono text-sm">{fmt(pnlData.grossProfit)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-2.5 border-t-2 border-slate-900 font-extrabold flex justify-between items-center text-slate-900 text-xs sm:text-sm">
                    <span className="uppercase tracking-wider">Trading Total</span>
                    <span className="font-mono font-extrabold">
                      Nu. {fmt(pnlData.os + pnlData.pur + pnlData.de + Math.max(0, pnlData.grossProfit))}
                    </span>
                  </div>
                </div>

                {/* Right Side: Credits / Incomes & Closing Stock */}
                <div className="flex flex-col justify-between p-3 sm:p-4 space-y-4">
                  <div>
                    <div className="flex justify-between items-center pb-2 mb-3 border-b border-slate-200 text-slate-700 font-bold uppercase text-[11px] tracking-wider">
                      <span>Particulars (Credit / Incomes)</span>
                      <span>Amount (Nu.)</span>
                    </div>

                    <div className="space-y-3.5">
                      {/* Sales Accounts */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center font-bold text-slate-900">
                          <span>Sales Accounts</span>
                          <span className="font-mono border-b border-slate-300 pb-0.5">{fmt(pnlData.s)}</span>
                        </div>
                        {depth !== 'summary' && pnlData.salesLedgers.map((l: any, i: number) => (
                          <div
                            key={i}
                            onClick={() => onDrillLedger && onDrillLedger(l.name)}
                            className="pl-4 flex justify-between items-center text-xs text-slate-600 hover:text-indigo-600 cursor-pointer transition"
                          >
                            <span className="underline decoration-dotted decoration-slate-300 underline-offset-2">{l.name}</span>
                            <span className="font-mono">{fmt(l.amount !== undefined ? l.amount : (l.cr || l.dr))}</span>
                          </div>
                        ))}
                      </div>

                      {/* Closing Stock */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center font-bold text-slate-900">
                          <span>Closing Stock</span>
                          <span className="font-mono border-b border-slate-300 pb-0.5">{fmt(pnlData.cs)}</span>
                        </div>
                        {depth !== 'summary' && (
                          <div className="pl-4 flex justify-between items-center text-xs text-slate-600">
                            <span>Stock on Hand (Closing)</span>
                            <span className="font-mono">{fmt(pnlData.cs)}</span>
                          </div>
                        )}
                      </div>

                      {/* Direct Incomes if any */}
                      {pnlData.di > 0 && (
                        <div className="space-y-1">
                          <div className="flex justify-between items-center font-bold text-slate-900">
                            <span>Direct Incomes</span>
                            <span className="font-mono border-b border-slate-300 pb-0.5">{fmt(pnlData.di)}</span>
                          </div>
                        </div>
                      )}

                      {/* Gross Loss c/o if any */}
                      {pnlData.grossProfit < 0 && (
                        <div className="flex justify-between items-center font-extrabold text-rose-800 bg-rose-50/60 px-2 py-1.5 rounded-lg border border-rose-200">
                          <span className="flex items-center gap-1.5">
                            <TrendingDown className="h-3.5 w-3.5 text-rose-600" />
                            Gross Loss c/o
                          </span>
                          <span className="font-mono text-sm">{fmt(Math.abs(pnlData.grossProfit))}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-2.5 border-t-2 border-slate-900 font-extrabold flex justify-between items-center text-slate-900 text-xs sm:text-sm">
                    <span className="uppercase tracking-wider">Trading Total</span>
                    <span className="font-mono font-extrabold">
                      Nu. {fmt(pnlData.s + pnlData.cs + pnlData.di + Math.max(0, -pnlData.grossProfit))}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 2.2 PROFIT & LOSS SECTION */}
            <div>
              <div className="bg-slate-100/90 px-4 py-1.5 text-slate-700 font-extrabold text-xs uppercase tracking-wider border-b border-slate-200">
                2. Operating & Net Profit / Loss
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
                {/* Left Side: Indirect Expenses & Nett Profit */}
                <div className="flex flex-col justify-between p-3 sm:p-4 space-y-4">
                  <div className="space-y-3.5">
                    {/* Gross Loss b/f if applicable */}
                    {pnlData.grossProfit < 0 && (
                      <div className="flex justify-between items-center font-bold text-rose-700">
                        <span>Gross Loss b/f</span>
                        <span className="font-mono">{fmt(Math.abs(pnlData.grossProfit))}</span>
                      </div>
                    )}

                    {/* Indirect Expenses */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center font-bold text-slate-900">
                        <span>Indirect Expenses</span>
                        <span className="font-mono border-b border-slate-300 pb-0.5">{fmt(pnlData.ie)}</span>
                      </div>
                      {depth !== 'summary' && pnlData.indirectExpLedgers.map((l: any, i: number) => (
                        <div
                          key={i}
                          onClick={() => onDrillLedger && onDrillLedger(l.name)}
                          className="pl-4 flex justify-between items-center text-xs text-slate-600 hover:text-indigo-600 cursor-pointer transition"
                        >
                          <span className="underline decoration-dotted decoration-slate-300 underline-offset-2">{l.name}</span>
                          <span className="font-mono">{fmt(l.amount !== undefined ? l.amount : (l.dr || l.cr))}</span>
                        </div>
                      ))}
                    </div>

                    {/* Nett Profit */}
                    {pnlData.netProfit >= 0 && (
                      <div className="flex justify-between items-center font-extrabold text-emerald-900 bg-emerald-50 px-2.5 py-2 rounded-lg border border-emerald-300">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          Nett Profit (Transferred to Capital)
                        </span>
                        <span className="font-mono text-sm sm:text-base">{fmt(pnlData.netProfit)}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-2.5 border-t-2 border-slate-900 font-extrabold flex justify-between items-center text-slate-900 text-xs sm:text-sm">
                    <span className="uppercase tracking-wider">P&L Total</span>
                    <span className="font-mono font-extrabold">
                      Nu. {fmt(pnlData.ie + Math.max(0, -pnlData.grossProfit) + Math.max(0, pnlData.netProfit))}
                    </span>
                  </div>
                </div>

                {/* Right Side: Gross Profit b/f & Indirect Incomes */}
                <div className="flex flex-col justify-between p-3 sm:p-4 space-y-4">
                  <div className="space-y-3.5">
                    {/* Gross Profit b/f */}
                    {pnlData.grossProfit >= 0 && (
                      <div className="flex justify-between items-center font-bold text-slate-900">
                        <span>Gross Profit b/f</span>
                        <span className="font-mono">{fmt(pnlData.grossProfit)}</span>
                      </div>
                    )}

                    {/* Indirect Incomes */}
                    {pnlData.ii > 0 && (
                      <div className="space-y-1">
                        <div className="flex justify-between items-center font-bold text-slate-900">
                          <span>Indirect Incomes</span>
                          <span className="font-mono border-b border-slate-300 pb-0.5">{fmt(pnlData.ii)}</span>
                        </div>
                        {depth !== 'summary' && pnlData.indirectIncLedgers.map((l: any, i: number) => (
                          <div
                            key={i}
                            onClick={() => onDrillLedger && onDrillLedger(l.name)}
                            className="pl-4 flex justify-between items-center text-xs text-slate-600 hover:text-indigo-600 cursor-pointer transition"
                          >
                            <span className="underline decoration-dotted decoration-slate-300 underline-offset-2">{l.name}</span>
                            <span className="font-mono">{fmt(l.amount !== undefined ? l.amount : (l.cr || l.dr))}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Nett Loss if any */}
                    {pnlData.netProfit < 0 && (
                      <div className="flex justify-between items-center font-extrabold text-rose-900 bg-rose-50 px-2.5 py-2 rounded-lg border border-rose-300">
                        <span className="flex items-center gap-1.5">
                          <AlertTriangle className="h-4 w-4 text-rose-600" />
                          Nett Loss
                        </span>
                        <span className="font-mono text-sm sm:text-base">{fmt(Math.abs(pnlData.netProfit))}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-2.5 border-t-2 border-slate-900 font-extrabold flex justify-between items-center text-slate-900 text-xs sm:text-sm">
                    <span className="uppercase tracking-wider">P&L Total</span>
                    <span className="font-mono font-extrabold">
                      Nu. {fmt(Math.max(0, pnlData.grossProfit) + pnlData.ii + Math.max(0, -pnlData.netProfit))}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. BALANCE SHEET VIEW */}
      {reportType === 'BS' && bsData && (
        <div className="w-full space-y-3">
          {/* Header Summary Strip */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xs">
            <div className="flex items-center gap-2.5 flex-wrap">
              <PieChart className="h-4 w-4 text-indigo-400 shrink-0" />
              <span className="font-extrabold text-sm sm:text-base text-white tracking-wide uppercase">Balance Sheet</span>
              <span className="text-xs text-slate-300 font-medium bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-700">
                As at: {toDate}
              </span>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-bold font-mono ${
                bsData.isBalanced 
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700' 
                  : 'bg-rose-950/80 text-rose-300 border-rose-700'
              }`}>
                {bsData.isBalanced ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Balanced: Nu. {fmt(bsData.totalAssets)}</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
                    <span>Diff: Nu. {fmt(Math.abs(bsData.diff))}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Full Screen Dual Column Statement */}
          <div className="w-full rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
              {/* Left Side: Liabilities & Equity */}
              <div className="flex flex-col justify-between p-3 sm:p-4 space-y-4">
                <div>
                  <div className="flex justify-between items-center pb-2 mb-3 border-b border-slate-200 text-slate-700 font-bold uppercase text-[11px] tracking-wider">
                    <span>Liabilities & Equity</span>
                    <span>Amount (Nu.)</span>
                  </div>

                  <div className="space-y-4">
                    {/* Capital Account */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center font-bold text-slate-900">
                        <span className="text-sm">Capital Account</span>
                        <span className="font-mono border-b border-slate-300 pb-0.5">{fmt(bsData.cap + bsData.netProfit)}</span>
                      </div>
                      {depth !== 'summary' && (
                        <div className="pl-4 space-y-1 text-xs text-slate-600">
                          <div className="flex justify-between items-center">
                            <span>Capital Base</span>
                            <span className="font-mono">{fmt(bsData.cap)}</span>
                          </div>
                          {bsData.netProfit !== 0 && (
                            <div className={`flex justify-between items-center font-semibold ${bsData.netProfit > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                              <span>Retained Earnings / Current Period {bsData.netProfit > 0 ? 'Profit' : 'Loss'}</span>
                              <span className="font-mono">{fmt(bsData.netProfit)}</span>
                            </div>
                          )}
                          {bsData.capitalLedgers.map((l: any, i: number) => (
                            <div
                              key={i}
                              onClick={() => onDrillLedger && onDrillLedger(l.name)}
                              className="flex justify-between items-center hover:text-indigo-600 cursor-pointer transition"
                            >
                              <span className="underline decoration-dotted decoration-slate-300 underline-offset-2">{l.name}</span>
                              <span className="font-mono">{fmt(l.cr || l.dr)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Loans (Liability) */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center font-bold text-slate-900">
                        <span className="text-sm">Loans (Liability)</span>
                        <span className="font-mono border-b border-slate-300 pb-0.5">{fmt(bsData.loans)}</span>
                      </div>
                      {depth !== 'summary' && bsData.loanLedgers.map((l: any, i: number) => (
                        <div
                          key={i}
                          onClick={() => onDrillLedger && onDrillLedger(l.name)}
                          className="pl-4 flex justify-between items-center text-xs text-slate-600 hover:text-indigo-600 cursor-pointer transition"
                        >
                          <span className="underline decoration-dotted decoration-slate-300 underline-offset-2">{l.name}</span>
                          <span className="font-mono">{fmt(l.cr || l.dr)}</span>
                        </div>
                      ))}
                    </div>

                    {/* Current Liabilities */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center font-bold text-slate-900">
                        <span className="text-sm">Current Liabilities</span>
                        <span className="font-mono border-b border-slate-300 pb-0.5">{fmt(bsData.cl)}</span>
                      </div>
                      {depth !== 'summary' && bsData.currentLiabLedgers.map((l: any, i: number) => (
                        <div
                          key={i}
                          onClick={() => onDrillLedger && onDrillLedger(l.name)}
                          className="pl-4 flex justify-between items-center text-xs text-slate-600 hover:text-indigo-600 cursor-pointer transition"
                        >
                          <span className="underline decoration-dotted decoration-slate-300 underline-offset-2">{l.name}</span>
                          <span className="font-mono">{fmt(l.cr || l.dr)}</span>
                        </div>
                      ))}
                    </div>

                    {/* Branch / Divisions */}
                    <div className="font-bold text-slate-700 text-xs">
                      <span>Branch / Divisions</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t-2 border-slate-900 font-extrabold flex justify-between items-center text-slate-900 text-xs sm:text-sm">
                  <span className="uppercase tracking-wider">TOTAL LIABILITIES</span>
                  <span className="font-mono text-sm sm:text-base font-extrabold">
                    Nu. {fmt(bsData.totalLiab)}
                  </span>
                </div>
              </div>

              {/* Right Side: Assets */}
              <div className="flex flex-col justify-between p-3 sm:p-4 space-y-4">
                <div>
                  <div className="flex justify-between items-center pb-2 mb-3 border-b border-slate-200 text-slate-700 font-bold uppercase text-[11px] tracking-wider">
                    <span>Assets & Properties</span>
                    <span>Amount (Nu.)</span>
                  </div>

                  <div className="space-y-4">
                    {/* Fixed Assets */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center font-bold text-slate-900">
                        <span className="text-sm">Fixed Assets</span>
                        <span className="font-mono border-b border-slate-300 pb-0.5">{fmt(bsData.fa)}</span>
                      </div>
                      {depth !== 'summary' && bsData.fixedAssetLedgers.map((l: any, i: number) => (
                        <div
                          key={i}
                          onClick={() => onDrillLedger && onDrillLedger(l.name)}
                          className="pl-4 flex justify-between items-center text-xs text-slate-600 hover:text-indigo-600 cursor-pointer transition"
                        >
                          <span className="underline decoration-dotted decoration-slate-300 underline-offset-2">{l.name}</span>
                          <span className="font-mono">{fmt(l.dr || l.cr)}</span>
                        </div>
                      ))}
                    </div>

                    {/* Current Assets */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center font-bold text-slate-900">
                        <span className="text-sm">Current Assets</span>
                        <span className="font-mono border-b border-slate-300 pb-0.5">{fmt(bsData.ca + bsData.stockVal)}</span>
                      </div>
                      {depth !== 'summary' && (
                        <div className="pl-4 space-y-1 text-xs text-slate-600">
                          <div className="flex justify-between items-center font-semibold text-slate-800">
                            <span>Closing Stock (Valuation)</span>
                            <span className="font-mono">{fmt(bsData.stockVal)}</span>
                          </div>
                          {bsData.currentAssetLedgers.map((l: any, i: number) => (
                            <div
                              key={i}
                              onClick={() => onDrillLedger && onDrillLedger(l.name)}
                              className="flex justify-between items-center hover:text-indigo-600 cursor-pointer transition"
                            >
                              <span className="underline decoration-dotted decoration-slate-300 underline-offset-2">{l.name}</span>
                              <span className="font-mono">{fmt(l.dr || l.cr)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t-2 border-slate-900 font-extrabold flex justify-between items-center text-slate-900 text-xs sm:text-sm">
                  <span className="uppercase tracking-wider">TOTAL ASSETS</span>
                  <span className="font-mono text-sm sm:text-base font-extrabold">
                    Nu. {fmt(bsData.totalAssets)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const TallyPrimeView = FinancialStatementView;
export type TallyDepth = ReportDetailDepth;
