import React, { useState, useEffect } from 'react';
import { Settings, Plus, ArrowUp, ArrowDown, Trash2, Edit2, X, Check, RotateCcw, Eye, EyeOff, Calculator } from 'lucide-react';
import { GstFieldConfig, GstInputTypeConfig, GstSourceType } from '../types';
import { DEFAULT_GST_INPUT_TYPES, getDefaultGstFieldConfigs, getGstConfigsFromConfig } from '../utils/gstConfigUtils';

interface GstConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  gstInputConfigsStr?: string;
  onSave: (updatedConfigsStr: string) => void;
}

export const GstConfigModal: React.FC<GstConfigModalProps> = ({
  isOpen,
  onClose,
  gstInputConfigsStr,
  onSave
}) => {
  const [selectedType, setSelectedType] = useState<string>('Local Purchase');
  const [allConfigs, setAllConfigs] = useState<GstInputTypeConfig[]>([]);
  const [newTypeName, setNewTypeName] = useState('');
  const [showAddTypeModal, setShowAddTypeModal] = useState(false);

  // Field Edit Modal State
  const [editingField, setEditingField] = useState<GstFieldConfig | null>(null);
  const [isNewField, setIsNewField] = useState(false);
  const [showFieldModal, setShowFieldModal] = useState(false);

  // Field Edit Form
  const [fieldLabel, setFieldLabel] = useState('');
  const [fieldId, setFieldId] = useState('');
  const [dataType, setDataType] = useState<'text' | 'number' | 'date'>('text');
  const [sourceType, setSourceType] = useState<GstSourceType>('manual');
  const [sourceValue, setSourceValue] = useState('');
  const [showInReport, setShowInReport] = useState(true);

  useEffect(() => {
    if (isOpen) {
      const existing = getGstConfigsFromConfig(gstInputConfigsStr);
      // Ensure all default transaction types exist in config
      const merged: GstInputTypeConfig[] = DEFAULT_GST_INPUT_TYPES.map(typeId => {
        const found = existing.find(c => c.typeId === typeId);
        if (found && found.fields && found.fields.length > 0) {
          return found;
        }
        return {
          typeId,
          fields: getDefaultGstFieldConfigs(typeId)
        };
      });

      // Include any user-created custom types
      existing.forEach(e => {
        if (!merged.some(m => m.typeId === e.typeId)) {
          merged.push(e);
        }
      });

      setAllConfigs(merged);
    }
  }, [isOpen, gstInputConfigsStr]);

  if (!isOpen) return null;

  const currentConfig = allConfigs.find(c => c.typeId === selectedType) || {
    typeId: selectedType,
    fields: getDefaultGstFieldConfigs(selectedType)
  };

  const currentFields = [...currentConfig.fields].sort((a, b) => a.order - b.order);

  const handleUpdateFields = (updatedFields: GstFieldConfig[]) => {
    // Re-index orders
    const reordered = updatedFields.map((f, idx) => ({ ...f, order: idx + 1 }));
    setAllConfigs(prev => {
      const idx = prev.findIndex(c => c.typeId === selectedType);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], fields: reordered };
        return copy;
      } else {
        return [...prev, { typeId: selectedType, fields: reordered }];
      }
    });
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const copy = [...currentFields];
    const temp = copy[index - 1];
    copy[index - 1] = copy[index];
    copy[index] = temp;
    handleUpdateFields(copy);
  };

  const handleMoveDown = (index: number) => {
    if (index === currentFields.length - 1) return;
    const copy = [...currentFields];
    const temp = copy[index + 1];
    copy[index + 1] = copy[index];
    copy[index] = temp;
    handleUpdateFields(copy);
  };

  const handleToggleReport = (fieldId: string) => {
    const copy = currentFields.map(f => f.id === fieldId ? { ...f, showInReport: !f.showInReport } : f);
    handleUpdateFields(copy);
  };

  const handleDeleteField = (fieldId: string) => {
    if (confirm('Are you sure you want to remove this field?')) {
      const copy = currentFields.filter(f => f.id !== fieldId);
      handleUpdateFields(copy);
    }
  };

  const handleOpenAddField = () => {
    setIsNewField(true);
    setEditingField(null);
    setFieldLabel('');
    setFieldId(`field_${Date.now().toString().slice(-4)}`);
    setDataType('text');
    setSourceType('manual');
    setSourceValue('');
    setShowInReport(true);
    setShowFieldModal(true);
  };

  const handleOpenEditField = (field: GstFieldConfig) => {
    setIsNewField(false);
    setEditingField(field);
    setFieldLabel(field.label);
    setFieldId(field.id);
    setDataType(field.dataType);
    setSourceType(field.sourceType);
    setSourceValue(field.sourceValue || '');
    setShowInReport(field.showInReport !== false);
    setShowFieldModal(true);
  };

  const handleSaveField = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fieldLabel.trim()) {
      alert('Please enter a field label.');
      return;
    }

    const cleanId = (fieldId || fieldLabel.toLowerCase().replace(/[^a-z0-9]/g, '_')).trim();

    const newFieldObj: GstFieldConfig = {
      id: cleanId,
      label: fieldLabel.trim(),
      dataType,
      sourceType,
      sourceValue: sourceType === 'manual' ? '' : sourceValue.trim(),
      showInReport,
      order: isNewField ? currentFields.length + 1 : (editingField?.order || 1)
    };

    if (isNewField) {
      handleUpdateFields([...currentFields, newFieldObj]);
    } else {
      const copy = currentFields.map(f => f.id === editingField?.id ? newFieldObj : f);
      handleUpdateFields(copy);
    }

    setShowFieldModal(false);
  };

  const handleResetCurrentType = () => {
    if (confirm(`Reset fields for "${selectedType}" to system defaults?`)) {
      const defaultFields = getDefaultGstFieldConfigs(selectedType);
      handleUpdateFields(defaultFields);
    }
  };

  const handleSaveAll = () => {
    onSave(JSON.stringify(allConfigs));
    onClose();
  };

  const handleAddCustomType = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTypeName.trim()) return;
    const name = newTypeName.trim();
    if (allConfigs.some(c => c.typeId.toLowerCase() === name.toLowerCase())) {
      alert('This type already exists.');
      return;
    }
    const newConfig: GstInputTypeConfig = {
      typeId: name,
      fields: getDefaultGstFieldConfigs('Local Purchase')
    };
    setAllConfigs([...allConfigs, newConfig]);
    setSelectedType(name);
    setNewTypeName('');
    setShowAddTypeModal(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-700/60 rounded-xl border border-indigo-500/30">
              <Settings className="w-5 h-5 text-indigo-200" />
            </div>
            <div>
              <h2 className="text-base font-extrabold tracking-tight">GST Input Fields & Formula Configuration</h2>
              <p className="text-xs text-indigo-200 mt-0.5">Customize tracking fields, formulas, and report headers per GST Input Type</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-indigo-200 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          
          {/* GST Input Type Selection bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2 flex-1 min-w-[260px]">
              <label className="text-xs font-bold text-slate-700 whitespace-nowrap">GST Input Type:</label>
              <select
                value={selectedType}
                onChange={e => setSelectedType(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold text-indigo-900 focus:ring-2 focus:ring-indigo-500 outline-none shadow-xs"
              >
                {allConfigs.map(c => (
                  <option key={c.typeId} value={c.typeId}>
                    {c.typeId}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAddTypeModal(true)}
                className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5 text-indigo-600" />
                <span>New Type</span>
              </button>

              <button
                type="button"
                onClick={handleResetCurrentType}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                title="Reset this type to system defaults"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Defaults</span>
              </button>
            </div>
          </div>

          {/* Fields List Header & Add Button */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                Configured Fields for: <span className="text-indigo-600">{selectedType}</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Reorder fields using ▲▼ to change entry form & report header layout.
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenAddField}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Custom Field</span>
            </button>
          </div>

          {/* Table of Fields */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs bg-white">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-2.5 px-3 w-12 text-center">Order</th>
                  <th className="py-2.5 px-3">Field Label</th>
                  <th className="py-2.5 px-3">Field ID</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Value Source / Formula</th>
                  <th className="py-2.5 px-3 text-center">Report Header</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {currentFields.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 italic">
                      No fields configured for this type. Click "+ Add Custom Field" above.
                    </td>
                  </tr>
                ) : (
                  currentFields.map((field, idx) => (
                    <tr key={field.id} className="hover:bg-indigo-50/30 transition">
                      
                      {/* Reorder Buttons */}
                      <td className="py-2 px-2 text-center">
                        <div className="flex items-center justify-center gap-0.5">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveUp(idx)}
                            className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-slate-100 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                            title="Move Up"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === currentFields.length - 1}
                            onClick={() => handleMoveDown(idx)}
                            className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-slate-100 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                            title="Move Down"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* Label */}
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        {field.label}
                      </td>

                      {/* ID */}
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                        {field.id}
                      </td>

                      {/* Data Type */}
                      <td className="py-2.5 px-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          field.dataType === 'number' ? 'bg-amber-100 text-amber-800' :
                          field.dataType === 'date' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {field.dataType}
                        </span>
                      </td>

                      {/* Source / Formula */}
                      <td className="py-2.5 px-3">
                        {field.sourceType === 'manual' && (
                          <span className="text-slate-500 italic text-[11px]">User Manual Input</span>
                        )}
                        {field.sourceType === 'ledger' && (
                          <span className="inline-flex items-center gap-1 bg-indigo-50 border border-indigo-200 text-indigo-800 px-2 py-0.5 rounded text-[11px] font-semibold">
                            Pull from Party Ledger ({field.sourceValue || 'name'})
                          </span>
                        )}
                        {field.sourceType === 'voucher' && (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-800 px-2 py-0.5 rounded text-[11px] font-semibold">
                            Pull from Voucher ({field.sourceValue || 'amount'})
                          </span>
                        )}
                        {field.sourceType === 'formula' && (
                          <span className="inline-flex items-center gap-1 bg-purple-50 border border-purple-200 text-purple-900 px-2 py-0.5 rounded text-[11px] font-mono font-bold">
                            <Calculator className="w-3 h-3 text-purple-600" />
                            Formula: {field.sourceValue}
                          </span>
                        )}
                      </td>

                      {/* Show in Report toggle */}
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleReport(field.id)}
                          className={`p-1.5 rounded-lg transition cursor-pointer ${
                            field.showInReport !== false 
                              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' 
                              : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                          }`}
                          title={field.showInReport !== false ? 'Included in Reports' : 'Excluded from Reports'}
                        >
                          {field.showInReport !== false ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditField(field)}
                            className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 transition cursor-pointer"
                            title="Edit Field"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteField(field.id)}
                            className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition cursor-pointer"
                            title="Delete Field"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Quick Guidance Box */}
          <div className="p-3.5 bg-indigo-50/60 rounded-xl border border-indigo-200 text-indigo-900 text-xs space-y-1">
            <p className="font-extrabold flex items-center gap-1.5 text-indigo-950">
              <Calculator className="w-4 h-4 text-indigo-600" />
              Formula & Pull Mapping Tips:
            </p>
            <ul className="list-disc list-inside text-[11px] text-indigo-800 space-y-0.5">
              <li>Use <strong>Formula</strong> mode for auto-calculations e.g., <code className="bg-white px-1.5 py-0.5 rounded font-mono text-purple-700">gstAmount * 20</code> to derive 100% Taxable Value from 5% GST.</li>
              <li>You can reference variables: <code className="bg-white px-1 rounded font-mono">gstAmount</code>, <code className="bg-white px-1 rounded font-mono">taxableAmount</code>, <code className="bg-white px-1 rounded font-mono">amount</code>, <code className="bg-white px-1 rounded font-mono">totalImportAmount</code>.</li>
              <li>Fields marked with <strong>Eye</strong> icon will appear as columns in the GST Input Reports in the exact order shown above.</li>
            </ul>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
          >
            Cancel
          </button>
          
          <button
            type="button"
            onClick={handleSaveAll}
            className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-indigo-800 hover:from-indigo-700 hover:to-indigo-900 text-white text-xs font-extrabold rounded-xl shadow-md transition cursor-pointer flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            <span>Save Configuration</span>
          </button>
        </div>

      </div>

      {/* Sub-Modal: Add / Edit Field */}
      {showFieldModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <form onSubmit={handleSaveField}>
              <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                <h3 className="text-sm font-extrabold flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-indigo-400" />
                  {isNewField ? 'Add Custom Field' : `Edit Field: ${editingField?.label}`}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowFieldModal(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs">
                
                {/* Label */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Field Label *</label>
                  <input
                    type="text"
                    required
                    value={fieldLabel}
                    onChange={e => {
                      setFieldLabel(e.target.value);
                      if (isNewField) {
                        setFieldId(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '_'));
                      }
                    }}
                    placeholder="e.g. Customs Duty, Clearance Fee"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                {/* ID & Data Type */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Field Key / ID</label>
                    <input
                      type="text"
                      required
                      value={fieldId}
                      onChange={e => setFieldId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Data Type</label>
                    <select
                      value={dataType}
                      onChange={e => setDataType(e.target.value as any)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="text">Text / String</option>
                      <option value="number">Numeric (Amount / Rate)</option>
                      <option value="date">Date</option>
                    </select>
                  </div>
                </div>

                {/* Value Source */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Value Source / Computation Mode</label>
                  <select
                    value={sourceType}
                    onChange={e => {
                      const st = e.target.value as GstSourceType;
                      setSourceType(st);
                      if (st === 'formula' && !sourceValue) {
                        setSourceValue('gstAmount * 20');
                      } else if (st === 'ledger' && !sourceValue) {
                        setSourceValue('name');
                      } else if (st === 'voucher' && !sourceValue) {
                        setSourceValue('amount');
                      }
                    }}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-bold text-indigo-900 bg-indigo-50/50 focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="manual">✍️ Manual Entry (User types value)</option>
                    <option value="ledger">👤 Pull from Party Ledger Details</option>
                    <option value="voucher">📋 Pull from Voucher Header</option>
                    <option value="formula">🧮 Math Formula Calculation</option>
                  </select>
                </div>

                {/* Source Value Config depending on SourceType */}
                {sourceType === 'ledger' && (
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Select Party Ledger Attribute</label>
                    <select
                      value={sourceValue || 'name'}
                      onChange={e => setSourceValue(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="name">Party Name</option>
                      <option value="gstNo">GST Number (GSTIN / TPN)</option>
                      <option value="country">Country</option>
                      <option value="address">Address</option>
                      <option value="phone">Phone Number</option>
                    </select>
                  </div>
                )}

                {sourceType === 'voucher' && (
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Select Voucher Attribute</label>
                    <select
                      value={sourceValue || 'amount'}
                      onChange={e => setSourceValue(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="amount">Total Voucher Amount</option>
                      <option value="date">Voucher Date</option>
                      <option value="voucherNo">Voucher Number</option>
                      <option value="bankTxnNo">Bank Ref / Txn No.</option>
                    </select>
                  </div>
                )}

                {sourceType === 'formula' && (
                  <div className="space-y-2">
                    <label className="block font-bold text-slate-700">
                      Formula Expression (e.g. <code className="text-purple-700">gstAmount * 20</code>)
                    </label>
                    <input
                      type="text"
                      required
                      value={sourceValue}
                      onChange={e => setSourceValue(e.target.value)}
                      placeholder="e.g. gstAmount * 20"
                      className="w-full rounded-lg border border-purple-300 bg-purple-50/50 px-3 py-2 font-mono font-bold text-purple-900 focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                    <div className="flex flex-wrap gap-1.5 items-center">
                      <span className="text-[10px] text-slate-500 font-semibold">Click to insert variable:</span>
                      {['gstAmount', 'taxableAmount', 'amount', 'totalImportAmount', 'exemptedAmount'].map(v => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setSourceValue(prev => (prev ? `${prev} * ${v}` : v))}
                          className="px-1.5 py-0.5 bg-slate-100 hover:bg-purple-100 hover:text-purple-800 text-slate-700 text-[10px] font-mono rounded border border-slate-200 transition cursor-pointer"
                        >
                          +{v}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Report Checkbox */}
                <label className="flex items-center gap-2 pt-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showInReport}
                    onChange={e => setShowInReport(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                  <span className="font-bold text-slate-800">Show this field as a column in GST Input Reports</span>
                </label>

              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowFieldModal(false)}
                  className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold rounded-xl shadow-xs"
                >
                  {isNewField ? 'Add Field' : 'Update Field'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sub-Modal: Add New Transaction Type */}
      {showAddTypeModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <form onSubmit={handleAddCustomType}>
              <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                <h3 className="text-sm font-extrabold">Add Custom GST Transaction Type</h3>
                <button type="button" onClick={() => setShowAddTypeModal(false)} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-5 space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Transaction Type Name *</label>
                  <input
                    type="text"
                    required
                    value={newTypeName}
                    onChange={e => setNewTypeName(e.target.value)}
                    placeholder="e.g. Service Import GST, Capital Good GST"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                <button type="button" onClick={() => setShowAddTypeModal(false)} className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl">
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold rounded-xl shadow-xs">
                  Create Type
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
