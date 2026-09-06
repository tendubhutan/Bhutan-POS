import React, { useState, useMemo, useEffect } from 'react';
import { Config, Item } from '../types';
import { getStockBalancesAsOfDate } from '../services/storageService';
import XLSX from 'xlsx-js-style';
import {
  X,
  FileSpreadsheet,
  CheckSquare,
  Square,
  Download,
  Filter,
  Layers,
  Sparkles,
  Info,
  CheckCircle2,
  Package,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Calendar
} from 'lucide-react';

export interface StockExportField {
  id: string;
  label: string;
  groupType: 'import' | 'additional';
  category: string;
  defaultSelected: boolean;
  isRequired?: boolean;
  align?: 'left' | 'center' | 'right';
  isNumeric?: boolean;
  isCurrency?: boolean;
  getValue: (item: any, config: Config) => string | number;
}

export const IMPORT_STOCK_COLUMNS: StockExportField[] = [
  {
    id: 'name',
    label: 'Item Name',
    groupType: 'import',
    category: 'Item Master',
    isRequired: true,
    defaultSelected: true,
    align: 'left',
    getValue: (i) => i['Item Name'] || i.itemName || ''
  },
  {
    id: 'baseUnit',
    label: 'Base Unit',
    groupType: 'import',
    category: 'Item Master',
    defaultSelected: true,
    align: 'center',
    getValue: (i) => i.Unit || i.unit || 'Pcs'
  },
  {
    id: 'altUnit',
    label: 'Alt Unit',
    groupType: 'import',
    category: 'Item Master',
    defaultSelected: true,
    align: 'center',
    getValue: (i) => i.multiUnits?.[0]?.unit || ''
  },
  {
    id: 'conversionFactor',
    label: 'Conv Factor',
    groupType: 'import',
    category: 'Item Master',
    defaultSelected: true,
    align: 'right',
    isNumeric: true,
    getValue: (i) => (i.multiUnits?.[0]?.conversionFactor ? Number(i.multiUnits[0].conversionFactor) : '')
  },
  {
    id: 'openingQty',
    label: 'Opening Qty',
    groupType: 'import',
    category: 'Stock',
    defaultSelected: true,
    align: 'right',
    isNumeric: true,
    getValue: (i) => Number(i['Opening Stock']) || 0
  },
  {
    id: 'purchaseRate',
    label: 'Purchase Rate',
    groupType: 'import',
    category: 'Pricing',
    defaultSelected: true,
    align: 'right',
    isNumeric: true,
    isCurrency: true,
    getValue: (i) => Number(i['Purchase Rate'] ?? i.purchaseRate) || 0
  },
  {
    id: 'altPurchaseRate',
    label: 'Alt Purchase Rate',
    groupType: 'import',
    category: 'Pricing',
    defaultSelected: true,
    align: 'right',
    isNumeric: true,
    isCurrency: true,
    getValue: (i) => (i.multiUnits?.[0]?.purchaseRate !== undefined && i.multiUnits[0].purchaseRate !== null && i.multiUnits[0].purchaseRate !== '') ? Number(i.multiUnits[0].purchaseRate) : ''
  },
  {
    id: 'saleRate',
    label: 'Sale Rate',
    groupType: 'import',
    category: 'Pricing',
    defaultSelected: true,
    align: 'right',
    isNumeric: true,
    isCurrency: true,
    getValue: (i) => Number(i['Sale Rate'] ?? i.saleRate) || 0
  },
  {
    id: 'wholesaleRate',
    label: 'Wholesale Rate',
    groupType: 'import',
    category: 'Pricing',
    defaultSelected: true,
    align: 'right',
    isNumeric: true,
    isCurrency: true,
    getValue: (i) => (i['Wholesale Rate'] !== undefined && i['Wholesale Rate'] !== null && i['Wholesale Rate'] !== '') ? Number(i['Wholesale Rate']) : (i.wholesaleRate !== undefined && i.wholesaleRate !== null && i.wholesaleRate !== '' ? Number(i.wholesaleRate) : '')
  },
  {
    id: 'altSaleRate',
    label: 'Alt Sale Rate',
    groupType: 'import',
    category: 'Pricing',
    defaultSelected: true,
    align: 'right',
    isNumeric: true,
    isCurrency: true,
    getValue: (i) => (i.multiUnits?.[0]?.saleRate !== undefined && i.multiUnits[0].saleRate !== null && i.multiUnits[0].saleRate !== '') ? Number(i.multiUnits[0].saleRate) : ''
  },
  {
    id: 'altWholesaleRate',
    label: 'Alt Wholesale Rate',
    groupType: 'import',
    category: 'Pricing',
    defaultSelected: true,
    align: 'right',
    isNumeric: true,
    isCurrency: true,
    getValue: (i) => (i.multiUnits?.[0]?.wholesaleRate !== undefined && i.multiUnits[0].wholesaleRate !== null && i.multiUnits[0].wholesaleRate !== '') ? Number(i.multiUnits[0].wholesaleRate) : ''
  },
  {
    id: 'mrp',
    label: 'MRP',
    groupType: 'import',
    category: 'Pricing',
    defaultSelected: true,
    align: 'right',
    isNumeric: true,
    isCurrency: true,
    getValue: (i) => Number(i.MRP ?? i.mrp) || 0
  },
  {
    id: 'altMrp',
    label: 'Alt MRP',
    groupType: 'import',
    category: 'Pricing',
    defaultSelected: true,
    align: 'right',
    isNumeric: true,
    isCurrency: true,
    getValue: (i) => (i.multiUnits?.[0]?.mrp !== undefined && i.multiUnits[0].mrp !== null && i.multiUnits[0].mrp !== '') ? Number(i.multiUnits[0].mrp) : ''
  },
  {
    id: 'barcode',
    label: 'Barcode',
    groupType: 'import',
    category: 'Item Master',
    defaultSelected: true,
    align: 'left',
    getValue: (i) => i.Barcode || i.barcode || ''
  },
  {
    id: 'group',
    label: 'Item Group',
    groupType: 'import',
    category: 'Item Master',
    defaultSelected: true,
    align: 'left',
    getValue: (i) => i.Group || i.group || ''
  },
  {
    id: 'category',
    label: 'Category',
    groupType: 'import',
    category: 'Item Master',
    defaultSelected: true,
    align: 'left',
    getValue: (i) => i.Category || i.category || ''
  },
  {
    id: 'serials',
    label: 'Serial No',
    groupType: 'import',
    category: 'Stock',
    defaultSelected: true,
    align: 'left',
    getValue: (i) => i['Opening Serials'] || ''
  }
];

