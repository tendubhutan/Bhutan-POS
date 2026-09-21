import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Config, Item, BarcodeQueueItem, ItemBatch } from '../types';
import JsBarcode from 'jsbarcode';
import { Search, Printer, Trash2, Plus, Tag, LayoutGrid, Layers, Calendar, Edit3, X, Check, Filter } from 'lucide-react';

interface BarcodePrintingProps {
  config: Config;
  items: Item[];
  initialQueue?: BarcodeQueueItem[];
}

const SAVED_BARCODE_SETTINGS_KEY = 'pos_barcode_sticker_settings';

export type PriceDisplayFormat = 'label_and_symbol' | 'label_only' | 'symbol_only' | 'price_only';

interface SavedBarcodeSettings {
  rollUp: number;
  widthMm: number;
  heightMm: number;
  gapMm?: number;
  showBorder?: boolean;
  showCompany: boolean;
  showName: boolean;
  showPrice: boolean;
  showWholesalePrice?: boolean;
  barcodeHeightMm?: number;
  addGstToPrice: boolean;
  priceLabel: 'MRP' | 'Sale Price' | 'Price';
  priceFormat?: PriceDisplayFormat;
  showCodeTxt: boolean;
  showBatch?: boolean;
  showExpDate?: boolean;
  showMfgDate?: boolean;
}

export const formatPriceDisplay = (
  priceLabel: string,
  currSym: string,
  printedPrice: number,
  format: PriceDisplayFormat = 'label_and_symbol'
): string => {
  const priceNum = printedPrice.toFixed(2);
  switch (format) {
    case 'label_only':
      return `${priceLabel} ${priceNum}`;
    case 'symbol_only':
      return `${currSym} ${priceNum}`;
    case 'price_only':
      return `${priceNum}`;
    case 'label_and_symbol':
    default:
      return `${priceLabel}: ${currSym} ${priceNum}`;
  }
};

const loadSavedBarcodeSettings = (): SavedBarcodeSettings => {
  try {
    const raw = localStorage.getItem(SAVED_BARCODE_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        rollUp: typeof parsed.rollUp === 'number' ? parsed.rollUp : 3,
        widthMm: typeof parsed.widthMm === 'number' ? parsed.widthMm : 34,
        heightMm: typeof parsed.heightMm === 'number' ? parsed.heightMm : 22,
        gapMm: typeof parsed.gapMm === 'number' ? parsed.gapMm : 2,
        showBorder: typeof parsed.showBorder === 'boolean' ? parsed.showBorder : true,
        showCompany: typeof parsed.showCompany === 'boolean' ? parsed.showCompany : false,
        showName: typeof parsed.showName === 'boolean' ? parsed.showName : true,
        showPrice: typeof parsed.showPrice === 'boolean' ? parsed.showPrice : true,
        showWholesalePrice: typeof parsed.showWholesalePrice === 'boolean' ? parsed.showWholesalePrice : false,
        barcodeHeightMm: typeof parsed.barcodeHeightMm === 'number' ? parsed.barcodeHeightMm : 7,
        addGstToPrice: typeof parsed.addGstToPrice === 'boolean' ? parsed.addGstToPrice : true,
        priceLabel: parsed.priceLabel || 'Sale Price',
        priceFormat: parsed.priceFormat || 'label_only',
        showCodeTxt: typeof parsed.showCodeTxt === 'boolean' ? parsed.showCodeTxt : true,
        showBatch: typeof parsed.showBatch === 'boolean' ? parsed.showBatch : true,
        showExpDate: typeof parsed.showExpDate === 'boolean' ? parsed.showExpDate : true,
        showMfgDate: typeof parsed.showMfgDate === 'boolean' ? parsed.showMfgDate : false,
      };
    }
  } catch (e) {
    console.error('Error loading barcode settings:', e);
  }
  return {
    rollUp: 3,
    widthMm: 34,
    heightMm: 22,
    gapMm: 2,
    showBorder: true,
    showCompany: false,
    showName: true,
    showPrice: true,
    showWholesalePrice: false,
    barcodeHeightMm: 7,
    addGstToPrice: true,
    priceLabel: 'Sale Price',
    priceFormat: 'label_only',
    showCodeTxt: true,
    showBatch: true,
    showExpDate: true,
    showMfgDate: false,
  };
};

// Helper to scale item name font size dynamically based on name length and sticker width
const getItemNameFontSize = (itemName: string, baseFontNm: number, widthMm: number) => {
  const len = (itemName || '').length;
  const widthFactor = Math.max(0.7, widthMm / 38);

  if (len <= 14) {
    return Math.max(5.5, Math.round(baseFontNm * 10) / 10);
  } else if (len <= 22) {
    return Math.max(4.8, Math.round(baseFontNm * 0.85 * widthFactor * 10) / 10);
  } else if (len <= 32) {
    return Math.max(4.2, Math.round(baseFontNm * 0.72 * widthFactor * 10) / 10);
  } else if (len <= 45) {
    return Math.max(3.8, Math.round(baseFontNm * 0.60 * widthFactor * 10) / 10);
  } else {
    return Math.max(3.5, Math.round(baseFontNm * 0.50 * widthFactor * 10) / 10);
  }
};

