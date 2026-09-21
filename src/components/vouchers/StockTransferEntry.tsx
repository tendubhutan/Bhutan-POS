import React, { useState, useEffect } from 'react';
import { Config, Item, StockTransferItem, StockTransferVoucher, Branch, Godown } from '../../types';
import {
  saveStockTransfer,
  getStockTransfers,
  receiveStockTransferChallan,
  cancelStockTransfer,
  peekNextTransferNo,
  getBranches,
  getGodowns,
  getItemStockForBranch,
  getTerminalBranchId
} from '../../services/storageService';
import {
  ArrowRightLeft,
  Truck,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Printer,
  Search,
  Package,
  Boxes,
  Eye,
  FileCheck2,
  Building2,
  Warehouse,
  RotateCcw,
  Ban,
  Clock
} from 'lucide-react';
import { SearchableItemSelect } from '../SearchableItemSelect';
import { formatDateDMY } from '../../utils/dateUtils';

interface StockTransferEntryProps {
  config: Config;
  items: Item[];
  onDataRefresh?: () => void;
  onNavigateBack?: () => void;
  voucherTypeSelector?: React.ReactNode;
}

export const StockTransferEntry: React.FC<StockTransferEntryProps> = ({
  config,
  items,
  onDataRefresh,
  onNavigateBack,
  voucherTypeSelector
}) => {
  const currencySymbol = config?.CurrencySymbol || 'Nu.';
  const branchTransferConfigMode = config?.BranchTransferMode || 'flexible';
  const isGodownEnabled = config?.EnableMultiGodown === 'true';

  const [activeTab, setActiveTab] = useState<'create' | 'register'>('create');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [savedTransfers, setSavedTransfers] = useState<StockTransferVoucher[]>([]);

  // Form State
  const [transferMode, setTransferMode] = useState<'direct' | 'challan'>(() => {
    if (branchTransferConfigMode === 'challan') return 'challan';
    return 'direct';
  });

  const [transferNo, setTransferNo] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [fromBranchId, setFromBranchId] = useState('');
  const [toBranchId, setToBranchId] = useState('');
  const [fromGodownId, setFromGodownId] = useState('');
  const [toGodownId, setToGodownId] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [narration, setNarration] = useState('');

  // Item lines
  const [lines, setLines] = useState<StockTransferItem[]>([
    { itemCode: '', itemName: '', unit: 'Pcs', qty: 1, rate: 0, amount: 0 }
  ]);

  // UI status
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [searchRegister, setSearchRegister] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'in_transit' | 'received' | 'cancelled'>('all');

  // Modal states
  const [receivingTransfer, setReceivingTransfer] = useState<StockTransferVoucher | null>(null);
  const [receiveNotes, setReceiveNotes] = useState('');
  const [receivedBy, setReceivedBy] = useState('');
  const [viewingTransfer, setViewingTransfer] = useState<StockTransferVoucher | null>(null);

  // Load master data
  const loadData = () => {
    const brList = getBranches().filter(b => b.isActive);
    setBranches(brList);
    const gdList = getGodowns().filter(g => g.isActive);
    setGodowns(gdList);
    setSavedTransfers(getStockTransfers());

    // Defaults
    if (brList.length > 0) {
      const activeId = getTerminalBranchId(config);
      const ho = brList.find(b => b.isHeadOffice) || brList[0];
      const defaultFrom = brList.find(b => b.id === activeId) || ho;
      setFromBranchId(defaultFrom.id);

      const otherBranch = brList.find(b => b.id !== defaultFrom.id);
      if (otherBranch) {
        setToBranchId(otherBranch.id);
      }
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Update voucher number when mode changes
  useEffect(() => {
    setTransferNo(peekNextTransferNo(transferMode));
  }, [transferMode]);

  // Update godowns when from/to branches change
  useEffect(() => {
    if (isGodownEnabled) {
      const fromGds = godowns.filter(g => g.branchId === fromBranchId);
      if (fromGds.length > 0 && !fromGds.some(g => g.id === fromGodownId)) {
        const def = fromGds.find(g => g.isDefault) || fromGds[0];
        setFromGodownId(def.id);
      }
      const toGds = godowns.filter(g => g.branchId === toBranchId);
      if (toGds.length > 0 && !toGds.some(g => g.id === toGodownId)) {
        const def = toGds.find(g => g.isDefault) || toGds[0];
        setToGodownId(def.id);
      }
    }
  }, [fromBranchId, toBranchId, godowns, isGodownEnabled]);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  const handleItemSelect = (index: number, item: Item) => {
    const updated = [...lines];
    const unitRate = Number(item['Purchase Rate']) || Number(item['Sale Price']) || 0;
    updated[index] = {
      ...updated[index],
      itemCode: item['Item Code'],
      itemName: item['Item Name'],
      unit: item.Unit || 'Pcs',
      rate: unitRate,
      amount: (Number(updated[index].qty) || 1) * unitRate
    };
    setLines(updated);
  };

  const handleQtyChange = (index: number, newQty: number) => {
    const updated = [...lines];
    const qty = Math.max(1, newQty);
    const rate = Number(updated[index].rate) || 0;
    updated[index] = {
      ...updated[index],
      qty,
      amount: qty * rate
    };
    setLines(updated);
  };

  const handleRateChange = (index: number, newRate: number) => {
    const updated = [...lines];
    const rate = Math.max(0, newRate);
    const qty = Number(updated[index].qty) || 1;
    updated[index] = {
      ...updated[index],
      rate,
      amount: qty * rate
    };
    setLines(updated);
  };

  const addLine = () => {
    setLines([...lines, { itemCode: '', itemName: '', unit: 'Pcs', qty: 1, rate: 0, amount: 0 }]);
  };

  const removeLine = (index: number) => {
    if (lines.length === 1) {
      setLines([{ itemCode: '', itemName: '', unit: 'Pcs', qty: 1, rate: 0, amount: 0 }]);
      return;
    }
    setLines(lines.filter((_, i) => i !== index));
  };

  const totalQty = lines.reduce((acc, l) => acc + (Number(l.qty) || 0), 0);
  const totalValuation = lines.reduce((acc, l) => acc + (Number(l.amount) || 0), 0);

  const resetForm = () => {
    setTransferNo(peekNextTransferNo(transferMode));
    setDate(new Date().toISOString().split('T')[0]);
    setVehicleNo('');
    setDriverName('');
    setDriverPhone('');
    setNarration('');
    setLines([{ itemCode: '', itemName: '', unit: 'Pcs', qty: 1, rate: 0, amount: 0 }]);
  };

  const handleSwapLocations = () => {
    const prevFromBranch = fromBranchId;
    const prevToBranch = toBranchId;
    const prevFromGodown = fromGodownId;
    const prevToGodown = toGodownId;

    setFromBranchId(prevToBranch);
    setToBranchId(prevFromBranch);
    setFromGodownId(prevToGodown);
    setToGodownId(prevFromGodown);

    const fromB = branches.find(b => b.id === prevToBranch)?.name || 'Source';
    const toB = branches.find(b => b.id === prevFromBranch)?.name || 'Destination';
    showToast(`Swapped locations: ${fromB} ➔ ${toB}`, 'success');
  };

  const handleOpenBranchMaster = () => {
    window.dispatchEvent(new CustomEvent('app:open-masters', { detail: { tab: 'branches' } }));
  };

  const handleSubmit = (printAfter = false) => {
    // Validation
    const validLines = lines.filter(l => l.itemCode && l.qty > 0);
    if (validLines.length === 0) {
      showToast('Please select at least one valid item to transfer.', 'error');
      return;
    }

    if (!fromBranchId) {
      showToast('Please select a Source Branch.', 'error');
      return;
    }

    if (!toBranchId) {
      showToast('Please select a Destination Branch.', 'error');
      return;
    }

    if (fromBranchId === toBranchId) {
      if (!isGodownEnabled || !fromGodownId || !toGodownId || fromGodownId === toGodownId) {
        showToast('Source and Destination cannot be the same. Please choose a different branch or godown.', 'error');
        return;
      }
    }

    const fromBranch = branches.find(b => b.id === fromBranchId);
    const toBranch = branches.find(b => b.id === toBranchId);
    const fromGodown = godowns.find(g => g.id === fromGodownId);
    const toGodown = godowns.find(g => g.id === toGodownId);

    const isChallan = transferMode === 'challan';

    const newVoucher: StockTransferVoucher = {
      id: 'st_' + Date.now(),
      transferNo: transferNo || peekNextTransferNo(transferMode),
      date,
      transferMode,
      status: isChallan ? 'in_transit' : 'completed',
      fromBranchId,
      fromBranchName: fromBranch?.name || 'Head Office',
      toBranchId,
      toBranchName: toBranch?.name || 'Destination Branch',
      fromGodownId: isGodownEnabled ? fromGodownId : undefined,
      fromGodownName: isGodownEnabled ? fromGodown?.name : undefined,
      toGodownId: isGodownEnabled ? toGodownId : undefined,
      toGodownName: isGodownEnabled ? toGodown?.name : undefined,
      vehicleNo: vehicleNo.trim() || undefined,
      driverName: driverName.trim() || undefined,
      driverPhone: driverPhone.trim() || undefined,
      dispatchTime: new Date().toLocaleTimeString(),
      narration: narration.trim() || undefined,
      items: validLines,
      totalQty,
      totalAmount: totalValuation
    };

    const res = saveStockTransfer(newVoucher);
    if (!res.ok) {
      showToast(res.error || 'Failed to record stock movement.', 'error');
      return;
    }

    showToast(
      isChallan
        ? `Transfer Challan ${newVoucher.transferNo} dispatched in transit!`
        : `Stock Transfer Voucher ${newVoucher.transferNo} posted successfully!`,
      'success'
    );

    if (printAfter) {
      setViewingTransfer(newVoucher);
    }

    resetForm();
    loadData();
    onDataRefresh?.();
  };

  const handleConfirmReceipt = () => {
    if (!receivingTransfer) return;
    const res = receiveStockTransferChallan(receivingTransfer.id, receiveNotes, receivedBy);
    if (!res.ok) {
      showToast(res.error || 'Failed to confirm receipt.', 'error');
      return;
    }
    showToast(`Challan ${receivingTransfer.transferNo} marked received and inventory added to destination branch!`, 'success');
    setReceivingTransfer(null);
    setReceiveNotes('');
    setReceivedBy('');
    loadData();
    onDataRefresh?.();
  };

  const handleCancelTransfer = (transfer: StockTransferVoucher) => {
    if (!window.confirm(`Are you sure you want to cancel Transfer ${transfer.transferNo}? Any deducted stock will be reversed.`)) {
      return;
    }
    const res = cancelStockTransfer(transfer.id, 'Cancelled by user');
    if (!res.ok) {
      showToast(res.error || 'Failed to cancel transfer.', 'error');
      return;
    }
    showToast(`Transfer ${transfer.transferNo} cancelled.`, 'success');
    loadData();
    onDataRefresh?.();
  };

  // Filtered register
  const filteredTransfers = savedTransfers.filter(t => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (!searchRegister) return true;
    const q = searchRegister.toLowerCase();
    return (
      t.transferNo.toLowerCase().includes(q) ||
      t.fromBranchName.toLowerCase().includes(q) ||
      t.toBranchName.toLowerCase().includes(q) ||
      (t.vehicleNo && t.vehicleNo.toLowerCase().includes(q)) ||
      t.items.some(i => i.itemName.toLowerCase().includes(q) || i.itemCode.toLowerCase().includes(q))
    );
  });

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50 text-slate-800 text-xs">
      {/* Top Bar / Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center justify-between shadow-2xs gap-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-xs">
            <ArrowRightLeft className="h-4.5 w-4.5" />
          </div>
          <div>
            <h1 className="font-extrabold text-slate-900 text-sm tracking-tight flex items-center gap-2">
              <span>Stock Transfer &amp; Challan</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                Alt+F7
              </span>
            </h1>
            <p className="text-[11px] text-slate-500 font-medium">
              Inter-branch &amp; warehouse goods movement (Direct voucher or 2-step transit challan)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {voucherTypeSelector}
          <div className="flex rounded-lg border border-slate-300 p-0.5 bg-slate-100">
            <button
              type="button"
              onClick={() => setActiveTab('create')}
              className={`px-3 py-1 rounded-md font-bold text-xs transition cursor-pointer ${
                activeTab === 'create'
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              New Transfer
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('register')}
              className={`px-3 py-1 rounded-md font-bold text-xs transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'register'
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Transfer Register</span>
              {savedTransfers.filter(t => t.status === 'in_transit').length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-500 text-white animate-pulse">
                  {savedTransfers.filter(t => t.status === 'in_transit').length} in transit
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Toast Alert */}
      {toastMsg && (
        <div
          className={`mx-4 mt-2 px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 shadow-sm border ${
            toastMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
              : 'bg-rose-50 text-rose-800 border-rose-300'
          }`}
        >
          {toastMsg.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
          )}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Main Tab Content */}
      {activeTab === 'create' ? (
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
          {/* Transfer Mode & Voucher Header Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {/* Transfer Mode Selector */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Movement Process / Mode
                </label>
                {branchTransferConfigMode === 'flexible' ? (
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setTransferMode('direct')}
                      className={`px-2 py-1.5 rounded-lg border font-bold text-xs text-center transition cursor-pointer flex items-center justify-center gap-1 ${
                        transferMode === 'direct'
                          ? 'bg-indigo-50 border-indigo-400 text-indigo-700 shadow-2xs ring-1 ring-indigo-400'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <ArrowRightLeft className="h-3.5 w-3.5 text-indigo-600" />
                      <span>Direct Transfer</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTransferMode('challan')}
                      className={`px-2 py-1.5 rounded-lg border font-bold text-xs text-center transition cursor-pointer flex items-center justify-center gap-1 ${
                        transferMode === 'challan'
                          ? 'bg-amber-50 border-amber-400 text-amber-900 shadow-2xs ring-1 ring-amber-400'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Truck className="h-3.5 w-3.5 text-amber-600" />
                      <span>Transfer Challan</span>
                    </button>
                  </div>
                ) : (
                  <div className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    {branchTransferConfigMode === 'challan' ? (
                      <>
                        <Truck className="h-3.5 w-3.5 text-amber-600" />
                        <span>Transfer Challan (2-Step In-Transit)</span>
                      </>
                    ) : (
                      <>
                        <ArrowRightLeft className="h-3.5 w-3.5 text-indigo-600" />
                        <span>Direct Transfer Voucher (Instant)</span>
                      </>
                    )}
                  </div>
                )}
                <p className="mt-1 text-[10px] text-slate-500 font-medium">
                  {transferMode === 'direct'
                    ? '1-step instant stock transfer between locations'
                    : '2-step movement: Dispatches into In-Transit, destination receives'}
                </p>
              </div>

              {/* Transfer Number */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Voucher / Challan No.
                </label>
                <input
                  type="text"
                  value={transferNo}
                  onChange={e => setTransferNo(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono font-bold text-slate-900 bg-slate-50 focus:bg-white focus:border-indigo-500 outline-none"
                  placeholder="TRF-0001"
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Date of Movement
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-bold text-slate-800 bg-white focus:border-indigo-500 outline-none"
                />
              </div>

              {/* Vehicle / Driver (if Challan mode) */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Transport / Vehicle Reg.
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={vehicleNo}
                    onChange={e => setVehicleNo(e.target.value)}
                    placeholder="e.g. BP-1-A1234"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-800 bg-white focus:border-indigo-500 outline-none uppercase font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Locations Card: From & To */}
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs">
            {/* Header info & quick actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-3 border-b border-slate-100">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                  Movement Path:
                </span>
                {fromBranchId && toBranchId && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-950 font-bold text-xs">
                    <span>{branches.find(b => b.id === fromBranchId)?.name || 'Source'}</span>
                    <ArrowRightLeft className="h-3 w-3 text-indigo-500 shrink-0" />
                    <span>{branches.find(b => b.id === toBranchId)?.name || 'Destination'}</span>
                    
                    {branches.find(b => b.id === toBranchId)?.isHeadOffice && !branches.find(b => b.id === fromBranchId)?.isHeadOffice ? (
                      <span className="ml-1 px-1.5 py-0.2 text-[10px] font-black rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                        Branch ➔ HO (Return / Consolidation)
                      </span>
                    ) : branches.find(b => b.id === fromBranchId)?.isHeadOffice && !branches.find(b => b.id === toBranchId)?.isHeadOffice ? (
                      <span className="ml-1 px-1.5 py-0.2 text-[10px] font-black rounded bg-indigo-100 text-indigo-800 border border-indigo-300">
                        HO ➔ Branch (Outward Supply)
                      </span>
                    ) : !branches.find(b => b.id === fromBranchId)?.isHeadOffice && !branches.find(b => b.id === toBranchId)?.isHeadOffice ? (
                      <span className="ml-1 px-1.5 py-0.2 text-[10px] font-black rounded bg-purple-100 text-purple-800 border border-purple-300">
                        Branch ➔ Branch (Inter-Branch)
                      </span>
                    ) : (
                      <span className="ml-1 px-1.5 py-0.2 text-[10px] font-black rounded bg-slate-100 text-slate-700 border border-slate-300">
                        Intra-Location Transfer
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSwapLocations}
                  className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 active:scale-95 text-indigo-700 border border-indigo-200 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                  title="Click to switch Source and Destination (e.g. swap Branch to HO or HO to Branch)"
                >
                  <ArrowRightLeft className="h-3.5 w-3.5 text-indigo-600" />
                  <span>Swap (⇄)</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenBranchMaster}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 border border-slate-300 font-bold text-xs flex items-center gap-1 transition cursor-pointer"
                  title="Open Branch Master to create or edit branches (Masters > Branches)"
                >
                  <Building2 className="h-3.5 w-3.5 text-slate-600" />
                  <span>+ Manage Branches</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative">
              {/* Center Movement / Swap Icon Button */}
              <button
                type="button"
                onClick={handleSwapLocations}
                title="Click to Swap Source &amp; Destination"
                className="hidden md:flex absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white hover:bg-indigo-50 border-2 border-indigo-400 items-center justify-center text-indigo-600 hover:text-indigo-800 shadow-md z-10 cursor-pointer active:scale-90 transition group"
              >
                <ArrowRightLeft className="h-4 w-4 group-hover:rotate-180 transition-transform duration-300" />
              </button>

              {/* Source (From) */}
              <div className="bg-slate-50/70 rounded-lg p-3 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                    <Building2 className="h-4 w-4 text-indigo-600" />
                    <span>SOURCE (Dispatched From)</span>
                  </div>
                  {branches.find(b => b.id === fromBranchId)?.isHeadOffice && (
                    <span className="text-[10px] font-extrabold bg-indigo-100 text-indigo-800 px-1.5 py-0.2 rounded">
                      Head Office
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">
                      From Branch *
                    </label>
                    <select
                      value={fromBranchId}
                      onChange={e => setFromBranchId(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-bold text-slate-900 bg-white focus:border-indigo-500 outline-none cursor-pointer"
                    >
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.name} {b.isHeadOffice ? '(HQ)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {isGodownEnabled && (
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">
                        From Godown / Warehouse
                      </label>
                      <select
                        value={fromGodownId}
                        onChange={e => setFromGodownId(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-medium text-slate-800 bg-white focus:border-indigo-500 outline-none cursor-pointer"
                      >
                        {godowns
                          .filter(g => g.branchId === fromBranchId)
                          .map(g => (
                            <option key={g.id} value={g.id}>
                              {g.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Destination (To) */}
              <div className="bg-slate-50/70 rounded-lg p-3 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                    <Building2 className="h-4 w-4 text-emerald-600" />
                    <span>DESTINATION (Delivered To)</span>
                  </div>
                  {branches.find(b => b.id === toBranchId)?.isHeadOffice && (
                    <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded">
                      Head Office
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">
                      To Branch *
                    </label>
                    <select
                      value={toBranchId}
                      onChange={e => setToBranchId(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-bold text-slate-900 bg-white focus:border-indigo-500 outline-none cursor-pointer"
                    >
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.name} {b.isHeadOffice ? '(HQ)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {isGodownEnabled && (
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">
                        To Godown / Warehouse
                      </label>
                      <select
                        value={toGodownId}
                        onChange={e => setToGodownId(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-medium text-slate-800 bg-white focus:border-indigo-500 outline-none cursor-pointer"
                      >
                        {godowns
                          .filter(g => g.branchId === toBranchId)
                          .map(g => (
                            <option key={g.id} value={g.id}>
                              {g.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Optional Driver Contact */}
            {transferMode === 'challan' && (
              <div className="mt-3 pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">
                    Driver Name
                  </label>
                  <input
                    type="text"
                    value={driverName}
                    onChange={e => setDriverName(e.target.value)}
                    placeholder="Driver / Transporter Name"
                    className="w-full px-2.5 py-1 rounded-lg border border-slate-300 bg-white outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">
                    Driver Contact Phone
                  </label>
                  <input
                    type="text"
                    value={driverPhone}
                    onChange={e => setDriverPhone(e.target.value)}
                    placeholder="Mobile / Phone number"
                    className="w-full px-2.5 py-1 rounded-lg border border-slate-300 bg-white outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Items Transfer Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-slate-800 text-xs">
                <Package className="h-4 w-4 text-indigo-600" />
                <span>Goods &amp; Inventory Items to Transfer</span>
                <span className="text-[11px] font-normal text-slate-500">
                  (Stock is validated against Source Branch)
                </span>
              </div>
              <button
                type="button"
                onClick={addLine}
                className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 transition cursor-pointer flex items-center gap-1 shadow-2xs"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Item Line</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 text-[11px] font-bold">
                    <th className="py-2 px-3 w-10 text-center">#</th>
                    <th className="py-2 px-3">Item Name &amp; Code</th>
                    <th className="py-2 px-2 w-28 text-right">Available at Source</th>
                    <th className="py-2 px-2 w-24 text-right">Transfer Qty</th>
                    <th className="py-2 px-2 w-20 text-center">Unit</th>
                    <th className="py-2 px-2 w-28 text-right">Transfer Rate ({currencySymbol})</th>
                    <th className="py-2 px-3 w-32 text-right">Valuation ({currencySymbol})</th>
                    <th className="py-2 px-2 w-12 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lines.map((line, index) => {
                    const currentStock = line.itemCode
                      ? getItemStockForBranch(line.itemCode, fromBranchId)
                      : 0;
                    const isExceeding = line.itemCode && line.qty > currentStock;

                    return (
                      <tr key={index} className="hover:bg-slate-50/70 transition">
                        <td className="py-2 px-3 text-center text-slate-400 font-bold">{index + 1}</td>
                        <td className="py-2 px-3">
                          <SearchableItemSelect
                            items={items}
                            value={line.itemName}
                            onSelect={it => handleItemSelect(index, it)}
                            placeholder="Type to search product or barcode..."
                            className="w-full"
                          />
                        </td>
                        <td className="py-2 px-2 text-right font-mono font-bold text-slate-600">
                          {line.itemCode ? currentStock : '-'}
                        </td>
                        <td className="py-2 px-2 text-right">
                          <input
                            type="number"
                            min="1"
                            value={line.qty || ''}
                            onChange={e => handleQtyChange(index, Number(e.target.value))}
                            className={`w-full px-2 py-1 rounded-lg border font-mono font-bold text-right outline-none ${
                              isExceeding
                                ? 'border-amber-400 bg-amber-50 text-amber-900 focus:ring-1 focus:ring-amber-400'
                                : 'border-slate-300 bg-white text-slate-900 focus:border-indigo-500'
                            }`}
                          />
                          {isExceeding && (
                            <span className="text-[9px] font-bold text-amber-700 block">
                              Low stock
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-center font-bold text-slate-600 text-xs">
                          {line.unit || 'Pcs'}
                        </td>
                        <td className="py-2 px-2 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.rate ?? ''}
                            onChange={e => handleRateChange(index, Number(e.target.value))}
                            className="w-full px-2 py-1 rounded-lg border border-slate-300 bg-white font-mono font-bold text-right text-slate-900 outline-none focus:border-indigo-500"
                          />
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-black text-slate-900">
                          {(line.amount || 0).toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeLine(index)}
                            title="Remove row"
                            className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Bottom Narration & Summary */}
            <div className="p-3.5 bg-slate-50 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Narration / Transfer Purpose
                </label>
                <input
                  type="text"
                  value={narration}
                  onChange={e => setNarration(e.target.value)}
                  placeholder="e.g. Weekly stock replenishment for retail branch..."
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 outline-none focus:border-indigo-500 text-xs"
                />
              </div>

              <div className="flex flex-col sm:flex-row items-end sm:items-center justify-end gap-4">
                <div className="text-right">
                  <div className="text-[11px] font-bold text-slate-500">
                    Total Items: <span className="text-slate-900 font-black">{lines.filter(l => l.itemCode).length}</span> | Qty:{' '}
                    <span className="text-slate-900 font-black">{totalQty}</span>
                  </div>
                  <div className="text-sm font-black text-indigo-700">
                    Total Value: {currencySymbol}{' '}
                    {totalValuation.toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-3 py-2 rounded-lg border border-slate-300 bg-white font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer text-xs"
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSubmit(false)}
                    className="px-4 py-2 rounded-lg bg-indigo-600 font-extrabold text-white hover:bg-indigo-700 transition cursor-pointer shadow-xs text-xs flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{transferMode === 'challan' ? 'Dispatch Challan' : 'Post Transfer'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSubmit(true)}
                    className="px-3 py-2 rounded-lg bg-slate-900 font-extrabold text-white hover:bg-slate-800 transition cursor-pointer shadow-xs text-xs flex items-center gap-1.5"
                    title="Save and Print Challan"
                  >
                    <Printer className="h-4 w-4" />
                    <span>Print Slip</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Register Tab: List of all transfers */
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
          {/* Filters Bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <div className="relative flex-1">
                <Search className="h-4 w-4 text-slate-400 absolute left-2.5 top-2" />
                <input
                  type="text"
                  value={searchRegister}
                  onChange={e => setSearchRegister(e.target.value)}
                  placeholder="Search by Transfer No, Branch, Item, or Vehicle..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold text-slate-500">Status:</span>
              {(['all', 'in_transit', 'received', 'completed', 'cancelled'] as const).map(st => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    statusFilter === st
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st === 'all'
                    ? 'All'
                    : st === 'in_transit'
                    ? 'In-Transit'
                    : st === 'received'
                    ? 'Received'
                    : st === 'completed'
                    ? 'Completed'
                    : 'Cancelled'}
                </button>
              ))}
            </div>
          </div>

          {/* Transfers Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600 text-[11px] font-bold">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Transfer / Challan No</th>
                  <th className="py-2.5 px-3">Type / Mode</th>
                  <th className="py-2.5 px-3">From (Source)</th>
                  <th className="py-2.5 px-3">To (Destination)</th>
                  <th className="py-2.5 px-2 text-right">Items / Qty</th>
                  <th className="py-2.5 px-3 text-right">Value ({currencySymbol})</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTransfers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <ArrowRightLeft className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                      <p className="font-bold">No stock transfers found</p>
                      <p className="text-[11px]">Record inter-branch stock transfers to see them here.</p>
                    </td>
                  </tr>
                ) : (
                  filteredTransfers.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-2.5 px-3 font-medium text-slate-700">
                        {formatDateDMY(t.date)}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                        {t.transferNo}
                        {t.vehicleNo && (
                          <span className="block text-[10px] text-slate-500 font-mono">
                            🚚 {t.vehicleNo}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            t.transferMode === 'challan'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                          }`}
                        >
                          {t.transferMode === 'challan' ? 'Transfer Challan' : 'Direct Voucher'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-800">
                        {t.fromBranchName}
                        {t.fromGodownName && (
                          <span className="block text-[10px] font-normal text-slate-500">
                            🏢 {t.fromGodownName}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-800">
                        {t.toBranchName}
                        {t.toGodownName && (
                          <span className="block text-[10px] font-normal text-slate-500">
                            🏢 {t.toGodownName}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-right font-bold text-slate-700">
                        {t.items.length} items / <span className="font-mono">{t.totalQty}</span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                        {(t.totalAmount || 0).toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black ${
                            t.status === 'completed' || t.status === 'received'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : t.status === 'in_transit'
                              ? 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {t.status === 'in_transit' && <Truck className="h-3 w-3" />}
                          {t.status === 'completed'
                            ? 'Completed'
                            : t.status === 'in_transit'
                            ? 'In-Transit'
                            : t.status === 'received'
                            ? 'Received'
                            : 'Cancelled'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {t.status === 'in_transit' && (
                            <button
                              type="button"
                              onClick={() => {
                                setReceivingTransfer(t);
                                setReceivedBy('Storekeeper');
                                setReceiveNotes('');
                              }}
                              className="px-2 py-1 rounded-md bg-emerald-600 text-white font-bold text-[11px] hover:bg-emerald-700 transition cursor-pointer flex items-center gap-1 shadow-2xs"
                              title="Receive Goods at Destination Branch"
                            >
                              <FileCheck2 className="h-3.5 w-3.5" />
                              <span>Receive</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setViewingTransfer(t)}
                            className="p-1 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
                            title="View / Print Slip"
                          >
                            <Printer className="h-4 w-4" />
                          </button>
                          {t.status === 'in_transit' && (
                            <button
                              type="button"
                              onClick={() => handleCancelTransfer(t)}
                              className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                              title="Cancel & Reverse Transfer"
                            >
                              <Ban className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Receive Goods Confirmation Modal */}
      {receivingTransfer && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-4 border border-slate-200 text-xs space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
                <FileCheck2 className="h-4.5 w-4.5" />
              </div>
              <div>
                <h2 className="font-black text-slate-900 text-sm">
                  Acknowledge Inward Receipt
                </h2>
                <p className="text-[11px] text-slate-500 font-medium">
                  Challan No: <strong className="text-slate-900">{receivingTransfer.transferNo}</strong>
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">From Branch:</span>
                <span className="font-bold text-slate-800">{receivingTransfer.fromBranchName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">To Destination:</span>
                <span className="font-bold text-emerald-800">{receivingTransfer.toBranchName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Quantity:</span>
                <span className="font-mono font-bold text-slate-900">{receivingTransfer.totalQty} Units</span>
              </div>
              {receivingTransfer.vehicleNo && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Vehicle No:</span>
                  <span className="font-mono font-bold text-slate-800">{receivingTransfer.vehicleNo}</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Received By (Storekeeper / Manager Name) *
              </label>
              <input
                type="text"
                value={receivedBy}
                onChange={e => setReceivedBy(e.target.value)}
                placeholder="Name of receiver"
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-800 outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Receipt Verification Notes
              </label>
              <input
                type="text"
                value={receiveNotes}
                onChange={e => setReceiveNotes(e.target.value)}
                placeholder="e.g. All cartons received in good condition, seal intact"
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-800 outline-none focus:border-indigo-500"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setReceivingTransfer(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReceipt}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white font-extrabold hover:bg-emerald-700 transition cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Confirm &amp; Add Stock</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Slip Preview Modal */}
      {viewingTransfer && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-5 border border-slate-200 text-xs space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-base font-black text-slate-900">
                  {viewingTransfer.transferMode === 'challan'
                    ? 'INTER-BRANCH GOODS TRANSFER CHALLAN'
                    : 'STOCK TRANSFER VOUCHER'}
                </h2>
                <p className="text-[11px] text-slate-500 font-bold">
                  {config?.CompanyName || 'High Density ERP System'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition cursor-pointer flex items-center gap-1 shadow-2xs"
                >
                  <Printer className="h-4 w-4" />
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewingTransfer(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>
                <p className="text-slate-500 font-medium">Challan / Voucher No:</p>
                <p className="font-mono font-black text-slate-900 text-sm">{viewingTransfer.transferNo}</p>
                <p className="text-slate-500 font-medium mt-1">Date:</p>
                <p className="font-bold text-slate-800">{formatDateDMY(viewingTransfer.date)}</p>
              </div>
              <div className="text-right">
                <p className="text-slate-500 font-medium">From:</p>
                <p className="font-bold text-slate-900">{viewingTransfer.fromBranchName}</p>
                <p className="text-slate-500 font-medium mt-1">To:</p>
                <p className="font-bold text-emerald-800">{viewingTransfer.toBranchName}</p>
              </div>
            </div>

            {viewingTransfer.vehicleNo && (
              <div className="bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 grid grid-cols-3 gap-2">
                <div>
                  <span className="text-slate-500 font-medium">Vehicle Reg:</span>
                  <span className="font-mono font-bold text-slate-800 block">{viewingTransfer.vehicleNo}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Driver Name:</span>
                  <span className="font-bold text-slate-800 block">{viewingTransfer.driverName || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Driver Phone:</span>
                  <span className="font-bold text-slate-800 block">{viewingTransfer.driverPhone || '-'}</span>
                </div>
              </div>
            )}

            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-300 text-slate-700 font-bold text-[11px]">
                  <th className="py-1.5 px-2">#</th>
                  <th className="py-1.5 px-2">Item Code</th>
                  <th className="py-1.5 px-2">Description</th>
                  <th className="py-1.5 px-2 text-right">Qty</th>
                  <th className="py-1.5 px-2 text-center">Unit</th>
                  <th className="py-1.5 px-2 text-right">Rate</th>
                  <th className="py-1.5 px-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {viewingTransfer.items.map((it, idx) => (
                  <tr key={idx}>
                    <td className="py-1.5 px-2 text-slate-400">{idx + 1}</td>
                    <td className="py-1.5 px-2 font-mono font-bold text-slate-700">{it.itemCode}</td>
                    <td className="py-1.5 px-2 font-bold text-slate-900">{it.itemName}</td>
                    <td className="py-1.5 px-2 text-right font-mono font-bold">{it.qty}</td>
                    <td className="py-1.5 px-2 text-center text-slate-600">{it.unit}</td>
                    <td className="py-1.5 px-2 text-right font-mono">{(it.rate || 0).toFixed(2)}</td>
                    <td className="py-1.5 px-2 text-right font-mono font-bold">{(it.amount || 0).toFixed(2)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-300 font-black">
                  <td colSpan={3} className="py-2 px-2 text-right uppercase">Total:</td>
                  <td className="py-2 px-2 text-right font-mono">{viewingTransfer.totalQty}</td>
                  <td></td>
                  <td></td>
                  <td className="py-2 px-2 text-right font-mono">
                    {currencySymbol} {(viewingTransfer.totalAmount || 0).toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>

            {viewingTransfer.narration && (
              <p className="text-slate-600 italic">Note: {viewingTransfer.narration}</p>
            )}

            <div className="pt-8 grid grid-cols-2 gap-8 text-center text-slate-500 text-[11px]">
              <div className="border-t border-slate-300 pt-1">
                Dispatched By (Source Storekeeper)
              </div>
              <div className="border-t border-slate-300 pt-1">
                Received &amp; Verified By (Destination Storekeeper)
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