export const ADDITIONAL_STOCK_COLUMNS: StockExportField[] = [
  {
    id: 'currentStock',
    label: 'Current Stock Qty',
    groupType: 'additional',
    category: 'Stock',
    defaultSelected: true,
    align: 'right',
    isNumeric: true,
    getValue: (i) => Number(i['Current Stock'] ?? i.currentStock) || 0
  },
  {
    id: 'valuation',
    label: 'Stock Valuation (Nu.)',
    groupType: 'additional',
    category: 'Pricing',
    defaultSelected: true,
    align: 'right',
    isNumeric: true,
    isCurrency: true,
    getValue: (i) => {
      const cur = Number(i['Current Stock'] ?? i.currentStock) || 0;
      const cost = Number(i['Purchase Rate'] ?? i.purchaseRate) || 0;
      return Math.round(cur * cost * 100) / 100;
    }
  },
  {
    id: 'code',
    label: 'Item Code',
    groupType: 'additional',
    category: 'Item Master',
    defaultSelected: true,
    align: 'left',
    getValue: (i) => i['Item Code'] || i.itemCode || ''
  },
  {
    id: 'stockStatus',
    label: 'Stock Status',
    groupType: 'additional',
    category: 'Stock',
    defaultSelected: false,
    align: 'center',
    getValue: (i) => {
      if (i['Maintain Stock'] === 'N') return 'Non-Stock';
      const cur = Number(i['Current Stock'] ?? i.currentStock) || 0;
      const reorder = Number(i['Reorder Level'] ?? i.reorderLevel) || 0;
      if (cur <= 0) return 'Out of Stock';
      if (reorder > 0 && cur <= reorder) return 'Low Stock';
      return 'In Stock';
    }
  },
  {
    id: 'reorderLevel',
    label: 'Reorder Level',
    groupType: 'additional',
    category: 'Stock',
    defaultSelected: false,
    align: 'right',
    isNumeric: true,
    getValue: (i) => Number(i['Reorder Level'] ?? i.reorderLevel) || 0
  },
  {
    id: 'printName',
    label: 'Print Name',
    groupType: 'additional',
    category: 'Item Master',
    defaultSelected: false,
    align: 'left',
    getValue: (i) => i['Print Name'] || i.printName || i['Item Name'] || i.itemName || ''
  },
  {
    id: 'gstRate',
    label: 'GST %',
    groupType: 'additional',
    category: 'Tax & Compliance',
    defaultSelected: false,
    align: 'right',
    isNumeric: true,
    getValue: (i) => Number(i['GST %'] ?? i.gstRate) || 0
  },
  {
    id: 'hsnSac',
    label: 'HSN / SAC Code',
    groupType: 'additional',
    category: 'Tax & Compliance',
    defaultSelected: false,
    align: 'left',
    getValue: (i) => i['HSN/SAC'] || i.hsnSac || ''
  },
  {
    id: 'maintainStock',
    label: 'Maintain Stock (Y/N)',
    groupType: 'additional',
    category: 'Stock',
    defaultSelected: false,
    align: 'center',
    getValue: (i) => (i['Maintain Stock'] === 'N' ? 'No' : 'Yes')
  },
  {
    id: 'zeroRated',
    label: 'Zero Rated (Y/N)',
    groupType: 'additional',
    category: 'Tax & Compliance',
    defaultSelected: false,
    align: 'center',
    getValue: (i) => i['Zero Rated (Y/N)'] || i.zeroRated || 'N'
  }
];

