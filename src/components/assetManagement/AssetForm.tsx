import React, { useState, useEffect } from 'react';
import { FixedAsset, AssetCategory, Custodian } from '../../types/assetManagement';
import { Config, Ledger, Employee } from '../../types';
import { getAssetCategories, getCustodians, saveCustodians, getAssets, saveAsset } from '../../services/assetManagementService';
import { saveVoucher, nextCounter, getVoucherPrefix, saveLedger, loadJson, STORAGE_KEYS } from '../../services/storageService';
import { Save, ArrowLeft, Info, Calendar, Calculator, Plus, X, User } from 'lucide-react';
import { QuickLedgerModal } from '../QuickLedgerModal';

interface AssetFormProps {
  mode: 'create' | 'edit';
  assetId?: string;
  config: Config;
  ledgers: Ledger[];
  onSave: () => void;
  onCancel: () => void;
  onDataRefresh?: () => void;
}

export const AssetForm: React.FC<AssetFormProps> = ({ mode, assetId, config, ledgers, onSave, onCancel, onDataRefresh }) => {
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [custodians, setCustodians] = useState<Custodian[]>([]);
  const [ledgersList, setLedgersList] = useState<Ledger[]>(ledgers);
  const [isExistingAsset, setIsExistingAsset] = useState<boolean>(false);

  // Supplier Modal state
  const [showSupplierModal, setShowSupplierModal] = useState<boolean>(false);

  // Quick GL Modal state
  const [showGlModal, setShowGlModal] = useState<boolean>(false);
  const [glModalTarget, setGlModalTarget] = useState<'assetGlAccountId' | 'accumulatedDepreciationGlAccountId' | 'depreciationExpenseGlAccountId' | null>(null);
  const [glModalGroup, setGlModalGroup] = useState<string>('Fixed Assets');

  const handleOpenGlModal = (
    target: 'assetGlAccountId' | 'accumulatedDepreciationGlAccountId' | 'depreciationExpenseGlAccountId',
    initialGroup: string
  ) => {
    setGlModalTarget(target);
    setGlModalGroup(initialGroup);
    setShowGlModal(true);
  };

  // Custodian Modal state
  const [showCustodianModal, setShowCustodianModal] = useState<boolean>(false);
  const [custodianForm, setCustodianForm] = useState<Partial<Custodian>>({
    custodianCode: '',
    name: '',
    department: '',
    designation: '',
    contact: '',
    employeeId: '',
    status: 'Active'
  });
  const [employeesList, setEmployeesList] = useState<Employee[]>([]);

  useEffect(() => {
    setLedgersList(ledgers);
  }, [ledgers]);

  const handleOpenCustodianModal = () => {
    const loadedEmps = loadJson<Employee[]>(STORAGE_KEYS.EMPLOYEES, []);
    setEmployeesList(loadedEmps);
    setCustodianForm({
      custodianCode: `CST-${Math.floor(1000 + Math.random() * 9000)}`,
      name: '',
      department: formData.department || '',
      designation: '',
      contact: '',
      employeeId: '',
      status: 'Active'
    });
    setShowCustodianModal(true);
  };

  const handleSaveNewCustodian = (e: React.FormEvent) => {
    e.preventDefault();
    if (!custodianForm.name?.trim() || !custodianForm.custodianCode?.trim()) {
      alert("Custodian Name and Custodian Code are required.");
      return;
    }

    const newCustodian: Custodian = {
      id: `cust_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      custodianCode: custodianForm.custodianCode.trim(),
      name: custodianForm.name.trim(),
      department: custodianForm.department?.trim() || '',
      designation: custodianForm.designation?.trim() || '',
      contact: custodianForm.contact?.trim() || '',
      employeeId: custodianForm.employeeId || '',
      status: 'Active'
    };

    const currentCusts = getCustodians();
    const updatedCusts = [...currentCusts, newCustodian];
    saveCustodians(updatedCusts);
    setCustodians(updatedCusts);

    setFormData(prev => ({
      ...prev,
      currentCustodianId: newCustodian.id,
      department: prev.department ? prev.department : newCustodian.department
    }));

    setShowCustodianModal(false);
  };
  
  const [formData, setFormData] = useState<Partial<FixedAsset>>({
    name: '',
    assetId: `FA-${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`,
    categoryId: '',
    assetTag: '',
    description: '',
    serialNumber: '',
    cost: 0,
    residualValue: 1, // FIXED RULE
    depreciationMethod: 'Straight Line',
    depreciationBasis: 'Rate',
    depreciationRate: 0,
    usefulLife: 0,
    depreciationStartDate: new Date().toISOString().split('T')[0],
    capitalizationDate: new Date().toISOString().split('T')[0],
    status: 'Draft',
    accumulatedDepreciation: 0,
    netBookValue: 0
  });

  useEffect(() => {
    setCategories(getAssetCategories());
    setCustodians(getCustodians());
    
    if (mode === 'edit' && assetId) {
      const assets = getAssets();
      const asset = assets.find(a => a.id === assetId);
      if (asset) {
        setFormData(asset);
      }
    }
  }, [mode, assetId]);

  const handleCategoryChange = (catId: string) => {
    const cat = categories.find(c => c.id === catId);
    if (cat) {
      setFormData({
        ...formData,
        categoryId: cat.id,
        depreciationRate: cat.defaultRate || formData.depreciationRate,
        usefulLife: cat.defaultUsefulLife || formData.usefulLife,
        assetGlAccountId: cat.assetGlAccountId || formData.assetGlAccountId,
        accumulatedDepreciationGlAccountId: cat.accumulatedDepreciationGlAccountId || formData.accumulatedDepreciationGlAccountId,
        depreciationExpenseGlAccountId: cat.depreciationExpenseGlAccountId || formData.depreciationExpenseGlAccountId,
      });
    } else {
      setFormData({ ...formData, categoryId: catId });
    }
  };

  const handleCostChange = (cost: number) => {
    // Recalculate NBV when cost changes (only relevant for draft/opening assets)
    const nbv = Math.max(1, cost - (formData.accumulatedDepreciation || 0));
    setFormData({ ...formData, cost, netBookValue: nbv });
  };
  
  const handleAccDepChange = (acc: number) => {
    // Only allow for opening balance entry in Draft status
    const cost = formData.cost || 0;
    let validAcc = acc;
    if (validAcc > cost - 1) {
      validAcc = cost - 1; // Cannot depreciate below 1
    }
    const nbv = cost - validAcc;
    setFormData({ ...formData, accumulatedDepreciation: validAcc, netBookValue: nbv });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.categoryId || formData.cost === undefined || formData.cost <= 0) {
      alert("Name, Category, and Cost > 0 are required.");
      return;
    }
    
    // Ensure NBV is calculated properly
    const finalCost = formData.cost;
    const finalAcc = formData.accumulatedDepreciation || 0;
    const finalNbv = Math.max(1, finalCost - finalAcc);

    const assetToSave: FixedAsset = {
      ...(formData as FixedAsset),
      id: mode === 'create' ? crypto.randomUUID() : (formData.id as string),
      residualValue: 1, // Enforce
      netBookValue: finalNbv,
      accumulatedDepreciation: finalAcc,
      createdBy: formData.createdBy || 'current_user', // from context normally
      createdAt: formData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    saveAsset(assetToSave, 'current_user');

    // --- AUTO CAPITALIZATION LOGIC ---
    if (!isExistingAsset && assetToSave.status === 'Active' && assetToSave.supplierName && !assetToSave.purchaseVoucherId) {
      // Create Journal Voucher to book Asset and Payable
      const px = getVoucherPrefix('J', config);
      const voucherNo = px + nextCounter('Voucher');
      
      const voucherDate = assetToSave.purchaseDate || assetToSave.capitalizationDate;
      
      // Determine supplier ledger
      let supplierLedger = ledgers.find(l => l['Ledger Name'] === assetToSave.supplierName)?.['Ledger Name'];
      if (!supplierLedger) {
        supplierLedger = assetToSave.supplierName;
      }
      
      // Determine Asset Ledger
      const category = categories.find(c => c.id === assetToSave.categoryId);
      let assetLedger = category?.assetGlAccountId;
      if (!assetLedger) assetLedger = 'Fixed Assets'; // fallback

      saveVoucher('J', {
        voucherNo,
        date: voucherDate,
        amount: assetToSave.cost,
        debitLedger: assetLedger,
        creditLedger: supplierLedger,
        narration: `Auto-Capitalization of Asset: ${assetToSave.assetId} - ${assetToSave.name}`
      });

      // Update asset with voucher reference
      assetToSave.purchaseVoucherId = voucherNo;
      saveAsset(assetToSave, 'current_user');
    }
    // --- END AUTO CAPITALIZATION ---
    onSave();
  };

  const isReadOnly = false;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-full max-w-5xl mx-auto">
      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 rounded-t-xl shrink-0">
        <div className="flex items-center gap-3">
          <button 
            onClick={onCancel}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 transition cursor-pointer"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h2 className="text-lg font-bold text-slate-800">
              {mode === 'create' ? 'Add New Asset' : `Edit Asset: ${formData.assetId}`}
            </h2>
            {mode === 'edit' && (
              <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider mt-1 ${
                formData.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-800'
              }`}>
                Status: {formData.status}
              </span>
            )}
          </div>
        </div>
        
        <button
          onClick={handleSubmit}
          className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition shadow-sm cursor-pointer"
        >
          <Save className="h-4 w-4" />
          Save Changes
        </button>
      </div>

      <div className="flex-1 overflow-auto p-6 custom-scrollbar">
        <form id="assetForm" onSubmit={handleSubmit} className="space-y-8">
          
          {mode === 'create' && (
            <div className={`p-4 rounded-xl border ${isExistingAsset ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
              <label className="flex items-center gap-3 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={isExistingAsset} 
                  onChange={(e) => setIsExistingAsset(e.target.checked)} 
                  className="w-5 h-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
                <span className="text-sm font-bold text-slate-800">
                  This is an existing / carried forward asset (Opening Balance)
                </span>
              </label>
              {isExistingAsset && (
                <p className="text-xs text-amber-700 mt-2 ml-8 font-medium">
                  The system will <b>NOT</b> generate an accounting journal voucher for this asset. Make sure you enter the correct Original Cost and Opening Accumulated Depreciation below, and ensure the corresponding GL Ledgers have the correct opening balances set in your Chart of Accounts.
                </p>
              )}
            </div>
          )}

          {/* 1. Basic Info */}
          <section>
            <h3 className="text-sm font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Asset ID</label>
                <input
                  type="text"
                  value={formData.assetId || ''}
                  onChange={(e) => setFormData({ ...formData, assetId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono text-slate-800 outline-none focus:border-indigo-500 font-semibold"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">Asset Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-indigo-500 outline-none font-semibold"
                  placeholder="e.g., MacBook Pro 16-inch"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Asset Category *</label>
                <select
                  required
                  value={formData.categoryId || ''}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-indigo-500 outline-none"
                >
                  <option value="">-- Select Category --</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.name}>{c.name} ({c.code})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Asset Tag / Barcode</label>
                <input
                  type="text"
                  value={formData.assetTag || ''}
                  onChange={(e) => setFormData({ ...formData, assetTag: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-indigo-500 outline-none font-mono"
                  placeholder="e.g., AST-2026-001"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                <select
                  value={formData.status || 'Draft'}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-indigo-500 outline-none font-bold text-indigo-700"
                >
                  <option value="Draft">Draft (Not Depreciating)</option>
                  <option value="Active">Active (Capitalized)</option>
                </select>
              </div>
            </div>
            
            <div className="mt-4">
              <label className="block text-xs font-bold text-slate-700 mb-1">Description / Specifications</label>
              <textarea
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-indigo-500 outline-none resize-none"
              ></textarea>
            </div>
          </section>

          {/* 2. Purchase & Valuation */}
          <section>
          {/* Purchase Details */}
          <section>
            <h3 className="text-sm font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100">Purchase Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Supplier Name</label>
                <div className="flex gap-1.5">
                  <select
                    value={formData.supplierName || ''}
                    onChange={(e) => setFormData({ ...formData, supplierName: e.target.value })}
                    className="flex-1 min-w-0 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-indigo-500 outline-none"
                  >
                    <option value="">-- Select Supplier --</option>
                    {ledgersList.map(l => (
                      <option key={l['Ledger Name']} value={l['Ledger Name']}>{l['Ledger Name']}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowSupplierModal(true)}
                    className="px-2.5 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-xs font-bold flex items-center gap-1 transition shrink-0"
                    title="Create New Supplier"
                  >
                    <Plus className="h-4 w-4" />
                    New
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Purchase Date</label>
                <input
                  type="date"
                  value={formData.purchaseDate || ''}
                  onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Purchase Invoice Number</label>
                <input
                  type="text"
                  value={formData.purchaseInvoiceNumber || ''}
                  onChange={(e) => setFormData({ ...formData, purchaseInvoiceNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Manufacturer / Make</label>
                <input
                  type="text"
                  value={formData.manufacturer || ''}
                  onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Model Number</label>
                <input
                  type="text"
                  value={formData.modelNumber || ''}
                  onChange={(e) => setFormData({ ...formData, modelNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Serial Number</label>
                <input
                  type="text"
                  value={formData.serialNumber || ''}
                  onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-indigo-500 outline-none"
                />
              </div>
            </div>
          </section>

            <h3 className="text-sm font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100">Capitalization & Value</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Asset Cost *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">{config.CurrencySymbol}</span>
                  <input
                    type="number"
                    required
                    min="1"
                    step="0.01"
                    value={formData.cost || ''}
                    onChange={(e) => handleCostChange(Number(e.target.value))}
                    className="w-full pl-10 pr-3 py-2 border border-slate-300 focus:border-indigo-500 rounded-lg text-sm font-mono font-bold outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 text-rose-700">Residual Value (Fixed)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-rose-500 text-xs font-bold">{config.CurrencySymbol}</span>
                  <input
                    type="number"
                    readOnly
                    value={1}
                    className="w-full pl-10 pr-3 py-2 border border-rose-200 bg-rose-50 rounded-lg text-sm font-mono font-bold text-rose-700 outline-none"
                  />
                </div>
                <p className="text-[9px] text-slate-500 mt-1">Cannot depreciate below Nu. 1</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Opening Acc. Dep.</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">{config.CurrencySymbol}</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.accumulatedDepreciation || 0}
                    onChange={(e) => handleAccDepChange(Number(e.target.value))}
                    className="w-full pl-10 pr-3 py-2 border border-slate-300 focus:border-indigo-500 rounded-lg text-sm font-mono outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 text-emerald-700">Net Book Value</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600 text-xs font-bold">{config.CurrencySymbol}</span>
                  <input
                    type="number"
                    readOnly
                    value={formData.netBookValue || 1}
                    className="w-full pl-10 pr-3 py-2 border border-emerald-200 bg-emerald-50 rounded-lg text-sm font-mono font-bold text-emerald-700 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-4 gap-5 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="col-span-full">
                <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wide">
                  <Calculator className="h-4 w-4" /> Depreciation Rules
                </h4>
              </div>
              
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Depreciation Method</label>
                <input
                  type="text"
                  readOnly
                  value="Straight Line"
                  className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-sm font-semibold text-slate-700 outline-none"
                />
              </div>
              
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Calculation Basis</label>
                <select
                  value={formData.depreciationBasis || 'Rate'}
                  onChange={(e) => setFormData({ ...formData, depreciationBasis: e.target.value as any })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-indigo-500 outline-none bg-white"
                >
                  <option value="Rate">By Rate (%)</option>
                  <option value="Useful Life">By Useful Life (Years)</option>
                </select>
              </div>

              {formData.depreciationBasis === 'Rate' ? (
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Depreciation Rate (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="any"
                    value={formData.depreciationRate || 0}
                    onChange={(e) => setFormData({ ...formData, depreciationRate: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-indigo-500 outline-none bg-white font-mono"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Useful Life (Years)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={formData.usefulLife || 0}
                    onChange={(e) => setFormData({ ...formData, usefulLife: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-indigo-500 outline-none bg-white font-mono"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1 text-indigo-700">Depreciation Start Date *</label>
                <div className="relative">
                  <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-indigo-500" />
                  <input
                    type="date"
                    required
                    value={formData.depreciationStartDate || ''}
                    onChange={(e) => setFormData({ ...formData, depreciationStartDate: e.target.value })}
                    className="w-full pl-8 pr-3 py-2 border border-indigo-200 bg-indigo-50 rounded-lg text-sm focus:border-indigo-500 outline-none font-medium text-indigo-900"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* 3. Assignment & Location */}
          <section>
            <h3 className="text-sm font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100">Custodian & Location</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Assigned Custodian</label>
                <div className="flex gap-1.5">
                  <select
                    value={formData.currentCustodianId || ''}
                    onChange={(e) => {
                      const custId = e.target.value;
                      const cust = custodians.find(c => c.id === custId);
                      setFormData({ 
                        ...formData, 
                        currentCustodianId: custId,
                        ...(cust?.department && !formData.department ? { department: cust.department } : {}) 
                      });
                    }}
                    className="flex-1 min-w-0 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-indigo-500 outline-none"
                  >
                    <option value="">-- Unassigned --</option>
                    {custodians.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.custodianCode})</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleOpenCustodianModal}
                    className="px-2.5 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-xs font-bold flex items-center gap-1 transition shrink-0"
                    title="Create New Custodian"
                  >
                    <Plus className="h-4 w-4" />
                    New
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Department</label>
                <input
                  type="text"
                  value={formData.department || ''}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Physical Location</label>
                <input
                  type="text"
                  value={formData.location || ''}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-indigo-500 outline-none"
                />
              </div>
            </div>
          </section>

          {/* 4. Accounting Integration */}
          <section>
            <h3 className="text-sm font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100">GL Account Mapping</h3>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex gap-3 text-amber-800">
              <Info className="h-5 w-5 shrink-0" />
              <div className="text-xs">
                These accounts will be used automatically when posting depreciation or disposal transactions. If left blank, the category defaults will be used (if configured).
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Asset GL Account</label>
                <div className="flex gap-1.5">
                  <select
                    value={formData.assetGlAccountId || ''}
                    onChange={(e) => setFormData({ ...formData, assetGlAccountId: e.target.value })}
                    className="flex-1 min-w-0 px-3 py-2 border border-slate-300 rounded-lg text-xs focus:border-indigo-500 outline-none"
                  >
                    <option value="">-- Use Category Default --</option>
                    {ledgersList.map(l => (
                      <option key={l['Ledger Name']} value={l['Ledger Name']}>{l['Ledger Name']}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => handleOpenGlModal('assetGlAccountId', 'Fixed Assets')}
                    className="px-2.5 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-xs font-bold flex items-center gap-1 transition shrink-0"
                    title="Create Asset GL Account"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    New
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Accumulated Depreciation GL</label>
                <div className="flex gap-1.5">
                  <select
                    value={formData.accumulatedDepreciationGlAccountId || ''}
                    onChange={(e) => setFormData({ ...formData, accumulatedDepreciationGlAccountId: e.target.value })}
                    className="flex-1 min-w-0 px-3 py-2 border border-slate-300 rounded-lg text-xs focus:border-indigo-500 outline-none"
                  >
                    <option value="">-- Use Category Default --</option>
                    {ledgersList.map(l => (
                      <option key={l['Ledger Name']} value={l['Ledger Name']}>{l['Ledger Name']}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => handleOpenGlModal('accumulatedDepreciationGlAccountId', 'Fixed Assets')}
                    className="px-2.5 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-xs font-bold flex items-center gap-1 transition shrink-0"
                    title="Create Accumulated Depreciation GL Account"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    New
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Depreciation Expense GL</label>
                <div className="flex gap-1.5">
                  <select
                    value={formData.depreciationExpenseGlAccountId || ''}
                    onChange={(e) => setFormData({ ...formData, depreciationExpenseGlAccountId: e.target.value })}
                    className="flex-1 min-w-0 px-3 py-2 border border-slate-300 rounded-lg text-xs focus:border-indigo-500 outline-none"
                  >
                    <option value="">-- Use Category Default --</option>
                    {ledgersList.map(l => (
                      <option key={l['Ledger Name']} value={l['Ledger Name']}>{l['Ledger Name']}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => handleOpenGlModal('depreciationExpenseGlAccountId', 'Indirect Expenses')}
                    className="px-2.5 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-xs font-bold flex items-center gap-1 transition shrink-0"
                    title="Create Depreciation Expense GL Account"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    New
                  </button>
                </div>
              </div>
            </div>
          </section>

        </form>
      </div>

      {showSupplierModal && (
        <QuickLedgerModal
          isOpen={showSupplierModal}
          onClose={() => setShowSupplierModal(false)}
          initialGroup="Sundry Creditors"
          config={config}
          onSave={(newLedger) => {
            const res = saveLedger(newLedger);
            if (!res.ok) {
              alert(res.error || 'Failed to save ledger');
              return;
            }
            setLedgersList(prev => {
              const idx = prev.findIndex(x => x['Ledger Name'] === newLedger['Ledger Name']);
              if (idx >= 0) {
                const updated = [...prev];
                updated[idx] = newLedger;
                return updated;
              }
              return [...prev, newLedger];
            });
            setFormData(prev => ({ ...prev, supplierName: newLedger['Ledger Name'] }));
            setShowSupplierModal(false);
            onDataRefresh?.();
          }}
        />
      )}

      {showGlModal && (
        <QuickLedgerModal
          isOpen={showGlModal}
          onClose={() => {
            setShowGlModal(false);
            setGlModalTarget(null);
          }}
          initialGroup={glModalGroup}
          config={config}
          onSave={(newLedger) => {
            const res = saveLedger(newLedger);
            if (!res.ok) {
              alert(res.error || 'Failed to save GL Account');
              return;
            }
            setLedgersList(prev => {
              const idx = prev.findIndex(x => x['Ledger Name'] === newLedger['Ledger Name']);
              if (idx >= 0) {
                const updated = [...prev];
                updated[idx] = newLedger;
                return updated;
              }
              return [...prev, newLedger];
            });
            if (glModalTarget) {
              setFormData(prev => ({ ...prev, [glModalTarget]: newLedger['Ledger Name'] }));
            }
            setShowGlModal(false);
            setGlModalTarget(null);
            onDataRefresh?.();
          }}
        />
      )}

      {showCustodianModal && (
        <div className="fixed inset-0 z-[1000000] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 overflow-hidden flex flex-col space-y-4 p-6">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <User className="h-5 w-5 text-indigo-600" />
                Create New Custodian
              </h3>
              <button type="button" onClick={() => setShowCustodianModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewCustodian} className="space-y-4 text-sm">
              {employeesList.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Link to Employee (Optional)</label>
                  <select
                    value={custodianForm.employeeId || ''}
                    onChange={(e) => {
                      const empId = e.target.value;
                      if (!empId) {
                        setCustodianForm(prev => ({ ...prev, employeeId: '' }));
                        return;
                      }
                      const emp = employeesList.find(x => x.id === empId);
                      if (emp) {
                        setCustodianForm(prev => ({
                          ...prev,
                          employeeId: emp.id,
                          name: emp.fullName,
                          department: emp.department || prev.department,
                          designation: emp.designation || prev.designation,
                          contact: emp.contactNo || prev.contact
                        }));
                      }
                    }}
                    className="w-full h-10 px-3 border border-slate-300 rounded-xl text-sm focus:border-indigo-500 outline-none"
                  >
                    <option value="">-- Do not link / Manual entry --</option>
                    {employeesList.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.fullName} ({emp.empCode})</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Custodian Code *</label>
                  <input
                    type="text"
                    required
                    value={custodianForm.custodianCode || ''}
                    onChange={(e) => setCustodianForm({ ...custodianForm, custodianCode: e.target.value })}
                    className="w-full h-10 px-3 border border-slate-300 rounded-xl text-sm font-mono focus:border-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={custodianForm.name || ''}
                    onChange={(e) => setCustodianForm({ ...custodianForm, name: e.target.value })}
                    placeholder="e.g. Karma Wangchuk"
                    className="w-full h-10 px-3 border border-slate-300 rounded-xl text-sm focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Department</label>
                  <input
                    type="text"
                    value={custodianForm.department || ''}
                    onChange={(e) => setCustodianForm({ ...custodianForm, department: e.target.value })}
                    placeholder="e.g. IT Department"
                    className="w-full h-10 px-3 border border-slate-300 rounded-xl text-sm focus:border-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Designation</label>
                  <input
                    type="text"
                    value={custodianForm.designation || ''}
                    onChange={(e) => setCustodianForm({ ...custodianForm, designation: e.target.value })}
                    placeholder="e.g. Senior IT Officer"
                    className="w-full h-10 px-3 border border-slate-300 rounded-xl text-sm focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Contact No / Phone</label>
                <input
                  type="text"
                  value={custodianForm.contact || ''}
                  onChange={(e) => setCustodianForm({ ...custodianForm, contact: e.target.value })}
                  placeholder="e.g. +975 17123456"
                  className="w-full h-10 px-3 border border-slate-300 rounded-xl text-sm focus:border-indigo-500 outline-none"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCustodianModal(false)}
                  className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md transition flex items-center gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  Save Custodian
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
