import React, { useState } from 'react';
import { X, Upload, ClipboardPaste, Check, AlertCircle, AlertTriangle, ArrowRight } from 'lucide-react';
import * as XLSX from 'xlsx';
import { bulkImportItems, BulkImportItem } from '../services/storageService';

interface ImportItemsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

export const ImportItemsModal: React.FC<ImportItemsModalProps> = ({ isOpen, onClose, onImportComplete }) => {
  const [activeTab, setActiveTab] = useState<'paste' | 'upload'>('paste');
  const [pasteData, setPasteData] = useState('');
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<number, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResult, setImportResult] = useState<{added: number, skipped: string[]} | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [unmappedPromptCols, setUnmappedPromptCols] = useState<{ index: number; header: string }[] | null>(null);

  // Track the exact sequence in which columns were added
  const [orderedKeys, setOrderedKeys] = useState<string[]>([
    'name', 'baseUnit', 'openingQty', 'purchaseRate', 'saleRate'
  ]);

  const columnHeaders = [
    { key: 'name', label: 'Item Name' },
    { key: 'baseUnit', label: 'Base Unit' },
    { key: 'altUnit', label: 'Alt Unit' },
    { key: 'conversionFactor', label: 'Conv Factor' },
    { key: 'openingQty', label: 'Opening Qty' },
    { key: 'purchaseRate', label: 'Purchase Rate' },
    { key: 'altPurchaseRate', label: 'Alt Purchase Rate' },
    { key: 'saleRate', label: 'Sale Rate' },
    { key: 'wholesaleRate', label: 'Wholesale Rate' },
    { key: 'altSaleRate', label: 'Alt Sale Rate' },
    { key: 'altWholesaleRate', label: 'Alt Wholesale Rate' },
    { key: 'mrp', label: 'MRP' },
    { key: 'altMrp', label: 'Alt MRP' },
    { key: 'barcode', label: 'Barcode' },
    { key: 'group', label: 'Item Group' },
    { key: 'category', label: 'Category' },
    { key: 'serials', label: 'Serial No' }
  ];

  const getActiveColumns = () => orderedKeys.map(k => columnHeaders.find(c => c.key === k)!);

  const toggleColumn = (key: string, checked: boolean) => {
    if (key === 'name') return; // Cannot uncheck Item Name
    if (checked) {
      setOrderedKeys(prev => [...prev, key]);
    } else {
      setOrderedKeys(prev => prev.filter(k => k !== key));
    }
  };

  const findMatchingColumn = (header: any) => {
    if (!header) return null;
    let raw = String(header).trim().toLowerCase();
    // Normalize common spelling mistakes and variations
    raw = raw
      .replace(/prise/g, 'price')
      .replace(/quatity|quntity|qnty/g, 'quantity')
      .replace(/wholsale|holesale/g, 'wholesale')
      .replace(/parchase/g, 'purchase')
      .replace(/catagory/g, 'category');

    const hClean = raw.replace(/[^a-z0-9]/g, '');
    if (!hClean) return null;

    // 1. Exact label or key match
    const exact = columnHeaders.find(c => {
      const labelClean = c.label.toLowerCase().replace(/[^a-z0-9]/g, '');
      const keyClean = c.key.toLowerCase().replace(/[^a-z0-9]/g, '');
      return labelClean === hClean || keyClean === hClean;
    });
    if (exact) return exact;

    // 2. Comprehensive synonyms & aliases
    const aliases: Record<string, string[]> = {
      name: ['item', 'itemname', 'product', 'productname', 'description', 'particulars', 'title', 'itemdescription'],
      baseUnit: ['unit', 'uom', 'baseunit', 'baseuom', 'primaryunit', 'unitname', 'mainunit'],
      altUnit: ['altunit', 'alternateunit', 'altuom', 'secondaryunit', 'pkgunit', 'packingunit', 'boxunit'],
      conversionFactor: ['convfactor', 'conversionfactor', 'conversion', 'multiplier', 'factor', 'packsize', 'packing', 'conv', 'piecesperbox', 'pcsperbox', 'unitfactor'],
      openingQty: ['openingqty', 'openingquantity', 'openingstock', 'qty', 'quantity', 'stock', 'openqty', 'opstock', 'opqty', 'openstock', 'openingstockqty'],
      purchaseRate: ['purchaserate', 'purchaseprice', 'buyrate', 'buyprice', 'cost', 'costprice', 'prate', 'pprice', 'purchase', 'buyingprice', 'buyingrate'],
      altPurchaseRate: ['altpurchaserate', 'altpurchaseprice', 'altcost', 'boxpurchaserate', 'boxcost', 'boxpurchaseprice'],
      saleRate: ['salerate', 'saleprice', 'sellingprice', 'retailprice', 'rate', 'price', 'srate', 'sprice', 'salesprice', 'salepricerate'],
      wholesaleRate: [
        'wholesalerate', 'wholesaleprice', 'wholesale', 'dealerprice', 'dealerrate',
        'tradeprice', 'traderate', 'wrate', 'wprice', 'wsrate', 'wsprice', 'wholesaleamt',
        'wholesalecost', 'ws', 'wholesaleprice'
      ],
      altSaleRate: ['altsalerate', 'altsaleprice', 'boxsalerate', 'boxprice', 'secondarysalerate'],
      altWholesaleRate: ['altwholesalerate', 'altwholesaleprice', 'boxwholesalerate', 'boxwholesaleprice', 'altwholesale', 'altwsrate', 'altwsprice', 'boxwholesale', 'altwholesalecost'],
      mrp: ['mrp', 'maxretailprice', 'maximumretailprice', 'mpr', 'maxprice', 'mrpamount'],
      altMrp: ['altmrp', 'boxmrp', 'altmpr'],
      barcode: ['barcode', 'barcodeno', 'upc', 'ean', 'itemcode', 'code', 'barcodes'],
      group: ['group', 'itemgroup', 'brand', 'itembrand', 'categorygroup'],
      category: ['category', 'itemcategory', 'cat', 'subcategory'],
      serials: ['serial', 'serials', 'serialno', 'serialnumber', 'imei', 'imeino']
    };

    for (const [key, aliasList] of Object.entries(aliases)) {
      if (aliasList.includes(hClean)) {
        return columnHeaders.find(c => c.key === key) || null;
      }
    }

    // 3. Intelligent fuzzy keyword deduction
    if (hClean.includes('alt') || hClean.includes('box') || hClean.includes('secondary')) {
      if (hClean.includes('wholesale') || hClean.includes('dealer')) return columnHeaders.find(c => c.key === 'altWholesaleRate') || null;
      if (hClean.includes('purchase') || hClean.includes('cost') || hClean.includes('buy')) return columnHeaders.find(c => c.key === 'altPurchaseRate') || null;
      if (hClean.includes('mrp')) return columnHeaders.find(c => c.key === 'altMrp') || null;
      if (hClean.includes('sale') || hClean.includes('price') || hClean.includes('rate')) return columnHeaders.find(c => c.key === 'altSaleRate') || null;
      if (hClean.includes('unit')) return columnHeaders.find(c => c.key === 'altUnit') || null;
    }

    if (hClean.includes('wholesale') || hClean.includes('dealer') || hClean.includes('trade')) {
      return columnHeaders.find(c => c.key === 'wholesaleRate') || null;
    }
    if (hClean.includes('purchase') || (hClean.includes('buy') && (hClean.includes('rate') || hClean.includes('price')))) {
      return columnHeaders.find(c => c.key === 'purchaseRate') || null;
    }
    if (hClean.includes('sale') || (hClean.includes('sell') && (hClean.includes('rate') || hClean.includes('price')))) {
      return columnHeaders.find(c => c.key === 'saleRate') || null;
    }
    if (hClean.includes('mrp')) {
      return columnHeaders.find(c => c.key === 'mrp') || null;
    }
    if (hClean.includes('serial') || hClean.includes('imei')) {
      return columnHeaders.find(c => c.key === 'serials') || null;
    }
    if (hClean.includes('bar') && hClean.includes('code')) {
      return columnHeaders.find(c => c.key === 'barcode') || null;
    }
    if (hClean.includes('conv') || hClean.includes('factor')) {
      return columnHeaders.find(c => c.key === 'conversionFactor') || null;
    }
    if (hClean.includes('open') || hClean.includes('stock')) {
      return columnHeaders.find(c => c.key === 'openingQty') || null;
    }

    return null;
  };

  const initColumnMapping = (data: any[][]) => {
    if (!data || data.length === 0) return;
    const headers = data[0] || [];
    const mapping: Record<number, string> = {};
    headers.forEach((h: any, idx: number) => {
      const match = findMatchingColumn(h);
      mapping[idx] = match ? match.key : '';
    });
    setColumnMapping(mapping);
  };

  const handlePasteChange = (val: string) => {
    setPasteData(val);
    setErrorMsg(null);
    setUnmappedPromptCols(null);
    const rows = val.split('\n').map(row => row.split('\t').map(cell => cell.trim()));
    const cleaned = rows.filter(r => r.length > 0 && r.some(c => c !== ''));
    setParsedData(cleaned);
    if (cleaned.length > 0 && cleaned[0].some(c => typeof c === 'string' && (c.toLowerCase().includes('item') || c.toLowerCase().includes('name')))) {
      initColumnMapping(cleaned);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setUnmappedPromptCols(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const dataBuffer = evt.target?.result;
        const wb = XLSX.read(dataBuffer, { type: 'array' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '' }) as any[][];
        
        if (data && data.length > 1) {
          const cleaned = data.filter(r => r && r.length > 0 && r.some(c => c !== null && c !== undefined && String(c).trim() !== ''));
          setParsedData(cleaned);
          initColumnMapping(cleaned);
        } else {
          setErrorMsg('The selected file contains no data rows.');
        }
      } catch (err: any) {
        setErrorMsg('Failed to parse file: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const checkUnmappedColumnsBeforeImport = () => {
    if (parsedData.length === 0) return;
    setErrorMsg(null);

    if (activeTab === 'upload') {
      const headers = parsedData[0] || [];
      const unmapped: { index: number; header: string }[] = [];

      // Look through each column
      headers.forEach((h: any, idx: number) => {
        const mappedKey = columnMapping[idx];
        if (!mappedKey) {
          // Check if any rows below have non-empty data
          const hasData = parsedData.slice(1).some(r => {
            const cell = r[idx];
            return cell !== undefined && cell !== null && String(cell).trim() !== '';
          });
          if (hasData) {
            unmapped.push({ index: idx, header: String(h || `Column ${idx + 1}`) });
          }
        }
      });

      // Verify if 'name' is mapped
      const hasItemName = Object.values(columnMapping).includes('name');
      if (!hasItemName) {
        setErrorMsg("Missing Item Name! Please map at least one column to 'Item Name' in the preview table below.");
        return;
      }

      if (unmapped.length > 0) {
        setUnmappedPromptCols(unmapped);
        return;
      }
    }

    executeImport();
  };

  const executeImport = () => {
    setUnmappedPromptCols(null);
    setIsProcessing(true);
    setErrorMsg(null);
    
    setTimeout(() => {
      try {
        let currentCols: any[] = getActiveColumns();
        let startIndex = 0;

        if (activeTab === 'upload') {
          const headers = parsedData[0] || [];
          currentCols = headers.map((_: any, idx: number) => {
            const mappedKey = columnMapping[idx];
            return mappedKey ? columnHeaders.find(c => c.key === mappedKey) || null : null;
          });
          startIndex = 1;
        } else {
          // For paste, skip header if it looks like one
          if (parsedData[0] && typeof parsedData[0][0] === 'string' && parsedData[0][0].toLowerCase().includes('name')) {
            startIndex = 1;
          }
        }

        const groupedItems = new Map<string, BulkImportItem>();

        for (let i = startIndex; i < parsedData.length; i++) {
          const row = parsedData[i];
          if (!row || row.length === 0) continue;

          let name = '';
          const itemData: any = {};
          
          currentCols.forEach((col, idx) => {
            if (!col) return;
            const rawVal = row[idx];
            const val = rawVal !== undefined && rawVal !== null ? String(rawVal).trim() : '';
            itemData[col.key] = val;
            if (col.key === 'name') name = val;
          });

          if (!name) continue;

          const qty = Number(itemData.openingQty) || (itemData.serials ? 1 : 0);
          
          if (groupedItems.has(name)) {
            const existing = groupedItems.get(name)!;
            existing.openingQty += qty;
            if (itemData.serials) {
              if (!existing.serials) existing.serials = [];
              existing.serials.push(String(itemData.serials).trim());
            }
          } else {
            const newItem: BulkImportItem = {
              name: String(itemData.name || '').trim(),
              baseUnit: String(itemData.baseUnit || 'Pcs').trim(),
              altUnit: itemData.altUnit ? String(itemData.altUnit).trim() : undefined,
              conversionFactor: Number(itemData.conversionFactor) || 1,
              openingQty: qty,
              purchaseRate: Number(itemData.purchaseRate) || 0,
              altPurchaseRate: itemData.altPurchaseRate ? Number(itemData.altPurchaseRate) : undefined,
              saleRate: Number(itemData.saleRate) || 0,
              wholesaleRate: (itemData.wholesaleRate !== undefined && itemData.wholesaleRate !== '' && !isNaN(Number(itemData.wholesaleRate))) ? Number(itemData.wholesaleRate) : undefined,
              altSaleRate: Number(itemData.altSaleRate) || 0,
              altWholesaleRate: (itemData.altWholesaleRate !== undefined && itemData.altWholesaleRate !== '' && !isNaN(Number(itemData.altWholesaleRate))) ? Number(itemData.altWholesaleRate) : undefined,
              mrp: Number(itemData.mrp) || 0,
              altMrp: itemData.altMrp ? Number(itemData.altMrp) : undefined,
              barcode: itemData.barcode ? String(itemData.barcode).trim() : undefined,
              group: itemData.group ? String(itemData.group).trim() : undefined,
              category: itemData.category ? String(itemData.category).trim() : undefined,
              serials: itemData.serials ? [String(itemData.serials).trim()] : undefined
            };
            groupedItems.set(name, newItem);
          }
        }

        const itemsToImport = Array.from(groupedItems.values());
        if (itemsToImport.length > 0) {
          const res = bulkImportItems(itemsToImport);
          if (res.ok) {
            setImportResult({ added: res.added || 0, skipped: res.skipped || [] });
            onImportComplete();
          }
        } else {
          setErrorMsg('No valid items found to import. Check if your column headers match the expected format and that the Item Name is provided.');
        }
      } catch (e: any) {
        setErrorMsg('Error during import: ' + e.message);
      } finally {
        setIsProcessing(false);
      }
    }, 100);
  };

  const handleClearData = () => {
    setParsedData([]);
    setPasteData('');
    setColumnMapping({});
    setUnmappedPromptCols(null);
    setErrorMsg(null);
  };

  if (!isOpen) return null;

  if (importResult) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
              <Check className="w-8 h-8" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-slate-800 text-center mb-2">Import Complete!</h2>
          <p className="text-slate-600 text-center mb-6">
            Successfully imported <strong>{importResult.added}</strong> items.
          </p>

          {importResult.skipped.length > 0 && (
            <div className="mb-6">
              <div className="text-sm font-bold text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-200">
                <p className="mb-2"><strong>{importResult.skipped.length} items skipped</strong> (already exist by name):</p>
                <div className="max-h-32 overflow-y-auto text-xs font-mono bg-white p-2 border border-amber-100 rounded">
                  {importResult.skipped.map((s, i) => (
                    <div key={i} className="mb-1 truncate">{s}</div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <button
            onClick={onClose}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-5xl h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200">
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-lg font-black text-slate-800">Import Inventory Items</h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Copy & Paste from Excel or Upload CSV</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-6 pt-4 border-b border-slate-200 shrink-0 gap-6">
          <button
            onClick={() => setActiveTab('paste')}
            className={`pb-3 text-sm font-bold border-b-2 flex items-center gap-2 transition ${activeTab === 'paste' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            <ClipboardPaste className="w-4 h-4" />
            Quick Paste (Excel Copy)
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`pb-3 text-sm font-bold border-b-2 flex items-center gap-2 transition ${activeTab === 'upload' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            <Upload className="w-4 h-4" />
            Upload File (Bulk Excel/CSV)
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          
          {activeTab === 'paste' ? (
            <div className="space-y-6">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 mb-3">1. Select the columns you want to import (in order):</h3>
                <div className="flex flex-wrap gap-2.5">
                  {columnHeaders.map(col => {
                    const isChecked = orderedKeys.includes(col.key);
                    const orderIndex = orderedKeys.indexOf(col.key);
                    return (
                      <label key={col.key} className={`flex items-center gap-2 cursor-pointer text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${isChecked ? 'bg-indigo-50 border-indigo-300 text-indigo-900 shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                        <input 
                          type="checkbox" 
                          disabled={col.key === 'name'}
                          checked={isChecked}
                          onChange={(e) => toggleColumn(col.key, e.target.checked)}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                        />
                        {col.label} {col.key === 'name' && <span className="text-red-500">*</span>}
                        {isChecked && (
                          <span className="ml-1 flex items-center justify-center w-4 h-4 rounded-full bg-indigo-600 text-[10px] text-white font-bold">
                            {orderIndex + 1}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-800">2. Copy from Excel and paste here:</h3>
                  <div className="text-[11px] font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-200 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Columns must perfectly match the checked boxes above
                  </div>
                </div>
                
                {/* Spreadsheet Paste Grid */}
                <div 
                  className="overflow-x-auto rounded-lg border border-slate-300 bg-white shadow-inner focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 outline-none transition-all cursor-text"
                  tabIndex={0}
                  onPaste={(e) => {
                    e.preventDefault();
                    handlePasteChange(e.clipboardData.getData('text'));
                  }}
                >
                  <table className="w-full text-xs text-left border-collapse select-none">
                    <thead className="bg-slate-100 text-slate-700 font-bold">
                      <tr>
                        <th className="py-2 px-3 border-r border-b border-slate-300 w-12 text-center bg-slate-200">#</th>
                        {getActiveColumns().map((c, i) => (
                          <th key={i} className="py-2 px-3 border-r border-b border-slate-300 whitespace-nowrap bg-slate-100">{c.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {parsedData.length > 0 ? (
                         parsedData.slice(0, 10).map((row, rIdx) => (
                            <tr key={rIdx} className="hover:bg-indigo-50/50">
                               <td className="py-1.5 px-3 border-r border-slate-300 bg-slate-100/50 text-center text-slate-500 font-bold">{rIdx + 1}</td>
                               {getActiveColumns().map((_, cIdx) => (
                                  <td key={cIdx} className="py-1.5 px-3 border-r border-slate-300 truncate max-w-[150px] text-slate-700">{row[cIdx] || ''}</td>
                               ))}
                            </tr>
                         ))
                      ) : (
                         Array.from({ length: 8 }).map((_, rIdx) => (
                            <tr key={rIdx}>
                               <td className="py-1.5 px-3 border-r border-slate-300 bg-slate-100/50 text-center text-slate-400 font-medium">{rIdx + 1}</td>
                               {getActiveColumns().map((_, cIdx) => (
                                  <td key={cIdx} className="py-1.5 px-3 border-r border-slate-300">
                                     {rIdx === 0 && cIdx === 0 ? (
                                        <div className="text-slate-400 italic pointer-events-none flex items-center gap-2">
                                          <span>Click anywhere in this grid and press </span>
                                          <kbd className="px-1.5 py-0.5 rounded-md bg-slate-100 border border-slate-300 font-sans text-[10px] text-slate-500 font-bold shadow-sm">Ctrl+V</kbd>
                                        </div>
                                     ) : ''}
                                  </td>
                               ))}
                            </tr>
                         ))
                      )}
                    </tbody>
                  </table>
                  {parsedData.length > 10 && (
                    <div className="py-2 text-center text-xs font-medium text-slate-500 bg-slate-50 border-t border-slate-200">
                      ...and {parsedData.length - 10} more rows
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm text-center">
                <Upload className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-sm font-bold text-slate-800 mb-2">Upload your Excel (.xlsx) or CSV file</h3>
                <p className="text-xs text-slate-500 mb-6 max-w-sm mx-auto">Make sure your file columns match the standard format. The system will read the first row as headers.</p>
                
                <input 
                  type="file" 
                  accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                  onChange={handleFileUpload}
                  className="block w-full max-w-sm mx-auto text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                />
              </div>
            </div>
          )}

          {parsedData.length > 0 && activeTab === 'upload' && (
            <div className="mt-6 bg-white p-4 rounded-xl border border-slate-200 shadow-sm" id="data-preview-container">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    Data Preview & Column Mapping
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">Verify or adjust what each spreadsheet column corresponds to below.</p>
                </div>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                  {parsedData.length - 1} data rows detected
                </span>
              </div>

              {parsedData[0] && parsedData[0].some((_: any, idx: number) => !columnMapping[idx]) && (
                <div className="mb-3 p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-800">
                    <span className="font-bold">Column Notice:</span> One or more columns are unmapped and will be skipped. If you want to import their data, pick the matching field from the column dropdown.
                  </div>
                </div>
              )}

              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center bg-slate-100 text-slate-500 font-bold align-middle">#</th>
                      {parsedData[0]?.map((c: any, i: number) => {
                        const isMapped = !!columnMapping[i];
                        return (
                          <th key={i} className={`py-2 px-2.5 border-l border-slate-200 align-top min-w-[170px] ${isMapped ? 'bg-slate-50' : 'bg-amber-50/60'}`}>
                            <div className="flex items-center justify-between gap-1 mb-1.5">
                              <span className="font-bold text-slate-800 text-xs truncate max-w-[105px]" title={String(c || '')}>
                                {c || `Column ${i+1}`}
                              </span>
                              {isMapped ? (
                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded shrink-0">Mapped</span>
                              ) : (
                                <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded shrink-0">Unmapped</span>
                              )}
                            </div>
                            <select
                              value={columnMapping[i] || ''}
                              onChange={(e) => setColumnMapping(prev => ({ ...prev, [i]: e.target.value }))}
                              className={`w-full text-xs font-semibold py-1.5 px-2 rounded-lg border outline-none cursor-pointer transition ${
                                isMapped
                                  ? 'bg-white border-emerald-300 text-emerald-900 focus:border-emerald-500'
                                  : 'bg-white border-amber-300 text-amber-900 focus:border-amber-500'
                              }`}
                            >
                              <option value="">-- Ignored (Skip) --</option>
                              {columnHeaders.map(ch => (
                                <option key={ch.key} value={ch.key}>
                                  {ch.label}
                                </option>
                              ))}
                            </select>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedData.slice(1, 6).map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-50">
                        <td className="py-1.5 px-3 text-center text-slate-400 font-medium">{rIdx + 1}</td>
                        {row.map((cell: string, cIdx: number) => (
                          <td key={cIdx} className="py-1.5 px-3 border-l border-slate-100 truncate max-w-[170px] font-mono text-[11px]">{String(cell ?? '')}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedData.length > 6 && (
                <p className="text-xs text-slate-500 text-center mt-3 font-medium">Showing first 5 rows of {parsedData.length - 1} total data rows.</p>
              )}
            </div>
          )}

          {errorMsg && (
            <div className="mt-6 bg-red-50 p-4 rounded-xl border border-red-200 shadow-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-bold text-red-800">Import Failed</h3>
                <p className="text-xs text-red-600 mt-1">{errorMsg}</p>
              </div>
              <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-red-600 transition p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 bg-white rounded-b-2xl flex justify-between shrink-0">
          <div>
            {parsedData.length > 0 && (
              <button 
                onClick={handleClearData}
                className="px-4 py-2 text-sm font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-xl transition"
              >
                Clear Data
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button 
              onClick={onClose}
              className="px-5 py-2 text-sm font-bold text-slate-600 hover:text-slate-900 transition"
            >
              Cancel
            </button>
            <button 
              onClick={checkUnmappedColumnsBeforeImport}
              disabled={parsedData.length === 0 || isProcessing}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-md transition disabled:opacity-50 flex items-center gap-2"
            >
              {isProcessing ? 'Importing...' : <><Check className="w-4 h-4" /> Validate & Import Data</>}
            </button>
          </div>
        </div>

      </div>

      {/* Unmapped Columns Confirmation Dialog */}
      {unmappedPromptCols && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 border border-amber-200 animate-in fade-in duration-150">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-800">Unmapped Columns Detected</h3>
                <p className="text-xs text-slate-500 font-medium">Some columns containing data are not matched to any inventory field.</p>
              </div>
            </div>

            <div className="mb-5 bg-amber-50 p-4 rounded-xl border border-amber-200">
              <p className="text-xs text-amber-900 font-medium mb-2.5">
                The following {unmappedPromptCols.length} column{unmappedPromptCols.length > 1 ? 's have' : ' has'} data but will be <strong>skipped/blank</strong> if you proceed:
              </p>
              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                {unmappedPromptCols.map((col) => (
                  <div key={col.index} className="flex items-center justify-between text-xs bg-white px-3 py-2 rounded-lg border border-amber-200 font-mono">
                    <span className="font-bold text-slate-800">"{col.header}"</span>
                    <span className="text-[11px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded font-sans font-semibold">Column {col.index + 1}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-amber-800 mt-2.5">
                Would you like to review and map these columns (e.g. choose Sale Rate, Wholesale Rate, etc.), or proceed and ignore them?
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setUnmappedPromptCols(null);
                  const el = document.getElementById('data-preview-container');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-4 py-2.5 text-sm font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition flex items-center gap-1.5"
              >
                Review & Map Columns
              </button>
              <button
                onClick={executeImport}
                className="px-4 py-2.5 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-md transition flex items-center gap-1.5"
              >
                Import Anyway (Skip Them) <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