const ALL_STOCK_FIELDS: StockExportField[] = [
  ...IMPORT_STOCK_COLUMNS,
  ...ADDITIONAL_STOCK_COLUMNS
];

const PRESETS = [
  {
    id: 'import17',
    label: 'Import Format (17 Fields)',
    description: 'Exact 17 columns in sequence (Item Name to Serial No) matching Import template',
    fieldIds: IMPORT_STOCK_COLUMNS.map((f) => f.id)
  },
  {
    id: 'complete',
    label: 'Complete All (27 Fields)',
    description: 'All 17 import columns plus current stock, valuation, item code & tax',
    fieldIds: ALL_STOCK_FIELDS.map((f) => f.id)
  },
  {
    id: 'standard',
    label: 'Stock Summary & Valuation',
    description: 'Code, Barcode, Item Name, Group, Category, Unit, Stock Qty, Valuation',
    fieldIds: ['code', 'barcode', 'name', 'group', 'category', 'baseUnit', 'currentStock', 'stockStatus', 'saleRate', 'valuation']
  },
  {
    id: 'pricing',
    label: 'Price List Only',
    description: 'Barcode, Name, Group, Units, Purchase, Sale, Wholesale, MRP, GST',
    fieldIds: ['barcode', 'name', 'group', 'baseUnit', 'altUnit', 'purchaseRate', 'saleRate', 'wholesaleRate', 'mrp', 'gstRate']
  }
];

const LOCAL_STORAGE_KEY = 'deep_pos_stock_export_fields_selection_v1';

interface ExportStockExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: Item[];
  config: Config;
  defaultGroupFilter?: string;
  defaultCategoryFilter?: string;
  title?: string;
}

