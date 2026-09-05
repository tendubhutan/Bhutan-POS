import React, { useState, useRef, useEffect } from 'react';
import { GlowButton } from './common/GlowButton';
import { focusNextOutsideGrid } from '../utils/domUtils';
import { Config, Item, Ledger, CartLine, Unit, BarcodeQueueItem } from '../types';
import { BankTransactionIdModal } from './BankTransactionIdModal';
import { isBankLedger } from '../utils/ledgerUtils';
import { savePurchaseInvoice, deletePurchaseInvoice, getVoucherDetails, saveLedger, loadJson, STORAGE_KEYS, DEFAULT_UNITS } from '../services/storageService';
import { Plus, Trash2, ChevronDown, ChevronUp, Maximize2, Minimize2, CheckCircle2, UserPlus, ShoppingBag, Tag, Printer, AlertCircle } from 'lucide-react';
import { playSaveSound, playWarningTone } from '../utils/audio';
import { SerialModal } from './SerialModal';
import { SearchableLedgerSelect } from './SearchableLedgerSelect';
import { SearchableItemSelect } from './SearchableItemSelect';
import { handleGridKeyDown } from '../utils/gridKeyboardNav';
import { QuickItemModal } from './QuickItemModal';
import { QuickLedgerModal } from './QuickLedgerModal';
import { AcceptModal } from './AcceptModal';
import { DrillModal } from './DrillModal';

interface PurchaseEntryProps {
  config: Config;
  items: Item[];
  ledgers: Ledger[];
  onDataRefresh: () => void;
  onOpenNewItemModal: (onSelect?: (item: Item) => void) => void;
  onOpenNewLedgerModal: (group?: string, onSelect?: (name: string) => void) => void;
  initialVoucherTarget?: { voucherNo: string; timestamp: number } | null;
  onPrintPurchaseBarcodes?: (queue: BarcodeQueueItem[]) => void;
}

