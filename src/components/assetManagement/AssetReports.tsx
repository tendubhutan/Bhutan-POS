import React, { useState, useEffect, useRef } from 'react';
import { Config } from '../../types';
import { 
  getAssets, 
  getAssetCategories, 
  getDepreciations,
  getDisposals,
  getCustodians,
  DEFAULT_CATEGORIES
} from '../../services/assetManagementService';
import { FixedAsset, AssetCategory, DepreciationTransaction, AssetDisposal, Custodian } from '../../types/assetManagement';
import { 
  FileText, 
  Search, 
  Download, 
  Printer, 
  FileSpreadsheet, 
  Building2, 
  TrendingDown, 
  Layers, 
  CheckCircle2,
  X,
  Eye,
  Calendar,
  Filter,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Maximize2,
  Minimize2,
  Tag,
  MapPin,
  UserCheck,
  ShieldCheck,
  Info
} from 'lucide-react';
import * as XLSX from 'xlsx-js-style';

interface AssetReportsProps {
  config: Config;
}

// Standard PPE categories fallback matching Note 2 schedule
const DEFAULT_PPE_CATEGORIES: Partial<AssetCategory>[] = [
  { name: 'Building (Permanent Structure)', defaultRate: 2 },
  { name: 'Computer & Accessories', defaultRate: 15 },
  { name: 'Electrical Installation', defaultRate: 5 },
  { name: 'Furniture & Fixtures', defaultRate: 15 },
  { name: 'Fencing', defaultRate: 3 },
  { name: 'Building (Temporary Structure)', defaultRate: 20 },
  { name: 'Construction of New TV', defaultRate: 15 },
  { name: 'Land', defaultRate: 0 },
  { name: 'Office Equipment', defaultRate: 15 },
  { name: 'Photography Equipment', defaultRate: 15 },
  { name: 'Radio Equipment', defaultRate: 15 },
  { name: 'Studio Equipments', defaultRate: 15 },
  { name: 'TV Equipments', defaultRate: 15 },
  { name: 'Roads & Culverts', defaultRate: 3 },
  { name: 'Motor Vehicles', defaultRate: 15 },
  { name: 'Transmission Equipment', defaultRate: 15 },
  { name: 'Transmission Towers', defaultRate: 3 },
  { name: 'Building (Semi-Permanent)', defaultRate: 6.5 },
  { name: 'Intangible Asset', defaultRate: 20 }
];