export const ExportStockExcelModal: React.FC<ExportStockExcelModalProps> = ({
  isOpen,
  onClose,
  items,
  config,
  defaultGroupFilter = 'ALL',
  defaultCategoryFilter = 'ALL',
  title = 'Export Stock Report to Excel'
}) => {
  // Track exact order in which columns were checked
  const [orderedKeys, setOrderedKeys] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Normalize any legacy IDs
          const mapped = parsed.map((k: string) => {
            if (k === 'itemName') return 'name';
            if (k === 'unit') return 'baseUnit';
            if (k === 'openingStock') return 'openingQty';
            return k;
          });
          const valid = mapped.filter((k: string) => ALL_STOCK_FIELDS.some((f) => f.id === k));
          if (valid.length > 0) return valid;
        }
      }
    } catch {}
    // Default preset: all 17 Import Columns + Current Stock + Valuation
    return [
      ...IMPORT_STOCK_COLUMNS.map((c) => c.id),
      'currentStock',
      'valuation'
    ];
  });

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [currentStockDate, setCurrentStockDate] = useState<string>(todayStr);

  const [activePreset, setActivePreset] = useState<string>('custom');
  const [fieldSearch, setFieldSearch] = useState('');
  const [filterStockStatus, setFilterStockStatus] = useState<'all' | 'instock' | 'lowstock' | 'outofstock'>('all');
  const [filterGroup, setFilterGroup] = useState<string>(defaultGroupFilter || 'ALL');
  const [filterCategory, setFilterCategory] = useState<string>(defaultCategoryFilter || 'ALL');
  const [includeNonStock, setIncludeNonStock] = useState<boolean>(true);
  const [includeCompanyHeader, setIncludeCompanyHeader] = useState<boolean>(true);
  const [includeTotalsRow, setIncludeTotalsRow] = useState<boolean>(true);
  const [fileNameCustom, setFileNameCustom] = useState<string>(() => {
    const d = new Date().toISOString().split('T')[0];
    return `Stock_Report_${d}`;
  });

  // Calculate stock balances as of the selected date
  const stockBalances = useMemo(() => {
    return getStockBalancesAsOfDate(currentStockDate);
  }, [currentStockDate, items]);

  // Augment items with the calculated stock as of the chosen date
  const itemsWithHistoricalStock = useMemo(() => {
    return items.map((item) => {
      const code = item['Item Code'];
      const calculatedStock = stockBalances[code] !== undefined ? stockBalances[code] : (Number(item['Current Stock']) || 0);
      return {
        ...item,
        'Current Stock': calculatedStock,
        currentStock: calculatedStock
      };
    });
  }, [items, stockBalances]);

  // Keep filters in sync when default props change
  useEffect(() => {
    if (defaultGroupFilter && defaultGroupFilter !== 'ALL') {
      setFilterGroup(defaultGroupFilter);
    }
    if (defaultCategoryFilter && defaultCategoryFilter !== 'ALL') {
      setFilterCategory(defaultCategoryFilter);
    }
  }, [defaultGroupFilter, defaultCategoryFilter]);

  // When stock as of date changes, keep file name synced if using default prefix
  useEffect(() => {
    setFileNameCustom((prev) => {
      if (prev.startsWith('Stock_Report_')) {
        return `Stock_Report_${currentStockDate}`;
      }
      return prev;
    });
  }, [currentStockDate]);

  // Persist user column choices and sequence
  const toggleColumn = (key: string, forceCheck?: boolean) => {
    setActivePreset('custom');
    setOrderedKeys((prev) => {
      let updated: string[];
      if (forceCheck !== undefined) {
        if (forceCheck && !prev.includes(key)) {
          updated = [...prev, key];
        } else if (!forceCheck && prev.includes(key)) {
          updated = prev.filter((k) => k !== key);
        } else {
          return prev;
        }
      } else {
        if (prev.includes(key)) {
          updated = prev.filter((k) => k !== key);
        } else {
          updated = [...prev, key];
        }
      }
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const applyPreset = (presetId: string) => {
    const preset = PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setActivePreset(presetId);
    setOrderedKeys(preset.fieldIds);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(preset.fieldIds));
    } catch {}
  };

  const selectAll = () => {
    setActivePreset('complete');
    const allIds = ALL_STOCK_FIELDS.map((f) => f.id);
    setOrderedKeys(allIds);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(allIds));
    } catch {}
  };

  const deselectAll = () => {
    setActivePreset('custom');
    setOrderedKeys([]);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([]));
    } catch {}
  };

  const selectImport17 = () => {
    setActivePreset('import17');
    const ids = IMPORT_STOCK_COLUMNS.map((c) => c.id);
    setOrderedKeys(ids);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(ids));
    } catch {}
  };

  // Distinct groups & categories for filtering
  const distinctGroups = useMemo(() => {
    const s = new Set<string>();
    itemsWithHistoricalStock.forEach((it) => {
      const g = (it.Group || (it as any).group || '').trim();
      if (g) s.add(g);
    });
    return Array.from(s).sort();
  }, [itemsWithHistoricalStock]);

  const distinctCategories = useMemo(() => {
    const s = new Set<string>();
    itemsWithHistoricalStock.forEach((it) => {
      const c = (it.Category || (it as any).category || '').trim();
      if (c) s.add(c);
    });
    return Array.from(s).sort();
  }, [itemsWithHistoricalStock]);

  // Filtered items to export
  const exportableItems = useMemo(() => {
    return itemsWithHistoricalStock.filter((it: any) => {
      if (!includeNonStock && it['Maintain Stock'] === 'N') return false;

      const group = it.Group || it.group || '';
      if (filterGroup !== 'ALL' && group !== filterGroup) return false;

      const category = it.Category || it.category || '';
      if (filterCategory !== 'ALL' && category !== filterCategory) return false;

      const cur = Number(it['Current Stock'] ?? it.currentStock) || 0;
      const reorder = Number(it['Reorder Level'] ?? it.reorderLevel) || 0;

      if (filterStockStatus === 'instock' && cur <= 0) return false;
      if (filterStockStatus === 'outofstock' && cur > 0) return false;
      if (filterStockStatus === 'lowstock' && (cur <= 0 || cur > reorder)) return false;

      return true;
    });
  }, [itemsWithHistoricalStock, includeNonStock, filterGroup, filterCategory, filterStockStatus]);

  // Ordered fields to export based on user selection sequence
  const activeFields = useMemo(() => {
    return orderedKeys
      .map((id) => ALL_STOCK_FIELDS.find((f) => f.id === id))
      .filter(Boolean) as StockExportField[];
  }, [orderedKeys]);

  // Filter column lists for search
  const filteredImportColumns = useMemo(() => {
    if (!fieldSearch.trim()) return IMPORT_STOCK_COLUMNS;
    const q = fieldSearch.toLowerCase();
    return IMPORT_STOCK_COLUMNS.filter((c) => c.label.toLowerCase().includes(q));
  }, [fieldSearch]);

  const filteredAdditionalColumns = useMemo(() => {
    if (!fieldSearch.trim()) return ADDITIONAL_STOCK_COLUMNS;
    const q = fieldSearch.toLowerCase();
    return ADDITIONAL_STOCK_COLUMNS.filter((c) => c.label.toLowerCase().includes(q));
  }, [fieldSearch]);

  // Run the Excel export
  const handleExport = () => {
    if (activeFields.length === 0) {
      alert('Please select at least one field to export.');
      return;
    }

    try {
      const aoa: any[][] = [];
      const colHeaders = activeFields.map((f) => {
        if (f.id === 'currentStock' && currentStockDate !== todayStr) {
          return `Stock Qty (As of ${currentStockDate})`;
        }
        if (f.id === 'valuation' && currentStockDate !== todayStr) {
          return `Stock Valuation (As of ${currentStockDate})`;
        }
        return f.label;
      });
      const currencySymbol = config.CurrencySymbol || 'Nu.';
      const exportDate = new Date().toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });

      let startRow = 0;

      if (includeCompanyHeader) {
        aoa.push([config.CompanyName || 'Business Inventory Report']);
        aoa.push(['Complete Stock Summary & Valuation Statement']);
        aoa.push([
          `Stock As Of Date: ${currentStockDate} | Generated on: ${exportDate} | Filter: Group [${filterGroup}], Category [${filterCategory}], Status [${filterStockStatus}] | Total Items: ${exportableItems.length}`
        ]);
        aoa.push([]); // blank row
        startRow = 4;
      }

      // Add table headers
      aoa.push(colHeaders);

      // Add item data rows
      const dataRows: any[][] = [];
      const colTotals: Record<number, number> = {};

      exportableItems.forEach((item) => {
        const row: any[] = [];
        activeFields.forEach((field, colIdx) => {
          const val = field.getValue(item, config);
          row.push(val);

          // Track sum for numeric fields like stock & valuation
          if (field.isNumeric && typeof val === 'number') {
            colTotals[colIdx] = (colTotals[colIdx] || 0) + val;
          }
        });
        dataRows.push(row);
        aoa.push(row);
      });

      // Add Grand Totals row if enabled
      let totalsRowIdx = -1;
      if (includeTotalsRow && exportableItems.length > 0) {
        totalsRowIdx = aoa.length;
        const totRow: any[] = [];
        activeFields.forEach((field, colIdx) => {
          if (colIdx === 0) {
            totRow.push('GRAND TOTAL');
          } else if (colTotals[colIdx] !== undefined) {
            if (field.id === 'currentStock' || field.id === 'openingStock') {
              totRow.push(Math.round(colTotals[colIdx] * 100) / 100);
            } else if (field.id === 'valuation') {
              totRow.push(Math.round(colTotals[colIdx] * 100) / 100);
            } else {
              totRow.push('');
            }
          } else {
            totRow.push('');
          }
        });
        aoa.push(totRow);
      }

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(aoa);

      // Auto-fit column widths with minimum padding
      const maxCols = colHeaders.length;
      const colWidths = activeFields.map((field, cIdx) => {
        let maxLen = field.label.length;
        dataRows.forEach((r) => {
          const cellVal = r[cIdx];
          if (cellVal !== undefined && cellVal !== null) {
            const l = String(cellVal).length;
            if (l > maxLen) maxLen = l;
          }
        });
        return Math.max(maxLen + 3, 11);
      });
      ws['!cols'] = colWidths.map((w) => ({ wch: w }));

      // Merge header rows if company header is present
      if (includeCompanyHeader && maxCols > 1) {
        ws['!merges'] = [
          { s: { r: 0, c: 0 }, e: { r: 0, c: maxCols - 1 } },
          { s: { r: 1, c: 0 }, e: { r: 1, c: maxCols - 1 } },
          { s: { r: 2, c: 0 }, e: { r: 2, c: maxCols - 1 } }
        ];

        // Format Company Title
        const c0 = XLSX.utils.encode_cell({ r: 0, c: 0 });
        if (ws[c0]) {
          ws[c0].s = {
            font: { name: 'Calibri', sz: 16, bold: true, color: { rgb: '1E1B4B' } },
            alignment: { horizontal: 'center', vertical: 'center' }
          };
        }

        // Format Report Title
        const c1 = XLSX.utils.encode_cell({ r: 1, c: 0 });
        if (ws[c1]) {
          ws[c1].s = {
            font: { name: 'Calibri', sz: 12, bold: true, color: { rgb: '3730A3' } },
            alignment: { horizontal: 'center', vertical: 'center' }
          };
        }

        // Format Subtitle
        const c2 = XLSX.utils.encode_cell({ r: 2, c: 0 });
        if (ws[c2]) {
          ws[c2].s = {
            font: { name: 'Calibri', sz: 9, italic: true, color: { rgb: '64748B' } },
            alignment: { horizontal: 'center', vertical: 'center' }
          };
        }
      }

      // Style Table Header Row
      activeFields.forEach((field, cIdx) => {
        const cellRef = XLSX.utils.encode_cell({ r: startRow, c: cIdx });
        if (ws[cellRef]) {
          ws[cellRef].s = {
            font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
            fill: { fgColor: { rgb: '312E81' } }, // Indigo 900
            alignment: {
              horizontal: field.align || 'left',
              vertical: 'center',
              wrapText: true
            },
            border: {
              top: { style: 'thin', color: { rgb: '1E1B4B' } },
              bottom: { style: 'medium', color: { rgb: '1E1B4B' } }
            }
          };
        }
      });

      // Style Data Rows
      const dataStart = startRow + 1;
      const dataEnd = dataStart + dataRows.length;
      for (let r = dataStart; r < dataEnd; r++) {
        const isEven = (r - dataStart) % 2 === 0;
        activeFields.forEach((field, cIdx) => {
          const cellRef = XLSX.utils.encode_cell({ r, c: cIdx });
          if (ws[cellRef]) {
            ws[cellRef].s = {
              font: { name: 'Calibri', sz: 10, color: { rgb: '1E293B' } },
              fill: isEven ? { fgColor: { rgb: 'FFFFFF' } } : { fgColor: { rgb: 'F8FAFC' } },
              alignment: {
                horizontal: field.align || 'left',
                vertical: 'center'
              },
              border: {
                bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
                right: { style: 'thin', color: { rgb: 'F1F5F9' } }
              }
            };

            // Currency formatting
            if (field.isCurrency && typeof ws[cellRef].v === 'number') {
              ws[cellRef].z = '#,##0.00';
            } else if (field.isNumeric && typeof ws[cellRef].v === 'number') {
              ws[cellRef].z = '#,##0';
            }
          }
        });
      }

      // Style Totals Row
      if (totalsRowIdx >= 0) {
        activeFields.forEach((field, cIdx) => {
          const cellRef = XLSX.utils.encode_cell({ r: totalsRowIdx, c: cIdx });
          if (ws[cellRef]) {
            ws[cellRef].s = {
              font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: '0F172A' } },
              fill: { fgColor: { rgb: 'E0E7FF' } }, // Light Indigo
              alignment: {
                horizontal: field.align || (cIdx === 0 ? 'left' : 'right'),
                vertical: 'center'
              },
              border: {
                top: { style: 'medium', color: { rgb: '4338CA' } },
                bottom: { style: 'double', color: { rgb: '4338CA' } }
              }
            };
            if ((field.id === 'valuation' || field.isCurrency) && typeof ws[cellRef].v === 'number') {
              ws[cellRef].z = '#,##0.00';
            } else if (field.isNumeric && typeof ws[cellRef].v === 'number') {
              ws[cellRef].z = '#,##0';
            }
          }
        });
      }

      XLSX.utils.book_append_sheet(wb, ws, 'Stock Report');

      const safeName = (fileNameCustom.trim() || 'Stock_Report').replace(/[^a-zA-Z0-9_\-]/g, '_');
      XLSX.writeFile(wb, `${safeName}.xlsx`);

      onClose();
    } catch (err) {
      console.error('Failed to export stock report:', err);
      alert('Error generating Excel export. Please check browser console.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="relative flex flex-col w-full max-w-4xl max-h-[92vh] rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-gradient-to-r from-indigo-50/70 via-white to-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <span>{title}</span>
                <span className="text-[11px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                  Excel (.xlsx)
                </span>
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Choose complete all-fields export or select customized columns
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Quick Presets Bar */}
          <div className="rounded-xl bg-slate-50 p-3 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>Export Presets:</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  Select All ({ALL_STOCK_FIELDS.length})
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={deselectAll}
                  className="text-[11px] font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5" />
                  Deselect All
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {PRESETS.map((p) => {
                const isActive = activePreset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPreset(p.id)}
                    className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                      isActive
                        ? 'border-indigo-600 bg-indigo-50/80 ring-2 ring-indigo-200 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-bold text-xs text-slate-900 flex items-center justify-between">
                      <span>{p.label}</span>
                      {isActive && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{p.description}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Filters & Options Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-white p-3 rounded-xl border border-slate-200 text-xs">
            {/* Current Stock As Of Date Filter */}
            <div className="bg-emerald-50/70 p-1.5 rounded-lg border border-emerald-200">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-emerald-900 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Stock As Of Date</span>
                </label>
                {currentStockDate !== todayStr && (
                  <button
                    type="button"
                    onClick={() => setCurrentStockDate(todayStr)}
                    className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 underline cursor-pointer"
                    title="Reset to today's date"
                  >
                    Today
                  </button>
                )}
              </div>
              <input
                type="date"
                value={currentStockDate}
                onChange={(e) => setCurrentStockDate(e.target.value)}
                className="w-full h-8 rounded-lg border border-emerald-300 px-2 font-semibold text-xs outline-none bg-white text-emerald-950 focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Stock Status Filter */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Items to Include</label>
              <select
                value={filterStockStatus}
                onChange={(e) => setFilterStockStatus(e.target.value as any)}
                className="w-full h-8 rounded-lg border border-slate-300 px-2 font-medium text-xs outline-none bg-slate-50 focus:bg-white focus:border-indigo-500"
              >
                <option value="all">All Items ({items.length})</option>
                <option value="instock">In Stock Only (&gt; 0)</option>
                <option value="lowstock">Low Stock Only (≤ Reorder)</option>
                <option value="outofstock">Out of Stock Only (0)</option>
              </select>
            </div>

            {/* Stock Group Filter */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Group / Brand</label>
              <select
                value={filterGroup}
                onChange={(e) => setFilterGroup(e.target.value)}
                className="w-full h-8 rounded-lg border border-slate-300 px-2 font-medium text-xs outline-none bg-slate-50 focus:bg-white focus:border-indigo-500"
              >
                <option value="ALL">All Groups</option>
                {distinctGroups.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            {/* Category Filter */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Category</label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full h-8 rounded-lg border border-slate-300 px-2 font-medium text-xs outline-none bg-slate-50 focus:bg-white focus:border-indigo-500"
              >
                <option value="ALL">All Categories</option>
                {distinctCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* File Name */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">File Name (.xlsx)</label>
              <input
                type="text"
                value={fileNameCustom}
                onChange={(e) => setFileNameCustom(e.target.value)}
                className="w-full h-8 rounded-lg border border-slate-300 px-2 font-mono text-xs outline-none bg-slate-50 focus:bg-white focus:border-indigo-500"
                placeholder="File name"
              />
            </div>
          </div>

          {/* Formatting Checkboxes */}
          <div className="flex flex-wrap items-center gap-4 px-1 text-xs text-slate-700">
            <label className="flex items-center gap-1.5 cursor-pointer font-medium hover:text-indigo-700 select-none">
              <input
                type="checkbox"
                checked={includeCompanyHeader}
                onChange={(e) => setIncludeCompanyHeader(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Include Company Header & Timestamp</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer font-medium hover:text-indigo-700 select-none">
              <input
                type="checkbox"
                checked={includeTotalsRow}
                onChange={(e) => setIncludeTotalsRow(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Include Grand Totals Row</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer font-medium hover:text-indigo-700 select-none">
              <input
                type="checkbox"
                checked={includeNonStock}
                onChange={(e) => setIncludeNonStock(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Include Non-Stock Items</span>
            </label>
          </div>

          {/* Column Selection Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-slate-200">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
                <span className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">
                  Select Excel Columns ({orderedKeys.length} of {ALL_STOCK_FIELDS.length} selected)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative w-48 sm:w-56">
                  <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search column..."
                    value={fieldSearch}
                    onChange={(e) => setFieldSearch(e.target.value)}
                    className="w-full h-7.5 pl-8 pr-2 text-xs rounded-lg border border-slate-200 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* 1. Item Master & Import Fields (Matches Import Items Column Selection) */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                    <span>1. Item Master &amp; Import Fields (in sequence):</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    17 core columns arranged to match the Import Items template format
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={selectImport17}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1 rounded-lg transition cursor-pointer"
                  >
                    Select All 17 Import Fields
                  </button>
                  <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                    {orderedKeys.filter((k) => IMPORT_STOCK_COLUMNS.some((c) => c.id === k)).length} / {IMPORT_STOCK_COLUMNS.length}
                  </span>
                </div>
              </div>

              {/* Pill tick boxes */}
              <div className="flex flex-wrap gap-2.5 pt-1">
                {filteredImportColumns.map((col) => {
                  const isChecked = orderedKeys.includes(col.id);
                  const orderIndex = orderedKeys.indexOf(col.id);
                  return (
                    <label
                      key={col.id}
                      className={`flex items-center gap-2 cursor-pointer text-xs font-medium px-3 py-1.5 rounded-full border transition-colors select-none ${
                        isChecked
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-900 shadow-xs font-semibold'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => toggleColumn(col.id, e.target.checked)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer"
                      />
                      <span>{col.label}</span>
                      {col.isRequired && <span className="text-red-500 font-bold">*</span>}
                      {isChecked && (
                        <span className="ml-1 flex items-center justify-center w-4 h-4 rounded-full bg-indigo-600 text-[10px] text-white font-bold shrink-0">
                          {orderIndex + 1}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>

            {/* 2. Stock Balances, Valuation & Additional Fields */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                    <span>2. Stock Balances, Valuation &amp; Additional Fields:</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Calculated stock balance as of selected date, valuation &amp; compliance attributes
                  </p>
                </div>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                  {orderedKeys.filter((k) => ADDITIONAL_STOCK_COLUMNS.some((c) => c.id === k)).length} / {ADDITIONAL_STOCK_COLUMNS.length} selected
                </span>
              </div>

              {/* Pill tick boxes */}
              <div className="flex flex-wrap gap-2.5 pt-1">
                {filteredAdditionalColumns.map((col) => {
                  const isChecked = orderedKeys.includes(col.id);
                  const orderIndex = orderedKeys.indexOf(col.id);
                  return (
                    <label
                      key={col.id}
                      className={`flex items-center gap-2 cursor-pointer text-xs font-medium px-3 py-1.5 rounded-full border transition-colors select-none ${
                        isChecked
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-950 shadow-xs font-semibold'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => toggleColumn(col.id, e.target.checked)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-600 cursor-pointer"
                      />
                      <span>{col.label}</span>
                      {isChecked && (
                        <span className="ml-1 flex items-center justify-center w-4 h-4 rounded-full bg-emerald-600 text-[10px] text-white font-bold shrink-0">
                          {orderIndex + 1}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100 bg-slate-50 flex-wrap gap-2">
          <div className="text-xs text-slate-600 font-medium flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
              <Package className="w-3.5 h-3.5 text-slate-500" />
              <strong>{exportableItems.length}</strong> items to export
            </span>
            <span className="inline-flex items-center gap-1 bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
              <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600" />
              <strong>{activeFields.length}</strong> columns
            </span>
            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-lg font-semibold">
              <Calendar className="w-3.5 h-3.5 text-emerald-600" />
              <span>Stock As Of: <strong>{currentStockDate}</strong></span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/70 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={activeFields.length === 0 || exportableItems.length === 0}
              className={`inline-flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-xl text-white shadow-md transition cursor-pointer ${
                activeFields.length === 0 || exportableItems.length === 0
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 active:scale-98'
              }`}
            >
              <Download className="w-4 h-4" />
              <span>Export to Excel (.xlsx)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