// Subcomponent to render preview cards with individual barcode SVGs
const StickerPreviewCard: React.FC<{
  sample: BarcodeQueueItem;
  config: Config;
  widthMm: number;
  heightMm: number;
  showCompany: boolean;
  showName: boolean;
  showPrice: boolean;
  showWholesalePrice: boolean;
  showCodeTxt: boolean;
  showBorder?: boolean;
  showBatch?: boolean;
  showExpDate?: boolean;
  showMfgDate?: boolean;
  priceLabel: string;
  priceFormat: PriceDisplayFormat;
  printedPrice: number;
  printedWholesalePrice: number;
  currSym: string;
  barcodeHeightMm: number;
}> = ({
  sample,
  config,
  widthMm,
  heightMm,
  showCompany,
  showName,
  showPrice,
  showWholesalePrice,
  showCodeTxt,
  showBorder = true,
  showBatch = true,
  showExpDate = true,
  showMfgDate = false,
  priceLabel,
  priceFormat,
  printedPrice,
  printedWholesalePrice,
  currSym,
  barcodeHeightMm,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  // Scaled dimensions for preview
  const cardWidthPx = Math.max(70, Math.min(130, Math.round(widthMm * 2.8)));
  const cardHeightPx = Math.max(50, Math.min(95, Math.round(heightMm * 2.8)));

  const scaleFactor = Math.min(widthMm / 34, heightMm / 22);
  const fontCo = Math.max(6, Math.min(8.5, Math.round(7.5 * scaleFactor)));
  const fontNm = Math.max(6.5, Math.min(9, Math.round(8.5 * scaleFactor)));
  const fontBc = Math.max(6, Math.min(8, Math.round(7.5 * scaleFactor)));
  const fontPr = Math.max(6, Math.min(8.5, Math.round(8.0 * scaleFactor)));
  const fontBatch = Math.max(5.5, Math.min(7.5, Math.round(7.0 * scaleFactor)));

  const itemFontSize = getItemNameFontSize(sample.itemName, fontNm, widthMm);

  const effectiveBarcode = sample.barcode || (sample.batchNo ? `${sample.itemCode}-${sample.batchNo}` : '100001');

  useEffect(() => {
    if (svgRef.current && effectiveBarcode) {
      try {
        const targetBcMm = barcodeHeightMm > 0 ? barcodeHeightMm : (heightMm <= 22 ? 7 : (heightMm <= 25 ? 8 : 11));
        const bcHeight = Math.max(12, Math.min(46, Math.round(targetBcMm * 2.6)));
        const bcWidth = Math.max(0.60, Math.min(1.15, widthMm * 0.024));

        JsBarcode(svgRef.current, effectiveBarcode, {
          format: 'CODE128',
          displayValue: false,
          height: bcHeight,
          width: bcWidth,
          margin: 0
        });
      } catch (e) {
        console.error('JsBarcode preview error', e);
      }
    }
  }, [effectiveBarcode, widthMm, heightMm, barcodeHeightMm, cardHeightPx]);

  const salePriceText = formatPriceDisplay(
    showWholesalePrice ? (priceLabel === 'Sale Price' ? 'Sale' : priceLabel) : priceLabel,
    currSym,
    printedPrice,
    priceFormat
  );
  const wholesalePriceText = formatPriceDisplay(
    showPrice ? 'WS' : 'Wholesale',
    currSym,
    printedWholesalePrice,
    priceFormat
  );

  const hasBatchInfo = ((showBatch && !!sample.batchNo) || (showExpDate && !!sample.expDate) || (showMfgDate && !!sample.mfgDate));

  return (
    <div
      style={{
        width: `${cardWidthPx}px`,
        height: `${cardHeightPx}px`,
        padding: '2px 3px'
      }}
      className={`bg-white ${showBorder ? 'border border-slate-400' : 'border border-dashed border-slate-300'} rounded-md flex flex-col items-center justify-center text-center shadow-xs overflow-hidden leading-tight flex-shrink-0 box-border`}
    >
      {showCompany && config.CompanyName && (
        <div style={{ fontSize: `${fontCo}px` }} className="font-bold truncate max-w-full text-slate-800 leading-none mb-0.5">
          {config.CompanyName}
        </div>
      )}
      {showName && (
        <div
          style={{
            fontSize: `${itemFontSize}px`,
            lineHeight: 1.05,
            maxHeight: `${itemFontSize * 2.1}px`
          }}
          className="font-bold text-slate-900 text-center w-full break-words overflow-hidden line-clamp-2 mb-0.5"
        >
          {sample.itemName}
          {(sample.size || sample.color) && (
            <span className="block font-semibold text-slate-700 text-[80%]">
              {[sample.size ? `Size: ${sample.size}` : '', sample.color ? `Col: ${sample.color}` : ''].filter(Boolean).join(' | ')}
            </span>
          )}
        </div>
      )}

      {/* Batch & Expiry Tag line */}
      {hasBatchInfo && (
        <div
          style={{ fontSize: `${fontBatch}px` }}
          className="font-mono font-bold text-slate-800 leading-none w-full truncate flex items-center justify-center gap-1 my-0.5"
        >
          {showBatch && sample.batchNo && (
            <span className="bg-slate-100 text-slate-800 px-0.5 py-0.2 rounded border border-slate-300">
              B:{sample.batchNo}
            </span>
          )}
          {showExpDate && sample.expDate && (
            <span className="bg-amber-50 text-amber-900 px-0.5 py-0.2 rounded border border-amber-300">
              Exp:{sample.expDate}
            </span>
          )}
          {showMfgDate && sample.mfgDate && (
            <span className="bg-emerald-50 text-emerald-900 px-0.5 py-0.2 rounded border border-emerald-300">
              Mfg:{sample.mfgDate}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center justify-center w-full overflow-hidden leading-none">
        <svg ref={svgRef} className="max-w-full max-h-full block" />
      </div>
      {showCodeTxt && (
        <div style={{ fontSize: `${fontBc}px` }} className="font-mono font-bold text-slate-700 leading-none tracking-tight mt-0.5">
          {effectiveBarcode}
        </div>
      )}
      {(showPrice || showWholesalePrice) && (
        <div
          style={{ fontSize: `${fontPr}px` }}
          className={`font-extrabold text-slate-900 whitespace-nowrap leading-none ${showCodeTxt ? 'mt-1' : 'mt-0.5'} flex items-center justify-center gap-1 max-w-full overflow-hidden`}
        >
          {showPrice && <span>{salePriceText}</span>}
          {showPrice && showWholesalePrice && <span className="text-slate-400 font-normal">|</span>}
          {showWholesalePrice && <span className="text-indigo-800">{wholesalePriceText}</span>}
        </div>
      )}
    </div>
  );
};

export const BarcodePrinting: React.FC<BarcodePrintingProps> = ({ config, items, initialQueue }) => {
  const [queue, setQueue] = useState<BarcodeQueueItem[]>([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'batches' | 'variants'>('all');

  // Load saved barcode settings from localStorage
  const [savedSettings] = useState(loadSavedBarcodeSettings);

  // Roll Layout settings (1-Up, 2-Up, 3-Up, 4-Up)
  const [rollUp, setRollUp] = useState<number>(savedSettings.rollUp);
  const [widthMm, setWidthMm] = useState<number>(savedSettings.widthMm);
  const [heightMm, setHeightMm] = useState<number>(savedSettings.heightMm);
  const [gapMm, setGapMm] = useState<number>(savedSettings.gapMm ?? (savedSettings.rollUp > 1 ? 2 : 0));
  const [showBorder, setShowBorder] = useState<boolean>(savedSettings.showBorder ?? true);

  // Sticker Content Options
  const [showCompany, setShowCompany] = useState<boolean>(savedSettings.showCompany);
  const [showName, setShowName] = useState<boolean>(savedSettings.showName);
  const [showPrice, setShowPrice] = useState<boolean>(savedSettings.showPrice);
  const [showWholesalePrice, setShowWholesalePrice] = useState<boolean>(savedSettings.showWholesalePrice ?? false);
  const [barcodeHeightMm, setBarcodeHeightMm] = useState<number>(savedSettings.barcodeHeightMm ?? (savedSettings.heightMm <= 22 ? 7 : (savedSettings.heightMm <= 25 ? 8 : 11)));
  const [addGstToPrice, setAddGstToPrice] = useState<boolean>(savedSettings.addGstToPrice);
  const [priceLabel, setPriceLabel] = useState<'MRP' | 'Sale Price' | 'Price'>(savedSettings.priceLabel);
  const [priceFormat, setPriceFormat] = useState<PriceDisplayFormat>(savedSettings.priceFormat || 'label_only');
  const [showCodeTxt, setShowCodeTxt] = useState<boolean>(savedSettings.showCodeTxt);
  const [showBatch, setShowBatch] = useState<boolean>(savedSettings.showBatch ?? true);
  const [showExpDate, setShowExpDate] = useState<boolean>(savedSettings.showExpDate ?? true);
  const [showMfgDate, setShowMfgDate] = useState<boolean>(savedSettings.showMfgDate ?? false);

  // Modal / Inline batch edit state
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editBatchForm, setEditBatchForm] = useState<{
    batchNo: string;
    expDate: string;
    mfgDate: string;
    barcode: string;
  }>({ batchNo: '', expDate: '', mfgDate: '', barcode: '' });

  // Automatically save barcode settings to localStorage on change
  useEffect(() => {
    const settingsToSave: SavedBarcodeSettings = {
      rollUp,
      widthMm,
      heightMm,
      gapMm,
      showBorder,
      showCompany,
      showName,
      showPrice,
      showWholesalePrice,
      barcodeHeightMm,
      addGstToPrice,
      priceLabel,
      priceFormat,
      showCodeTxt,
      showBatch,
      showExpDate,
      showMfgDate,
    };
    try {
      localStorage.setItem(SAVED_BARCODE_SETTINGS_KEY, JSON.stringify(settingsToSave));
    } catch (e) {
      console.error('Error saving barcode settings:', e);
    }
  }, [
    rollUp,
    widthMm,
    heightMm,
    gapMm,
    showBorder,
    showCompany,
    showName,
    showPrice,
    showWholesalePrice,
    barcodeHeightMm,
    addGstToPrice,
    priceLabel,
    priceFormat,
    showCodeTxt,
    showBatch,
    showExpDate,
    showMfgDate,
  ]);

  // Initialize initial queue if passed (e.g. from Purchase Entry or Sales Invoice)
  useEffect(() => {
    if (initialQueue && initialQueue.length > 0) {
      setQueue(initialQueue.map(q => {
        const matchedItem = items.find(i => i['Item Code'] === q.itemCode);
        const matchedBatch = matchedItem?.batches?.find(b => b.id === q.batchId || b.batchNo === q.batchNo);
        const resolvedBatchNo = q.batchNo || matchedBatch?.batchNo;
        const effectiveBatchBarcode = matchedBatch?.barcode || (resolvedBatchNo ? (matchedItem?.Barcode ? `${matchedItem.Barcode}-${resolvedBatchNo}` : `${q.itemCode}-${resolvedBatchNo}`) : '');
        return {
          ...q,
          barcode: q.barcode || effectiveBatchBarcode || matchedItem?.Barcode || '100001',
          wholesaleRate: (q.wholesaleRate !== undefined && q.wholesaleRate > 0)
            ? q.wholesaleRate
            : Number(matchedBatch?.wholesaleRate || matchedItem?.['Wholesale Rate'] || (matchedItem as any)?.wholesaleRate || (matchedItem as any)?.wholesalePrice || 0),
          batchNo: resolvedBatchNo,
          expDate: q.expDate || matchedBatch?.expDate,
          mfgDate: q.mfgDate || matchedBatch?.mfgDate,
          batchId: q.batchId || matchedBatch?.id
        };
      }));
    }
  }, [initialQueue, items]);

  // Handle Up preset selection
  const handleRollUpChange = (up: number) => {
    setRollUp(up);
    if (up === 1) { setWidthMm(50); setHeightMm(30); setGapMm(0); setBarcodeHeightMm(11); }
    else if (up === 2) { setWidthMm(38); setHeightMm(25); setGapMm(2); setBarcodeHeightMm(8); }
    else if (up === 3) { setWidthMm(34); setHeightMm(22); setGapMm(2); setBarcodeHeightMm(7); }
    else if (up === 4) { setWidthMm(25); setHeightMm(15); setGapMm(1.5); setBarcodeHeightMm(5); }
  };

  // Expanded items taking into account both Batches and Variants!
  const expandedItems = useMemo(() => {
    const result: (Item & {
      batchNo?: string;
      expDate?: string;
      mfgDate?: string;
      batchId?: string;
      variantId?: string;
    })[] = [];

    for (const item of items) {
      const hasBatches = item.batches && item.batches.length > 0;
      const isBatchItem = item.maintainBatch === 'Y' || item.isPharmacy === 'Y';
      const hasVariants = item.variants && item.variants.length > 0;

      if (hasBatches) {
        // Expand each batch of the product
        for (const b of (item.batches || [])) {
          const cleanBatchNo = (b.batchNo || 'B-101').trim();
          const batchBc = b.barcode || (item.Barcode ? `${item.Barcode}-${cleanBatchNo}` : `${item['Item Code']}-${cleanBatchNo}`);
          result.push({
            ...item,
            batchNo: cleanBatchNo,
            expDate: b.expDate,
            mfgDate: b.mfgDate,
            batchId: b.id,
            Barcode: batchBc,
            'Purchase Rate': (b.purchaseRate !== undefined && b.purchaseRate > 0) ? b.purchaseRate : item['Purchase Rate'],
            'Sale Rate': (b.saleRate !== undefined && b.saleRate > 0) ? b.saleRate : item['Sale Rate'],
            'Wholesale Rate': (b.wholesaleRate !== undefined && b.wholesaleRate > 0) ? b.wholesaleRate : ((item as any)['Wholesale Rate'] || (item as any)['wholesaleRate']),
            MRP: (b.mrp !== undefined && b.mrp > 0) ? b.mrp : (item.MRP || item['Sale Rate']),
            'Current Stock': b.currentStock !== undefined ? b.currentStock : item['Current Stock']
          });
        }
      } else if (isBatchItem) {
        // Item has Batch-Wise enabled but no batch array entries yet -> Create ready batch item
        const defaultBatchNo = 'B-101';
        const batchBc = item.Barcode ? `${item.Barcode}-${defaultBatchNo}` : `${item['Item Code']}-${defaultBatchNo}`;
        result.push({
          ...item,
          batchNo: defaultBatchNo,
          Barcode: batchBc,
          'Purchase Rate': item['Purchase Rate'],
          'Sale Rate': item['Sale Rate'],
          'Wholesale Rate': (item as any)['Wholesale Rate'] || (item as any)['wholesaleRate'],
          MRP: item.MRP || item['Sale Rate'],
          'Current Stock': item['Current Stock']
        });
      } else if (hasVariants) {
        // Expand each size/color variant
        for (const v of (item.variants || [])) {
          result.push({
            ...item,
            variantId: v.id,
            size: v.size || item.size,
            color: v.color || item.color,
            Barcode: v.barcode || item.Barcode,
            'Purchase Rate': (v.purchaseRate !== undefined && v.purchaseRate > 0) ? v.purchaseRate : item['Purchase Rate'],
            'Sale Rate': (v.saleRate !== undefined && v.saleRate > 0) ? v.saleRate : item['Sale Rate'],
            'Wholesale Rate': (v.wholesaleRate !== undefined && v.wholesaleRate > 0) ? v.wholesaleRate : ((item as any)['Wholesale Rate'] || (item as any)['wholesaleRate']),
            MRP: (v.mrp !== undefined && v.mrp > 0) ? v.mrp : item.MRP,
            'Current Stock': v.currentStock !== undefined ? v.currentStock : item['Current Stock']
          });
        }
      } else {
        result.push(item);
      }
    }
    return result;
  }, [items]);

  // Filtered search list
  const filteredItems = useMemo(() => {
    let list = expandedItems;
    if (filterType === 'batches') {
      list = list.filter(i => !!i.batchNo || i.maintainBatch === 'Y' || i.isPharmacy === 'Y');
    } else if (filterType === 'variants') {
      list = list.filter(i => !!i.size || !!i.color || (i.variants && i.variants.length > 0));
    }

    if (!search.trim()) return list;

    const term = search.toLowerCase();
    return list.filter(i =>
      (i['Item Name'] || '').toLowerCase().includes(term) ||
      (i.Barcode || '').toLowerCase().includes(term) ||
      (i['Item Code'] || '').toLowerCase().includes(term) ||
      (i.batchNo || '').toLowerCase().includes(term) ||
      (i.size || '').toLowerCase().includes(term) ||
      (i.color || '').toLowerCase().includes(term)
    );
  }, [expandedItems, filterType, search]);

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addItemToQueue = (item: (Item & { batchNo?: string; expDate?: string; mfgDate?: string; batchId?: string })) => {
    const cleanBatchNo = item.batchNo ? item.batchNo.trim() : undefined;
    const effectiveBarcode = item.Barcode || (cleanBatchNo ? `${item['Item Code']}-${cleanBatchNo}` : '100001');

    const existingIndex = queue.findIndex(q =>
      q.itemCode === item['Item Code'] &&
      (q.size || '') === (item.size || '') &&
      (q.color || '') === (item.color || '') &&
      (q.batchNo || '') === (cleanBatchNo || '') &&
      (q.barcode || '') === effectiveBarcode
    );

    const wholesaleVal = Number(item['Wholesale Rate'] || (item as any)['wholesaleRate'] || (item as any)['wholesalePrice'] || 0);

    if (existingIndex >= 0) {
      setQueue(queue.map((q, idx) => idx === existingIndex ? { ...q, qty: q.qty + 1 } : q));
    } else {
      setQueue([
        ...queue,
        {
          itemCode: item['Item Code'],
          itemName: item['Item Name'],
          barcode: effectiveBarcode,
          rate: item['Sale Rate'] || 0,
          wholesaleRate: wholesaleVal,
          mrp: item.MRP || item['Sale Rate'] || 0,
          gstPct: item['GST %'] || 0,
          qty: 1,
          size: item.size,
          color: item.color,
          batchNo: cleanBatchNo,
          expDate: item.expDate,
          mfgDate: item.mfgDate,
          batchId: item.batchId
        }
      ]);
    }
    setSearch('');
    setIsSearchOpen(false);
  };

  const addAllItemsToQueue = () => {
    const newItems: BarcodeQueueItem[] = expandedItems.map(item => ({
      itemCode: item['Item Code'],
      itemName: item['Item Name'],
      barcode: item.Barcode || '100001',
      rate: item['Sale Rate'] || 0,
      wholesaleRate: Number(item['Wholesale Rate'] || (item as any)['wholesaleRate'] || (item as any)['wholesalePrice'] || 0),
      mrp: item.MRP || item['Sale Rate'] || 0,
      gstPct: item['GST %'] || 0,
      qty: 1,
      size: item.size,
      color: item.color,
      batchNo: item.batchNo,
      expDate: item.expDate,
      mfgDate: item.mfgDate,
      batchId: item.batchId
    }));
    setQueue(newItems);
  };

  const updateQtyAtIndex = (index: number, qty: number) => {
    setQueue(queue.map((q, idx) => idx === index ? { ...q, qty: Math.max(1, qty) } : q));
  };

  const removeItemAtIndex = (index: number) => {
    setQueue(queue.filter((_, idx) => idx !== index));
  };

  const clearQueue = () => {
    setQueue([]);
  };

  // Open inline batch editing
  const startEditBatch = (index: number) => {
    const q = queue[index];
    setEditingIndex(index);
    setEditBatchForm({
      batchNo: q.batchNo || '',
      expDate: q.expDate || '',
      mfgDate: q.mfgDate || '',
      barcode: q.barcode || ''
    });
  };

  const saveEditBatch = () => {
    if (editingIndex === null) return;
    setQueue(queue.map((q, idx) => {
      if (idx !== editingIndex) return q;
      return {
        ...q,
        batchNo: editBatchForm.batchNo.trim() || undefined,
        expDate: editBatchForm.expDate.trim() || undefined,
        mfgDate: editBatchForm.mfgDate.trim() || undefined,
        barcode: editBatchForm.barcode.trim() || q.barcode
      };
    }));
    setEditingIndex(null);
  };

  // Calculate Printed Price for a Queue Item
  const getPrintedPrice = (item: BarcodeQueueItem) => {
    let base = item.rate;
    const enableGst = String(config.EnableGST) !== 'false';
    if (addGstToPrice && enableGst && item.gstPct > 0) {
      base = base + (base * item.gstPct / 100);
    }
    return Math.round((base + Number.EPSILON) * 100) / 100;
  };

  // Calculate Printed Wholesale Price for a Queue Item
  const getPrintedWholesalePrice = (item: BarcodeQueueItem) => {
    let base = item.wholesaleRate || 0;
    const enableGst = String(config.EnableGST) !== 'false';
    if (addGstToPrice && enableGst && item.gstPct > 0) {
      base = base + (base * item.gstPct / 100);
    }
    return Math.round((base + Number.EPSILON) * 100) / 100;
  };

  const cleanupPrintFrame = () => {
    const oldFrame = document.getElementById('print-barcode-iframe');
    if (oldFrame) {
      try { oldFrame.remove(); } catch {}
    }
  };

  useEffect(() => {
    return () => {
      cleanupPrintFrame();
    };
  }, []);

  const handlePrint = () => {
    if (queue.length === 0) {
      alert('Queue is empty. Search and add items first.');
      return;
    }

    cleanupPrintFrame();

    // Flatten queue according to sticker quantities
    const flatList: BarcodeQueueItem[] = [];
    queue.forEach(q => {
      for (let i = 0; i < q.qty; i++) flatList.push(q);
    });

    // Group into rows of `rollUp` (e.g. 1-Up, 2-Up, 3-Up, 4-Up)
    const rows: BarcodeQueueItem[][] = [];
    for (let i = 0; i < flatList.length; i += rollUp) {
      rows.push(flatList.slice(i, i + rollUp));
    }

    const scaleFactor = Math.min(widthMm / 34, heightMm / 22);
    const fontCo = Math.max(6, Math.round(7.5 * scaleFactor));
    const fontNm = Math.max(6.5, Math.round(8.5 * scaleFactor));
    const fontBc = Math.max(6, Math.round(7.5 * scaleFactor));
    const fontPr = Math.max(6.5, Math.round(8.0 * scaleFactor));
    const fontBatch = Math.max(5.5, Math.round(7.0 * scaleFactor));

    // Target barcode bar height in mm: clean proportion prevents cutting off bottom text
    const targetBcMm = barcodeHeightMm > 0 ? barcodeHeightMm : (heightMm <= 22 ? 7 : (heightMm <= 25 ? 8 : 11));
    const barcodeH = Math.max(12, Math.round(targetBcMm * 3.78));
    const barcodeW = Math.max(0.60, Math.min(1.15, 0.88 * (widthMm / 34)));

    const currSym = config.CurrencySymbol || 'Nu.';

    const actualGapMm = rollUp > 1 ? Math.max(0, gapMm) : 0;
    const totalRowWidthMm = (widthMm * rollUp) + (actualGapMm * (rollUp - 1));

    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Barcode Roll Printing (${rollUp}-Up)</title>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
        <style>
          @page {
            size: ${totalRowWidthMm}mm ${heightMm}mm;
            margin: 0;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          html, body {
            font-family: Arial, sans-serif;
            margin: 0 !important;
            padding: 0 !important;
            width: ${totalRowWidthMm}mm;
            background: #fff;
            color: #000;
          }
          .roll-container {
            display: block;
            margin: 0 !important;
            padding: 0 !important;
            width: ${totalRowWidthMm}mm;
          }
          .roll-row {
            display: flex;
            flex-direction: row;
            align-items: center;
            justify-content: flex-start;
            width: ${totalRowWidthMm}mm;
            height: ${heightMm}mm;
            max-height: ${heightMm}mm;
            min-height: ${heightMm}mm;
            margin: 0 !important;
            padding: 0 !important;
            page-break-after: always;
            break-after: page;
            page-break-inside: avoid;
            break-inside: avoid;
            overflow: hidden;
          }
          .roll-row:last-child {
            page-break-after: auto;
            break-after: auto;
          }
          .label-box {
            width: ${widthMm}mm;
            height: ${heightMm}mm;
            max-height: ${heightMm}mm;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            padding: 0.5mm 1mm;
            text-align: center;
            margin: 0;
            margin-right: ${actualGapMm}mm;
            background: #fff;
            border-radius: 0;
            border: none !important;
            outline: none !important;
            box-shadow: none !important;
            page-break-inside: avoid;
            break-inside: avoid;
            flex-shrink: 0;
          }
          .label-box:last-child {
            margin-right: 0 !important;
          }
          .comp-title {
            font-size: ${fontCo}px;
            font-weight: bold;
            line-height: 1.05;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 100%;
            margin-bottom: 0.3mm;
          }
          .item-title {
            font-weight: bold;
            line-height: 1.05;
            text-align: center;
            word-break: break-word;
            overflow: hidden;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            max-width: 100%;
            margin-bottom: 0.3mm;
          }
          .batch-line {
            font-family: monospace;
            font-size: ${fontBatch}px;
            font-weight: bold;
            line-height: 1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 100%;
            margin-bottom: 0.2mm;
            color: #000;
          }
          .barcode-wrapper {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            overflow: hidden;
            margin: 0;
            padding: 0;
            line-height: 0;
          }
          .barcode-txt {
            font-size: ${fontBc}px;
            font-family: monospace;
            font-weight: bold;
            line-height: 1;
            letter-spacing: 0.5px;
            margin-top: 0.2mm;
          }
          .price-tag {
            font-size: ${fontPr}px;
            font-weight: bold;
            line-height: 1.05;
            white-space: nowrap;
            max-width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 2px;
            margin-top: ${showCodeTxt ? '0.8mm' : '0.3mm'};
          }
          @media print {
            .label-box {
              border: none !important;
              box-shadow: none !important;
              outline: none !important;
            }
            html, body { margin: 0 !important; padding: 0 !important; }
          }
        </style>
      </head>
      <body>
        <div class="roll-container">
    `;

    rows.forEach(rowItems => {
      html += `<div class="roll-row">`;
      rowItems.forEach(x => {
        const printedPrice = getPrintedPrice(x);
        const printedWholesalePrice = getPrintedWholesalePrice(x);
        const randId = Math.random().toString(36).substring(2, 7);

        html += `<div class="label-box" style="border: none !important; outline: none !important; box-shadow: none !important;">`;
        if (showCompany && config.CompanyName) {
          html += `<div class="comp-title">${config.CompanyName}</div>`;
        }
        if (showName) {
          const itemFontSize = getItemNameFontSize(x.itemName, fontNm, widthMm);
          const varTxt = [x.size ? `Size: ${x.size}` : '', x.color ? `Col: ${x.color}` : ''].filter(Boolean).join(' | ');
          html += `<div class="item-title" style="font-size: ${itemFontSize}px; max-height: ${itemFontSize * 2.1}px;">${x.itemName}${varTxt ? `<span style="display:block; font-size:80%; font-weight:600;">${varTxt}</span>` : ''}</div>`;
        }

        // Batch / Expiry details
        const hasBatchLine = ((showBatch && x.batchNo) || (showExpDate && x.expDate) || (showMfgDate && x.mfgDate));
        if (hasBatchLine) {
          const batchPieces = [
            showBatch && x.batchNo ? `B:${x.batchNo}` : '',
            showExpDate && x.expDate ? `Exp:${x.expDate}` : '',
            showMfgDate && x.mfgDate ? `Mfg:${x.mfgDate}` : ''
          ].filter(Boolean).join(' ');
          html += `<div class="batch-line">${batchPieces}</div>`;
        }

        const barcodeVal = x.barcode || (x.batchNo ? `${x.itemCode}-${x.batchNo}` : '100001');

        html += `<div class="barcode-wrapper">`;
        html += `<svg class="barcode-render-svg" data-barcode="${encodeURIComponent(barcodeVal)}" style="max-width: 98%; height: ${barcodeH}px; display: block; margin: 0 auto;"></svg>`;
        html += `</div>`;
        if (showCodeTxt) {
          html += `<div class="barcode-txt">${barcodeVal}</div>`;
        }
        if (showPrice || showWholesalePrice) {
          html += `<div class="price-tag">`;
          if (showPrice) {
            const salePriceText = formatPriceDisplay(
              showWholesalePrice ? (priceLabel === 'Sale Price' ? 'Sale' : priceLabel) : priceLabel,
              currSym,
              printedPrice,
              priceFormat
            );
            html += `<span>${salePriceText}</span>`;
          }
          if (showPrice && showWholesalePrice) {
            html += `<span style="color: #94a3b8; font-weight: normal; margin: 0 1px;">|</span>`;
          }
          if (showWholesalePrice) {
            const wholesalePriceText = formatPriceDisplay(
              showPrice ? 'WS' : 'Wholesale',
              currSym,
              printedWholesalePrice,
              priceFormat
            );
            html += `<span style="color: #1e1b4b;">${wholesalePriceText}</span>`;
          }
          html += `</div>`;
        }
        html += `</div>`;
      });
      html += `</div>`;
    });

    html += `
        </div>
        <script>
          setTimeout(() => {
            document.querySelectorAll('.barcode-render-svg').forEach(el => {
              const rawCode = el.getAttribute('data-barcode');
              const code = rawCode ? decodeURIComponent(rawCode) : '100001';
              try {
                JsBarcode(el, code, { format: "CODE128", displayValue: false, height: ${barcodeH}, width: ${barcodeW}, margin: 0 });
              } catch(e){
                console.error('JsBarcode render error for code:', code, e);
              }
            });
          }, 60);
        </script>
      </body>
      </html>
    `;

    const iframe = document.createElement('iframe');
    iframe.id = 'print-barcode-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    document.body.appendChild(iframe);

    const pri = iframe.contentWindow;
    if (!pri) return;

    pri.document.open();
    pri.document.write(html);
    pri.document.close();

    const handleAfterPrint = () => {
      setTimeout(() => {
        cleanupPrintFrame();
        window.focus();
      }, 100);
    };

    pri.addEventListener('afterprint', handleAfterPrint);

    const handleWindowFocus = () => {
      setTimeout(() => {
        cleanupPrintFrame();
        window.removeEventListener('focus', handleWindowFocus);
      }, 200);
    };

    window.addEventListener('focus', handleWindowFocus);

    setTimeout(() => {
      try {
        pri.focus();
        pri.print();
      } catch (e) {
        console.error('Barcode print iframe exception:', e);
        cleanupPrintFrame();
      }
    }, 450);
  };

  const currSym = config.CurrencySymbol || 'Nu.';

  // Count batch items for filter badge
  const batchItemsCount = useMemo(() => {
    return expandedItems.filter(i => !!i.batchNo || i.maintainBatch === 'Y' || i.isPharmacy === 'Y').length;
  }, [expandedItems]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Tag className="h-6 w-6 text-indigo-600" />
            Barcode Sticker Roll Generator
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Generate and print barcode stickers for Master products, Batch-Wise lots, and Size/Color Variants on thermal rolls
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={addAllItemsToQueue}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50"
          >
            <Plus className="h-4 w-4" />
            Add All Products & Batches
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Search & Queue Table (7 cols) */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <LayoutGrid className="h-4 w-4 text-indigo-600" />
                Print Queue ({queue.reduce((acc, q) => acc + q.qty, 0)} Total Labels)
              </h3>
              {queue.length > 0 && (
                <button
                  onClick={clearQueue}
                  className="text-xs font-bold text-rose-600 hover:underline flex items-center gap-1"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Clear Queue
                </button>
              )}
            </div>

            {/* Quick Filter Bar */}
            <div className="flex items-center gap-1.5 mb-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => {
                  setFilterType('all');
                  setIsSearchOpen(true);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                  filterType === 'all'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Items ({expandedItems.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilterType('batches');
                  setIsSearchOpen(true);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                  filterType === 'batches'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                💊 Batch-Wise ({batchItemsCount})
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilterType('variants');
                  setIsSearchOpen(true);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                  filterType === 'variants'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-purple-50 text-purple-800 border border-purple-200 hover:bg-purple-100'
                }`}
              >
                Variants (Size/Color)
              </button>
            </div>

            {/* Search Input */}
            <div ref={searchRef} className="relative mb-3">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search product name, batch no (e.g. B-101), or barcode to add to queue..."
                value={search}
                onFocus={() => setIsSearchOpen(true)}
                onChange={e => {
                  setSearch(e.target.value);
                  setIsSearchOpen(true);
                }}
                className="w-full h-9 pl-9 pr-8 rounded-xl border border-slate-300 text-xs font-medium outline-none focus:border-indigo-500"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setIsSearchOpen(false);
                  }}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              {isSearchOpen && (search.trim() || filterType !== 'all') && (
                <div className="absolute left-0 right-0 top-full mt-1 z-20 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
                  {filteredItems.length === 0 ? (
                    <div className="p-3 text-xs text-slate-400 text-center italic">
                      No matching products or batches found {search ? `for "${search}"` : ''}
                    </div>
                  ) : (
                    filteredItems.map((item, idx) => (
                      <div
                        key={`${item['Item Code']}_${item.batchNo || ''}_${item.size || ''}_${item.color || ''}_${idx}`}
                        onClick={() => addItemToQueue(item)}
                        className="p-2.5 text-xs hover:bg-indigo-50 cursor-pointer border-b border-slate-100 flex justify-between items-center transition"
                      >
                        <div className="space-y-0.5">
                          <div className="font-bold text-slate-800 flex items-center gap-1.5 flex-wrap">
                            <span>{item['Item Name']}</span>
                            {item.batchNo && (
                              <span className="px-1.5 py-0.2 text-[10px] bg-emerald-100 text-emerald-900 font-extrabold rounded border border-emerald-300 flex items-center gap-0.5">
                                💊 Batch: {item.batchNo}
                              </span>
                            )}
                            {item.expDate && (
                              <span className="px-1.5 py-0.2 text-[10px] bg-amber-100 text-amber-900 font-bold rounded border border-amber-300">
                                📅 Exp: {item.expDate}
                              </span>
                            )}
                            {item.size && (
                              <span className="px-1.5 py-0.2 text-[10px] bg-purple-100 text-purple-900 font-bold rounded">
                                Size: {item.size}
                              </span>
                            )}
                            {item.color && (
                              <span className="px-1.5 py-0.2 text-[10px] bg-pink-100 text-pink-900 font-bold rounded">
                                Color: {item.color}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 flex items-center gap-2">
                            <span>Sale: <strong>{currSym} {item['Sale Rate']}</strong></span>
                            <span>|</span>
                            <span>GST: {item['GST %'] || 0}%</span>
                            {item['Current Stock'] !== undefined && (
                              <>
                                <span>|</span>
                                <span className="text-slate-600 font-medium">Stock: {item['Current Stock']}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                            BC: {item.Barcode || (item.batchNo ? `${item['Item Code']}-${item.batchNo}` : '100001')}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Print Queue Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[11px] border-b border-slate-200">
                    <th className="py-2.5 px-3 text-left">Product / Batch Details</th>
                    <th className="py-2.5 px-3 text-left">Barcode</th>
                    <th className="py-2.5 px-3 text-right">Selling Rate</th>
                    {showWholesalePrice && (
                      <th className="py-2.5 px-3 text-right text-indigo-800">Wholesale Rate</th>
                    )}
                    <th className="py-2.5 px-3 text-center">Sticker Qty</th>
                    <th className="py-2.5 px-3 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {queue.length === 0 ? (
                    <tr>
                      <td colSpan={showWholesalePrice ? 6 : 5} className="py-10 text-center text-slate-400 italic">
                        Queue is empty. Search products / batches above or click "Add All Products & Batches".
                      </td>
                    </tr>
                  ) : (
                    queue.map((q, qIdx) => {
                      const printedPrice = getPrintedPrice(q);
                      const printedWholesale = getPrintedWholesalePrice(q);
                      const isEditing = editingIndex === qIdx;

                      return (
                        <tr key={`${q.itemCode}_${q.batchNo || ''}_${q.size || ''}_${q.color || ''}_${qIdx}`} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-slate-800 flex items-center gap-1.5 flex-wrap">
                              <span>{q.itemName}</span>
                              {q.gstPct > 0 && (
                                <span className="text-[10px] text-slate-500 font-normal">
                                  ({q.gstPct}% GST)
                                </span>
                              )}
                            </div>

                            {/* Batch & Variant Badges */}
                            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                              {q.batchNo && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 text-[10px] bg-emerald-100 text-emerald-900 font-bold rounded border border-emerald-300">
                                  💊 B.No: {q.batchNo}
                                </span>
                              )}
                              {q.expDate && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 text-[10px] bg-amber-100 text-amber-900 font-bold rounded border border-amber-300">
                                  📅 Exp: {q.expDate}
                                </span>
                              )}
                              {q.mfgDate && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 text-[10px] bg-teal-100 text-teal-900 font-bold rounded border border-teal-300">
                                  Mfg: {q.mfgDate}
                                </span>
                              )}
                              {q.size && (
                                <span className="bg-purple-100 text-purple-900 border border-purple-200 px-1 py-0.2 text-[10px] font-bold rounded">
                                  Size: {q.size}
                                </span>
                              )}
                              {q.color && (
                                <span className="bg-pink-100 text-pink-900 border border-pink-200 px-1 py-0.2 text-[10px] font-bold rounded">
                                  Color: {q.color}
                                </span>
                              )}

                              {/* Quick Edit Batch Button */}
                              <button
                                type="button"
                                onClick={() => isEditing ? setEditingIndex(null) : startEditBatch(qIdx)}
                                className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-0.5 underline ml-1"
                              >
                                <Edit3 className="w-2.5 h-2.5" />
                                {q.batchNo ? 'Edit Batch' : 'Add Batch'}
                              </button>
                            </div>

                            {/* Inline Edit Batch Form */}
                            {isEditing && (
                              <div className="mt-2 p-2 rounded-lg bg-indigo-50/80 border border-indigo-200 grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs">
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-700">Batch No</label>
                                  <input
                                    type="text"
                                    value={editBatchForm.batchNo}
                                    placeholder="e.g. B-101"
                                    onChange={e => setEditBatchForm({ ...editBatchForm, batchNo: e.target.value })}
                                    className="w-full h-7 px-1.5 rounded border border-slate-300 bg-white font-medium text-xs outline-none"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-700">Exp Date</label>
                                  <input
                                    type="text"
                                    value={editBatchForm.expDate}
                                    placeholder="YYYY-MM-DD"
                                    onChange={e => setEditBatchForm({ ...editBatchForm, expDate: e.target.value })}
                                    className="w-full h-7 px-1.5 rounded border border-slate-300 bg-white font-medium text-xs outline-none"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-700">Batch Barcode</label>
                                  <input
                                    type="text"
                                    value={editBatchForm.barcode}
                                    placeholder="Barcode"
                                    onChange={e => setEditBatchForm({ ...editBatchForm, barcode: e.target.value })}
                                    className="w-full h-7 px-1.5 rounded border border-slate-300 bg-white font-mono text-xs outline-none"
                                  />
                                </div>
                                <div className="flex items-end gap-1">
                                  <button
                                    type="button"
                                    onClick={saveEditBatch}
                                    className="h-7 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-xs flex items-center gap-0.5"
                                  >
                                    <Check className="w-3 h-3" /> Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingIndex(null)}
                                    className="h-7 px-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-xs"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-indigo-600">{q.barcode}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                            {currSym} {printedPrice.toFixed(2)}
                          </td>
                          {showWholesalePrice && (
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-800">
                              {currSym} {printedWholesale.toFixed(2)}
                            </td>
                          )}
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="number"
                              min="1"
                              value={q.qty !== undefined && q.qty !== null ? q.qty : 1}
                              onChange={e => updateQtyAtIndex(qIdx, Number(e.target.value))}
                              className="w-16 h-8 text-center rounded-lg border border-slate-300 font-bold text-xs outline-none focus:border-indigo-500"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button onClick={() => removeItemAtIndex(qIdx)} className="text-slate-400 hover:text-rose-600 p-1">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="pt-2 text-xs text-slate-500 flex justify-between items-center border-t border-slate-100">
            <span>Total Sticker Items: <strong>{queue.length}</strong></span>
            <span>Total Printed Labels: <strong className="text-indigo-600 text-sm">{queue.reduce((acc, q) => acc + q.qty, 0)}</strong></span>
          </div>
        </div>

        {/* Right Column: Roll Settings, Price Options & Sticker Preview (5 cols) */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-2">
            Paper Roll Layout & GST Price
          </h3>

          {/* Paper Roll Layout Presets (1-Up, 2-Up, 3-Up, 4-Up) */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="block text-xs font-bold text-slate-700">
                Roll Layout (Stickers Across Roll)
              </label>
              <span className="text-[11px] font-semibold text-indigo-600">
                {rollUp}-Up ({widthMm}x{heightMm}mm)
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
              {[1, 2, 3, 4].map(up => (
                <button
                  key={up}
                  type="button"
                  onClick={() => handleRollUpChange(up)}
                  className={`py-1.5 text-xs font-extrabold rounded-lg transition ${
                    rollUp === up
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {up}-Up
                </button>
              ))}
            </div>
            {/* Quick Presets */}
            <div className="flex flex-wrap gap-1 pt-1">
              <button
                type="button"
                onClick={() => { setRollUp(3); setWidthMm(34); setHeightMm(22); setGapMm(2); setBarcodeHeightMm(7); }}
                className={`text-[11px] px-2 py-0.5 rounded-md font-semibold border transition ${
                  widthMm === 34 && heightMm === 22 && rollUp === 3
                    ? 'bg-indigo-50 border-indigo-400 text-indigo-700 font-bold'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                34×22 mm (3-Up)
              </button>
              <button
                type="button"
                onClick={() => { setRollUp(2); setWidthMm(38); setHeightMm(25); setGapMm(2); setBarcodeHeightMm(8); }}
                className={`text-[11px] px-2 py-0.5 rounded-md font-semibold border transition ${
                  widthMm === 38 && heightMm === 25 && rollUp === 2
                    ? 'bg-indigo-50 border-indigo-400 text-indigo-700 font-bold'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                38×25 mm (2-Up)
              </button>
              <button
                type="button"
                onClick={() => { setRollUp(1); setWidthMm(50); setHeightMm(25); setGapMm(0); setBarcodeHeightMm(9); }}
                className={`text-[11px] px-2 py-0.5 rounded-md font-semibold border transition ${
                  widthMm === 50 && heightMm === 25 && rollUp === 1
                    ? 'bg-indigo-50 border-indigo-400 text-indigo-700 font-bold'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                50×25 mm (1-Up)
              </button>
            </div>
          </div>

          {/* Roll Dimensions & Barcode Bar Height */}
          <div className="space-y-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div>
                <label className="block font-bold text-slate-600 mb-1">Sticker Width (mm)</label>
                <input
                  type="number"
                  value={widthMm}
                  onChange={e => setWidthMm(Number(e.target.value))}
                  className="w-full h-8 rounded-lg border border-slate-300 px-2 font-bold bg-white outline-none"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-600 mb-1">Sticker Height (mm)</label>
                <input
                  type="number"
                  value={heightMm}
                  onChange={e => setHeightMm(Number(e.target.value))}
                  className="w-full h-8 rounded-lg border border-slate-300 px-2 font-bold bg-white outline-none"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-600 mb-1">Column Gap (mm)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="10"
                  value={gapMm}
                  onChange={e => setGapMm(Number(e.target.value))}
                  className="w-full h-8 rounded-lg border border-slate-300 px-2 font-bold bg-white outline-none disabled:bg-slate-100 disabled:text-slate-400"
                  disabled={rollUp <= 1}
                  title="Horizontal gap between stickers in a row"
                />
              </div>
            </div>

            {/* Barcode Height Control */}
            <div className="pt-1 border-t border-slate-200/80">
              <div className="flex justify-between items-center mb-1">
                <label className="font-bold text-slate-700">Barcode Bar Height:</label>
                <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]">
                  {barcodeHeightMm} mm
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="5"
                  max="14"
                  step="1"
                  value={barcodeHeightMm}
                  onChange={e => setBarcodeHeightMm(Number(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                For 22mm height stickers, 6–7mm bar height leaves plenty of space for batch and rate lines.
              </p>
            </div>
          </div>

          {/* GST Price & Print Options */}
          <div className="space-y-2.5 border-t border-slate-100 pt-3">
            {/* Add GST Checkbox */}
            <label className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between cursor-pointer">
              <div className="text-xs">
                <span className="block font-bold text-emerald-950">Add GST to Price</span>
                <span className="text-[11px] text-emerald-800">Includes GST % directly in the printed sticker rate</span>
              </div>
              <input
                type="checkbox"
                checked={addGstToPrice}
                onChange={e => setAddGstToPrice(e.target.checked)}
                className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="space-y-1">
                <label className="block font-semibold text-slate-600">Price Label Header</label>
                <select
                  value={priceLabel}
                  onChange={e => setPriceLabel(e.target.value as any)}
                  className="w-full h-8 rounded-lg border border-slate-300 px-2 font-semibold outline-none bg-white"
                >
                  <option value="Price">Price</option>
                  <option value="Sale Price">Sale Price</option>
                  <option value="MRP">MRP</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-slate-600">Price Format on Label</label>
                <select
                  value={priceFormat}
                  onChange={e => setPriceFormat(e.target.value as PriceDisplayFormat)}
                  className="w-full h-8 rounded-lg border border-slate-300 px-2 font-semibold outline-none bg-white text-indigo-900"
                >
                  <option value="label_only">Price Only ({priceLabel} 500)</option>
                  <option value="symbol_only">Currency Only ({currSym} 500)</option>
                  <option value="label_and_symbol">Both ({priceLabel}: {currSym} 500)</option>
                  <option value="price_only">Amount Only (500.00)</option>
                </select>
              </div>
            </div>

            {/* Display Field Checkboxes */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                <input type="checkbox" checked={showCompany} onChange={e => setShowCompany(e.target.checked)} className="rounded border-slate-300 text-indigo-600" />
                Company Name
              </label>
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                <input type="checkbox" checked={showName} onChange={e => setShowName(e.target.checked)} className="rounded border-slate-300 text-indigo-600" />
                Product Name
              </label>
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-emerald-800">
                <input type="checkbox" checked={showBatch} onChange={e => setShowBatch(e.target.checked)} className="rounded border-emerald-400 text-emerald-600" />
                Batch No. (B.No)
              </label>
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-amber-800">
                <input type="checkbox" checked={showExpDate} onChange={e => setShowExpDate(e.target.checked)} className="rounded border-amber-400 text-amber-600" />
                Expiry Date (Exp)
              </label>
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-teal-800">
                <input type="checkbox" checked={showMfgDate} onChange={e => setShowMfgDate(e.target.checked)} className="rounded border-teal-400 text-teal-600" />
                Mfg Date
              </label>
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                <input type="checkbox" checked={showPrice} onChange={e => setShowPrice(e.target.checked)} className="rounded border-slate-300 text-indigo-600" />
                Sale Price Tag
              </label>
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                <input type="checkbox" checked={showWholesalePrice} onChange={e => setShowWholesalePrice(e.target.checked)} className="rounded border-slate-300 text-indigo-600" />
                Wholesale Price Tag
              </label>
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                <input type="checkbox" checked={showCodeTxt} onChange={e => setShowCodeTxt(e.target.checked)} className="rounded border-slate-300 text-indigo-600" />
                Barcode Text
              </label>
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                <input type="checkbox" checked={showBorder} onChange={e => setShowBorder(e.target.checked)} className="rounded border-slate-300 text-indigo-600" />
                Sticker Border
              </label>
            </div>
          </div>

          {/* Roll Strip Preview Box */}
          <div className="space-y-1.5 border-t border-slate-100 pt-3">
            <div className="flex justify-between items-center text-xs font-bold text-slate-700">
              <span>Paper Roll Preview ({rollUp}-Up)</span>
              <span className="text-[10px] text-slate-500 font-mono">
                {widthMm}×{heightMm}mm {rollUp > 1 ? `(${gapMm}mm gap)` : ''}
              </span>
            </div>

            <div className="p-3 rounded-xl border border-slate-200 bg-slate-100 flex items-center justify-center min-h-[130px] overflow-x-auto">
              {queue.length === 0 ? (
                <span className="text-xs text-slate-400 italic">Add items to preview sticker roll</span>
              ) : (
                <div
                  className="flex items-center bg-slate-200 p-2 rounded border border-slate-300"
                  style={{ gap: `${Math.max(3, Math.round(gapMm * 2.8))}px` }}
                >
                  {Array.from({ length: rollUp }).map((_, idx) => {
                    const sample = queue[idx % queue.length];
                    const printedPrice = getPrintedPrice(sample);
                    const printedWholesalePrice = getPrintedWholesalePrice(sample);

                    return (
                      <StickerPreviewCard
                        key={idx}
                        sample={sample}
                        config={config}
                        widthMm={widthMm}
                        heightMm={heightMm}
                        showCompany={showCompany}
                        showName={showName}
                        showPrice={showPrice}
                        showWholesalePrice={showWholesalePrice}
                        showCodeTxt={showCodeTxt}
                        showBorder={showBorder}
                        showBatch={showBatch}
                        showExpDate={showExpDate}
                        showMfgDate={showMfgDate}
                        priceLabel={priceLabel}
                        priceFormat={priceFormat}
                        printedPrice={printedPrice}
                        printedWholesalePrice={printedWholesalePrice}
                        currSym={currSym}
                        barcodeHeightMm={barcodeHeightMm}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handlePrint}
            disabled={queue.length === 0}
            className="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold text-xs sm:text-sm hover:bg-emerald-700 disabled:opacity-50 transition flex items-center justify-center gap-2 shadow-xs"
          >
            <Printer className="h-4 w-4" />
            Print Roll Stickers ({rollUp}-Up)
          </button>
        </div>
      </div>
    </div>
  );
};
