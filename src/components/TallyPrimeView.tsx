import React, { useState, useMemo, useEffect } from 'react';
import { Search, SlidersHorizontal, Layers, ListFilter, Maximize2 } from 'lucide-react';
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
  }, [reportData]);

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

  const handleDepthChange = (newDepth: ReportDetailDepth) => {
    setDepth(newDepth);
    if (onDepthChange) {
      onDepthChange(newDepth);
    }
    if (config) {
      saveConfig({ ...config, ReportDetailDepth: newDepth });
    }
  };

  return (
    <div className="space-y-4 font-sans text-xs sm:text-sm">
      {/* Search Input for Trial Balance */}
      {reportType === 'TB' && (
        <div className="relative max-w-5xl mx-auto">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search group or ledger account..."
            className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-none shadow-2xs"
          />
        </div>
      )}

      {/* 1. TRIAL BALANCE VIEW */}
      {reportType === 'TB' && (
        <div className="bg-white border border-slate-300 rounded-xl shadow-xs p-4 sm:p-6 space-y-3 max-w-5xl mx-auto font-sans text-xs sm:text-sm text-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 sm:px-4 bg-slate-50/90 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm sm:text-base font-black text-indigo-950 uppercase tracking-wide">
                TRIAL BALANCE
              </h1>
              <span className="inline-block bg-indigo-100/90 text-indigo-800 font-bold text-xs px-3 py-0.5 rounded-full border border-indigo-200">
                Period: {fromDate} to {toDate}
              </span>
            </div>
          </div>

          <table className="w-full border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-t-2 border-b border-slate-900 text-slate-900 font-bold uppercase text-[11px]">
                <th className="py-2 px-2 text-left">P a r t i c u l a r s</th>
                <th colSpan={2} className="py-1 px-2 text-right border-b border-slate-300">
                  Closing Balance
                </th>
              </tr>
              <tr className="border-b border-slate-900 text-slate-900 font-bold text-[11px]">
                <th className="py-1 px-2 text-left"></th>
                <th className="py-1 px-2 text-right w-36 sm:w-44">Debit</th>
                <th className="py-1 px-2 text-right w-36 sm:w-44">Credit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tbTree.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-slate-400 italic">
                    No ledger entries found.
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
                      <tr
                        onClick={() => toggleNode(groupNode.id)}
                        className="hover:bg-slate-50 cursor-pointer font-bold text-slate-900"
                      >
                        <td className="py-1.5 px-2 flex items-center gap-1.5">
                          {groupNode.children && groupNode.children.length > 0 && (
                            <span className="text-slate-400 text-[10px]">
                              {isExpanded ? '▼' : '►'}
                            </span>
                          )}
                          <span>{groupNode.name}</span>
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono font-bold">
                          {isDr && groupVal > 0 ? (
                            <span className="border-b border-slate-400 pb-0.5">{fmt(groupVal)}</span>
                          ) : null}
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono font-bold">
                          {!isDr && groupVal > 0 ? (
                            <span className="border-b border-slate-400 pb-0.5">{fmt(groupVal)}</span>
                          ) : null}
                        </td>
                      </tr>

                      {isExpanded && depth !== 'summary' && groupNode.children?.map(child => {
                        const childCloseNet = child.closingDr - child.closingCr;
                        const childIsDr = childCloseNet >= 0;
                        const childVal = Math.abs(childCloseNet);

                        return (
                          <tr
                            key={child.id}
                            onClick={() => onDrillLedger && onDrillLedger(child.name)}
                            className="hover:bg-slate-50 cursor-pointer text-slate-700 text-xs"
                          >
                            <td className="py-1 px-2 pl-7 font-normal">
                              {child.name}
                            </td>
                            <td className="py-1 px-2 text-right font-mono">
                              {childIsDr && childVal > 0 ? fmt(childVal) : ''}
                            </td>
                            <td className="py-1 px-2 text-right font-mono">
                              {!childIsDr && childVal > 0 ? fmt(childVal) : ''}
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr className="border-t border-b-4 border-slate-900 font-extrabold text-slate-900 text-xs sm:text-sm">
                <td className="py-2.5 px-2 uppercase tracking-wide">C a r r i e d   O v e r / G r a n d   T o t a l</td>
                <td className="py-2.5 px-2 text-right font-mono">
                  {fmt(tbTotals.closingDr)}
                </td>
                <td className="py-2.5 px-2 text-right font-mono">
                  {fmt(tbTotals.closingCr)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* 2. PROFIT & LOSS ACCOUNT VIEW */}
      {reportType === 'PNL' && pnlData && (
        <div className="bg-white border border-slate-300 rounded-xl shadow-xs p-4 sm:p-6 space-y-3 max-w-5xl mx-auto font-sans text-xs sm:text-sm text-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 sm:px-4 bg-slate-50/90 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm sm:text-base font-black text-indigo-950 uppercase tracking-wide">
                PROFIT & LOSS ACCOUNT
              </h1>
              <span className="inline-block bg-indigo-100/90 text-indigo-800 font-bold text-xs px-3 py-0.5 rounded-full border border-indigo-200">
                Period: {fromDate} to {toDate}
              </span>
            </div>
          </div>

          <div className="border-t-2 border-b-4 border-slate-900 divide-y divide-slate-900">
            {/* TRADING ACCOUNT */}
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-300">
              <div className="flex flex-col justify-between p-2 space-y-4">
                <div>
                  <div className="flex justify-between items-center pb-1 mb-2 border-b border-slate-900 font-bold uppercase text-[11px]">
                    <span>P a r t i c u l a r s</span>
                    <span>{fromDate} to {toDate}</span>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-0.5">
                      <div className="flex justify-between items-center font-bold text-slate-900">
                        <span>Opening Stock</span>
                        <span className="font-mono border-b border-slate-400 pb-0.5">{fmt(pnlData.os)}</span>
                      </div>
                      {depth !== 'summary' && (
                        <div className="pl-4 flex justify-between items-center text-xs text-slate-700">
                          <span>Stock</span>
                          <span className="font-mono">{fmt(pnlData.os)}</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex justify-between items-center font-bold text-slate-900">
                        <span>Purchase Accounts</span>
                        <span className="font-mono border-b border-slate-400 pb-0.5">{fmt(pnlData.pur)}</span>
                      </div>
                      {depth !== 'summary' && pnlData.purchLedgers.map((l: any, i: number) => (
                        <div key={i} onClick={() => onDrillLedger && onDrillLedger(l.name)} className="pl-4 flex justify-between items-center text-xs text-slate-700 hover:text-indigo-600 cursor-pointer">
                          <span>{l.name}</span>
                          <span className="font-mono">{fmt(l.amount !== undefined ? l.amount : (l.dr || l.cr))}</span>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex justify-between items-center font-bold text-slate-900">
                        <span>Direct Expenses</span>
                        <span className="font-mono border-b border-slate-400 pb-0.5">{fmt(pnlData.de)}</span>
                      </div>
                      {depth !== 'summary' && pnlData.directExpLedgers.map((l: any, i: number) => (
                        <div key={i} onClick={() => onDrillLedger && onDrillLedger(l.name)} className="pl-4 flex justify-between items-center text-xs text-slate-700 hover:text-indigo-600 cursor-pointer">
                          <span>{l.name}</span>
                          <span className="font-mono">{fmt(l.amount !== undefined ? l.amount : (l.dr || l.cr))}</span>
                        </div>
                      ))}
                    </div>

                    {pnlData.grossProfit >= 0 && (
                      <div className="flex justify-between items-center font-extrabold text-slate-900 pt-2">
                        <span>Gross Profit c/o</span>
                        <span className="font-mono">{fmt(pnlData.grossProfit)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-900 font-extrabold flex justify-between items-center">
                  <span>&nbsp;</span>
                  <span className="font-mono">{fmt(pnlData.os + pnlData.pur + pnlData.de + Math.max(0, pnlData.grossProfit))}</span>
                </div>
              </div>

              <div className="flex flex-col justify-between p-2 space-y-4">
                <div>
                  <div className="flex justify-between items-center pb-1 mb-2 border-b border-slate-900 font-bold uppercase text-[11px]">
                    <span>P a r t i c u l a r s</span>
                    <span>{fromDate} to {toDate}</span>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-0.5">
                      <div className="flex justify-between items-center font-bold text-slate-900">
                        <span>Sales Accounts</span>
                        <span className="font-mono border-b border-slate-400 pb-0.5">{fmt(pnlData.s)}</span>
                      </div>
                      {depth !== 'summary' && pnlData.salesLedgers.map((l: any, i: number) => (
                        <div key={i} onClick={() => onDrillLedger && onDrillLedger(l.name)} className="pl-4 flex justify-between items-center text-xs text-slate-700 hover:text-indigo-600 cursor-pointer">
                          <span>{l.name}</span>
                          <span className="font-mono">{fmt(l.amount !== undefined ? l.amount : (l.cr || l.dr))}</span>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex justify-between items-center font-bold text-slate-900">
                        <span>Closing Stock</span>
                        <span className="font-mono border-b border-slate-400 pb-0.5">{fmt(pnlData.cs)}</span>
                      </div>
                      {depth !== 'summary' && (
                        <div className="pl-4 flex justify-between items-center text-xs text-slate-700">
                          <span>Stock</span>
                          <span className="font-mono">{fmt(pnlData.cs)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-900 font-extrabold flex justify-between items-center">
                  <span>&nbsp;</span>
                  <span className="font-mono">{fmt(pnlData.s + pnlData.cs + Math.max(0, -pnlData.grossProfit))}</span>
                </div>
              </div>
            </div>

            {/* PROFIT & LOSS ACCOUNT */}
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-300">
              <div className="flex flex-col justify-between p-2 space-y-4">
                <div className="space-y-3">
                  <div className="space-y-0.5">
                    <div className="flex justify-between items-center font-bold text-slate-900">
                      <span>Indirect Expenses</span>
                      <span className="font-mono border-b border-slate-400 pb-0.5">{fmt(pnlData.ie)}</span>
                    </div>
                    {depth !== 'summary' && pnlData.indirectExpLedgers.map((l: any, i: number) => (
                      <div key={i} onClick={() => onDrillLedger && onDrillLedger(l.name)} className="pl-4 flex justify-between items-center text-xs text-slate-700 hover:text-indigo-600 cursor-pointer">
                        <span>{l.name}</span>
                        <span className="font-mono">{fmt(l.amount !== undefined ? l.amount : (l.dr || l.cr))}</span>
                      </div>
                    ))}
                  </div>

                  {pnlData.netProfit >= 0 && (
                    <div className="flex justify-between items-center font-extrabold text-slate-900 pt-2">
                      <span>Nett Profit</span>
                      <span className="font-mono">{fmt(pnlData.netProfit)}</span>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-900 font-extrabold flex justify-between items-center">
                  <span>&nbsp;</span>
                  <span className="font-mono">{fmt(pnlData.ie + Math.max(0, pnlData.netProfit))}</span>
                </div>
              </div>

              <div className="flex flex-col justify-between p-2 space-y-4">
                <div className="space-y-3">
                  {pnlData.grossProfit >= 0 && (
                    <div className="flex justify-between items-center font-bold text-slate-900">
                      <span>Gross Profit b/f</span>
                      <span className="font-mono">{fmt(pnlData.grossProfit)}</span>
                    </div>
                  )}

                  {pnlData.ii > 0 && (
                    <div className="space-y-0.5">
                      <div className="flex justify-between items-center font-bold text-slate-900">
                        <span>Indirect Incomes</span>
                        <span className="font-mono border-b border-slate-400 pb-0.5">{fmt(pnlData.ii)}</span>
                      </div>
                      {depth !== 'summary' && pnlData.indirectIncLedgers.map((l: any, i: number) => (
                        <div key={i} onClick={() => onDrillLedger && onDrillLedger(l.name)} className="pl-4 flex justify-between items-center text-xs text-slate-700 hover:text-indigo-600 cursor-pointer">
                          <span>{l.name}</span>
                          <span className="font-mono">{fmt(l.amount !== undefined ? l.amount : (l.cr || l.dr))}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-900 font-extrabold flex justify-between items-center">
                  <span>T o t a l</span>
                  <span className="font-mono">{fmt(Math.max(0, pnlData.grossProfit) + pnlData.ii)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. BALANCE SHEET VIEW */}
      {reportType === 'BS' && bsData && (
        <div className="bg-white border border-slate-300 rounded-xl shadow-xs p-4 sm:p-6 space-y-3 max-w-5xl mx-auto font-sans text-xs sm:text-sm text-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 sm:px-4 bg-slate-50/90 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm sm:text-base font-black text-indigo-950 uppercase tracking-wide">
                BALANCE SHEET
              </h1>
              <span className="inline-block bg-indigo-100/90 text-indigo-800 font-bold text-xs px-3 py-0.5 rounded-full border border-indigo-200">
                As at: {toDate}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-300 border-t-2 border-b-4 border-slate-900">
            <div className="flex flex-col justify-between p-2 space-y-4">
              <div>
                <div className="flex justify-between items-center pb-1 mb-2 border-b border-slate-900 font-bold uppercase text-[11px]">
                  <span>L i a b i l i t i e s</span>
                  <span>as at {toDate}</span>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="flex justify-between items-center font-bold text-slate-900">
                      <span>Capital Account</span>
                      <span className="font-mono border-b border-slate-400 pb-0.5">{fmt(bsData.cap + bsData.netProfit)}</span>
                    </div>
                    {depth !== 'summary' && (
                      <div className="pl-4 space-y-0.5 text-xs text-slate-700">
                        <div className="flex justify-between items-center">
                          <span>Capital Account</span>
                          <span className="font-mono">{fmt(bsData.cap)}</span>
                        </div>
                        {bsData.netProfit !== 0 && (
                          <div className="flex justify-between items-center italic">
                            <span>Retain Earnings / Net Profit</span>
                            <span className="font-mono">{fmt(bsData.netProfit)}</span>
                          </div>
                        )}
                        {bsData.capitalLedgers.map((l: any, i: number) => (
                          <div key={i} onClick={() => onDrillLedger && onDrillLedger(l.name)} className="flex justify-between items-center hover:text-indigo-600 cursor-pointer">
                            <span>{l.name}</span>
                            <span className="font-mono">{fmt(l.cr || l.dr)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center font-bold text-slate-900">
                      <span>Loans (Liability)</span>
                      <span className="font-mono border-b border-slate-400 pb-0.5">{fmt(bsData.loans)}</span>
                    </div>
                    {depth !== 'summary' && bsData.loanLedgers.map((l: any, i: number) => (
                      <div key={i} onClick={() => onDrillLedger && onDrillLedger(l.name)} className="pl-4 flex justify-between items-center text-xs text-slate-700 hover:text-indigo-600 cursor-pointer">
                        <span>{l.name}</span>
                        <span className="font-mono">{fmt(l.cr || l.dr)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center font-bold text-slate-900">
                      <span>Current Liabilities</span>
                      <span className="font-mono border-b border-slate-400 pb-0.5">{fmt(bsData.cl)}</span>
                    </div>
                    {depth !== 'summary' && bsData.currentLiabLedgers.map((l: any, i: number) => (
                      <div key={i} onClick={() => onDrillLedger && onDrillLedger(l.name)} className="pl-4 flex justify-between items-center text-xs text-slate-700 hover:text-indigo-600 cursor-pointer">
                        <span>{l.name}</span>
                        <span className="font-mono">{fmt(l.cr || l.dr)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="font-bold text-slate-900">
                    <span>Branch / Divisions</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t-2 border-slate-900 font-extrabold flex justify-between items-center">
                <span>T o t a l</span>
                <span className="font-mono">{fmt(bsData.totalLiab)}</span>
              </div>
            </div>

            <div className="flex flex-col justify-between p-2 space-y-4">
              <div>
                <div className="flex justify-between items-center pb-1 mb-2 border-b border-slate-900 font-bold uppercase text-[11px]">
                  <span>A s s e t s</span>
                  <span>as at {toDate}</span>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="flex justify-between items-center font-bold text-slate-900">
                      <span>Fixed Assets</span>
                      <span className="font-mono border-b border-slate-400 pb-0.5">{fmt(bsData.fa)}</span>
                    </div>
                    {depth !== 'summary' && bsData.fixedAssetLedgers.map((l: any, i: number) => (
                      <div key={i} onClick={() => onDrillLedger && onDrillLedger(l.name)} className="pl-4 flex justify-between items-center text-xs text-slate-700 hover:text-indigo-600 cursor-pointer">
                        <span>{l.name}</span>
                        <span className="font-mono">{fmt(l.dr || l.cr)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center font-bold text-slate-900">
                      <span>Current Assets</span>
                      <span className="font-mono border-b border-slate-400 pb-0.5">{fmt(bsData.ca + bsData.stockVal)}</span>
                    </div>
                    {depth !== 'summary' && (
                      <div className="pl-4 space-y-0.5 text-xs text-slate-700">
                        <div className="flex justify-between items-center font-semibold">
                          <span>Closing Stock</span>
                          <span className="font-mono">{fmt(bsData.stockVal)}</span>
                        </div>
                        {bsData.currentAssetLedgers.map((l: any, i: number) => (
                          <div key={i} onClick={() => onDrillLedger && onDrillLedger(l.name)} className="flex justify-between items-center hover:text-indigo-600 cursor-pointer">
                            <span>{l.name}</span>
                            <span className="font-mono">{fmt(l.dr || l.cr)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t-2 border-slate-900 font-extrabold flex justify-between items-center">
                <span>A s s e t s   T o t a l</span>
                <span className="font-mono">{fmt(bsData.totalAssets)}</span>
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
