import React, { useState, useEffect, useRef } from 'react';
import { Config, Item, BarcodeQueueItem } from '../types';
import JsBarcode from 'jsbarcode';
import { Search, Printer, Trash2, Plus, Tag, LayoutGrid } from 'lucide-react';

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
  showCompany: boolean;
  showName: boolean;
  showPrice: boolean;
  showWholesalePrice?: boolean;
  barcodeHeightMm?: number;
  addGstToPrice: boolean;
  priceLabel: 'MRP' | 'Sale Price' | 'Price';
  priceFormat?: PriceDisplayFormat;
  showCodeTxt: boolean;
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
        showCompany: typeof parsed.showCompany === 'boolean' ? parsed.showCompany : false,
        showName: typeof parsed.showName === 'boolean' ? parsed.showName : true,
        showPrice: typeof parsed.showPrice === 'boolean' ? parsed.showPrice : true,
        showWholesalePrice: typeof parsed.showWholesalePrice === 'boolean' ? parsed.showWholesalePrice : false,
        barcodeHeightMm: typeof parsed.barcodeHeightMm === 'number' ? parsed.barcodeHeightMm : 7,
        addGstToPrice: typeof parsed.addGstToPrice === 'boolean' ? parsed.addGstToPrice : true,
        priceLabel: parsed.priceLabel || 'Sale Price',
        priceFormat: parsed.priceFormat || 'label_only',
        showCodeTxt: typeof parsed.showCodeTxt === 'boolean' ? parsed.showCodeTxt : true,
      };
    }
  } catch (e) {
    console.error('Error loading barcode settings:', e);
  }
  return {
    rollUp: 3,
    widthMm: 34,
    heightMm: 22,
    showCompany: false,
    showName: true,
    showPrice: true,
    showWholesalePrice: false,
    barcodeHeightMm: 7,
    addGstToPrice: true,
    priceLabel: 'Sale Price',
    priceFormat: 'label_only',
    showCodeTxt: true,
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

  const itemFontSize = getItemNameFontSize(sample.itemName, fontNm, widthMm);

  useEffect(() => {
    if (svgRef.current && sample.barcode) {
      try {
        // Target barcode bar height in mm
        const targetBcMm = barcodeHeightMm > 0 ? barcodeHeightMm : (heightMm <= 22 ? 7 : (heightMm <= 25 ? 8 : 11));
        const bcHeight = Math.max(14, Math.min(46, Math.round(targetBcMm * 2.8)));
        const bcWidth = Math.max(0.65, Math.min(1.15, widthMm * 0.026));

        JsBarcode(svgRef.current, sample.barcode, {
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
  }, [sample.barcode, widthMm, heightMm, barcodeHeightMm, cardHeightPx]);

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

  return (
    <div
      style={{
        width: `${cardWidthPx}px`,
        height: `${cardHeightPx}px`,
        padding: '2px 3px'
      }}
      className="bg-white border border-slate-400 rounded-md flex flex-col items-center justify-center text-center shadow-xs overflow-hidden leading-tight flex-shrink-0 box-border"
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
        </div>
      )}
      <div className="flex items-center justify-center w-full overflow-hidden leading-none">
        <svg ref={svgRef} className="max-w-full max-h-full block" />
      </div>
      {showCodeTxt && (
        <div style={{ fontSize: `${fontBc}px` }} className="font-mono font-bold text-slate-700 leading-none tracking-tight mt-0.5">
          {sample.barcode}
        </div>
      )}
      {(showPrice || showWholesalePrice) && (
        <div
          style={{ fontSize: `${fontPr}px` }}
          className={`font-extrabold text-slate-900 whitespace-nowrap leading-none ${showCodeTxt ? 'mt-1.5' : 'mt-0.5'} flex items-center justify-center gap-1 max-w-full overflow-hidden`}
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

  // Load saved barcode settings from localStorage
  const [savedSettings] = useState(loadSavedBarcodeSettings);

  // Roll Layout settings (1-Up, 2-Up, 3-Up, 4-Up)
  const [rollUp, setRollUp] = useState<number>(savedSettings.rollUp);
  const [widthMm, setWidthMm] = useState<number>(savedSettings.widthMm);
  const [heightMm, setHeightMm] = useState<number>(savedSettings.heightMm);

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

  // Automatically save barcode settings to localStorage on change
  useEffect(() => {
    const settingsToSave: SavedBarcodeSettings = {
      rollUp,
      widthMm,
      heightMm,
      showCompany,
      showName,
      showPrice,
      showWholesalePrice,
      barcodeHeightMm,
      addGstToPrice,
      priceLabel,
      priceFormat,
      showCodeTxt,
    };
    try {
      localStorage.setItem(SAVED_BARCODE_SETTINGS_KEY, JSON.stringify(settingsToSave));
    } catch (e) {
      console.error('Error saving barcode settings:', e);
    }
  }, [rollUp, widthMm, heightMm, showCompany, showName, showPrice, showWholesalePrice, barcodeHeightMm, addGstToPrice, priceLabel, priceFormat, showCodeTxt]);

  // Initialize initial queue if passed (e.g. from Purchase Entry)
  useEffect(() => {
    if (initialQueue && initialQueue.length > 0) {
      setQueue(initialQueue.map(q => {
        if (q.wholesaleRate !== undefined && q.wholesaleRate > 0) return q;
        const matchedItem = items.find(i => i['Item Code'] === q.itemCode);
        return {
          ...q,
          wholesaleRate: Number(matchedItem?.['Wholesale Rate'] || (matchedItem as any)?.wholesaleRate || (matchedItem as any)?.wholesalePrice || 0)
        };
      }));
    }
  }, [initialQueue, items]);

  // Handle Up preset selection
  const handleRollUpChange = (up: number) => {
    setRollUp(up);
    if (up === 1) { setWidthMm(50); setHeightMm(30); setBarcodeHeightMm(11); }
    else if (up === 2) { setWidthMm(38); setHeightMm(25); setBarcodeHeightMm(8); }
    else if (up === 3) { setWidthMm(34); setHeightMm(22); setBarcodeHeightMm(7); }
    else if (up === 4) { setWidthMm(25); setHeightMm(15); setBarcodeHeightMm(5); }
  };

  const addItemToQueue = (item: Item) => {
    const existing = queue.find(q => q.itemCode === item['Item Code']);
    const wholesaleVal = Number((item as any)['Wholesale Rate'] || (item as any)['wholesaleRate'] || (item as any)['wholesalePrice'] || 0);
    if (existing) {
      setQueue(queue.map(q => q.itemCode === item['Item Code'] ? { ...q, qty: q.qty + 1 } : q));
    } else {
      setQueue([
        ...queue,
        {
          itemCode: item['Item Code'],
          itemName: item['Item Name'],
          barcode: item.Barcode || '100001',
          rate: item['Sale Rate'] || 0,
          wholesaleRate: wholesaleVal,
          mrp: item.MRP || item['Sale Rate'] || 0,
          gstPct: item['GST %'] || 0,
          qty: 1
        }
      ]);
    }
    setSearch('');
  };

  const addAllItemsToQueue = () => {
    const newItems: BarcodeQueueItem[] = items.map(item => ({
      itemCode: item['Item Code'],
      itemName: item['Item Name'],
      barcode: item.Barcode || '100001',
      rate: item['Sale Rate'] || 0,
      wholesaleRate: Number((item as any)['Wholesale Rate'] || (item as any)['wholesaleRate'] || (item as any)['wholesalePrice'] || 0),
      mrp: item.MRP || item['Sale Rate'] || 0,
      gstPct: item['GST %'] || 0,
      qty: 1
    }));
    setQueue(newItems);
  };

  const updateQty = (code: string, qty: number) => {
    setQueue(queue.map(q => q.itemCode === code ? { ...q, qty: Math.max(1, qty) } : q));
  };

  const removeItem = (code: string) => {
    setQueue(queue.filter(q => q.itemCode !== code));
  };

  const clearQueue = () => {
    setQueue([]);
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

  React.useEffect(() => {
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

    // Target barcode bar height in mm: clean proportion prevents cutting off bottom text
    const targetBcMm = barcodeHeightMm > 0 ? barcodeHeightMm : (heightMm <= 22 ? 7 : (heightMm <= 25 ? 8 : 11));
    const barcodeH = Math.max(14, Math.round(targetBcMm * 3.78));
    const barcodeW = Math.max(0.65, Math.min(1.15, 0.88 * (widthMm / 34)));

    const currSym = config.CurrencySymbol || 'Nu.';

    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Barcode Roll Printing (${rollUp}-Up)</title>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
        <style>
          @page { margin: 0; size: auto; }
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 1mm;
            background: #fff;
            color: #000;
          }
          .roll-container {
            display: flex;
            flex-direction: column;
            gap: 1.5mm;
          }
          .roll-row {
            display: flex;
            flex-direction: row;
            align-items: center;
            justify-content: flex-start;
            page-break-inside: avoid;
            break-inside: avoid;
            margin-bottom: 1.5mm;
          }
          .label-box {
            width: ${widthMm}mm;
            height: ${heightMm}mm;
            max-height: ${heightMm}mm;
            border: 1px dotted #ccc;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            padding: 0.5mm 1mm;
            text-align: center;
            margin-right: 1.5mm;
            background: #fff;
            page-break-inside: avoid;
            break-inside: avoid;
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
            margin-top: 0.3mm;
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
            margin-top: ${showCodeTxt ? '1.2mm' : '0.4mm'};
          }
          @media print {
            .label-box { border: none !important; }
            body { margin: 0; padding: 0; }
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

        html += `<div class="label-box">`;
        if (showCompany && config.CompanyName) {
          html += `<div class="comp-title">${config.CompanyName}</div>`;
        }
        if (showName) {
          const itemFontSize = getItemNameFontSize(x.itemName, fontNm, widthMm);
          html += `<div class="item-title" style="font-size: ${itemFontSize}px; max-height: ${itemFontSize * 2.1}px;">${x.itemName}</div>`;
        }
        html += `<div class="barcode-wrapper">`;
        html += `<svg id="bc_${x.barcode}_${randId}" style="max-width: 98%; height: ${barcodeH}px; display: block; margin: 0 auto;"></svg>`;
        html += `</div>`;
        if (showCodeTxt) {
          html += `<div class="barcode-txt">${x.barcode}</div>`;
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
            document.querySelectorAll('svg').forEach(el => {
              const parts = el.id.split('_');
              const code = parts[1] || '100001';
              try {
                JsBarcode(el, code, { format: "CODE128", displayValue: false, height: ${barcodeH}, width: ${barcodeW}, margin: 0 });
              } catch(e){}
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
            Generate and print barcode stickers on 1-Up, 2-Up, 3-Up, or 4-Up thermal paper rolls with GST pricing
          </p>
        </div>

        <button
          onClick={addAllItemsToQueue}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50"
        >
          <Plus className="h-4 w-4" />
          Add All Master Products
        </button>
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

            <div className="relative mb-3">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search product name or barcode to add to queue..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-300 text-xs font-medium outline-none focus:border-indigo-500"
              />

              {search.trim() && (
                <div className="absolute left-0 right-0 top-full mt-1 z-20 max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
                  {items
                    .filter(i => (i['Item Name'] || '').toLowerCase().includes(search.toLowerCase()) || (i.Barcode || '').includes(search))
                    .map(item => (
                      <div
                        key={item['Item Code']}
                        onClick={() => addItemToQueue(item)}
                        className="p-2.5 text-xs hover:bg-indigo-50 cursor-pointer border-b border-slate-100 flex justify-between items-center"
                      >
                        <div>
                          <div className="font-bold text-slate-800">{item['Item Name']}</div>
                          <div className="text-[10px] text-slate-500">
                            Sale Rate: {currSym} {item['Sale Rate']} | GST: {item['GST %'] || 0}%
                          </div>
                        </div>
                        <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                          BC: {item.Barcode || '100001'}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[11px] border-b border-slate-200">
                    <th className="py-2.5 px-3 text-left">Product Name</th>
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
                        Queue is empty. Search products above or click "Add All Master Products".
                      </td>
                    </tr>
                  ) : (
                    queue.map(q => {
                      const printedPrice = getPrintedPrice(q);
                      const printedWholesale = getPrintedWholesalePrice(q);
                      return (
                        <tr key={q.itemCode} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-semibold text-slate-800">
                            {q.itemName}
                            {q.gstPct > 0 && (
                              <span className="ml-1.5 text-[10px] text-slate-500 font-normal">
                                ({q.gstPct}% GST)
                              </span>
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
                              onChange={e => updateQty(q.itemCode, Number(e.target.value))}
                              className="w-16 h-8 text-center rounded-lg border border-slate-300 font-bold text-xs outline-none focus:border-indigo-500"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button onClick={() => removeItem(q.itemCode)} className="text-slate-400 hover:text-rose-600 p-1">
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
                onClick={() => { setRollUp(3); setWidthMm(34); setHeightMm(22); setBarcodeHeightMm(7); }}
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
                onClick={() => { setRollUp(2); setWidthMm(38); setHeightMm(25); setBarcodeHeightMm(8); }}
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
                onClick={() => { setRollUp(1); setWidthMm(50); setHeightMm(25); setBarcodeHeightMm(9); }}
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
            <div className="grid grid-cols-2 gap-2">
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
                For 22mm height stickers, 6–7mm bar height leaves plenty of space so text below never cuts off.
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
            <div className="grid grid-cols-2 gap-2 text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                <input type="checkbox" checked={showCompany} onChange={e => setShowCompany(e.target.checked)} className="rounded border-slate-300 text-indigo-600" />
                Company Name
              </label>
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                <input type="checkbox" checked={showName} onChange={e => setShowName(e.target.checked)} className="rounded border-slate-300 text-indigo-600" />
                Product Name
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
            </div>
          </div>

          {/* Roll Strip Preview Box */}
          <div className="space-y-1.5 border-t border-slate-100 pt-3">
            <div className="flex justify-between items-center text-xs font-bold text-slate-700">
              <span>Paper Roll Preview ({rollUp}-Up)</span>
              <span className="text-[10px] text-slate-500 font-mono">{widthMm}x{heightMm}mm per label</span>
            </div>

            <div className="p-3 rounded-xl border border-slate-200 bg-slate-100 flex items-center justify-center min-h-[130px] overflow-x-auto">
              {queue.length === 0 ? (
                <span className="text-xs text-slate-400 italic">Add items to preview sticker roll</span>
              ) : (
                <div className="flex items-center gap-1.5 bg-slate-200 p-2 rounded border border-slate-300">
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

