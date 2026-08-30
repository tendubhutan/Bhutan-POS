import React, { useState, useRef, useEffect } from 'react';
import { focusNextOutsideGrid } from '../utils/domUtils';
import { Config, Item, Ledger, CartLine, BarcodeQueueItem } from '../types';
import { saveSalesInvoice, deleteSalesInvoice, getVoucherDetails, saveLedger } from '../services/storageService';
import { Plus, Trash2, ChevronDown, ChevronUp, Maximize2, Minimize2, CheckCircle2, UserPlus, ShoppingBag, Tag, Printer, FileText } from 'lucide-react';
import { SerialModal } from './SerialModal';
import { ThermalReceiptModal } from './ThermalReceiptModal';
import { SalesInvoice } from '../types';
import { SearchableLedgerSelect } from './SearchableLedgerSelect';
import { SearchableItemSelect } from './SearchableItemSelect';
import { handleGridKeyDown } from '../utils/gridKeyboardNav';
import { QuickItemModal } from './QuickItemModal';
import { QuickLedgerModal } from './QuickLedgerModal';
import { DrillModal } from './DrillModal';

interface SalesInvoiceEntryProps {
  config: Config;
  items: Item[];
  ledgers: Ledger[];
  onDataRefresh: () => void;
  onOpenNewItemModal: (onSelect?: (item: Item) => void) => void;
  onOpenNewLedgerModal: (group?: string, onSelect?: (name: string) => void) => void;
  initialVoucherTarget?: { voucherNo: string; timestamp: number } | null;
  onPrintBarcodes?: (queue: BarcodeQueueItem[]) => void;
}