export const PurchaseEntry: React.FC<PurchaseEntryProps> = ({
  config,
  items,
  ledgers,
  onDataRefresh,
  onOpenNewItemModal,
  onOpenNewLedgerModal,
  onPrintPurchaseBarcodes,
  initialVoucherTarget
}) => {
  const [supplierName, setSupplierName] = useState('');
  const [bankTxnNo, setBankTxnNo] = useState<string>('');
  const [bankTxnModalOpen, setBankTxnModalOpen] = useState(false);
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
  const [billNo, setBillNo] = useState('');
  const [isGstMode, setIsGstMode] = useState(true);
  
  const [editingBillNo, setEditingBillNo] = useState<string | null>(null);

  useEffect(() => {
    if (initialVoucherTarget && initialVoucherTarget.voucherNo) {
      const details = getVoucherDetails(initialVoucherTarget.voucherNo);
      if (details && details.type === 'PUR') {
        const inv = details.header as any;
        const newCart = (inv.items || []).map((it: any) => {
          const itemMatch = items.find(i => i['Item Code'] === (it['Item Code'] || it.itemCode));
          const isZeroRated = (it['Zero Rated (Y/N)'] === 'Y' || it.zeroRated === 'Y' || it.zeroRated === true);
          return {
            itemCode: it['Item Code'] || it.itemCode || '',
            itemName: it['Item Name'] || it.itemName || '',
            description: it.description || it['Item Description'] || '',
            lineDescription: it.lineDescription || '',
            qty: Number(it.Qty !== undefined ? it.Qty : (it.qty !== undefined ? it.qty : 1)),
            rate: Number(it.Rate !== undefined ? it.Rate : (it.rate !== undefined ? it.rate : 0)),
            discount: Number(it.Discount !== undefined ? it.Discount : (it.discount !== undefined ? it.discount : 0)),
            discountType: (it['Discount %'] && Number(it['Discount %']) > 0) ? ('percent' as const) : ('flat' as const),
            unit: it.Unit || it.unit || itemMatch?.Unit || 'Pcs',
            gstPct: Number(it['GST %'] !== undefined ? it['GST %'] : (it.gstPct !== undefined ? it.gstPct : (itemMatch?.['GST %'] || 0))),
            gstAmt: Number(it['GST Amount'] !== undefined ? it['GST Amount'] : (it.gstAmt !== undefined ? it.gstAmt : 0)),
            zeroRated: isZeroRated ? ('Y' as const) : ('N' as const),
            purchaseRate: Number(it.purchaseRate || itemMatch?.['Purchase Rate'] || 0),
            isSerialized: (it.isSerialized || itemMatch?.['Is Serialized'] || 'N') as 'Y' | 'N',
            serials: typeof it['Serial Numbers'] === 'string'
              ? it['Serial Numbers'].split(',').map((s: string) => s.trim()).filter(Boolean) 
              : (Array.isArray(it.serials) ? it.serials : [])
          };
        });
        setCart(newCart);

        const hasAnyGst = (inv.items || []).some((it: any) => (Number(it['GST Amount']) > 0 || Number(it['GST %']) > 0));
        const totalGstAmt = Number(inv.gstAmt || 0);
        if (totalGstAmt > 0 || hasAnyGst) {
          setIsGstMode(true);
        } else if (inv.items && inv.items.length > 0) {
          setIsGstMode(false);
        }
        
        if (inv.supplier) {
          if (typeof inv.supplier === 'object') {
            setSupplierName(inv.supplier.ledger || inv.supplier.name || '');
          } else {
            setSupplierName(inv.supplier);
          }
        }

        setBillNo(inv.supplierBillNo || inv.billNo || inv.invoiceNo || '');
        if (inv.date) {
           const d = new Date(inv.date);
           if (!isNaN(d.getTime())) setBillDate(d.toISOString().split('T')[0]);
        }
        if (Array.isArray(inv.additionalExpenses)) {
          setAdditionalExpenses(inv.additionalExpenses);
        }
        setEditingBillNo(inv.billNo || inv.invoiceNo);
      }
    }
  }, [initialVoucherTarget]);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const units = loadJson<Unit[]>(STORAGE_KEYS.UNITS, DEFAULT_UNITS);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
  };
  useEffect(() => {
    if (cart.length > 0 && supplierName) {
      setIsHeaderCollapsed(true);
    } else if (cart.length === 0) {
      setIsHeaderCollapsed(false);
    }
  }, [cart.length]);

  // Grid Entry Fields

  // Serial Modal State
  const [serialModalOpen, setSerialModalOpen] = useState(false);
  const [activeSerialIndex, setActiveSerialIndex] = useState<number>(-1);
  const [additionalExpenses, setAdditionalExpenses] = useState<{ledger: string, amount: number}[]>([]);

  // Alter / Edit Master Modal States
  const [itemToAlter, setItemToAlter] = useState<Item | null>(null);
  const [showItemAlterModal, setShowItemAlterModal] = useState(false);
  const [ledgerToAlter, setLedgerToAlter] = useState<Ledger | null>(null);
  const [showLedgerAlterModal, setShowLedgerAlterModal] = useState(false);

  // Drill Modal Info State (F7 / Ctrl+I / Alt+I)
  const [drillModalState, setDrillModalState] = useState<{ type: 'stock' | 'ledger' | 'voucher' | null; targetId: string | null }>({
    type: null,
    targetId: null
  });

  const billDateRef = useRef<HTMLInputElement>(null);
  const billNoRef = useRef<HTMLInputElement>(null);
  const itemInputRef = useRef<HTMLInputElement>(null);

  const showSerials = String(config.EnableSerials) === 'true';

  const selectedSupplierObj = ledgers.find(l => l['Ledger Name'] === supplierName);
  const isSupplierGstExempted = Boolean(
    selectedSupplierObj?.['GST Exempted'] === 'Y' ||
    selectedSupplierObj?.['GST Type'] === 'Exempted'
  );

  const round2 = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;

  const handleGstModeToggle = (mode: boolean) => {
    setIsGstMode(mode);
    if (!mode) {
      setCart(prev => prev.map(line => ({ ...line, gstAmt: 0 })));
    } else {
      setCart(prev => prev.map(line => {
        const isZ = isSupplierGstExempted || String(line.zeroRated).toUpperCase() === 'Y';
        const gr = line.qty * line.rate;
        return {
          ...line,
          gstAmt: isZ ? 0 : round2(gr * (Number(line.gstPct) || 0) / 100)
        };
      }));
    }
  };

  const getGridNavOpts = (idx: number, field: 'item' | 'qty' | 'rate' | 'disc' | 'gst') => ({
    prefix: 'pur',
    idx,
    field,
    totalRows: cart.length,
    searchPickerId: 'pur-fast-item-picker',
    hasDiscount: false,
    hasGst: isGstMode && !isSupplierGstExempted && String(cart[idx]?.zeroRated).toUpperCase() !== 'Y',
    onDeleteRow: (i: number) => removeCartLine(i),
    onOpenNewItemModal: () => onOpenNewItemModal(),
    onEditItem: (i: number) => {
      const item = items.find(itm => itm['Item Code'] === cart[i]?.itemCode || itm['Item Name'] === cart[i]?.itemName);
      if (item) {
        setItemToAlter(item);
        setShowItemAlterModal(true);
      }
    },
    onShowInfo: (i: number) => {
      const item = items.find(itm => itm['Item Code'] === cart[i]?.itemCode || itm['Item Name'] === cart[i]?.itemName);
      if (item) {
        setDrillModalState({ type: 'stock', targetId: item['Item Code'] || item['Item Name'] });
      }
    },
    onSaveVoucher: handleSavePurchase,
    dateInputId: 'pur-date-input'
  });

  const handlePurchaseBack = (): boolean => {
    if (serialModalOpen) {
      setSerialModalOpen(false);
      return true;
    }
    if (drillModalState?.type) {
      setDrillModalState({ type: null, targetId: null });
      return true;
    }
    return false;
  };

  // Global Keyboard Shortcuts (F2 Accept/Save, Ctrl+A Accept/Save, F7/Ctrl+I Item/Ledger Info, ESC Back)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + A or F2: Accept and Save Purchase
      const isCtrlA = (e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A');
      const isF2 = e.key === 'F2' || e.code === 'F2';
      if (isCtrlA || isF2) {
        e.preventDefault();
        e.stopPropagation();
        handleSavePurchase();
        return;
      }

      // F7 or Ctrl+I or Alt+I: View Item Purchase Price / Stock Info or Ledger Details
      const isF7 = e.key === 'F7';
      const isCtrlI = (e.ctrlKey || e.metaKey) && (e.key === 'i' || e.key === 'I');
      const isAltI = e.altKey && (e.key === 'i' || e.key === 'I');
      if (isF7 || isCtrlI || isAltI) {
        e.preventDefault();
        e.stopPropagation();

        if (supplierName) {
          setDrillModalState({ type: 'ledger', targetId: supplierName });
          return;
        }

        if (cart.length > 0) {
          const lastLine = cart[cart.length - 1];
          const item = items.find(itm => itm['Item Code'] === lastLine.itemCode || itm['Item Name'] === lastLine.itemName);
          if (item) {
            setDrillModalState({ type: 'stock', targetId: item['Item Code'] || item['Item Name'] });
            return;
          }
        }
        return;
      }

      if (e.key === 'Escape') { if (e.defaultPrevented) return;
        const handled = handlePurchaseBack();
        if (handled) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };

    const handleSaveEvent = (e: Event) => {
      e.preventDefault();
      handleSavePurchase();
    };

    const handleBackEvent = (e: Event) => {
      const handled = handlePurchaseBack();
      if (handled) {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('app:save', handleSaveEvent);
    window.addEventListener('app:back', handleBackEvent);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('app:save', handleSaveEvent);
      window.removeEventListener('app:back', handleBackEvent);
    };
  }, [
    cart,
    supplierName,
    billDate,
    billNo,
    serialModalOpen,
    drillModalState,
    isGstMode
  ]);

  const selectItem = (item: Item, autoAdd: boolean = true) => {
    const qty = 1;
    const rate = Number(item['Purchase Rate'] ?? (item as any)['Sale Rate'] ?? item.MRP ?? 0);
    
    const isZ = !isGstMode || isSupplierGstExempted || String(item['Zero Rated (Y/N)']).toUpperCase() === 'Y';
    const computedGstAmt = isZ ? 0 : round2((qty * rate) * (Number(item['GST %']) || 0) / 100);

    const existingIdx = cart.findIndex(l => l.itemCode === item['Item Code']);
    let updatedCart = [...cart];
    let targetIndex = existingIdx;

    if (existingIdx > -1) {
      updatedCart[existingIdx].qty += qty;
      const gr = updatedCart[existingIdx].qty * updatedCart[existingIdx].rate;
      const z = !isGstMode || isSupplierGstExempted || String(updatedCart[existingIdx].zeroRated).toUpperCase() === 'Y';
      updatedCart[existingIdx].gstAmt = z ? 0 : round2(gr * (Number(updatedCart[existingIdx].gstPct) || 0) / 100);
    } else {
      const newLine: CartLine = {
        itemCode: item['Item Code'],
        itemName: item['Item Name'],
        unit: item.Unit || 'Pcs',
        qty,
        rate,
        discount: 0,
        gstPct: Number(item['GST %']) || 0,
        zeroRated: item['Zero Rated (Y/N)'] || 'N',
        purchaseRate: rate,
        isSerialized: item['Is Serialized'],
        serials: [],
        gstAmt: computedGstAmt
      };
      updatedCart.push(newLine);
      targetIndex = updatedCart.length - 1;
    }

    setCart(updatedCart);

    setTimeout(() => {
      const qtyEl = document.getElementById(`pur-qty-${targetIndex}`) as HTMLInputElement | null;
      if (qtyEl) {
        qtyEl.focus();
        qtyEl.select();
      }
    }, 50);
  };

  const updateCartLine = (index: number, field: 'qty' | 'rate' | 'gstAmt' | 'lineDescription', val: any) => {
    const updated = [...cart];
    (updated[index] as any)[field] = val;
    
    if (field === 'qty' || field === 'rate') {
      const isZ = !isGstMode || isSupplierGstExempted || String(updated[index].zeroRated).toUpperCase() === 'Y';
      const gr = updated[index].qty * updated[index].rate;
      updated[index].gstAmt = isZ ? 0 : round2(gr * (Number(updated[index].gstPct) || 0) / 100);
    }

    setCart(updated);
  };

  const removeCartLine = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const totalAmount = cart.reduce((sum, line) => {
    const lineGst = isGstMode ? (Number(line.gstAmt) || 0) : 0;
    return sum + (line.qty * line.rate) + lineGst;
  }, 0);

  const prepareBarcodeQueue = (): BarcodeQueueItem[] => {
    return cart.map(line => {
      const matchedItem = items.find(i => i['Item Code'] === line.itemCode);
      return {
        itemCode: line.itemCode,
        itemName: line.itemName,
        barcode: matchedItem?.Barcode || '100001',
        rate: matchedItem?.['Sale Rate'] || line.rate,
        mrp: matchedItem?.MRP || matchedItem?.['Sale Rate'] || line.rate,
        gstPct: isGstMode ? (line.gstPct || Number(matchedItem?.['GST %']) || 0) : 0,
        qty: line.qty
      };
    });
  };

  const handlePrintBarcodesDirectly = () => {
    if (cart.length === 0) {
      alert('Purchase cart is empty. Add items first.');
      return;
    }
    const queue = prepareBarcodeQueue();
    if (onPrintPurchaseBarcodes) {
      onPrintPurchaseBarcodes(queue);
    }
  };

  const handleSavePurchase = () => {
    if (cart.length === 0) {
      playWarningTone();
      showToast('Cart is empty.', 'error');
      return;
    }
    if (!supplierName.trim()) {
      playWarningTone();
      showToast('Please select or enter a supplier.', 'error');
      return;
    }

    setShowAcceptModal(true);
  };

  const proceedSavePurchase = () => {
    setShowAcceptModal(false);

    const supplierLedger = ledgers.find(l => l['Ledger Name'] === supplierName);
    const queueForBarcode = prepareBarcodeQueue();

    const finalCart = isGstMode ? cart : cart.map(l => ({ ...l, gstPct: 0, gstAmt: 0 }));

    const res = savePurchaseInvoice({
      cart: finalCart,
      supplier: {
        name: supplierName,
        gstNo: supplierLedger?.['GST No'] || '',
        tpnNo: supplierLedger?.['TPN No'] || '',
        address: supplierLedger?.Address || '',
        phone: supplierLedger?.['Contact No'] || ''
      },
      payment: {
        cash: 0,
        bank1: 0,
        bank2: 0,
        bank1Ledger: config.Bank1Ledger || 'BOB Account',
        bank2Ledger: config.Bank2Ledger || 'BNBL Account'
      },
      supplierBillNo: billNo,
      notes: billDate ? `Bill Date: ${billDate}` : '',
      billNo: editingBillNo || undefined,
      date: billDate ? new Date(billDate).toISOString() : undefined,
      isEdit: Boolean(editingBillNo),
    });

    if (!res.ok) {
      playWarningTone();
      showToast(res.error || 'Failed to save purchase invoice', 'error');
      return;
    }

    setEditingBillNo(null);

    setCart([]);
    setSupplierName('');
    setBillNo('');
    playSaveSound();
    onDataRefresh();

    if (confirm('Purchase Invoice saved successfully! Do you want to print Barcode Stickers for received items now?')) {
      if (onPrintPurchaseBarcodes) {
        onPrintPurchaseBarcodes(queueForBarcode);
      }
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 space-y-2">
      <AcceptModal 
        isOpen={showAcceptModal}
        title={editingBillNo ? `Save changes to ${editingBillNo}?` : "Save Purchase Invoice?"}
        onConfirm={proceedSavePurchase}
        onCancel={() => setShowAcceptModal(false)}
      />

      {/* Active Altering Invoice Banner */}
      {editingBillNo && (
        <div className="shrink-0 flex items-center justify-between px-3.5 py-2 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs shadow-2xs">
          <div className="flex items-center gap-2 font-medium">
            <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            <span>Altering Purchase Invoice: <strong className="font-mono font-bold text-amber-950 text-sm">{editingBillNo}</strong></span>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingBillNo(null);
              setCart([]);
              setSupplierName('');
              setBillNo('');
              setBillDate(new Date().toISOString().split('T')[0]);
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-amber-900 font-bold text-[11px] hover:bg-amber-100 transition cursor-pointer shadow-2xs"
          >
            <span>Discard Alteration &amp; New Purchase</span>
          </button>
        </div>
      )}

      {/* Header & Quick Summary Bar */}
      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-xs flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold shadow-xs">
              <ShoppingBag className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-sm sm:text-base font-extrabold text-slate-900 leading-tight">Purchase Entry</h1>
                
                {/* GST / No GST Toggle Button */}
                <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 border border-slate-200">
                  <button
                    type="button"
                    onClick={() => handleGstModeToggle(true)}
                    className={`px-2 py-0.5 rounded text-[11px] font-extrabold transition-all cursor-pointer ${
                      isGstMode
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    With GST
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGstModeToggle(false)}
                    className={`px-2 py-0.5 rounded text-[11px] font-extrabold transition-all cursor-pointer ${
                      !isGstMode
                        ? 'bg-amber-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    No GST
                  </button>
                </div>

                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.2 rounded text-[10px] font-bold">
                  Credit / Cash
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                Continuous Loop Entry (Press <kbd className="bg-slate-100 border border-slate-300 rounded px-1 py-0.2 text-[10px] font-mono font-bold">F2</kbd> to Save)
              </p>
            </div>
          </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Invoice Total</div>
            <div className="text-sm sm:text-base font-black text-emerald-600 font-mono leading-none">
              {config.CurrencySymbol || 'Nu.'} {totalAmount.toFixed(2)}
            </div>
          </div>
          <div className="relative inline-block">
            {toastMsg && (
              <div className={`absolute bottom-full mb-2 right-0 z-[9999] flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold text-white shadow-2xl whitespace-nowrap ${toastMsg.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'} animate-in fade-in slide-in-from-bottom-2`}>
                {toastMsg.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                <span>{toastMsg.text}</span>
                <div className={`absolute top-full right-6 -mt-1 border-4 border-transparent ${toastMsg.type === 'success' ? 'border-t-emerald-600' : 'border-t-rose-600'}`} />
              </div>
            )}
            <GlowButton
              id="pur-save-btn"
              type="button"
              onClick={handleSavePurchase}
              disabled={cart.length === 0}
              variant="emerald"
              size="sm"
              icon={CheckCircle2}
              title="Save Purchase (F2)"
            >
              Save [F2]
            </GlowButton>
          </div>
        </div>
      </div>

      {/* Supplier & Bill Header Fields */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden transition-all duration-300">
        {isHeaderCollapsed ? (
          <div 
            className="flex items-center justify-between p-3 cursor-pointer hover:bg-indigo-100 transition-colors bg-gradient-to-r from-indigo-50 to-blue-50 border-b-2 border-indigo-200"
            onClick={() => setIsHeaderCollapsed(false)}
            title="Click to expand header details"
          >
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-500 uppercase tracking-widest text-[10px] bg-white px-2 py-0.5 rounded-full shadow-sm">Supplier</span>
                <span className="font-extrabold text-indigo-900">{supplierName || <span className="text-rose-500">Not Selected</span>}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-500 uppercase tracking-widest text-[10px] bg-white px-2 py-0.5 rounded-full shadow-sm">Date</span>
                <span className="font-bold text-slate-800">{billDate}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-500 uppercase tracking-widest text-[10px] bg-white px-2 py-0.5 rounded-full shadow-sm">Ref No</span>
                <span className="font-bold text-slate-800">{billNo || '-'}</span>
              </div>
            </div>
            <button className="flex items-center gap-1.5 text-xs font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-wide bg-white px-3 py-1 rounded-lg shadow-sm border border-indigo-100">
              <span>Edit Header</span>
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="p-2.5">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">Invoice Details</h3>
              <button 
                type="button"
                onClick={() => setIsHeaderCollapsed(true)}
                className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-indigo-600 uppercase tracking-wide cursor-pointer transition-colors"
                title="Collapse to save space"
              >
                <span>Collapse</span>
                <ChevronUp className="h-4 w-4" />
              </button>
            </div>
            {isSupplierGstExempted && (
              <div className="mb-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold shadow-2xs">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span>GST Exempted Supplier — 0% Tax Applied (Unless Manually Overridden)</span>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-0.5">Supplier Ledger *</label>
            <SearchableLedgerSelect
              ledgers={ledgers}
              value={supplierName}
              onChange={(val) => {
                setSupplierName(val);
                if (isBankLedger(val, ledgers, config)) {
                  setBankTxnModalOpen(true);
                }
              }}
              filterGroups={['Sundry Creditors', 'Cash-in-Hand', 'Bank Accounts']}
              onCreateNew={() => onOpenNewLedgerModal('Sundry Creditors', (name) => setSupplierName(name))}
              onEditLedger={name => {
                const l = ledgers.find(x => x['Ledger Name'] === name);
                if (l) {
                  setLedgerToAlter(l);
                  setShowLedgerAlterModal(true);
                }
              }}
              onShowInfo={name => setDrillModalState({ type: 'ledger', targetId: name })}
              onSaveVoucher={handleSavePurchase}
              onFocusDate={() => billDateRef.current?.focus()}
              placeholder="Select Supplier Ledger"
              onEnterNext={() => {
                billDateRef.current?.focus();
              }}
              onArrowRight={() => {
                billDateRef.current?.focus();
              }}
              onArrowDown={() => {
                billDateRef.current?.focus();
              }}
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-0.5">Supplier Bill Date</label>
            <input
              id="pur-date-input"
              ref={billDateRef}
              type="date"
              value={billDate}
              onChange={e => setBillDate(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  billNoRef.current?.focus();
                  billNoRef.current?.select();
                } else if (e.key === 'ArrowRight') {
                  e.preventDefault();
                  billNoRef.current?.focus();
                  billNoRef.current?.select();
                }
              }}
              className="w-full h-8.5 rounded-lg border border-slate-300 px-2.5 text-xs font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-0.5">Supplier Bill / Ref No</label>
            <input
              ref={billNoRef}
              type="text"
              value={billNo}
              onChange={e => setBillNo(e.target.value)}
              onFocus={e => e.target.select()}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  document.getElementById('pur-fast-item-picker')?.focus();
                } else if (e.key === 'ArrowLeft') {
                  e.preventDefault();
                  billDateRef.current?.focus();
                }
              }}
              placeholder="e.g. SUP-90812"
              className="w-full h-8.5 rounded-lg border border-slate-300 px-2.5 text-xs font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
            />
          </div>
        </div>
        </div>
        )}
      </div>

      {/* In-Table Purchase Grid Container */}
      <div className="flex-1 min-h-0 flex flex-col rounded-xl border border-slate-200 bg-white shadow-xs relative">
        {/* Header Bar */}
        <div className="px-3 py-2 border-b border-slate-200 bg-white flex items-center justify-between gap-2 shrink-0 relative z-30">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">PURCHASE PARTICULARS</h3>
            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
              {cart.length} line items
            </span>
          </div>
          <span className="text-[11px] text-slate-500 font-medium italic hidden sm:inline">
            Direct In-Table Search: Type or scan barcode inside the Item Name cell
          </span>
        </div>

        {/* Populated Table with Active Bottom Cell Entry Row */}
        <div className="flex-1 min-h-0 overflow-y-auto rounded-b-xl">
          <table className="w-full border-collapse text-xs sm:text-sm">
            <thead className="sticky top-0 z-10 bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase text-[11px] tracking-wider">
              <tr>
                <th className="py-2 px-3 text-left">ITEM DESCRIPTION</th>
                <th className="py-2 px-1 text-center w-20">QTY</th>
                <th className="py-2 px-1 text-center w-16">UNIT</th>
                <th className="py-2 px-1 text-right w-24">RATE</th>
                {isGstMode && <th className="py-2 px-1 text-right w-24">GST</th>}
                <th className="py-2 px-2 text-right w-28">AMOUNT</th>
                <th className="py-2 px-1 text-center w-12">ACT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cart.map((line, idx) => {
                const gr = line.qty * line.rate;
                const lineGst = isGstMode ? (Number(line.gstAmt) || 0) : 0;
                const amt = gr + lineGst;
                const isZ = !isGstMode || isSupplierGstExempted || String(line.zeroRated).toUpperCase() === 'Y';
                
                return (
                  <tr key={idx} className="hover:bg-slate-50/80 transition">
                    <td className="py-1 px-2 align-middle font-medium min-w-[220px]">
                      <SearchableItemSelect
                        variant="grid"
                        id={`pur-item-${idx}`}
                        onEnterNext={() => {
                          setTimeout(() => {
                            const el = document.getElementById(`pur-qty-${idx}`);
                            if (el) { el.focus(); (el as HTMLInputElement).select?.(); }
                          }, 10);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter') return;
                          handleGridKeyDown(e, getGridNavOpts(idx, 'item'));
                        }}
                        valueCode={line.itemCode}
                        items={items}
                        placeholder="Select Item / Barcode..."
                        currencySymbol={config.CurrencySymbol || 'Nu.'}
                        priceType="purchase"
                        showPrice={true}
                        onEndOfList={(id) => id && focusNextOutsideGrid(id)}
                        onSelect={item => {
                          const qty = line.qty || 1;
                          const rate = Number(item['Purchase Rate'] ?? (item as any)['Purchase Price'] ?? item.MRP ?? (item as any)['Sale Rate'] ?? 0);
                          const isZero = !isGstMode || isSupplierGstExempted || String(item['Zero Rated (Y/N)']).toUpperCase() === 'Y';
                          const computedGstAmt = isZero ? 0 : round2((qty * rate) * (Number(item['GST %']) || 0) / 100);

                          const updated = [...cart];
                          updated[idx] = {
                            ...updated[idx],
                            itemCode: item['Item Code'],
                            itemName: item['Item Name'],
                            unit: item.Unit || 'Pcs',
                            rate,
                            gstPct: Number(item['GST %']) || 0,
                            zeroRated: item['Zero Rated (Y/N)'] || 'N',
                            isSerialized: item['Is Serialized'],
                            gstAmt: computedGstAmt
                          };
                          setCart(updated);
                          setTimeout(() => {
                            const qtyEl = document.getElementById(`pur-qty-${idx}`) as HTMLInputElement | null;
                            if (qtyEl) {
                              qtyEl.focus();
                              qtyEl.select();
                            }
                          }, 50);
                        }}
                        onCreateNew={onOpenNewItemModal}
                        onEditItem={item => {
                          setItemToAlter(item);
                          setShowItemAlterModal(true);
                        }}
                        onShowInfo={item => setDrillModalState({ type: 'stock', targetId: item['Item Code'] || item['Item Name'] })}
                        onSaveVoucher={handleSavePurchase}
                        onFocusDate={() => billDateRef.current?.focus()}
                      />
                    </td>
                    <td className="py-1 px-1 align-middle text-center">
                      <input
                        id={`pur-qty-${idx}`}
                        type="number"
                        min="0.01"
                        step="any"
                        value={line.qty}
                        onFocus={e => e.target.select()}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === 'Tab' || e.key === 'ArrowRight') {
                            if (line.isSerialized === 'Y' && showSerials) {
                              e.preventDefault();
                              e.stopPropagation();
                              setActiveSerialIndex(idx);
                              setSerialModalOpen(true);
                              return;
                            }
                          }
                          handleGridKeyDown(e, getGridNavOpts(idx, 'qty'));
                        }}
                        onChange={e => updateCartLine(idx, 'qty', Number(e.target.value))}
                        className="w-full text-center h-7.5 rounded border border-slate-300 text-xs font-semibold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 outline-none bg-white"
                      />
                    </td>
                    <td className="py-1 px-1 align-middle text-center">
                      <select
                        value={line.unit || 'Pcs'}
                        onChange={e => {
                          const val = e.target.value;
                          const updated = [...cart];
                          updated[idx].unit = val;
                          const item = items.find(i => (i['Item Code'] && i['Item Code'] === updated[idx].itemCode) || i['Item Name'] === updated[idx].itemName);
                          if (item) {
                            if (val === item.Unit) {
                              updated[idx].rate = item['Purchase Rate'] || 0;
                            } else if (item.multiUnits) {
                              const mu = item.multiUnits.find(m => m.unit === val);
                              if (mu && mu.purchaseRate) {
                                updated[idx].rate = mu.purchaseRate;
                              }
                            }
                          }
                          setCart(updated);
                        }}
                        className="w-full text-center h-7.5 rounded border border-slate-300 text-xs font-semibold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 outline-none bg-white"
                      >
                        {units.map(u => (
                          <option key={u['Unit Name']} value={u['Unit Name']}>{u.Symbol || u['Unit Name']}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1 px-1 align-middle text-right">
                      <input
                        id={`pur-rate-${idx}`}
                        type="number"
                        step="any"
                        value={line.rate || ''}
                        onFocus={e => e.target.select()}
                        onKeyDown={e => handleGridKeyDown(e, getGridNavOpts(idx, 'rate'))}
                        onChange={e => updateCartLine(idx, 'rate', Number(e.target.value))}
                        className="w-full text-right h-7.5 rounded border border-slate-300 px-1 text-xs font-semibold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 outline-none bg-white"
                      />
                    </td>
                    {isGstMode && (
                      <td className="py-1 px-1 align-middle text-right">
                        <input
                          id={`pur-gst-${idx}`}
                          type="number"
                          step="any"
                          value={line.gstAmt || ''}
                          disabled={isZ}
                          onFocus={e => e.target.select()}
                          onKeyDown={e => handleGridKeyDown(e, getGridNavOpts(idx, 'gst'))}
                          onChange={e => updateCartLine(idx, 'gstAmt', Number(e.target.value))}
                          className="w-full text-right h-7.5 rounded border border-slate-300 px-1 text-xs font-semibold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 outline-none bg-white disabled:bg-slate-100 disabled:text-slate-400"
                        />
                      </td>
                    )}
                    <td className="py-1.5 px-2 align-middle text-right font-bold text-slate-800 font-mono text-xs">
                      {config.CurrencySymbol || 'Nu.'} {amt.toFixed(2)}
                    </td>
                    <td className="py-1.5 px-1 align-middle text-center">
                      <button
                        onClick={() => removeCartLine(idx)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 cursor-pointer transition"
                        title="Remove item"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {/* Active Table Cell Search Row (Tally.Prime Style) */}
              <tr className="bg-indigo-50/50 hover:bg-indigo-100/50 transition border-t border-indigo-100 sticky bottom-0 z-10 shadow-[0_-2px_4px_rgba(0,0,0,0.05)]">
                <td className="py-1 px-2 align-middle min-w-[220px]">
                  <SearchableItemSelect
                    variant="grid"
                    id="pur-fast-item-picker"
                    onInputChange={(val) => { if (val && supplierName) setIsHeaderCollapsed(true); }}
                    items={items}
                    placeholder="+ Type Item Name or Scan Barcode..."
                    currencySymbol={config.CurrencySymbol || 'Nu.'}
                    priceType="purchase"
                    showPrice={true}
                    onEndOfList={(id) => id && focusNextOutsideGrid(id)}
                    onSelect={item => selectItem(item, true)}
                    autoClearAfterSelect={true}
                    onEnterNext={() => focusNextOutsideGrid('pur-fast-item-picker')}
                    onCreateNew={onOpenNewItemModal}
                    onEditItem={item => {
                      setItemToAlter(item);
                      setShowItemAlterModal(true);
                    }}
                    onShowInfo={item => setDrillModalState({ type: 'stock', targetId: item['Item Code'] || item['Item Name'] })}
                    onSaveVoucher={handleSavePurchase}
                    onFocusDate={() => billDateRef.current?.focus()}
                  />
                </td>
                <td className="py-1 px-1 align-middle text-center font-semibold text-slate-400 text-xs">—</td>
                <td className="py-1 px-1 align-middle text-center font-semibold text-slate-400 text-xs">—</td>
                <td className="py-1 px-1 align-middle text-right font-semibold text-slate-400 text-xs">—</td>
                {isGstMode && <td className="py-1 px-1 align-middle text-right font-semibold text-slate-400 text-xs">—</td>}
                <td className="py-1 px-2 align-middle text-right font-semibold text-slate-400 text-xs">—</td>
                <td className="py-1 px-1 align-middle text-center font-bold text-indigo-500 text-[10px]">NEW</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer Bar: Totals & Actions */}
      <div className="bg-white rounded-xl border border-slate-200 p-2 shadow-xs flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
        </div>

        <div className="flex items-center gap-2.5 flex-wrap ml-auto">
          <div className="flex items-center gap-2 bg-slate-950 text-white px-3 py-1.5 rounded-lg text-xs font-mono">
            <div>
              <span className="text-slate-400 text-[10px] mr-1">Total:</span>
              <span className="font-black text-emerald-400 text-sm">{config.CurrencySymbol || 'Nu.'} {totalAmount.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {editingBillNo && (
              <button
                onClick={() => {
                  if (window.confirm('Are you sure you want to delete this purchase invoice completely?')) {
                    deletePurchaseInvoice(editingBillNo);
                    setCart([]);
                    setEditingBillNo(null);
                    onDataRefresh();
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-rose-100 text-rose-700 font-bold text-xs hover:bg-rose-200 transition cursor-pointer"
              >
                Delete
              </button>
            )}
            <button
              onClick={handlePrintBarcodesDirectly}
              disabled={cart.length === 0}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-slate-50 text-slate-700 font-bold text-xs hover:bg-slate-100 disabled:opacity-50 transition flex items-center gap-1 cursor-pointer"
              title="Print barcode stickers"
            >
              <Printer className="h-3.5 w-3.5 text-indigo-600" />
              <span className="hidden sm:inline">Barcodes</span>
            </button>
            <div className="relative inline-block">
              {toastMsg && (
                <div className={`absolute bottom-full mb-2 right-0 z-[9999] flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold text-white shadow-2xl whitespace-nowrap ${toastMsg.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'} animate-in fade-in slide-in-from-bottom-2`}>
                  {toastMsg.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                  <span>{toastMsg.text}</span>
                  <div className={`absolute top-full right-6 -mt-1 border-4 border-transparent ${toastMsg.type === 'success' ? 'border-t-emerald-600' : 'border-t-rose-600'}`} />
                </div>
              )}
              <button
                id="pur-save-btn"
                onClick={handleSavePurchase}
                disabled={cart.length === 0}
                className="focus:ring-[4px] focus:ring-emerald-400/80 focus:ring-offset-1 focus:shadow-[0_0_15px_rgba(52,211,153,0.6)] z-10 relative focus:scale-[1.02] outline-none px-4 py-1.5 rounded-lg bg-emerald-600 text-white font-extrabold text-xs hover:bg-emerald-700 disabled:opacity-50 transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Save Purchase [F2]</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Serial Modal */}
      {activeSerialIndex > -1 && cart[activeSerialIndex] && (
        <SerialModal
          isOpen={serialModalOpen}
          onClose={() => {
            setSerialModalOpen(false);
            const targetIdx = activeSerialIndex;
            setTimeout(() => {
              const rateEl = document.getElementById(`pur-rate-${targetIdx}`) as HTMLInputElement | null;
              if (rateEl) {
                rateEl.focus();
                rateEl.select();
              }
            }, 50);
          }}
          onConfirm={serials => {
            const updated = [...cart];
            updated[activeSerialIndex].serials = serials;
            setCart(updated);
            setSerialModalOpen(false);
            const targetIdx = activeSerialIndex;
            setTimeout(() => {
              const rateEl = document.getElementById(`pur-rate-${targetIdx}`) as HTMLInputElement | null;
              if (rateEl) {
                rateEl.focus();
                rateEl.select();
              }
            }, 50);
          }}
          requiredQty={cart[activeSerialIndex].qty}
          itemName={cart[activeSerialIndex].itemName}
          initialSerials={cart[activeSerialIndex].serials}
        />
      )}

      {/* Alter Item Master Modal */}
      {showItemAlterModal && (
        <QuickItemModal
          isOpen={showItemAlterModal}
          onClose={() => {
            setShowItemAlterModal(false);
            setItemToAlter(null);
          }}
          onSave={saved => {
            onDataRefresh();
            setShowItemAlterModal(false);
            setItemToAlter(null);
          }}
          config={config}
          itemToEdit={itemToAlter}
        />
      )}

      {/* Alter Ledger Master Modal */}
      {showLedgerAlterModal && (
        <QuickLedgerModal
          isOpen={showLedgerAlterModal}
          onClose={() => {
            setShowLedgerAlterModal(false);
            setLedgerToAlter(null);
          }}
          onSave={saved => {
            saveLedger(saved);
            onDataRefresh();
            setShowLedgerAlterModal(false);
            setLedgerToAlter(null);
          }}
          config={config}
          ledgerToEdit={ledgerToAlter}
        />
      )}

      {/* Item Info / Ledger Report Drill Modal */}
      {drillModalState?.type && drillModalState?.targetId && (
        <DrillModal
          type={drillModalState.type}
          targetId={drillModalState.targetId}
          config={config}
          onClose={() => setDrillModalState({ type: null, targetId: null })}
          onRefresh={onDataRefresh}
          onDrillVoucher={refNo => setDrillModalState({ type: 'voucher', targetId: refNo })}
          onDrillLedger={name => setDrillModalState({ type: 'ledger', targetId: name })}
          onDrillStock={code => setDrillModalState({ type: 'stock', targetId: code })}
        />
      )}

      {/* Pop-up modal for Bank Transaction ID / UTR when Bank ledger is selected */}
      <BankTransactionIdModal
        isOpen={bankTxnModalOpen}
        bankLedgerName={supplierName || 'Bank Account'}
        initialValue={bankTxnNo}
        onSave={(newTxnId) => {
          setBankTxnNo(newTxnId);
          setBankTxnModalOpen(false);
          setTimeout(() => {
            document.getElementById('pur-fast-item-picker')?.focus();
          }, 50);
        }}
        onClose={() => {
          setBankTxnModalOpen(false);
          setTimeout(() => {
            document.getElementById('pur-fast-item-picker')?.focus();
          }, 50);
        }}
      />
    </div>
  );
};