export const AssetReports: React.FC<AssetReportsProps & {
  isFullScreen?: boolean;
  onToggleFullScreen?: (val: boolean) => void;
}> = ({ config, isFullScreen = false, onToggleFullScreen }) => {
  const [activeTab, setActiveTab] = useState<'ppe' | 'schedule' | 'register'>('ppe');
  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [depreciations, setDepreciations] = useState<DepreciationTransaction[]>([]);
  const [disposals, setDisposals] = useState<AssetDisposal[]>([]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('All');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedLocation, setSelectedLocation] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  
  const [custodians, setCustodians] = useState<Custodian[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [selectedDeepAsset, setSelectedDeepAsset] = useState<FixedAsset | null>(null);
  
  const [showPrintModal, setShowPrintModal] = useState(false);
  const printContainerRef = useRef<HTMLDivElement>(null);

  const toggleCategoryExpand = (catName: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(catName)) {
        next.delete(catName);
      } else {
        next.add(catName);
      }
      return next;
    });
  };

  const loadData = () => {
    const loadedAssets = getAssets();
    const loadedCats = getAssetCategories();
    const loadedDeps = getDepreciations();
    const loadedDisp = getDisposals();
    const loadedCust = getCustodians();

    setAssets(loadedAssets);
    setDepreciations(loadedDeps);
    setDisposals(loadedDisp);
    setCustodians(loadedCust);

    // Merge default categories with loaded categories to ensure all standard PPE schedule lines exist
    const catMap = new Map<string, AssetCategory>();
    DEFAULT_CATEGORIES.forEach(c => catMap.set(c.name.toLowerCase(), c));
    loadedCats.forEach(c => catMap.set(c.name.toLowerCase(), c));
    const combinedCats = Array.from(catMap.values());
    setCategories(combinedCats);

    // Determine default year/period from posted depreciations or assets
    if (loadedDeps.length > 0) {
      const yearsInDeps = Array.from(new Set(loadedDeps.map(d => d.financialYear))).filter(Boolean);
      if (yearsInDeps.length > 0 && !yearsInDeps.includes(selectedYear)) {
        setSelectedYear(yearsInDeps[yearsInDeps.length - 1]);
      }
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener('storage', loadData);
    return () => window.removeEventListener('storage', loadData);
  }, []);

  // Compute available years dynamically
  const availableYears = Array.from(
    new Set([
      'All',
      '2024',
      '2025',
      '2026',
      '2027',
      '2028',
      ...depreciations.map(d => d.financialYear).filter(Boolean),
      ...assets.map(a => a.purchaseDate ? a.purchaseDate.substring(0, 4) : '2026').filter(Boolean)
    ])
  ).sort();

  // Compute available accounting periods dynamically
  const availablePeriods = Array.from(
    new Set([
      'All',
      ...depreciations.map(d => d.accountingPeriod).filter(Boolean)
    ])
  );

  const availableLocations = Array.from(
    new Set(assets.map(a => a.location).filter(Boolean))
  ).sort();

  const availableStatuses = Array.from(
    new Set(assets.map(a => a.status).filter(Boolean))
  ).sort();

  const currentYearNum = parseInt(selectedYear !== 'All' ? selectedYear : '2026', 10);
  const prevYearNum = currentYearNum - 1;

  // Dynamic Date Strings for Headers
  const openingDateHeader = selectedYear === 'All' ? 'Opening Balance' : `Opening as on 01.01.${currentYearNum}`;
  const closingDateHeader = selectedPeriod !== 'All' 
    ? `Closing as on ${selectedPeriod}` 
    : (selectedYear === 'All' ? 'Closing Balance' : `Closing as on 31.12.${currentYearNum}`);
  
  const netClosingHeader = selectedPeriod !== 'All' 
    ? `As on ${selectedPeriod}` 
    : (selectedYear === 'All' ? 'Current Net Block' : `As on 31.12.${currentYearNum}`);
  
  const netPrevHeader = selectedYear === 'All' ? 'Previous Period' : `As on 31.12.${prevYearNum}`;

  // Filtered Depreciations
  const filteredDepreciations = depreciations.filter(d => {
    const asset = assets.find(a => a.id === d.assetId || a.assetId === d.assetId);
    const matchesSearch = !searchQuery || 
      d.accountingPeriod.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.journalId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (asset && (asset.name.toLowerCase().includes(searchQuery.toLowerCase()) || asset.assetId.toLowerCase().includes(searchQuery.toLowerCase())));
    
    const matchesYear = selectedYear === 'All' || d.financialYear === selectedYear;
    const matchesPeriod = selectedPeriod === 'All' || d.accountingPeriod.toLowerCase() === selectedPeriod.toLowerCase();
    const matchesCat = selectedCategory === 'All' || (asset && (asset.categoryId === selectedCategory || asset.categoryId.toLowerCase().includes(selectedCategory.toLowerCase())));

    return matchesSearch && matchesYear && matchesPeriod && matchesCat;
  });

  // Filtered Assets
  const filteredAssets = assets.filter(a => {
    const matchesSearch = !searchQuery || 
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      a.assetId.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCat = selectedCategory === 'All' || a.categoryId === selectedCategory || a.categoryId.toLowerCase().includes(selectedCategory.toLowerCase());
    const matchesLoc = selectedLocation === 'All' || a.location === selectedLocation;
    const matchesStatus = selectedStatus === 'All' || a.status === selectedStatus;

    return matchesSearch && matchesCat && matchesLoc && matchesStatus;
  });

  // BUILD DYNAMIC PPE SCHEDULE DATA MATRICES (Note 2 Format)
  const computeCategoryRow = (catName: string, rate: number, catId?: string) => {
    const catAssets = assets.filter(a => {
      if (!a) return false;

      // 1. Direct category ID or code match
      if (catId && (a.categoryId === catId || a.categoryId === catId.toLowerCase())) return true;
      if (a.categoryId && (
        a.categoryId.toLowerCase() === catName.toLowerCase() ||
        a.categoryId.toLowerCase().includes(catName.toLowerCase())
      )) return true;

      // 2. subCategory match
      if (a.subCategory && (
        a.subCategory.toLowerCase() === catName.toLowerCase() ||
        a.subCategory.toLowerCase().includes(catName.toLowerCase()) ||
        catName.toLowerCase().includes(a.subCategory.toLowerCase())
      )) return true;

      // 3. Asset name keyword match
      if (catName && a.name && (
        a.name.toLowerCase().includes(catName.toLowerCase()) ||
        (catName.toLowerCase().includes('computer') && (a.name.toLowerCase().includes('server') || a.name.toLowerCase().includes('macbook') || a.name.toLowerCase().includes('laptop') || a.name.toLowerCase().includes('pc') || a.name.toLowerCase().includes('computer'))) ||
        (catName.toLowerCase().includes('building') && (a.name.toLowerCase().includes('building') || a.name.toLowerCase().includes('office') || a.name.toLowerCase().includes('structure'))) ||
        (catName.toLowerCase().includes('vehicle') && (a.name.toLowerCase().includes('vehicle') || a.name.toLowerCase().includes('van') || a.name.toLowerCase().includes('car') || a.name.toLowerCase().includes('truck') || a.name.toLowerCase().includes('toyota'))) ||
        (catName.toLowerCase().includes('furniture') && (a.name.toLowerCase().includes('furniture') || a.name.toLowerCase().includes('table') || a.name.toLowerCase().includes('chair') || a.name.toLowerCase().includes('desk'))) ||
        (catName.toLowerCase().includes('office') && (a.name.toLowerCase().includes('printer') || a.name.toLowerCase().includes('copier') || a.name.toLowerCase().includes('scanner'))) ||
        (catName.toLowerCase().includes('electrical') && (a.name.toLowerCase().includes('generator') || a.name.toLowerCase().includes('electrical') || a.name.toLowerCase().includes('transformer'))) ||
        (catName.toLowerCase().includes('studio') && (a.name.toLowerCase().includes('camera') || a.name.toLowerCase().includes('studio') || a.name.toLowerCase().includes('audio'))) ||
        (catName.toLowerCase().includes('intangible') && (a.name.toLowerCase().includes('software') || a.name.toLowerCase().includes('erp') || a.name.toLowerCase().includes('license') || a.name.toLowerCase().includes('pos')))
      )) return true;

      // 4. Look up category in categories list
      const matchedCat = categories.find(c => c.id === a.categoryId || c.code === a.categoryId || c.name === a.categoryId);
      if (matchedCat && matchedCat.name.toLowerCase() === catName.toLowerCase()) return true;

      // 5. Standard ID mapping (cat-1 -> Building, cat-2 -> Computer, cat-3 -> Electrical, cat-4 -> Furniture, cat-5 -> Vehicles, cat-6 -> Office, cat-7 -> Studio, cat-8 -> Roads, cat-9 -> Intangible)
      if (a.categoryId === 'cat-1' && catName.toLowerCase().includes('building')) return true;
      if (a.categoryId === 'cat-2' && catName.toLowerCase().includes('computer')) return true;
      if (a.categoryId === 'cat-3' && catName.toLowerCase().includes('electrical')) return true;
      if (a.categoryId === 'cat-4' && catName.toLowerCase().includes('furniture')) return true;
      if (a.categoryId === 'cat-5' && catName.toLowerCase().includes('vehicle')) return true;
      if (a.categoryId === 'cat-6' && catName.toLowerCase().includes('office')) return true;
      if (a.categoryId === 'cat-7' && catName.toLowerCase().includes('studio')) return true;
      if (a.categoryId === 'cat-8' && catName.toLowerCase().includes('road')) return true;
      if (a.categoryId === 'cat-9' && catName.toLowerCase().includes('intangible')) return true;

      return false;
    });

    let grossOpening = 0;
    let grossAdditions = 0;
    let grossAdjustments = 0;

    catAssets.forEach(a => {
      const assetCost = Number(a.totalCapitalizedCost || a.cost || 0);
      const pDate = a.purchaseDate || a.capitalizationDate || a.createdAt || '';
      const pYear = pDate.length >= 4 ? parseInt(pDate.substring(0, 4), 10) : currentYearNum;

      if (selectedYear === 'All' || pYear < currentYearNum) {
        grossOpening += assetCost;
      } else if (pYear === currentYearNum) {
        grossAdditions += assetCost;
      } else {
        grossOpening += assetCost;
      }
    });

    const catDisposals = disposals.filter(d => {
      const asset = assets.find(a => a.id === d.assetId || a.assetId === d.assetId);
      if (!asset) return false;
      return catAssets.some(ca => ca.id === asset.id || ca.assetId === asset.assetId);
    });
    grossAdjustments = catDisposals.reduce((sum, d) => sum + Number(d.assetCost || 0), 0);
    const grossClosing = grossOpening + grossAdditions - grossAdjustments;

    // Filter depreciations for this category matching current year/period
    const catDeps = depreciations.filter(d => {
      const asset = assets.find(a => a.id === d.assetId || a.assetId === d.assetId);
      let isThisCat = false;
      if (asset) {
        isThisCat = catAssets.some(ca => ca.id === asset.id || ca.assetId === asset.assetId);
      } else {
        isThisCat = true;
      }
      const matchesYear = selectedYear === 'All' || d.financialYear === selectedYear;
      const matchesPeriod = selectedPeriod === 'All' || d.accountingPeriod.toLowerCase() === selectedPeriod.toLowerCase();
      return isThisCat && matchesYear && matchesPeriod;
    });

    let depAdditions = catDeps.reduce((sum, d) => sum + Number(d.depreciationAmount || 0), 0);
    let depAdjustments = catDisposals.reduce((sum, d) => sum + Number(d.accumulatedDepreciation || 0), 0);
    let depClosing = catAssets.reduce((sum, a) => sum + Number(a.accumulatedDepreciation || 0), 0);

    if (depClosing < depAdditions) {
      depClosing = depAdditions;
    }

    let depOpening = Math.max(0, depClosing - depAdditions + depAdjustments);

    let netClosing = grossClosing - depClosing;
    let netPrev = grossOpening - depOpening;

    // Determine effective rate
    let effectiveRate = rate;
    if (!effectiveRate || effectiveRate === 0) {
      const assetWithRate = catAssets.find(a => Number(a.depreciationRate) > 0);
      if (assetWithRate) {
        effectiveRate = Number(assetWithRate.depreciationRate);
      } else if (catName.toLowerCase().includes('computer')) effectiveRate = 15;
      else if (catName.toLowerCase().includes('building')) effectiveRate = 2;
      else if (catName.toLowerCase().includes('furniture')) effectiveRate = 15;
      else if (catName.toLowerCase().includes('vehicle')) effectiveRate = 15;
      else if (catName.toLowerCase().includes('office')) effectiveRate = 15;
      else if (catName.toLowerCase().includes('studio')) effectiveRate = 15;
      else if (catName.toLowerCase().includes('intangible')) effectiveRate = 20;
      else if (catName.toLowerCase().includes('road')) effectiveRate = 3;
      else if (catName.toLowerCase().includes('electrical')) effectiveRate = 5;
      else effectiveRate = 10;
    }

    // Cat assets itemized calculations for deep-down drilldown
    const itemizedAssets = catAssets.map(a => {
      const assetCost = Number(a.totalCapitalizedCost || a.cost || 0);
      const pDate = a.purchaseDate || a.capitalizationDate || a.createdAt || '';
      const pYear = pDate.length >= 4 ? parseInt(pDate.substring(0, 4), 10) : currentYearNum;

      let aGrossOpening = 0;
      let aGrossAdditions = 0;
      if (selectedYear === 'All' || pYear < currentYearNum) {
        aGrossOpening = assetCost;
      } else if (pYear === currentYearNum) {
        aGrossAdditions = assetCost;
      } else {
        aGrossOpening = assetCost;
      }

      const aDisposal = catDisposals.find(d => d.assetId === a.id || d.assetId === a.assetId);
      const aGrossAdjustments = aDisposal ? Number(aDisposal.assetCost || 0) : 0;
      const aGrossClosing = aGrossOpening + aGrossAdditions - aGrossAdjustments;

      // Filter depreciations for this asset matching current year/period
      const aDeps = catDeps.filter(d => d.assetId === a.id || d.assetId === a.assetId);
      const aDepAdditions = aDeps.reduce((sum, d) => sum + Number(d.depreciationAmount || 0), 0);
      const aDepAdjustments = aDisposal ? Number(aDisposal.accumulatedDepreciation || 0) : 0;
      
      let aDepClosing = Number(a.accumulatedDepreciation || 0);
      if (aDepClosing < aDepAdditions) {
        aDepClosing = aDepAdditions;
      }
      const aDepOpening = Math.max(0, aDepClosing - aDepAdditions + aDepAdjustments);
      const aNetClosing = aGrossClosing - aDepClosing;
      const aNetPrev = aGrossOpening - aDepOpening;

      return {
        asset: a,
        grossOpening: aGrossOpening,
        grossAdditions: aGrossAdditions,
        grossAdjustments: aGrossAdjustments,
        grossClosing: aGrossClosing,
        depOpening: aDepOpening,
        depAdditions: aDepAdditions,
        depAdjustments: aDepAdjustments,
        depClosing: aDepClosing,
        netClosing: aNetClosing,
        netPrev: aNetPrev
      };
    });

    return {
      name: catName,
      rate: effectiveRate,
      grossOpening,
      grossAdditions,
      grossAdjustments,
      grossClosing,
      depOpening,
      depAdditions,
      depAdjustments,
      depClosing,
      netClosing,
      netPrev,
      catAssets,
      itemizedAssets
    };
  };

  // Unified Category Rows (Including Intangible Assets in main list)
  const allScheduleRows = categories.map(cat => 
    computeCategoryRow(cat.name, cat.defaultRate ?? 10, cat.id)
  );

  // Grand Totals across all Categories
  const grandTotals = {
    grossOpening: allScheduleRows.reduce((s, r) => s + r.grossOpening, 0),
    grossAdditions: allScheduleRows.reduce((s, r) => s + r.grossAdditions, 0),
    grossAdjustments: allScheduleRows.reduce((s, r) => s + r.grossAdjustments, 0),
    grossClosing: allScheduleRows.reduce((s, r) => s + r.grossClosing, 0),
    depOpening: allScheduleRows.reduce((s, r) => s + r.depOpening, 0),
    depAdditions: allScheduleRows.reduce((s, r) => s + r.depAdditions, 0),
    depAdjustments: allScheduleRows.reduce((s, r) => s + r.depAdjustments, 0),
    depClosing: allScheduleRows.reduce((s, r) => s + r.depClosing, 0),
    netClosing: allScheduleRows.reduce((s, r) => s + r.netClosing, 0),
    netPrev: allScheduleRows.reduce((s, r) => s + r.netPrev, 0)
  };

  const previousPeriodTotals = {
    grossOpening: grandTotals.grossOpening,
    grossAdditions: 0,
    grossAdjustments: 0,
    grossClosing: grandTotals.grossOpening,
    depOpening: grandTotals.depOpening,
    depAdditions: 0,
    depAdjustments: 0,
    depClosing: grandTotals.depOpening,
    netClosing: grandTotals.netPrev,
    netPrev: grandTotals.netPrev
  };

  // EXCEL EXPORT HANDLERS (.xlsx format)
  const exportPpeToExcel = () => {
    const aoa: any[][] = [];

    // Title Block
    const compName = config.CompanyName || (config as any).companyName || 'MY RETAIL STORE';
    aoa.push([compName]);
    const reportDateStr = selectedPeriod !== 'All' ? selectedPeriod : (selectedYear === 'All' ? '' : `31.12.${currentYearNum}`);
    const schedTitle = reportDateStr ? `PROPERTY, PLANT & EQUIPMENT SCHEDULE as at ${reportDateStr}` : 'PROPERTY, PLANT & EQUIPMENT SCHEDULE';
    aoa.push([schedTitle]);
    aoa.push([]);

    // Header Row 1
    aoa.push([
      'PARTICULARS',
      'RATE (%)',
      'GROSS BLOCK', '', '', '',
      'DEPRECIATION', '', '', '',
      'NET BLOCK', ''
    ]);

    // Header Row 2
    aoa.push([
      '',
      '',
      openingDateHeader,
      'ADDITIONS',
      'ADJUSTMENTS',
      closingDateHeader,
      openingDateHeader,
      'ADDITIONS',
      'ADJUSTMENTS',
      closingDateHeader,
      netClosingHeader,
      netPrevHeader
    ]);

    // All Category Rows continuously
    allScheduleRows.forEach(r => {
      aoa.push([
        r.name,
        r.rate ? `${r.rate}%` : '0%',
        r.grossOpening || 0,
        r.grossAdditions || 0,
        r.grossAdjustments || 0,
        r.grossClosing || 0,
        r.depOpening || 0,
        r.depAdditions || 0,
        r.depAdjustments || 0,
        r.depClosing || 0,
        r.netClosing || 0,
        r.netPrev || 0
      ]);
    });

    // Grand Totals Row
    aoa.push([
      'T O T A L S :',
      '',
      grandTotals.grossOpening || 0,
      grandTotals.grossAdditions || 0,
      grandTotals.grossAdjustments || 0,
      grandTotals.grossClosing || 0,
      grandTotals.depOpening || 0,
      grandTotals.depAdditions || 0,
      grandTotals.depAdjustments || 0,
      grandTotals.depClosing || 0,
      grandTotals.netClosing || 0,
      grandTotals.netPrev || 0
    ]);

    // Previous Period Row
    aoa.push([
      'Previous Period',
      '',
      previousPeriodTotals.grossOpening || 0,
      previousPeriodTotals.grossAdditions || 0,
      previousPeriodTotals.grossAdjustments || 0,
      previousPeriodTotals.grossClosing || 0,
      previousPeriodTotals.depOpening || 0,
      previousPeriodTotals.depAdditions || 0,
      previousPeriodTotals.depAdjustments || 0,
      previousPeriodTotals.depClosing || 0,
      previousPeriodTotals.netClosing || 0,
      previousPeriodTotals.netPrev || 0
    ]);

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    const titleStyle = { font: { bold: true, sz: 14, color: { rgb: "1e293b" } }, alignment: { horizontal: "center" } };
    const subtitleStyle = { font: { bold: true, sz: 11, color: { rgb: "64748b" } }, alignment: { horizontal: "center" } };
    const headerStyle = { font: { bold: true, color: { rgb: "ffffff" } }, fill: { fgColor: { rgb: "1e3a8a" } }, alignment: { horizontal: "center", vertical: "center", wrapText: true }, border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } } };
    const subHeaderStyle = { font: { bold: true, color: { rgb: "e2e8f0" }, sz: 10 }, fill: { fgColor: { rgb: "1e3a8a" } }, alignment: { horizontal: "right", vertical: "center", wrapText: true }, border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } } };
    const totalsStyle = { font: { bold: true, color: { rgb: "0f172a" } }, fill: { fgColor: { rgb: "f1f5f9" } }, border: { top: { style: 'thin' }, bottom: { style: 'double' } } };
    const normalStyle = { font: { sz: 11, color: { rgb: "334155" } }, alignment: { vertical: "center" }, border: { bottom: { style: 'hair', color: { rgb: "cbd5e1" } } } };

    // Apply cell number formatting and styles for classic Excel display
    Object.keys(ws).forEach(cellKey => {
      if (cellKey.startsWith('!')) return;
      const cell = ws[cellKey];
      const row = parseInt(cellKey.replace(/\D/g, '')) - 1;

      // Base Style
      cell.s = { ...normalStyle };

      if (cell.t === 'n') {
        cell.z = '#,##0.00;(#,##0.00);"-"';
      }

      if (row === 0 || row === 1) cell.s = titleStyle;
      else if (row === 3) cell.s = headerStyle;
      else if (row === 4) cell.s = subHeaderStyle;
      else if (row >= aoa.length - 2) {
        cell.s = { ...totalsStyle, alignment: cell.t === 'n' ? { horizontal: 'right' } : { horizontal: 'left' } };
      }
    });

    // Merges
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 11 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 11 } },
      { s: { r: 3, c: 0 }, e: { r: 4, c: 0 } },
      { s: { r: 3, c: 1 }, e: { r: 4, c: 1 } },
      { s: { r: 3, c: 2 }, e: { r: 3, c: 5 } },
      { s: { r: 3, c: 6 }, e: { r: 3, c: 9 } },
      { s: { r: 3, c: 10 }, e: { r: 3, c: 11 } }
    ];

    ws['!cols'] = [
      { wch: 34 }, { wch: 10 },
      { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 18 },
      { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 18 },
      { wch: 18 }, { wch: 18 }
    ];

    ws['!rows'] = [
      { hpt: 25 }, { hpt: 20 }, { hpt: 10 }, { hpt: 30 }, { hpt: 40 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Note 2 - PPE Schedule');
    XLSX.writeFile(wb, `Note_2_Property_Plant_Equipment_${selectedYear}.xlsx`);
  };

  const exportScheduleToExcel = () => {
    const companyName = config.CompanyName || (config as any).companyName || 'MY RETAIL STORE';
    const aoa: any[][] = [];
    aoa.push([companyName.toUpperCase()]);
    aoa.push(['DEPRECIATION SCHEDULE LOG REPORT']);
    aoa.push([`Financial Year: ${selectedYear} | Accounting Period: ${selectedPeriod}`]);
    aoa.push([]);

    aoa.push([
      'POSTING DATE', 'JOURNAL REF', 'ASSET ID', 'ASSET NAME', 'FINANCIAL YEAR', 'ACCOUNTING PERIOD', 'OPENING NBV', 'DEPRECIATION AMOUNT', 'ACCUMULATED DEP.', 'CLOSING NBV', 'STATUS'
    ]);

    let sumOpening = 0;
    let sumDep = 0;
    let sumAccDep = 0;
    let sumClosing = 0;

    filteredDepreciations.forEach(d => {
      const asset = assets.find(a => a.id === d.assetId);
      const opening = d.openingNbv || 0;
      const dep = d.depreciationAmount || 0;
      const acc = d.accumulatedDepreciation || 0;
      const closing = d.closingNbv || 0;

      sumOpening += opening;
      sumDep += dep;
      sumAccDep += acc;
      sumClosing += closing;

      aoa.push([
        d.depreciationDate,
        d.journalId || '-',
        asset?.assetId || '-',
        asset?.name || '-',
        d.financialYear,
        d.accountingPeriod,
        opening,
        dep,
        acc,
        closing,
        d.status || 'Posted'
      ]);
    });

    // Summary Totals row
    aoa.push([
      'TOTALS', '', '', '', '', '',
      sumOpening,
      sumDep,
      sumAccDep,
      sumClosing,
      ''
    ]);

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    const titleStyle = { font: { bold: true, sz: 14, color: { rgb: "1e293b" } }, alignment: { horizontal: "center" } };
    const subtitleStyle = { font: { bold: true, sz: 11, color: { rgb: "64748b" } }, alignment: { horizontal: "center" } };
    const headerStyle = { font: { bold: true, color: { rgb: "ffffff" }, sz: 10 }, fill: { fgColor: { rgb: "1e3a8a" } }, alignment: { horizontal: "center", vertical: "center", wrapText: true }, border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } } };
    const totalsStyle = { font: { bold: true, color: { rgb: "0f172a" } }, fill: { fgColor: { rgb: "f1f5f9" } }, border: { top: { style: 'thin' }, bottom: { style: 'double' } } };
    const normalStyle = { font: { sz: 11, color: { rgb: "334155" } }, alignment: { vertical: "center" }, border: { bottom: { style: 'hair', color: { rgb: "cbd5e1" } } } };

    // Apply cell number formatting
    Object.keys(ws).forEach(cellKey => {
      if (cellKey.startsWith('!')) return;
      const cell = ws[cellKey];
      const row = parseInt(cellKey.replace(/\D/g, '')) - 1;

      // Base style
      cell.s = { ...normalStyle };

      if (cell.t === 'n') {
        cell.z = '#,##0.00;(#,##0.00);"-"';
      }

      if (row === 0 || row === 1) cell.s = titleStyle;
      else if (row === 2) cell.s = subtitleStyle;
      else if (row === 4) cell.s = headerStyle;
      else if (row === aoa.length - 1) {
        cell.s = { ...totalsStyle, alignment: cell.t === 'n' ? { horizontal: 'right' } : { horizontal: 'left' } };
      }
    });

    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 10 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 10 } },
      { s: { r: aoa.length - 1, c: 0 }, e: { r: aoa.length - 1, c: 5 } }
    ];

    ws['!cols'] = [
      { wch: 14 }, { wch: 18 }, { wch: 16 }, { wch: 36 }, { wch: 14 }, { wch: 20 },
      { wch: 18 }, { wch: 22 }, { wch: 20 }, { wch: 18 }, { wch: 12 }
    ];

    ws['!rows'] = [
      { hpt: 25 }, { hpt: 20 }, { hpt: 15 }, { hpt: 10 }, { hpt: 30 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Depreciation Log');
    XLSX.writeFile(wb, `Depreciation_Schedule_Log_${selectedYear}.xlsx`);
  };

  const exportRegisterToExcel = () => {
    const companyName = config.CompanyName || (config as any).companyName || 'MY RETAIL STORE';
    const aoa: any[][] = [];
    aoa.push([companyName.toUpperCase()]);
    aoa.push(['FIXED ASSET REGISTER REPORT']);
    aoa.push([`Financial Year: ${selectedYear} | Total Assets: ${filteredAssets.length}`]);
    aoa.push([]);

    aoa.push([
      'ASSET ID', 'ASSET NAME', 'CATEGORY', 'PURCHASE DATE', 'ORIGINAL COST', 'ACCUMULATED DEP.', 'NET BOOK VALUE', 'STATUS'
    ]);

    let totalCost = 0;
    let totalAccDep = 0;
    let totalNbv = 0;

    filteredAssets.forEach(a => {
      const cat = categories.find(c => c.id === a.categoryId);
      const cost = a.cost || 0;
      const acc = a.accumulatedDepreciation || 0;
      const nbv = a.netBookValue || 0;

      totalCost += cost;
      totalAccDep += acc;
      totalNbv += nbv;

      aoa.push([
        a.assetId,
        a.name,
        cat?.name || 'Uncategorized',
        a.purchaseDate || '-',
        cost,
        acc,
        nbv,
        a.status || 'Active'
      ]);
    });

    aoa.push([
      'TOTALS', '', '', '',
      totalCost,
      totalAccDep,
      totalNbv,
      ''
    ]);

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    const titleStyle = { font: { bold: true, sz: 14, color: { rgb: "1e293b" } }, alignment: { horizontal: "center" } };
    const subtitleStyle = { font: { bold: true, sz: 11, color: { rgb: "64748b" } }, alignment: { horizontal: "center" } };
    const headerStyle = { font: { bold: true, color: { rgb: "ffffff" }, sz: 10 }, fill: { fgColor: { rgb: "1e3a8a" } }, alignment: { horizontal: "center", vertical: "center", wrapText: true }, border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } } };
    const totalsStyle = { font: { bold: true, color: { rgb: "0f172a" } }, fill: { fgColor: { rgb: "f1f5f9" } }, border: { top: { style: 'thin' }, bottom: { style: 'double' } } };
    const normalStyle = { font: { sz: 11, color: { rgb: "334155" } }, alignment: { vertical: "center" }, border: { bottom: { style: 'hair', color: { rgb: "cbd5e1" } } } };

    Object.keys(ws).forEach(cellKey => {
      if (cellKey.startsWith('!')) return;
      const cell = ws[cellKey];
      const row = parseInt(cellKey.replace(/\D/g, '')) - 1;

      // Base style
      cell.s = { ...normalStyle };

      if (cell.t === 'n') {
        cell.z = '#,##0.00;(#,##0.00);"-"';
      }

      if (row === 0 || row === 1) cell.s = titleStyle;
      else if (row === 2) cell.s = subtitleStyle;
      else if (row === 4) cell.s = headerStyle;
      else if (row === aoa.length - 1) {
        cell.s = { ...totalsStyle, alignment: cell.t === 'n' ? { horizontal: 'right' } : { horizontal: 'left' } };
      }
    });

    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 7 } },
      { s: { r: aoa.length - 1, c: 0 }, e: { r: aoa.length - 1, c: 3 } }
    ];

    ws['!cols'] = [
      { wch: 16 }, { wch: 36 }, { wch: 26 }, { wch: 14 }, { wch: 18 }, { wch: 20 }, { wch: 18 }, { wch: 14 }
    ];

    ws['!rows'] = [
      { hpt: 25 }, { hpt: 20 }, { hpt: 15 }, { hpt: 10 }, { hpt: 30 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Fixed Asset Register');
    XLSX.writeFile(wb, `Fixed_Asset_Register_${selectedYear}.xlsx`);
  };

  // PRINT TRIGGER HANDLER
  const triggerPrintWindow = () => {
    let printContent = '';
    const companyName = config.CompanyName || (config as any).companyName || 'MY RETAIL STORE';

    if (activeTab === 'ppe') {
      printContent = printContainerRef.current?.innerHTML || '';
    } else if (activeTab === 'register') {
      let totalCost = 0, totalAccDep = 0, totalNbv = 0;
      const rows = filteredAssets.map(a => {
        const cat = categories.find(c => c.id === a.categoryId);
        const cost = a.cost || 0;
        const acc = a.accumulatedDepreciation || 0;
        const nbv = a.netBookValue || 0;
        totalCost += cost; totalAccDep += acc; totalNbv += nbv;
        return `
          <tr>
            <td>${a.assetId}</td>
            <td>${a.name}</td>
            <td>${cat?.name || 'Uncategorized'}</td>
            <td>${a.purchaseDate || '-'}</td>
            <td class="num">${fmt(cost)}</td>
            <td class="num">${fmt(acc)}</td>
            <td class="num">${fmt(nbv)}</td>
            <td>${a.status || 'Active'}</td>
          </tr>
        `;
      }).join('');

      printContent = `
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="margin: 0; font-size: 16px;">${companyName}</h2>
          <h3 style="margin: 5px 0; font-size: 14px; text-decoration: underline;">FIXED ASSET REGISTER REPORT</h3>
          <p style="margin: 0;">Financial Year: ${selectedYear} | Total Assets: ${filteredAssets.length}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>ASSET ID</th>
              <th>ASSET NAME</th>
              <th>CATEGORY</th>
              <th>PURCHASE DATE</th>
              <th>ORIGINAL COST</th>
              <th>ACCUMULATED DEP.</th>
              <th>NET BOOK VALUE</th>
              <th>STATUS</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr class="totals-row">
              <td colspan="4">TOTALS (${assets.length} assets):</td>
              <td class="num">${fmt(totalCost)}</td>
              <td class="num">${fmt(totalAccDep)}</td>
              <td class="num">${fmt(totalNbv)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      `;
    } else if (activeTab === 'schedule') {
      let sumOpening = 0, sumDep = 0, sumAccDep = 0, sumClosing = 0;
      const rows = filteredDepreciations.map(d => {
        const asset = assets.find(a => a.id === d.assetId);
        const opening = d.openingNbv || 0;
        const dep = d.depreciationAmount || 0;
        const acc = d.accumulatedDepreciation || 0;
        const closing = d.closingNbv || 0;
        sumOpening += opening; sumDep += dep; sumAccDep += acc; sumClosing += closing;
        return `
          <tr>
            <td>${d.depreciationDate}</td>
            <td>${d.journalId || '-'}</td>
            <td>${asset?.assetId || '-'}</td>
            <td>${asset?.name || '-'}</td>
            <td>${d.financialYear}</td>
            <td>${d.accountingPeriod}</td>
            <td class="num">${fmt(opening)}</td>
            <td class="num">${fmt(dep)}</td>
            <td class="num">${fmt(acc)}</td>
            <td class="num">${fmt(closing)}</td>
            <td>${d.status || 'Posted'}</td>
          </tr>
        `;
      }).join('');

      printContent = `
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="margin: 0; font-size: 16px;">${companyName}</h2>
          <h3 style="margin: 5px 0; font-size: 14px; text-decoration: underline;">DEPRECIATION SCHEDULE LOG REPORT</h3>
          <p style="margin: 0;">Financial Year: ${selectedYear} | Accounting Period: ${selectedPeriod}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>POSTING DATE</th>
              <th>JOURNAL REF</th>
              <th>ASSET ID</th>
              <th>ASSET NAME</th>
              <th>FINANCIAL YEAR</th>
              <th>ACCOUNTING PERIOD</th>
              <th>OPENING NBV</th>
              <th>DEPRECIATION AMOUNT</th>
              <th>ACCUMULATED DEP.</th>
              <th>CLOSING NBV</th>
              <th>STATUS</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr class="totals-row">
              <td colspan="6">TOTALS:</td>
              <td class="num">${fmt(sumOpening)}</td>
              <td class="num">${fmt(sumDep)}</td>
              <td class="num">${fmt(sumAccDep)}</td>
              <td class="num">${fmt(sumClosing)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      `;
    }

    if (!printContent) return;

    const printWindow = window.open('', '_blank', 'width=1100,height=800');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>NOTE NO.: 2: PROPERTY , PLANT & EQUIPMENT</title>
            <style>
              @page { size: landscape; margin: 8mm; }
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; font-size: 10px; margin: 0; padding: 10px; color: #1e293b; }
              .title-header { text-decoration: underline; font-weight: bold; font-size: 13px; margin-bottom: 12px; }
              table { width: 100%; border-collapse: collapse; margin-top: 5px; font-size: 9.5px; }
              th, td { border: 1px solid #64748b; padding: 4px 6px; }
              th { background-color: #1d6fce !important; color: #ffffff !important; text-align: center; font-weight: bold; -webkit-print-color-adjust: exact; }
              td.num { text-align: right; font-family: monospace; }
              tr.bold-row td { font-weight: bold; background-color: #f1f5f9; -webkit-print-color-adjust: exact; }
              tr.totals-row td { font-weight: bold; border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a; background-color: #e2e8f0; -webkit-print-color-adjust: exact; }
              .signatures { margin-top: 40px; display: flex; justify-content: space-between; font-size: 10px; font-weight: bold; }
              .signature-line { border-top: 1px solid #475569; width: 180px; text-align: center; pt-1; }
            </style>
          </head>
          <body>
            ${printContent}
            <div class="signatures">
              <div><div class="signature-line">Prepared By</div></div>
              <div><div class="signature-line">Checked By</div></div>
              <div><div class="signature-line">Approved By</div></div>
            </div>
            <script>
              window.onload = function() {
                window.print();
                setTimeout(function() { window.close(); }, 500);
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } else {
      window.print();
    }
  };

  const fmt = (val: number) => {
    if (!val || val === 0) return '-';
    return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200">
      {/* Compact Integrated Top Header & Control Bar */}
      <div className="p-3 border-b border-slate-200 bg-slate-50/80 rounded-t-xl shrink-0 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Left Side: Report View Dropdown + Search Box */}
        <div className="flex items-center gap-3 flex-wrap flex-1 min-w-[320px]">
          {/* Report Type Dropdown */}
          <div className="flex items-center gap-2 shrink-0">
            <FileText className="h-5 w-5 text-indigo-600 shrink-0" />
            <select
              value={activeTab}
              onChange={e => setActiveTab(e.target.value as 'ppe' | 'schedule' | 'register')}
              className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 font-extrabold text-slate-800 text-xs shadow-2xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="ppe">Note 2: Property, Plant & Equipment Schedule</option>
              <option value="schedule">Depreciation Log ({depreciations.length})</option>
              <option value="register">Fixed Asset Register ({assets.length})</option>
            </select>
          </div>

          {/* Search Box Next to Dropdown */}
          <div className="relative flex-1 max-w-xs min-w-[200px]">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search category, asset name, or journal..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl outline-none focus:border-indigo-500 font-medium text-xs shadow-2xs"
            />
          </div>
        </div>

        {/* Right Side: Moved Up FY & Period Filters + Actions */}
        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          {/* Dynamic Financial Year Filter */}
          <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-slate-300 shadow-2xs">
            <Calendar className="h-3.5 w-3.5 text-slate-500" />
            <span className="text-slate-500 font-semibold text-[11px]">FY:</span>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(e.target.value)}
              className="bg-transparent font-bold text-slate-800 text-xs outline-none cursor-pointer"
            >
              {availableYears.map(yr => (
                <option key={yr} value={yr}>
                  {yr === 'All' ? 'All Years' : yr}
                </option>
              ))}
            </select>
          </div>

          {/* Dynamic Accounting Period Filter */}
          {availablePeriods.length > 1 && activeTab === 'schedule' && (
            <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-slate-300 shadow-2xs">
              <Filter className="h-3.5 w-3.5 text-slate-500" />
              <span className="text-slate-500 font-semibold text-[11px]">Period:</span>
              <select
                value={selectedPeriod}
                onChange={e => setSelectedPeriod(e.target.value)}
                className="bg-transparent font-bold text-slate-800 text-xs outline-none cursor-pointer max-w-[130px] truncate"
              >
                {availablePeriods.map(p => (
                  <option key={p} value={p}>
                    {p === 'All' ? 'All Periods' : p}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Dynamic Category Filter */}
          {(activeTab === 'schedule' || activeTab === 'register') && (
            <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-slate-300 shadow-2xs">
              <Layers className="h-3.5 w-3.5 text-slate-500" />
              <span className="text-slate-500 font-semibold text-[11px]">Category:</span>
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="bg-transparent font-bold text-slate-800 text-xs outline-none cursor-pointer max-w-[110px] truncate"
              >
                <option value="All">All Categories</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Dynamic Location Filter */}
          {activeTab === 'register' && availableLocations.length > 0 && (
            <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-slate-300 shadow-2xs">
              <Building2 className="h-3.5 w-3.5 text-slate-500" />
              <span className="text-slate-500 font-semibold text-[11px]">Location:</span>
              <select
                value={selectedLocation}
                onChange={e => setSelectedLocation(e.target.value)}
                className="bg-transparent font-bold text-slate-800 text-xs outline-none cursor-pointer max-w-[100px] truncate"
              >
                <option value="All">All Locations</option>
                {availableLocations.map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>
          )}

          {/* Dynamic Status Filter */}
          {activeTab === 'register' && availableStatuses.length > 0 && (
            <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-slate-300 shadow-2xs">
              <CheckCircle2 className="h-3.5 w-3.5 text-slate-500" />
              <span className="text-slate-500 font-semibold text-[11px]">Status:</span>
              <select
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value)}
                className="bg-transparent font-bold text-slate-800 text-xs outline-none cursor-pointer max-w-[100px] truncate"
              >
                <option value="All">All Statuses</option>
                {availableStatuses.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
          )}

          {/* Deep-Down Toggle for PPE Schedule */}
          {activeTab === 'ppe' && (
            <button
              type="button"
              onClick={() => {
                if (expandedCategories.size > 0) {
                  setExpandedCategories(new Set());
                } else {
                  const withAssets = allScheduleRows.filter(r => (r.itemizedAssets?.length || 0) > 0).map(r => r.name);
                  setExpandedCategories(new Set(withAssets));
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition shadow-2xs cursor-pointer shrink-0 border border-indigo-200"
              title="Expand or collapse individual assets deep-down drilldown for all categories"
            >
              {expandedCategories.size > 0 ? (
                <>
                  <ChevronUp className="h-4 w-4 text-indigo-600" />
                  <span>Collapse Deep-Down</span>
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 text-indigo-600" />
                  <span>Deep-Down (All Assets)</span>
                </>
              )}
            </button>
          )}

          {/* Full Page View Toggle */}
          {onToggleFullScreen && (
            <button
              type="button"
              onClick={() => onToggleFullScreen(!isFullScreen)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-200/80 hover:bg-slate-300/80 text-slate-700 text-xs font-bold transition shadow-2xs cursor-pointer shrink-0"
              title={isFullScreen ? "Exit Full Page View" : "Enter Full Page View"}
            >
              {isFullScreen ? (
                <>
                  <Minimize2 className="h-4 w-4 text-slate-600" />
                  <span>Exit Full Screen</span>
                </>
              ) : (
                <>
                  <Maximize2 className="h-4 w-4 text-slate-600" />
                  <span>Full Page View</span>
                </>
              )}
            </button>
          )}

          {/* Excel Export Button */}
          <button
            type="button"
            onClick={() => {
              if (activeTab === 'ppe') exportPpeToExcel();
              else if (activeTab === 'schedule') exportScheduleToExcel();
              else exportRegisterToExcel();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-2xs cursor-pointer shrink-0"
            title="Export report to Excel (.xlsx)"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Export Excel (.xlsx)
          </button>

          {/* Print Button */}
          <button
            type="button"
            onClick={() => {
              if (activeTab === 'ppe') setShowPrintModal(true);
              else triggerPrintWindow();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-2xs cursor-pointer shrink-0"
            title="Print Depreciation Schedule / PPE Report"
          >
            <Printer className="h-4 w-4" />
            Print Report
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden p-4 flex flex-col min-h-0">
        {activeTab === 'ppe' && (
          <div className="flex flex-col h-full space-y-3 min-h-0">
            {/* Classic Financial Schedule Matrix with Sticky Headers & Sticky Footers */}
            <div className="flex-1 min-h-0 border border-slate-300 rounded-xl overflow-hidden bg-white shadow-sm flex flex-col relative">
              <div className="absolute inset-0 overflow-auto custom-scrollbar">
                <table className="w-full text-left text-[11px] border-collapse min-w-[1250px]">
                  <thead className="sticky top-0 z-20 shadow-xs">
                    <tr className="bg-[#1e3a8a] text-white uppercase font-bold text-center border-b border-blue-800">
                      <th rowSpan={2} className="sticky top-0 z-20 px-3 py-2.5 border-r border-blue-800/80 text-left min-w-[220px] tracking-wider leading-tight whitespace-nowrap bg-[#1e3a8a] text-blue-50 font-bold">
                        PARTICULARS
                      </th>
                      <th rowSpan={2} className="sticky top-0 z-20 px-2 py-2.5 border-r border-blue-800/80 min-w-[70px] tracking-wider leading-tight text-[10px] whitespace-nowrap bg-[#1e3a8a] text-blue-100">
                        RATE (%)
                      </th>
                      <th colSpan={4} className="sticky top-0 z-20 px-2 py-1.5 border-r border-blue-800/80 tracking-widest text-[11px] bg-[#1e3a8a] text-white border-b border-blue-800">
                        GROSS BLOCK
                      </th>
                      <th colSpan={4} className="sticky top-0 z-20 px-2 py-1.5 border-r border-blue-800/80 tracking-widest text-[11px] bg-[#1e3a8a] text-indigo-100 border-b border-blue-800">
                        DEPRECIATION
                      </th>
                      <th colSpan={2} className="sticky top-0 z-20 px-2 py-1.5 tracking-widest text-[11px] bg-[#1e3a8a] text-teal-100 border-b border-blue-800">
                        NET BLOCK
                      </th>
                    </tr>
                    <tr className="text-[9.5px] leading-tight tracking-tight uppercase bg-[#1e3a8a]">
                      <th className="sticky top-[31px] z-20 px-2 py-1.5 border-r border-blue-800/80 min-w-[110px] whitespace-pre-line bg-[#1e3a8a] text-blue-100 text-right">{openingDateHeader.replace('OPENING AS ON ', 'OPENING AS ON\n')}</th>
                      <th className="sticky top-[31px] z-20 px-2 py-1.5 border-r border-blue-800/80 min-w-[100px] bg-[#1e3a8a] text-blue-100 text-right">ADDITIONS</th>
                      <th className="sticky top-[31px] z-20 px-2 py-1.5 border-r border-blue-800/80 min-w-[100px] bg-[#1e3a8a] text-blue-100 text-right">ADJUSTMENTS</th>
                      <th className="sticky top-[31px] z-20 px-2 py-1.5 border-r border-blue-800/80 min-w-[110px] whitespace-pre-line bg-[#1e3a8a] text-white font-extrabold text-right">{closingDateHeader.replace('CLOSING AS ON ', 'CLOSING AS ON\n')}</th>

                      <th className="sticky top-[31px] z-20 px-2 py-1.5 border-r border-blue-800/80 min-w-[110px] whitespace-pre-line bg-[#1e3a8a] text-blue-100 text-right">{openingDateHeader.replace('OPENING AS ON ', 'OPENING AS ON\n')}</th>
                      <th className="sticky top-[31px] z-20 px-2 py-1.5 border-r border-blue-800/80 min-w-[100px] bg-[#1e3a8a] text-indigo-100 font-bold text-right">ADDITIONS</th>
                      <th className="sticky top-[31px] z-20 px-2 py-1.5 border-r border-blue-800/80 min-w-[100px] bg-[#1e3a8a] text-blue-100 text-right">ADJUSTMENTS</th>
                      <th className="sticky top-[31px] z-20 px-2 py-1.5 border-r border-blue-800/80 min-w-[110px] whitespace-pre-line bg-[#1e3a8a] text-white font-extrabold text-right">{closingDateHeader.replace('CLOSING AS ON ', 'CLOSING AS ON\n')}</th>

                      <th className="sticky top-[31px] z-20 px-2 py-1.5 border-r border-blue-800/80 min-w-[125px] whitespace-pre-line bg-[#1e3a8a] text-teal-100 font-black text-right">{netClosingHeader.replace('AS ON ', 'AS ON\n')}</th>
                      <th className="sticky top-[31px] z-20 px-2 py-1.5 min-w-[125px] whitespace-pre-line bg-[#1e3a8a] text-teal-50 font-bold text-right">{netPrevHeader.replace('AS ON ', 'AS ON\n')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/90 font-medium text-slate-800">
                    {/* All Category Rows with Deep-Down Drilldown */}
                    {allScheduleRows.map((r, idx) => {
                      const isExpanded = expandedCategories.has(r.name);
                      const hasAssets = r.itemizedAssets && r.itemizedAssets.length > 0;
                      return (
                        <React.Fragment key={idx}>
                          <tr 
                            onClick={() => hasAssets && toggleCategoryExpand(r.name)}
                            className={`even:bg-slate-50/60 hover:bg-indigo-50/30 transition-colors ${hasAssets ? 'cursor-pointer' : ''}`}
                          >
                            <td className="px-3 py-2 border-r border-slate-200 font-semibold text-slate-900 whitespace-nowrap bg-white min-w-[220px]" title={r.name}>
                              <div className="flex items-center justify-between gap-1.5">
                                <div className="flex items-center gap-1.5">
                                  {hasAssets ? (
                                    <button 
                                      type="button" 
                                      onClick={(e) => { e.stopPropagation(); toggleCategoryExpand(r.name); }}
                                      className="p-0.5 rounded hover:bg-slate-200 text-slate-500 hover:text-indigo-600 transition"
                                      title={isExpanded ? "Collapse deep-down" : "Deep-down / Drill down into individual assets"}
                                    >
                                      {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-indigo-600" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-500" />}
                                    </button>
                                  ) : (
                                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-300 ml-1 mr-1"></span>
                                  )}
                                  <span className={hasAssets ? "font-bold text-slate-900" : "text-slate-700"}>{r.name}</span>
                                </div>
                                {hasAssets && (
                                  <span className="px-1.5 py-0.5 rounded-full text-[9.5px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                                    <Layers className="h-2.5 w-2.5" />
                                    {r.itemizedAssets.length} {r.itemizedAssets.length === 1 ? 'asset' : 'assets'}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-2 py-2 border-r border-slate-200 text-center font-mono text-[11px] text-slate-600 font-semibold whitespace-nowrap">{r.rate}%</td>
                            <td className="px-2.5 py-2 border-r border-slate-200 text-right font-mono text-slate-700 whitespace-nowrap">{fmt(r.grossOpening)}</td>
                            <td className="px-2.5 py-2 border-r border-slate-200 text-right font-mono text-slate-700 whitespace-nowrap">{fmt(r.grossAdditions)}</td>
                            <td className="px-2.5 py-2 border-r border-slate-200 text-right font-mono text-slate-700 whitespace-nowrap">{fmt(r.grossAdjustments)}</td>
                            <td className="px-2.5 py-2 border-r border-slate-200 text-right font-mono font-bold text-slate-900 bg-slate-50/50 whitespace-nowrap">{fmt(r.grossClosing)}</td>

                            <td className="px-2.5 py-2 border-r border-slate-200 text-right font-mono text-slate-600 whitespace-nowrap">{fmt(r.depOpening)}</td>
                            <td className="px-2.5 py-2 border-r border-slate-200 text-right font-mono font-bold text-indigo-700 bg-indigo-50/40 whitespace-nowrap">{fmt(r.depAdditions)}</td>
                            <td className="px-2.5 py-2 border-r border-slate-200 text-right font-mono text-slate-600 whitespace-nowrap">{fmt(r.depAdjustments)}</td>
                            <td className="px-2.5 py-2 border-r border-slate-200 text-right font-mono text-rose-700 font-bold bg-rose-50/20 whitespace-nowrap">{fmt(r.depClosing)}</td>

                            <td className="px-2.5 py-2 border-r border-slate-200 text-right font-mono font-extrabold text-emerald-900 bg-emerald-50/40 whitespace-nowrap">{fmt(r.netClosing)}</td>
                            <td className="px-2.5 py-2 text-right font-mono text-slate-600 whitespace-nowrap">{fmt(r.netPrev)}</td>
                          </tr>

                          {/* Deep-Down Itemized Assets */}
                          {isExpanded && r.itemizedAssets.map((item, itemIdx) => (
                            <tr 
                              key={`${idx}-${itemIdx}`}
                              onClick={() => setSelectedDeepAsset(item.asset)}
                              className="bg-indigo-50/30 hover:bg-indigo-100/50 transition-colors cursor-pointer border-l-4 border-l-indigo-600 text-[10.5px]"
                              title="Click to deep dive into this asset's full records and audit history"
                            >
                              <td className="pl-6 pr-3 py-1.5 border-r border-slate-200/80 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-indigo-400 font-mono text-xs">↳</span>
                                  <span className="font-mono text-[10px] font-bold text-indigo-700 bg-indigo-100/80 px-1.5 py-0.5 rounded border border-indigo-200">
                                    {item.asset.assetId}
                                  </span>
                                  <span className="font-medium text-slate-800">{item.asset.name}</span>
                                  <span className="ml-auto inline-flex items-center gap-0.5 text-[9.5px] font-bold text-indigo-600 bg-white/80 px-1.5 py-0.5 rounded border border-indigo-200/60 shadow-2xs hover:bg-white">
                                    <Eye className="h-3 w-3 text-indigo-600" />
                                    Deep-Down
                                  </span>
                                </div>
                              </td>
                              <td className="px-2 py-1.5 border-r border-slate-200/80 text-center font-mono text-[10px] text-slate-500 whitespace-nowrap">
                                {item.asset.depreciationRate ? `${item.asset.depreciationRate}%` : `${r.rate}%`}
                              </td>
                              <td className="px-2.5 py-1.5 border-r border-slate-200/80 text-right font-mono text-slate-600 whitespace-nowrap">{fmt(item.grossOpening)}</td>
                              <td className="px-2.5 py-1.5 border-r border-slate-200/80 text-right font-mono text-slate-600 whitespace-nowrap">{fmt(item.grossAdditions)}</td>
                              <td className="px-2.5 py-2 border-r border-slate-200/80 text-right font-mono text-slate-600 whitespace-nowrap">{fmt(item.grossAdjustments)}</td>
                              <td className="px-2.5 py-2 border-r border-slate-200/80 text-right font-mono font-semibold text-slate-800 whitespace-nowrap">{fmt(item.grossClosing)}</td>

                              <td className="px-2.5 py-2 border-r border-slate-200/80 text-right font-mono text-slate-500 whitespace-nowrap">{fmt(item.depOpening)}</td>
                              <td className="px-2.5 py-2 border-r border-slate-200/80 text-right font-mono font-semibold text-indigo-700 whitespace-nowrap">{fmt(item.depAdditions)}</td>
                              <td className="px-2.5 py-2 border-r border-slate-200/80 text-right font-mono text-slate-500 whitespace-nowrap">{fmt(item.depAdjustments)}</td>
                              <td className="px-2.5 py-2 border-r border-slate-200/80 text-right font-mono font-semibold text-rose-700 whitespace-nowrap">{fmt(item.depClosing)}</td>

                              <td className="px-2.5 py-2 border-r border-slate-200/80 text-right font-mono font-bold text-emerald-800 whitespace-nowrap">{fmt(item.netClosing)}</td>
                              <td className="px-2.5 py-2 text-right font-mono text-slate-500 whitespace-nowrap">{fmt(item.netPrev)}</td>
                            </tr>
                          ))}
                        </React.Fragment>
                      );
                    })}
                  </tbody>

                  <tfoot className="sticky bottom-0 z-20 shadow-[0_-2px_6px_rgba(0,0,0,0.12)]">
                    <tr className="bg-slate-200 font-black text-slate-900 border-t-2 border-slate-900 text-[11px]">
                      <td className="px-3 py-2.5 border-r border-slate-400 tracking-wider font-black text-slate-900 uppercase bg-slate-200 whitespace-nowrap">T O T A L S :</td>
                      <td className="px-2 py-2.5 border-r border-slate-400 text-center bg-slate-200"></td>
                      <td className="px-2.5 py-2.5 border-r border-slate-400 text-right font-mono bg-slate-200 whitespace-nowrap">{fmt(grandTotals.grossOpening)}</td>
                      <td className="px-2.5 py-2.5 border-r border-slate-400 text-right font-mono text-indigo-900 bg-slate-200 whitespace-nowrap">{fmt(grandTotals.grossAdditions)}</td>
                      <td className="px-2.5 py-2.5 border-r border-slate-400 text-right font-mono bg-slate-200 whitespace-nowrap">{fmt(grandTotals.grossAdjustments)}</td>
                      <td className="px-2.5 py-2.5 border-r border-slate-400 text-right font-mono font-black bg-slate-200 whitespace-nowrap">{fmt(grandTotals.grossClosing)}</td>

                      <td className="px-2.5 py-2.5 border-r border-slate-400 text-right font-mono bg-slate-200 whitespace-nowrap">{fmt(grandTotals.depOpening)}</td>
                      <td className="px-2.5 py-2.5 border-r border-slate-400 text-right font-mono text-indigo-900 font-black bg-slate-200 whitespace-nowrap">{fmt(grandTotals.depAdditions)}</td>
                      <td className="px-2.5 py-2.5 border-r border-slate-400 text-right font-mono bg-slate-200 whitespace-nowrap">{fmt(grandTotals.depAdjustments)}</td>
                      <td className="px-2.5 py-2.5 border-r border-slate-400 text-right font-mono text-rose-900 font-black bg-slate-200 whitespace-nowrap">{fmt(grandTotals.depClosing)}</td>

                      <td className="px-2.5 py-2.5 border-r border-slate-400 text-right font-mono text-emerald-950 font-black bg-emerald-100 border-b-2 border-double border-emerald-900 whitespace-nowrap">{fmt(grandTotals.netClosing)}</td>
                      <td className="px-2.5 py-2.5 text-right font-mono bg-slate-200 whitespace-nowrap">{fmt(grandTotals.netPrev)}</td>
                    </tr>
                    <tr className="bg-slate-100 font-bold text-slate-700">
                      <td className="px-3 py-2 border-r border-slate-300 bg-slate-100 whitespace-nowrap">Previous Period</td>
                      <td className="px-2 py-2 border-r border-slate-300 text-center bg-slate-100"></td>
                      <td className="px-2.5 py-2 border-r border-slate-300 text-right font-mono bg-slate-100 whitespace-nowrap">{fmt(previousPeriodTotals.grossOpening)}</td>
                      <td className="px-2.5 py-2 border-r border-slate-300 text-right font-mono bg-slate-100 whitespace-nowrap">{fmt(previousPeriodTotals.grossAdditions)}</td>
                      <td className="px-2.5 py-2 border-r border-slate-300 text-right font-mono bg-slate-100 whitespace-nowrap">{fmt(previousPeriodTotals.grossAdjustments)}</td>
                      <td className="px-2.5 py-2 border-r border-slate-300 text-right font-mono bg-slate-100 whitespace-nowrap">{fmt(previousPeriodTotals.grossClosing)}</td>

                      <td className="px-2.5 py-2 border-r border-slate-300 text-right font-mono bg-slate-100 whitespace-nowrap">{fmt(previousPeriodTotals.depOpening)}</td>
                      <td className="px-2.5 py-2 border-r border-slate-300 text-right font-mono bg-slate-100 whitespace-nowrap">{fmt(previousPeriodTotals.depAdditions)}</td>
                      <td className="px-2.5 py-2 border-r border-slate-300 text-right font-mono bg-slate-100 whitespace-nowrap">{fmt(previousPeriodTotals.depAdjustments)}</td>
                      <td className="px-2.5 py-2 border-r border-slate-300 text-right font-mono bg-slate-100 whitespace-nowrap">{fmt(previousPeriodTotals.depClosing)}</td>

                      <td className="px-2.5 py-2 border-r border-slate-300 text-right font-mono bg-slate-100 whitespace-nowrap">{fmt(previousPeriodTotals.netClosing)}</td>
                      <td className="px-2.5 py-2 text-right font-mono bg-slate-100 whitespace-nowrap">{fmt(previousPeriodTotals.netPrev)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'schedule' && (
          <div className="flex-1 min-h-0 border border-slate-200 rounded-xl overflow-hidden shadow-2xs bg-white flex flex-col relative">
            <div className="absolute inset-0 overflow-auto custom-scrollbar">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="sticky top-0 z-20 bg-[#1e3a8a] text-white font-bold uppercase text-[11px] border-b border-blue-950 shadow-2xs">
                  <tr>
                    <th className="px-4 py-3 bg-[#1e3a8a]">Posting Date</th>
                    <th className="px-4 py-3 bg-[#1e3a8a]">Journal Ref</th>
                    <th className="px-4 py-3 bg-[#1e3a8a]">Asset ID</th>
                    <th className="px-4 py-3 bg-[#1e3a8a]">Asset Name</th>
                    <th className="px-4 py-3 bg-[#1e3a8a]">Period</th>
                    <th className="px-4 py-3 text-right bg-[#1e3a8a]">Opening NBV</th>
                    <th className="px-4 py-3 text-right bg-[#1e3a8a] text-indigo-100 font-extrabold">Depreciation Amount</th>
                    <th className="px-4 py-3 text-right bg-[#1e3a8a]">Acc. Depreciation</th>
                    <th className="px-4 py-3 text-right bg-[#1e3a8a]">Closing NBV</th>
                    <th className="px-4 py-3 text-center bg-[#1e3a8a]">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredDepreciations.length > 0 ? (
                    filteredDepreciations.map((d, idx) => {
                      const asset = assets.find(a => a.id === d.assetId);
                      return (
                        <tr 
                          key={idx} 
                          onClick={() => {
                            if (asset) setSelectedDeepAsset(asset);
                          }}
                          className={`transition ${asset ? 'cursor-pointer hover:bg-indigo-50/50' : 'hover:bg-slate-50'}`}
                          title={asset ? "Click to deep dive into this asset's full records and audit history" : undefined}
                        >
                          <td className="px-4 py-3 text-slate-600 font-mono">{d.depreciationDate}</td>
                          <td className="px-4 py-3 font-mono text-indigo-700 font-bold">{d.journalId || '-'}</td>
                          <td className="px-4 py-3 font-mono text-slate-700 font-bold">{asset?.assetId || '-'}</td>
                          <td className="px-4 py-3 font-bold text-slate-900">
                            <div className="flex items-center justify-between gap-2">
                              <span>{asset?.name || 'Asset Record'}</span>
                              {asset && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded border border-indigo-200">
                                  <Eye className="h-3 w-3" />
                                  Deep-Down
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-semibold border border-slate-200/80">
                              {d.accountingPeriod}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-600">{fmt(d.openingNbv)}</td>
                          <td className="px-4 py-3 text-right font-mono font-extrabold bg-indigo-50/50 text-indigo-800">
                            {fmt(d.depreciationAmount)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-rose-600">{fmt(d.accumulatedDepreciation)}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700">{fmt(d.closingNbv)}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px] border border-emerald-200">
                              <CheckCircle2 className="h-3 w-3" />
                              Posted
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center text-slate-400 font-medium">
                        No posted depreciation records found matching the criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
                {filteredDepreciations.length > 0 && (
                  <tfoot className="sticky bottom-0 z-20 bg-slate-200 text-slate-900 font-black text-xs border-t-2 border-slate-800 shadow-md">
                    <tr>
                      <td colSpan={5} className="px-4 py-3 uppercase tracking-wider font-extrabold bg-slate-200">
                        TOTALS ({filteredDepreciations.length} records):
                      </td>
                      <td className="px-4 py-3 text-right font-mono bg-slate-200">
                        {fmt(filteredDepreciations.reduce((sum, d) => sum + (d.openingNbv || 0), 0))}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-indigo-900 font-black bg-indigo-200/60">
                        {fmt(filteredDepreciations.reduce((sum, d) => sum + (d.depreciationAmount || 0), 0))}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-rose-900 bg-slate-200">
                        {fmt(filteredDepreciations.reduce((sum, d) => sum + (d.accumulatedDepreciation || 0), 0))}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-emerald-950 font-black bg-emerald-200/60">
                        {fmt(filteredDepreciations.reduce((sum, d) => sum + (d.closingNbv || 0), 0))}
                      </td>
                      <td className="px-4 py-3 bg-slate-200"></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}

        {activeTab === 'register' && (
          <div className="flex-1 min-h-0 border border-slate-200 rounded-xl overflow-hidden shadow-2xs bg-white flex flex-col relative">
            <div className="absolute inset-0 overflow-auto custom-scrollbar">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="sticky top-0 z-20 bg-[#1e3a8a] text-white font-bold uppercase text-[11px] border-b border-blue-950 shadow-2xs">
                  <tr>
                    <th className="px-4 py-3 bg-[#1e3a8a]">Asset ID</th>
                    <th className="px-4 py-3 bg-[#1e3a8a]">Asset Name</th>
                    <th className="px-4 py-3 bg-[#1e3a8a]">Category</th>
                    <th className="px-4 py-3 bg-[#1e3a8a]">Purchase Date</th>
                    <th className="px-4 py-3 text-right bg-[#1e3a8a]">Cost</th>
                    <th className="px-4 py-3 text-right bg-[#1e3a8a]">Acc. Depreciation</th>
                    <th className="px-4 py-3 text-right bg-[#1e3a8a]">Net Book Value</th>
                    <th className="px-4 py-3 text-center bg-[#1e3a8a]">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredAssets.map((asset, idx) => {
                    const cat = categories.find(c => c.id === asset.categoryId);
                    return (
                      <tr 
                        key={idx} 
                        onClick={() => setSelectedDeepAsset(asset)}
                        className="hover:bg-indigo-50/50 transition cursor-pointer"
                        title="Click to deep dive into this asset's full records and audit history"
                      >
                        <td className="px-4 py-3 font-mono text-xs text-indigo-700 font-bold">
                          <div className="flex items-center gap-1.5">
                            <Eye className="h-3.5 w-3.5 text-indigo-500" />
                            <span>{asset.assetId}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-900">
                          <div className="flex items-center justify-between gap-2">
                            <span>{asset.name}</span>
                            <span className="inline-flex items-center gap-1 text-[10px] text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded border border-indigo-200">
                              Deep-Down
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 font-semibold">{cat?.name || 'Uncategorized'}</td>
                        <td className="px-4 py-3 font-mono text-slate-600">{asset.purchaseDate || '-'}</td>
                        <td className="px-4 py-3 text-right font-mono text-slate-800">{fmt(asset.cost)}</td>
                        <td className="px-4 py-3 text-right font-mono text-rose-600">{fmt(asset.accumulatedDepreciation)}</td>
                        <td className="px-4 py-3 text-right font-mono font-extrabold text-emerald-700">{fmt(asset.netBookValue)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            asset.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            asset.status === 'Fully Depreciated' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {asset.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {assets.length > 0 && (
                  <tfoot className="sticky bottom-0 z-20 bg-slate-200 text-slate-900 font-black text-xs border-t-2 border-slate-800 shadow-md">
                    <tr>
                      <td colSpan={4} className="px-4 py-3 uppercase tracking-wider font-extrabold bg-slate-200">
                        TOTALS ({assets.length} assets):
                      </td>
                      <td className="px-4 py-3 text-right font-mono bg-slate-200 font-black">
                        {fmt(assets.reduce((sum, a) => sum + (a.cost || 0), 0))}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-rose-900 bg-slate-200 font-black">
                        {fmt(assets.reduce((sum, a) => sum + (a.accumulatedDepreciation || 0), 0))}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-emerald-950 font-black bg-emerald-200/60">
                        {fmt(assets.reduce((sum, a) => sum + (a.netBookValue || 0), 0))}
                      </td>
                      <td className="px-4 py-3 bg-slate-200"></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}
      </div>

      {/* PRINT PREVIEW MODAL */}
      {showPrintModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 overflow-auto">
          <div className="w-full max-w-6xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 my-8 space-y-4 max-h-[92vh] flex flex-col">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200 shrink-0">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Printer className="h-5 w-5 text-indigo-600" />
                  Print Preview: Note 2 - Property, Plant & Equipment Schedule
                </h3>
                <p className="text-xs text-slate-500">Formatted dynamically from system dates and active asset records.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={triggerPrintWindow}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Printer className="h-4 w-4" /> Trigger Landscape Print
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintModal(false)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Printable Content Container */}
            <div className="flex-1 overflow-auto border border-slate-300 p-5 bg-white rounded-xl font-sans" ref={printContainerRef}>
              <div className="text-center mb-4 pb-3 border-b border-slate-200">
                <div className="font-extrabold text-sm uppercase text-slate-900 tracking-wider">
                  {config.CompanyName || (config as any).companyName || 'MY RETAIL STORE'}
                </div>
                <div className="font-extrabold text-base uppercase text-indigo-900 tracking-wide mt-0.5">
                  PROPERTY, PLANT & EQUIPMENT SCHEDULE {selectedPeriod !== 'All' ? `as at ${selectedPeriod}` : (selectedYear !== 'All' ? `as at 31.12.${currentYearNum}` : '')}
                </div>
              </div>

              <table className="w-full text-left text-[10px] whitespace-nowrap border-collapse border border-slate-600">
                <thead>
                  <tr className="bg-[#1e3a8a] text-white font-bold text-center border-b border-blue-900">
                    <th rowSpan={2} className="p-2 border-r border-blue-800 text-left w-56">Particulars</th>
                    <th rowSpan={2} className="p-2 border-r border-blue-800 w-12">Rate (%)</th>
                    <th colSpan={4} className="p-1.5 border-r border-blue-800 bg-[#1e3a8a]">GROSS BLOCK</th>
                    <th colSpan={4} className="p-1.5 border-r border-blue-800 bg-[#1e3a8a] text-indigo-100">DEPRECIATION</th>
                    <th colSpan={2} className="p-1.5 bg-[#1e3a8a] text-teal-100">NET BLOCK</th>
                  </tr>
                  <tr className="bg-[#1e3a8a] text-white font-bold text-center border-t border-blue-800 text-[9px] uppercase">
                    <th className="p-1 border-r border-blue-800 whitespace-pre-line">{openingDateHeader.replace('OPENING AS ON ', 'OPENING AS ON\n')}</th>
                    <th className="p-1 border-r border-blue-800">Additions</th>
                    <th className="p-1 border-r border-blue-800">Adjustments</th>
                    <th className="p-1 border-r border-blue-800 whitespace-pre-line">{closingDateHeader.replace('CLOSING AS ON ', 'CLOSING AS ON\n')}</th>

                    <th className="p-1 border-r border-blue-800 whitespace-pre-line">{openingDateHeader.replace('OPENING AS ON ', 'OPENING AS ON\n')}</th>
                    <th className="p-1 border-r border-blue-800 text-indigo-100">Additions</th>
                    <th className="p-1 border-r border-blue-800">Adjustments</th>
                    <th className="p-1 border-r border-blue-800 whitespace-pre-line">{closingDateHeader.replace('CLOSING AS ON ', 'CLOSING AS ON\n')}</th>

                    <th className="p-1 border-r border-blue-800 whitespace-pre-line bg-[#1e3a8a] text-teal-100">{netClosingHeader.replace('AS ON ', 'AS ON\n')}</th>
                    <th className="p-1 whitespace-pre-line bg-[#1e3a8a] text-teal-50">{netPrevHeader.replace('AS ON ', 'AS ON\n')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300 font-medium text-slate-800">
                  {allScheduleRows.map((r, idx) => (
                    <tr key={idx}>
                      <td className="p-1.5 border-r border-slate-300 font-semibold">{r.name}</td>
                      <td className="p-1.5 border-r border-slate-300 text-center font-mono">{r.rate}</td>
                      <td className="p-1.5 border-r border-slate-300 text-right font-mono">{fmt(r.grossOpening)}</td>
                      <td className="p-1.5 border-r border-slate-300 text-right font-mono">{fmt(r.grossAdditions)}</td>
                      <td className="p-1.5 border-r border-slate-300 text-right font-mono">{fmt(r.grossAdjustments)}</td>
                      <td className="p-1.5 border-r border-slate-300 text-right font-mono font-bold">{fmt(r.grossClosing)}</td>

                      <td className="p-1.5 border-r border-slate-300 text-right font-mono">{fmt(r.depOpening)}</td>
                      <td className="p-1.5 border-r border-slate-300 text-right font-mono font-bold">{fmt(r.depAdditions)}</td>
                      <td className="p-1.5 border-r border-slate-300 text-right font-mono">{fmt(r.depAdjustments)}</td>
                      <td className="p-1.5 border-r border-slate-300 text-right font-mono font-bold">{fmt(r.depClosing)}</td>

                      <td className="p-1.5 border-r border-slate-300 text-right font-mono font-bold">{fmt(r.netClosing)}</td>
                      <td className="p-1.5 text-right font-mono">{fmt(r.netPrev)}</td>
                    </tr>
                  ))}
                </tbody>

                <tfoot>
                  <tr className="totals-row bg-slate-200 font-bold border-t-2 border-slate-700">
                    <td className="p-1.5 border-r border-slate-400 font-extrabold">T O T A L S :</td>
                    <td className="p-1.5 border-r border-slate-400 text-center"></td>
                    <td className="p-1.5 border-r border-slate-400 text-right font-mono">{fmt(grandTotals.grossOpening)}</td>
                    <td className="p-1.5 border-r border-slate-400 text-right font-mono">{fmt(grandTotals.grossAdditions)}</td>
                    <td className="p-1.5 border-r border-slate-400 text-right font-mono">{fmt(grandTotals.grossAdjustments)}</td>
                    <td className="p-1.5 border-r border-slate-400 text-right font-mono">{fmt(grandTotals.grossClosing)}</td>

                    <td className="p-1.5 border-r border-slate-400 text-right font-mono">{fmt(grandTotals.depOpening)}</td>
                    <td className="p-1.5 border-r border-slate-400 text-right font-mono">{fmt(grandTotals.depAdditions)}</td>
                    <td className="p-1.5 border-r border-slate-400 text-right font-mono">{fmt(grandTotals.depAdjustments)}</td>
                    <td className="p-1.5 border-r border-slate-400 text-right font-mono">{fmt(grandTotals.depClosing)}</td>

                    <td className="p-1.5 border-r border-slate-400 text-right font-mono">{fmt(grandTotals.netClosing)}</td>
                    <td className="p-1.5 text-right font-mono">{fmt(grandTotals.netPrev)}</td>
                  </tr>
                  <tr className="bg-slate-100 font-bold border-t border-slate-400">
                    <td className="p-1.5 border-r border-slate-400">Previous Period</td>
                    <td className="p-1.5 border-r border-slate-400 text-center"></td>
                    <td className="p-1.5 border-r border-slate-400 text-right font-mono">{fmt(previousPeriodTotals.grossOpening)}</td>
                    <td className="p-1.5 border-r border-slate-400 text-right font-mono">{fmt(previousPeriodTotals.grossAdditions)}</td>
                    <td className="p-1.5 border-r border-slate-400 text-right font-mono">{fmt(previousPeriodTotals.grossAdjustments)}</td>
                    <td className="p-1.5 border-r border-slate-400 text-right font-mono">{fmt(previousPeriodTotals.grossClosing)}</td>

                    <td className="p-1.5 border-r border-slate-400 text-right font-mono">{fmt(previousPeriodTotals.depOpening)}</td>
                    <td className="p-1.5 border-r border-slate-400 text-right font-mono">{fmt(previousPeriodTotals.depAdditions)}</td>
                    <td className="p-1.5 border-r border-slate-400 text-right font-mono">{fmt(previousPeriodTotals.depAdjustments)}</td>
                    <td className="p-1.5 border-r border-slate-400 text-right font-mono">{fmt(previousPeriodTotals.depClosing)}</td>

                    <td className="p-1.5 border-r border-slate-400 text-right font-mono">{fmt(previousPeriodTotals.netClosing)}</td>
                    <td className="p-1.5 text-right font-mono">{fmt(previousPeriodTotals.netPrev)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
      {/* Deep-Down Asset Detail & Audit Modal */}
      {selectedDeepAsset && (() => {
        const deepCategory = categories.find(c => c.id === selectedDeepAsset.categoryId || c.name.toLowerCase() === selectedDeepAsset.categoryId?.toLowerCase())?.name || 'Standard PPE';
        const deepCustodian = custodians.find(c => c.id === selectedDeepAsset.currentCustodianId || c.name === selectedDeepAsset.currentCustodianId);
        const deepDeps = depreciations.filter(d => d.assetId === selectedDeepAsset.id || d.assetId === selectedDeepAsset.assetId).sort((a,b) => (a.depreciationDate > b.depreciationDate ? -1 : 1));
        const deepDisposal = disposals.find(d => d.assetId === selectedDeepAsset.id || d.assetId === selectedDeepAsset.assetId);

        return (
          <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 overflow-auto">
            <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 my-auto max-h-[92vh] flex flex-col space-y-4 animate-in fade-in zoom-in-95 duration-150">
              {/* Header */}
              <div className="flex items-start justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-indigo-100/80 text-indigo-700 border border-indigo-200">
                    <Eye className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-lg text-slate-900 tracking-tight">
                        {selectedDeepAsset.name}
                      </h3>
                      <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold border ${
                        selectedDeepAsset.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        selectedDeepAsset.status === 'Disposed' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                        selectedDeepAsset.status === 'Fully Depreciated' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-slate-100 text-slate-700 border-slate-200'
                      }`}>
                        {selectedDeepAsset.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500 font-medium">
                      <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                        ID: {selectedDeepAsset.assetId}
                      </span>
                      {selectedDeepAsset.assetTag && (
                        <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                          Tag: {selectedDeepAsset.assetTag}
                        </span>
                      )}
                      <span>•</span>
                      <span className="text-slate-700 font-semibold">{deepCategory}</span>
                      <span>•</span>
                      <span>Purchase: {selectedDeepAsset.purchaseDate || 'N/A'}</span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDeepAsset(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                  title="Close Deep-Down"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar text-xs">
                {/* 4 Financial Highlight Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="text-[11px] font-semibold text-slate-500 block">Gross Cost / Capitalized</span>
                    <span className="text-base font-extrabold font-mono text-slate-900 mt-0.5 block">
                      Nu. {fmt(selectedDeepAsset.totalCapitalizedCost || selectedDeepAsset.cost)}
                    </span>
                  </div>
                  <div className="p-3 bg-rose-50/50 border border-rose-200/80 rounded-xl">
                    <span className="text-[11px] font-semibold text-rose-600 block">Accumulated Depreciation</span>
                    <span className="text-base font-extrabold font-mono text-rose-700 mt-0.5 block">
                      Nu. {fmt(selectedDeepAsset.accumulatedDepreciation)}
                    </span>
                  </div>
                  <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl">
                    <span className="text-[11px] font-semibold text-emerald-700 block">Net Book Value (Closing)</span>
                    <span className="text-base font-black font-mono text-emerald-900 mt-0.5 block">
                      Nu. {fmt(selectedDeepAsset.netBookValue)}
                    </span>
                  </div>
                  <div className="p-3 bg-indigo-50/50 border border-indigo-200/80 rounded-xl">
                    <span className="text-[11px] font-semibold text-indigo-700 block">Depreciation Policy</span>
                    <span className="text-base font-bold font-mono text-indigo-900 mt-0.5 block">
                      {selectedDeepAsset.depreciationRate ? `${selectedDeepAsset.depreciationRate}%` : 'Standard'}
                    </span>
                    <span className="text-[10px] text-indigo-600 truncate block">
                      {selectedDeepAsset.depreciationMethod || 'Straight Line'}
                    </span>
                  </div>
                </div>

                {/* Grid of Identification & Custody */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Identification Details */}
                  <div className="p-4 border border-slate-200 rounded-xl bg-white space-y-2">
                    <h4 className="font-bold text-slate-900 flex items-center gap-1.5 pb-1 border-b border-slate-100">
                      <Tag className="h-4 w-4 text-indigo-600" />
                      Asset Specification & Procurement
                    </h4>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 pt-1 text-[11px]">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Model / Serial No:</span>
                        <span className="font-medium text-slate-800">{selectedDeepAsset.modelNumber || selectedDeepAsset.serialNumber || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Manufacturer / Brand:</span>
                        <span className="font-medium text-slate-800">{selectedDeepAsset.manufacturer || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Supplier / Vendor:</span>
                        <span className="font-medium text-slate-800">{selectedDeepAsset.supplierName || 'Not recorded'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Invoice / Bill Ref:</span>
                        <span className="font-mono text-slate-800">{selectedDeepAsset.purchaseInvoiceNumber || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Capitalization Date:</span>
                        <span className="font-mono text-slate-800">{selectedDeepAsset.capitalizationDate || selectedDeepAsset.purchaseDate || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Estimated Useful Life:</span>
                        <span className="font-medium text-slate-800">{selectedDeepAsset.usefulLife ? `${selectedDeepAsset.usefulLife} Years` : 'Per Category'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Salvage / Residual Value:</span>
                        <span className="font-mono text-slate-800">Nu. {fmt(selectedDeepAsset.residualValue || 1)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Cost Centre:</span>
                        <span className="font-medium text-slate-800">{selectedDeepAsset.costCentre || 'General'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Custody & Physical Location */}
                  <div className="p-4 border border-slate-200 rounded-xl bg-white space-y-2">
                    <h4 className="font-bold text-slate-900 flex items-center gap-1.5 pb-1 border-b border-slate-100">
                      <UserCheck className="h-4 w-4 text-indigo-600" />
                      Current Custodian & Physical Location
                    </h4>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 pt-1 text-[11px]">
                      <div className="col-span-2 sm:col-span-1">
                        <span className="text-slate-400 block text-[10px]">Assigned Custodian:</span>
                        <span className="font-bold text-slate-900">
                          {deepCustodian ? deepCustodian.name : (selectedDeepAsset.currentCustodianId || 'Unassigned')}
                        </span>
                        {deepCustodian?.designation && (
                          <span className="text-[10px] text-slate-500 block">({deepCustodian.designation})</span>
                        )}
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Custodian Contact:</span>
                        <span className="font-medium text-slate-700">{deepCustodian?.contact || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Department:</span>
                        <span className="font-medium text-slate-800">{selectedDeepAsset.department || deepCustodian?.department || 'Operations'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Physical Location:</span>
                        <span className="font-medium text-slate-800 flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-slate-400" />
                          {selectedDeepAsset.location || 'Headquarters'}
                        </span>
                      </div>
                      {selectedDeepAsset.custodianAssignmentDate && (
                        <div>
                          <span className="text-slate-400 block text-[10px]">Assigned Date:</span>
                          <span className="font-mono text-slate-800">{selectedDeepAsset.custodianAssignmentDate}</span>
                        </div>
                      )}
                      {selectedDeepAsset.subCategory && (
                        <div>
                          <span className="text-slate-400 block text-[10px]">Sub-Category:</span>
                          <span className="font-medium text-slate-800">{selectedDeepAsset.subCategory}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Disposal Record if Disposed */}
                {deepDisposal && (
                  <div className="p-3.5 bg-rose-50/60 border border-rose-200 rounded-xl space-y-1.5">
                    <div className="flex items-center gap-2 text-rose-800 font-bold">
                      <Info className="h-4 w-4" />
                      <span>Disposal & De-recognition Audit Record</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] pt-1">
                      <div>
                        <span className="text-slate-500 block text-[10px]">Disposal Date:</span>
                        <span className="font-mono font-bold text-rose-900">{deepDisposal.disposalDate}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">Disposal Type:</span>
                        <span className="font-semibold text-slate-800">{deepDisposal.disposalType}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">Sale Proceeds:</span>
                        <span className="font-mono font-bold text-slate-900">Nu. {fmt(deepDisposal.saleProceeds)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">Gain / (Loss):</span>
                        <span className={`font-mono font-black ${deepDisposal.gainLoss >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                          Nu. {fmt(deepDisposal.gainLoss)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Depreciation Posting History Log */}
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                  <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <span className="font-bold text-slate-900 flex items-center gap-1.5">
                      <TrendingDown className="h-4 w-4 text-indigo-600" />
                      Posted Depreciation History ({deepDeps.length} run{deepDeps.length === 1 ? '' : 's'})
                    </span>
                    <span className="text-[11px] text-slate-500">
                      General Ledger posted audit trail
                    </span>
                  </div>
                  <div className="overflow-x-auto max-h-52 custom-scrollbar">
                    <table className="w-full text-left text-xs whitespace-nowrap">
                      <thead className="sticky top-0 bg-[#1e3a8a] text-white font-bold uppercase text-[10px]">
                        <tr>
                          <th className="px-3 py-2 bg-[#1e3a8a]">Date</th>
                          <th className="px-3 py-2 bg-[#1e3a8a]">Journal ID</th>
                          <th className="px-3 py-2 bg-[#1e3a8a]">Period</th>
                          <th className="px-3 py-2 text-right bg-[#1e3a8a]">Opening NBV</th>
                          <th className="px-3 py-2 text-right bg-[#1e3a8a] text-indigo-100">Depreciation</th>
                          <th className="px-3 py-2 text-right bg-[#1e3a8a]">Acc. Dep</th>
                          <th className="px-3 py-2 text-right bg-[#1e3a8a]">Closing NBV</th>
                          <th className="px-3 py-2 text-center bg-[#1e3a8a]">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-[11px]">
                        {deepDeps.length > 0 ? (
                          deepDeps.map((dep, dIdx) => (
                            <tr key={dIdx} className="hover:bg-slate-50">
                              <td className="px-3 py-2 font-mono text-slate-600">{dep.depreciationDate}</td>
                              <td className="px-3 py-2 font-mono text-indigo-700 font-bold">{dep.journalId || '-'}</td>
                              <td className="px-3 py-2 text-slate-700">{dep.accountingPeriod}</td>
                              <td className="px-3 py-2 text-right font-mono text-slate-600">{fmt(dep.openingNbv)}</td>
                              <td className="px-3 py-2 text-right font-mono font-bold text-indigo-800 bg-indigo-50/40">
                                {fmt(dep.depreciationAmount)}
                              </td>
                              <td className="px-3 py-2 text-right font-mono text-rose-600">{fmt(dep.accumulatedDepreciation)}</td>
                              <td className="px-3 py-2 text-right font-mono font-bold text-emerald-700">{fmt(dep.closingNbv)}</td>
                              <td className="px-3 py-2 text-center">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[9.5px] border border-emerald-200">
                                  <CheckCircle2 className="h-2.5 w-2.5" />
                                  Posted
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={8} className="px-4 py-8 text-center text-slate-400 font-medium">
                              No posted depreciation transactions found for this asset yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setSelectedDeepAsset(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Close Deep-Down
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