export const SalesInvoiceEntry: React.FC<SalesInvoiceEntryProps> = ({
  config,
  items,
  ledgers,
  onDataRefresh,
  onOpenNewItemModal,
  onOpenNewLedgerModal,
  onPrintBarcodes,
  initialVoucherTarget
}) => {
  const [customerName, setCustomerName] = useState('');
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
  const [billNo, setBillNo] = useState('');
  const [orderNo, setOrderNo] = useState('');
  const [orderDate, setOrderDate] = useState('');
  const [deliveryNoteNo, setDeliveryNoteNo] = useState('');
  
  
  const [editingBillNo, setEditingBillNo] = useState<string | null>(null);
  const [savedInvoice, setSavedInvoice] = useState<any>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);

  const getDefaultTerms = (cfg: Config) => {
    if (Array.isArray(cfg.PredefinedTermsList) && cfg.PredefinedTermsList.length > 0) {
      return cfg.PredefinedTermsList
        .map((t: any) => (typeof t === 'string' ? t : (t.terms || t.title || '')))
        .filter(Boolean)
        .join('\n');
    }
    return cfg.FooterTerms || '';
  };

  const [termsAndConditions, setTermsAndConditions] = useState<string>(() => getDefaultTerms(config));

  // Discount settings
  const showItemDiscount = String(config.EnableItemDiscount) !== 'false';
  const showBillDiscount = String(config.EnableBillDiscount) !== 'false';
  const [billDiscount, setBillDiscount] = useState<number | ''>('');
  
  const getLineDiscountAmt = (line: CartLine) => {
    if (!showItemDiscount) return 0;
    const rawDisc = Number(line.discount) || 0;
    const isPercent = line.discountType === 'percent' || config.ItemDiscountType === 'percent';
    if (isPercent) {
      return ((Number(line.qty) || 0) * (Number(line.rate) || 0) * rawDisc) / 100;
    }
    return rawDisc;
  };
  

  useEffect(() => {
    if (initialVoucherTarget && initialVoucherTarget.voucherNo) {
      const details = getVoucherDetails(initialVoucherTarget.voucherNo);
      if (details) {
        const inv = details.header as any;
        const newCart = (inv.items || []).map((it: any) => ({
          itemCode: it['Item Code'],
          itemName: it['Item Name'],
          description: it.description || it['Item Description'] || '',
          lineDescription: it.lineDescription || '',
          qty: it.Qty || 1,
          rate: it.Rate || 0,
          discount: it.Discount || 0,
          unit: it.Unit || 'Pcs',
          gstPct: it['GST %'] || 0,
          gstAmt: it['GST Amount'] || 0,
          zeroRated: it['Zero Rated (Y/N)'] === 'Y',
          serials: it['Serial Numbers'] ? it['Serial Numbers'].split(',').map((s: string)=>s.trim()).filter(Boolean) : []
        }));
        setCart(newCart);
        
        const c = inv.customer || inv.supplier;
        if (c) {
          if (typeof c === 'object') {
            setCustomerName(c.ledger || c.name || '');
          } else {
            setCustomerName(c);
          }
        }

        setBillNo(inv.invoiceNo || inv.billNo || '');
        if (inv.date) {
           const d = new Date(inv.date);
           if (!isNaN(d.getTime())) setBillDate(d.toISOString().split('T')[0]);
        }
        if (inv.additionalExpenses) {
          setAdditionalExpenses(inv.additionalExpenses);
        } else {
          setAdditionalExpenses([]);
        }
        if (inv.discount !== undefined || inv.billDiscount !== undefined) {
          setBillDiscount(inv.discount ?? inv.billDiscount ?? '');
        } else {
          setBillDiscount('');
        }
        if (inv.termsAndConditions !== undefined) {
          setTermsAndConditions(inv.termsAndConditions || '');
        } else {
          setTermsAndConditions(getDefaultTerms(config));
        }
        setEditingBillNo(inv.invoiceNo || inv.billNo);
      }
    }
  }, [initialVoucherTarget]);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  useEffect(() => {
    if (cart.length > 0 && customerName) {
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
  const [drillModalState, setDrillModalState] = useState<{ type: 'stock' | 'ledger' | null; targetId: string | null }>({
    type: null,
    targetId: null
  });

  const billDateRef = useRef<HTMLInputElement>(null);
  const billNoRef = useRef<HTMLInputElement>(null);
  const itemInputRef = useRef<HTMLInputElement>(null);

  const showSerials = String(config.EnableSerials) === 'true';

  const selectedCustomerObj = ledgers.find(l => l['Ledger Name'] === customerName);
  const isCustomerGstExempted = Boolean(
    selectedCustomerObj?.['GST Exempted'] === 'Y' ||
    selectedCustomerObj?.['GST Type'] === 'Exempted'
  );

  const round2 = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;

  const getGridNavOpts = (idx: number, field: 'qty' | 'rate' | 'disc' | 'gst') => ({
    prefix: 'sale',
    idx,
    field,
    totalRows: cart.length,
    searchPickerId: 'sale-fast-item-picker',
    hasDiscount: showItemDiscount,
    hasGst: !isCustomerGstExempted && String(cart[idx]?.zeroRated).toUpperCase() !== 'Y',
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
    onSaveVoucher: handleSaveInvoice,
    dateInputId: 'sale-date-input'
  });

  // Global Keyboard Shortcuts (F2 Accept/Save, Ctrl+A Accept/Save, F7/Ctrl+I Item/Ledger Info)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + A or F2: Accept and Save Invoice
      const isCtrlA = (e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A');
      const isF2 = e.key === 'F2';
      if (isCtrlA || isF2) {
        e.preventDefault();
        e.stopPropagation();
        handleSaveInvoice();
        return;
      }

      // F7 or Ctrl+I or Alt+I: View Item Purchase Price / Stock Info or Ledger Details
      const isF7 = e.key === 'F7';
      const isCtrlI = (e.ctrlKey || e.metaKey) && (e.key === 'i' || e.key === 'I');
      const isAltI = e.altKey && (e.key === 'i' || e.key === 'I');
      if (isF7 || isCtrlI || isAltI) {
        e.preventDefault();
        e.stopPropagation();

        // 1. If focused on customer ledger or customer name exists, show ledger report
        if (customerName) {
          setDrillModalState({ type: 'ledger', targetId: customerName });
          return;
        }

        // 2. Or if cart has items, show item info for last / active item
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

      if (e.key === 'Escape') {
        if (serialModalOpen) {
          e.preventDefault();
          e.stopPropagation();
          setSerialModalOpen(false);
          return;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, customerName, billDate, billNo, serialModalOpen]);

  const selectItem = (item: Item, autoAdd: boolean = true) => {
    const qty = 1;
    const rate = Number((item as any)['Sale Rate'] ?? (item as any)['Sales Rate'] ?? item.MRP ?? item['Purchase Rate'] ?? 0);
    
    const isZ = isCustomerGstExempted || String(item['Zero Rated (Y/N)']).toUpperCase() === 'Y';
    const computedGstAmt = isZ ? 0 : round2((qty * rate) * (Number(item['GST %']) || 0) / 100);

    const existingIdx = cart.findIndex(l => l.itemCode === item['Item Code']);
    let updatedCart = [...cart];
    let targetIndex = existingIdx;

    if (existingIdx > -1) {
      updatedCart[existingIdx].qty += qty;
      const gr = updatedCart[existingIdx].qty * updatedCart[existingIdx].rate;
      const z = isCustomerGstExempted || String(updatedCart[existingIdx].zeroRated).toUpperCase() === 'Y';
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
        purchaseRate: item['Purchase Rate'] || 0,
        isSerialized: item['Is Serialized'],
        serials: [],
        gstAmt: computedGstAmt
      };
      updatedCart.push(newLine);
      targetIndex = updatedCart.length - 1;
    }

    setCart(updatedCart);

    if (item['Is Serialized'] === 'Y' && showSerials) {
      setActiveSerialIndex(targetIndex);
      setSerialModalOpen(true);
    } else {
      setTimeout(() => {
        const qtyEl = document.getElementById(`sale-qty-${targetIndex}`) as HTMLInputElement | null;
        if (qtyEl) {
          qtyEl.focus();
          qtyEl.select();
        }
      }, 50);
    }
  };

  const updateCartLine = (index: number, field: 'qty' | 'rate' | 'gstAmt' | 'discount' | 'discountType' | 'lineDescription', val: any) => {
    const updated = [...cart];
    (updated[index] as any)[field] = val;
    
    if (field === 'qty' || field === 'rate' || field === 'discount' || field === 'discountType') {
      const isZ = isCustomerGstExempted || String(updated[index].zeroRated).toUpperCase() === 'Y';
      const lineDisc = getLineDiscountAmt(updated[index]);
      const gr = (updated[index].qty * updated[index].rate) - lineDisc;
      updated[index].gstAmt = isZ ? 0 : round2(Math.max(0, gr) * (Number(updated[index].gstPct) || 0) / 100);
    }

    setCart(updated);
    if (field === 'qty' && updated[index].isSerialized === 'Y' && showSerials) {
      setActiveSerialIndex(index);
      setSerialModalOpen(true);
    }
  };

  const removeCartLine = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };


  const calculateTotals = () => {
    let taxable = 0, zeroRated = 0, gstAmt = 0, rawTotal = 0, itemDiscountTotal = 0;
    cart.forEach(l => {
      const lineDisc = getLineDiscountAmt(l);
      itemDiscountTotal += lineDisc;
      const gross = (Number(l.qty) || 0) * (Number(l.rate) || 0) - lineDisc;
      const isZero = isCustomerGstExempted || String(l.zeroRated).toUpperCase() === 'Y';
      const lineGst = isZero ? 0 : (gross * (Number(l.gstPct) || 0) / 100);
      if (isZero) zeroRated += gross; else taxable += gross;
      gstAmt += lineGst;
      rawTotal += (gross + lineGst);
    });

    const expenses = additionalExpenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
    rawTotal += expenses;

    let discountAmt = 0;
    if (showBillDiscount && billDiscount !== '') {
      const d = Number(billDiscount);
      if (config.BillDiscountType === 'percent') {
        discountAmt = (rawTotal * d) / 100;
      } else {
        discountAmt = d;
      }
    }

    const finalTotal = Math.max(0, rawTotal - discountAmt);
    
    return {
      taxable,
      zeroRated,
      gstAmt,
      subtotal: rawTotal,
      discount: discountAmt,
      itemDiscountTotal,
      total: finalTotal
    };
  };

  const totals = calculateTotals();


  const prepareBarcodeQueue = (): BarcodeQueueItem[] => {
    return cart.map(line => {
      const matchedItem = items.find(i => i['Item Code'] === line.itemCode);
      return {
        itemCode: line.itemCode,
        itemName: line.itemName,
        barcode: matchedItem?.Barcode || '100001',
        rate: matchedItem?.['Sale Rate'] || line.rate,
        mrp: matchedItem?.MRP || matchedItem?.['Sale Rate'] || line.rate,
        gstPct: line.gstPct || Number(matchedItem?.['GST %']) || 0,
        qty: line.qty
      };
    });
  };

  const handlePrintBarcodesDirectly = () => {
    if (cart.length === 0) {
      alert('Invoice cart is empty. Add items first.');
      return;
    }
    const queue = prepareBarcodeQueue();
    if (onPrintBarcodes) {
      onPrintBarcodes(queue);
    }
  };

  const handleSaveInvoice = () => {
    if (cart.length === 0) {
      alert('Cart is empty.');
      return;
    }
    if (!customerName.trim()) {
      alert('Please select or enter a customer.');
      return;
    }

    const customerLedger = ledgers.find(l => l['Ledger Name'] === customerName);
    const queueForBarcode = prepareBarcodeQueue();

    const res = saveSalesInvoice({
      cart,
      customer: {
        ledger: customerLedger ? customerLedger['Ledger Name'] : customerName,
        name: customerName,
        gstNo: customerLedger ? customerLedger['GST No'] : ''
      },
      orderNo: orderNo,
      orderDate: orderDate,
      deliveryNoteNo: deliveryNoteNo,
      billDiscount: (showBillDiscount && billDiscount !== '') ? Number(billDiscount) : 0,
      additionalExpenses: additionalExpenses
        .map(exp => ({ ledger: exp.ledger, amount: Number(exp.amount) || 0 }))
        .filter(exp => exp.ledger && exp.amount > 0),
      termsAndConditions: termsAndConditions || getDefaultTerms(config),
      payment: {
        cash: 0,
        bank1: 0,
        bank2: 0,
        bank1Ledger: config.Bank1Ledger || 'BOB Account',
        bank2Ledger: config.Bank2Ledger || 'BNBL Account'
      },
      notes: billDate ? `Bill Date: ${billDate}` : '',
      invoiceNo: editingBillNo || undefined
    });

    if (!res.ok) {
      alert(res.error || 'Failed to save sales invoice');
      return;
    }

    setSavedInvoice(res as any);
    setShowPrintModal(true);
    setEditingBillNo(null);
    setCart([]);
    setBillNo('');
    setCustomerName('');
    setOrderNo('');
    setOrderDate('');
    setDeliveryNoteNo('');
    setAdditionalExpenses([]);
    setBillDiscount('');
    setTermsAndConditions(getDefaultTerms(config));
    onDataRefresh();

    
  };

  return (
    <div className="flex flex-col h-full min-h-0 space-y-2">
      {/* Header & Quick Summary Bar */}
      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold shadow-xs">
            <ShoppingBag className="h-4.5 w-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-extrabold text-slate-900 leading-tight">Sales Invoice (B2B)</h1>
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
              {config.CurrencySymbol || 'Nu.'} {totals.total.toFixed(2)}
            </div>
          </div>
          <button
            onClick={handleSaveInvoice}
            disabled={cart.length === 0}
            className="px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 disabled:opacity-50 transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
            title="Save Invoice (F2)"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Save [F2]</span>
          </button>
        </div>
      </div>

      {/* Customer & Bill Header Fields */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden transition-all duration-300">
        {isHeaderCollapsed ? (
          <div 
            className="flex items-center justify-between p-3 cursor-pointer hover:bg-indigo-100 transition-colors bg-gradient-to-r from-indigo-50 to-blue-50 border-b-2 border-indigo-200"
            onClick={() => setIsHeaderCollapsed(false)}
            title="Click to expand header details"
          >
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-500 uppercase tracking-widest text-[10px] bg-white px-2 py-0.5 rounded-full shadow-sm">Customer</span>
                <span className="font-extrabold text-indigo-900">{customerName || <span className="text-rose-500">Not Selected</span>}</span>
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
            {isCustomerGstExempted && (
              <div className="mb-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold shadow-2xs">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span>GST Exempted Customer — 0% Tax Applied (Unless Manually Overridden)</span>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-0.5">Customer Ledger *</label>
            <SearchableLedgerSelect
              ledgers={ledgers}
              value={customerName}
              onChange={setCustomerName}
              filterGroups={['Sundry Debtors', 'Cash-in-Hand', 'Bank Accounts']}
              onCreateNew={() => onOpenNewLedgerModal('Sundry Debtors', (name) => setCustomerName(name))}
              onEditLedger={name => {
                const l = ledgers.find(x => x['Ledger Name'] === name);
                if (l) {
                  setLedgerToAlter(l);
                  setShowLedgerAlterModal(true);
                }
              }}
              onShowInfo={name => setDrillModalState({ type: 'ledger', targetId: name })}
              onSaveVoucher={handleSaveInvoice}
              onFocusDate={() => billDateRef.current?.focus()}
              placeholder="Select Customer Ledger"
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
            <label className="block text-[11px] font-bold text-slate-700 mb-0.5">Invoice Date</label>
            <input
              id="sale-date-input"
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
            <label className="block text-[11px] font-bold text-slate-700 mb-0.5">Invoice / Ref No</label>
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

      {/* In-Table Sales Grid Container */}
      <div className="flex-1 min-h-0 flex flex-col rounded-xl border border-slate-200 bg-white shadow-xs relative">
        {/* Header Bar */}
        <div className="px-3 py-2 border-b border-slate-200 bg-white flex items-center justify-between gap-2 shrink-0 relative z-30">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">INVOICE PARTICULARS</h3>
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
                {showItemDiscount && <th className="py-2 px-1 text-right w-24">DISC {config.ItemDiscountType === 'percent' ? '(%)' : '(#)'}</th>}
                <th className="py-2 px-1 text-right w-24">GST</th>
                <th className="py-2 px-2 text-right w-28">AMOUNT</th>
                <th className="py-2 px-1 text-center w-12">ACT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cart.map((line, idx) => {
                const lineDisc = getLineDiscountAmt(line);
                const gr = (line.qty * line.rate) - lineDisc;
                const amt = Math.max(0, gr) + (Number(line.gstAmt) || 0);
                const isZ = isCustomerGstExempted || String(line.zeroRated).toUpperCase() === 'Y';
                
                return (
                  <tr key={idx} className="hover:bg-slate-50/80 transition">
                    <td className="py-1 px-2 align-middle font-medium min-w-[220px]">
                      <SearchableItemSelect
                        id={`sale-item-${idx}`}
                        valueCode={line.itemCode}
                        items={items}
                        placeholder="Select Item / Barcode..."
                        currencySymbol={config.CurrencySymbol || 'Nu.'}
                        priceType="sale"
                        showPrice={true}
                        onEndOfList={(id) => id && focusNextOutsideGrid(id)}
                        onSelect={item => {
                          const qty = line.qty || 1;
                          const rate = Number((item as any)['Sale Rate'] ?? (item as any)['Sales Rate'] ?? item.MRP ?? item['Purchase Rate'] ?? 0);
                          const isZero = isCustomerGstExempted || String(item['Zero Rated (Y/N)']).toUpperCase() === 'Y';
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
                            purchaseRate: item['Purchase Rate'] || 0,
                            isSerialized: item['Is Serialized'],
                            gstAmt: computedGstAmt
                          };
                          setCart(updated);
                          setTimeout(() => {
                            const qtyEl = document.getElementById(`sale-qty-${idx}`) as HTMLInputElement | null;
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
                        onSaveVoucher={handleSaveInvoice}
                        onFocusDate={() => billDateRef.current?.focus()}
                        dropdownPosition="down"
                      />
                    </td>
                    <td className="py-1 px-1 align-middle text-center">
                      <input
                        id={`sale-qty-${idx}`}
                        type="number"
                        min="0.01"
                        step="any"
                        value={line.qty === 0 ? '' : line.qty}
                        onFocus={e => e.target.select()}
                        onKeyDown={e => handleGridKeyDown(e, getGridNavOpts(idx, 'qty'))}
                        onChange={e => updateCartLine(idx, 'qty', e.target.value !== '' ? Number(e.target.value) : '')}
                        className="w-full text-center h-7.5 rounded border border-slate-300 text-xs font-semibold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 outline-none bg-white"
                      />
                    </td>
                    <td className="py-1 px-1 align-middle text-center font-semibold text-slate-600 text-xs">
                      {line.unit || 'Pcs'}
                    </td>
                    <td className="py-1 px-1 align-middle text-right">
                      <input
                        id={`sale-rate-${idx}`}
                        type="number"
                        step="any"
                        value={line.rate === 0 || line.rate === undefined ? '' : line.rate}
                        onFocus={e => e.target.select()}
                        onKeyDown={e => handleGridKeyDown(e, getGridNavOpts(idx, 'rate'))}
                        onChange={e => updateCartLine(idx, 'rate', e.target.value !== '' ? Number(e.target.value) : '')}
                        className="w-full text-right h-7.5 rounded border border-slate-300 px-1 text-xs font-semibold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 outline-none bg-white"
                      />
                    </td>
                    {showItemDiscount && (
                      <td className="py-1 px-1 align-middle text-right">
                        <input
                          id={`sale-disc-${idx}`}
                          type="number"
                          step="any"
                          value={line.discount === 0 || line.discount === undefined ? '' : line.discount}
                          onFocus={e => e.target.select()}
                          onKeyDown={e => handleGridKeyDown(e, getGridNavOpts(idx, 'disc'))}
                          onChange={e => updateCartLine(idx, 'discount', e.target.value !== '' ? Number(e.target.value) : '')}
                          className="w-full text-right h-7.5 rounded border border-slate-300 px-1 text-xs font-semibold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 outline-none bg-white"
                        />
                      </td>
                    )}
                    <td className="py-1 px-1 align-middle text-right">
                      <input
                        id={`sale-gst-${idx}`}
                        type="number"
                        step="any"
                        value={line.gstAmt === 0 || line.gstAmt === undefined ? '' : line.gstAmt}
                        disabled={isZ}
                        onFocus={e => e.target.select()}
                        onKeyDown={e => handleGridKeyDown(e, getGridNavOpts(idx, 'gst'))}
                        onChange={e => updateCartLine(idx, 'gstAmt', e.target.value !== '' ? Number(e.target.value) : '')}
                        className="w-full text-right h-7.5 rounded border border-slate-300 px-1 text-xs font-semibold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 outline-none bg-white disabled:bg-slate-100 disabled:text-slate-400"
                      />
                    </td>
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
              <tr className="bg-indigo-50/20 hover:bg-indigo-50/40 transition border-t border-indigo-100">
                <td className="py-1 px-2 align-middle min-w-[220px]">
                  <SearchableItemSelect
                    id="sale-fast-item-picker"
                    items={items}
                    placeholder="Type Item Name or Scan Barcode..."
                    currencySymbol={config.CurrencySymbol || 'Nu.'}
                    priceType="sale"
                    showPrice={true}
                    onEndOfList={(id) => id && focusNextOutsideGrid(id)}
                        onSelect={item => selectItem(item, true)}
                    autoClearAfterSelect={true}
                    onCreateNew={onOpenNewItemModal}
                    onEditItem={item => {
                      setItemToAlter(item);
                      setShowItemAlterModal(true);
                    }}
                    onShowInfo={item => setDrillModalState({ type: 'stock', targetId: item['Item Code'] || item['Item Name'] })}
                    onSaveVoucher={handleSaveInvoice}
                    onFocusDate={() => billDateRef.current?.focus()}
                    dropdownPosition="down"
                  />
                </td>
                <td className="py-1 px-1 align-middle text-center font-semibold text-slate-400 text-xs">—</td>
                <td className="py-1 px-1 align-middle text-center font-semibold text-slate-400 text-xs">—</td>
                <td className="py-1 px-1 align-middle text-right font-semibold text-slate-400 text-xs">—</td>
                {showItemDiscount && <td className="py-1 px-1 align-middle text-right font-semibold text-slate-400 text-xs">—</td>}
                <td className="py-1 px-1 align-middle text-right font-semibold text-slate-400 text-xs">—</td>
                <td className="py-1 px-2 align-middle text-right font-semibold text-slate-400 text-xs">—</td>
                <td className="py-1 px-1 align-middle text-center font-bold text-indigo-500 text-[10px]">NEW</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Additional Expenses Section (if entries exist) */}
      {additionalExpenses.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 shrink-0">
          {additionalExpenses.map((exp, idx) => (
            <div key={idx} className="flex items-center gap-1.5 bg-white border border-slate-200 rounded p-1 shadow-2xs">
              <div className="flex-1 min-w-0">
                <SearchableLedgerSelect
                  id={`exp-ledger-${idx}`}
                  ledgers={ledgers}
                  value={exp.ledger}
                  onChange={l => {
                    const arr = [...additionalExpenses];
                    arr[idx].ledger = l;
                    setAdditionalExpenses(arr);
                  }}
                  placeholder="Expense Ledger..."
                  onCreateNew={() => onOpenNewLedgerModal('Indirect Expenses', (name) => {
                    const arr = [...additionalExpenses];
                    arr[idx].ledger = name;
                    setAdditionalExpenses(arr);
                  })}
                />
              </div>
              <input
                type="number"
                value={exp.amount === 0 || exp.amount === '' || exp.amount === undefined ? '' : exp.amount}
                onChange={e => {
                  const arr = [...additionalExpenses];
                  arr[idx].amount = e.target.value !== '' ? Number(e.target.value) : '';
                  setAdditionalExpenses(arr);
                }}
                placeholder="Amt"
                className="w-16 text-right h-7 rounded border border-slate-300 px-1 text-xs font-semibold focus:border-indigo-500 outline-none"
              />
              <button
                onClick={() => setAdditionalExpenses(additionalExpenses.filter((_, i) => i !== idx))}
                className="p-1 text-slate-400 hover:text-rose-600"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Footer Bar: Expenses, Discount, Totals & Actions */}
      <div className="bg-white rounded-xl border border-slate-200 p-2 shadow-xs flex flex-wrap items-center justify-between gap-2 shrink-0">
        {/* Left: Lumpsum Discount & Additional Expenses Toggle */}
        <div className="flex items-center gap-2 flex-wrap">
          {showBillDiscount && (
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
              <span className="text-xs font-bold text-slate-700">Bill Disc:</span>
              <input
                type="number"
                placeholder="Disc"
                value={billDiscount === 0 || billDiscount === '' ? '' : billDiscount}
                onChange={e => setBillDiscount(e.target.value !== '' ? Number(e.target.value) : '')}
                className="w-16 text-right h-6.5 rounded border border-slate-300 px-1 text-xs font-bold focus:border-indigo-500 outline-none bg-white"
              />
              <span className="text-[11px] font-bold text-slate-500">
                {config.BillDiscountType === 'percent' ? '%' : (config.CurrencySymbol || 'Nu.')}
              </span>
            </div>
          )}

          <button 
            type="button"
            onClick={() => setAdditionalExpenses([...additionalExpenses, { ledger: '', amount: '' as any }])}
            className="text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-1 rounded-lg flex items-center gap-1 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Addl Charge ({additionalExpenses.length})</span>
          </button>
        </div>

        {/* Right: Summary Pills & Actions */}
        <div className="flex items-center gap-2.5 flex-wrap ml-auto">
          {/* Summary Breakdown Pill */}
          <div className="flex items-center gap-2 bg-slate-950 text-white px-3 py-1.5 rounded-lg text-xs font-mono">
            <div>
              <span className="text-slate-400 text-[10px] mr-1">Taxable:</span>
              <span className="font-bold">{totals.taxable.toFixed(2)}</span>
            </div>
            <span className="text-slate-800">|</span>
            <div>
              <span className="text-indigo-300 text-[10px] mr-1">GST:</span>
              <span className="font-bold text-indigo-200">{totals.gstAmt.toFixed(2)}</span>
            </div>
            {totals.itemDiscountTotal > 0 && (
              <>
                <span className="text-slate-800">|</span>
                <div>
                  <span className="text-emerald-400 text-[10px] mr-1">Item Disc:</span>
                  <span className="font-bold text-emerald-300">-{totals.itemDiscountTotal.toFixed(2)}</span>
                </div>
              </>
            )}
            {totals.discount > 0 && (
              <>
                <span className="text-slate-800">|</span>
                <div>
                  <span className="text-emerald-400 text-[10px] mr-1">Bill Disc:</span>
                  <span className="font-bold text-emerald-300">-{totals.discount.toFixed(2)}</span>
                </div>
              </>
            )}
            <span className="text-slate-800">|</span>
            <div>
              <span className="text-slate-400 text-[10px] mr-1">NET:</span>
              <span className="font-black text-emerald-400 text-sm">{config.CurrencySymbol || 'Nu.'} {totals.total.toFixed(2)}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {editingBillNo && (
              <button
                onClick={() => {
                  if (window.confirm('Are you sure you want to delete this invoice completely?')) {
                    deleteSalesInvoice(editingBillNo);
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
            <button
              onClick={handleSaveInvoice}
              disabled={cart.length === 0}
              className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white font-extrabold text-xs hover:bg-emerald-700 disabled:opacity-50 transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Save [F2]</span>
            </button>
          </div>
        </div>
      </div>

      
      {/* Serial Modal */}
      {activeSerialIndex > -1 && cart[activeSerialIndex] && (
        <SerialModal
          isOpen={serialModalOpen}
          onClose={() => setSerialModalOpen(false)}
          onConfirm={serials => {
            const updated = [...cart];
            updated[activeSerialIndex].serials = serials;
            setCart(updated);
            setSerialModalOpen(false);
            setTimeout(() => document.getElementById('pur-fast-item-picker')?.focus(), 50);
          }}
          requiredQty={cart[activeSerialIndex].qty}
          itemName={cart[activeSerialIndex].itemName}
          initialSerials={cart[activeSerialIndex].serials}
        />
      )}

      {showPrintModal && savedInvoice && (
        <ThermalReceiptModal
          isOpen={showPrintModal}
          onClose={() => setShowPrintModal(false)}
          invoice={savedInvoice}
          config={config}
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
      {drillModalState.type && drillModalState.targetId && (
        <DrillModal
          type={drillModalState.type}
          targetId={drillModalState.targetId}
          config={config}
          onClose={() => setDrillModalState({ type: null, targetId: null })}
          onRefresh={onDataRefresh}
        />
      )}
    </div>
  );
};
