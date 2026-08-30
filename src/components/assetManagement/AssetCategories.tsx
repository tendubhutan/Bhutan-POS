import React, { useState, useEffect } from 'react';
import { AssetCategory } from '../../types/assetManagement';
import { Ledger, Config } from '../../types';
import { getAssetCategories, saveAssetCategories } from '../../services/assetManagementService';
import { Plus, Edit2, Check, X, Search } from 'lucide-react';

interface AssetCategoriesProps {
  ledgers: Ledger[];
  config: Config;
}

export const AssetCategories: React.FC<AssetCategoriesProps> = ({ ledgers, config }) => {
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<AssetCategory | null>(null);
  
  const [formData, setFormData] = useState<Partial<AssetCategory>>({
    name: '',
    code: '',
    description: '',
    defaultRate: 0,
    defaultUsefulLife: 0,
    assetGlAccountId: '',
    accumulatedDepreciationGlAccountId: '',
    depreciationExpenseGlAccountId: '',
    gainOnDisposalAccountId: '',
    lossOnDisposalAccountId: '',
    active: true
  });

  useEffect(() => {
    setCategories(getAssetCategories());
  }, []);

  const handleOpenModal = (category?: AssetCategory) => {
    if (category) {
      setEditingCategory(category);
      setFormData(category);
    } else {
      setEditingCategory(null);
      setFormData({
        name: '',
        code: '',
        description: '',
        defaultRate: 10,
        defaultUsefulLife: 10,
        assetGlAccountId: '',
        accumulatedDepreciationGlAccountId: '',
        depreciationExpenseGlAccountId: '',
        gainOnDisposalAccountId: '',
        lossOnDisposalAccountId: '',
        active: true
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.code) {
      alert("Name and Code are required.");
      return;
    }

    let updatedCategories = [...categories];
    
    if (editingCategory) {
      updatedCategories = updatedCategories.map(c => 
        c.id === editingCategory.id 
          ? { ...c, ...formData, updatedAt: new Date().toISOString() } as AssetCategory
          : c
      );
    } else {
      const newCategory: AssetCategory = {
        ...(formData as AssetCategory),
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      updatedCategories.push(newCategory);
    }
    
    saveAssetCategories(updatedCategories);
    setCategories(updatedCategories);
    setIsModalOpen(false);
  };

  const filteredCategories = categories.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-full">
      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 rounded-t-xl shrink-0">
        <h2 className="text-lg font-bold text-slate-800">Asset Categories</h2>
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all outline-none"
            />
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition shadow-sm cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Add Category
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 custom-scrollbar">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-100 text-slate-600 font-semibold">
              <tr>
                <th className="px-4 py-3 rounded-l-lg">Code</th>
                <th className="px-4 py-3">Category Name</th>
                <th className="px-4 py-3">Default Useful Life</th>
                <th className="px-4 py-3">Default Rate</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 rounded-r-lg text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCategories.length > 0 ? (
                filteredCategories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3 font-mono text-slate-700">{cat.code}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{cat.name}</td>
                    <td className="px-4 py-3 text-slate-700">{cat.defaultUsefulLife} Years</td>
                    <td className="px-4 py-3 text-slate-700">{cat.defaultRate}%</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold ${cat.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                        {cat.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleOpenModal(cat)}
                        className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 transition cursor-pointer"
                        title="Edit Category"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No asset categories found. Click "Add Category" to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
              <h3 className="text-lg font-bold text-slate-800">
                {editingCategory ? 'Edit Asset Category' : 'Create Asset Category'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-200 p-1.5 rounded-lg transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              <form id="categoryForm" onSubmit={handleSave} className="space-y-6">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Category Code *</label>
                    <input
                      type="text"
                      required
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-indigo-500 outline-none"
                      placeholder="e.g., CMP, FUR, BLD"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Category Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-indigo-500 outline-none"
                      placeholder="e.g., Computers, Furniture, Buildings"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                  <input
                    type="text"
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-indigo-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Default Useful Life (Years)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={formData.defaultUsefulLife}
                      onChange={(e) => setFormData({ ...formData, defaultUsefulLife: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Default Depreciation Rate (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="any"
                      value={formData.defaultRate}
                      onChange={(e) => setFormData({ ...formData, defaultRate: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-4">
                  <h4 className="text-sm font-bold text-slate-800 mb-3">GL Account Mapping</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Asset GL Account</label>
                      <select
                        value={formData.assetGlAccountId || ''}
                        onChange={(e) => setFormData({ ...formData, assetGlAccountId: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-indigo-500 outline-none"
                      >
                        <option value="">-- Select GL Account --</option>
                        {ledgers.map(l => (
                          <option key={l['Ledger Name']} value={l['Ledger Name']}>{l['Ledger Name']}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Accumulated Depreciation GL</label>
                      <select
                        value={formData.accumulatedDepreciationGlAccountId || ''}
                        onChange={(e) => setFormData({ ...formData, accumulatedDepreciationGlAccountId: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-indigo-500 outline-none"
                      >
                        <option value="">-- Select GL Account --</option>
                        {ledgers.map(l => (
                          <option key={l['Ledger Name']} value={l['Ledger Name']}>{l['Ledger Name']}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Depreciation Expense GL</label>
                      <select
                        value={formData.depreciationExpenseGlAccountId || ''}
                        onChange={(e) => setFormData({ ...formData, depreciationExpenseGlAccountId: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-indigo-500 outline-none"
                      >
                        <option value="">-- Select GL Account --</option>
                        {ledgers.map(l => (
                          <option key={l['Ledger Name']} value={l['Ledger Name']}>{l['Ledger Name']}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Gain on Disposal GL</label>
                      <select
                        value={formData.gainOnDisposalAccountId || ''}
                        onChange={(e) => setFormData({ ...formData, gainOnDisposalAccountId: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-indigo-500 outline-none"
                      >
                        <option value="">-- Select GL Account --</option>
                        {ledgers.map(l => (
                          <option key={l['Ledger Name']} value={l['Ledger Name']}>{l['Ledger Name']}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Loss on Disposal GL</label>
                      <select
                        value={formData.lossOnDisposalAccountId || ''}
                        onChange={(e) => setFormData({ ...formData, lossOnDisposalAccountId: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-indigo-500 outline-none"
                      >
                        <option value="">-- Select GL Account --</option>
                        {ledgers.map(l => (
                          <option key={l['Ledger Name']} value={l['Ledger Name']}>{l['Ledger Name']}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                
                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.active}
                      onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                    />
                    <span className="text-sm font-semibold text-slate-700">Active Category</span>
                  </label>
                </div>
              </form>
            </div>
            
            <div className="p-4 border-t border-slate-200 bg-slate-50 shrink-0 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="categoryForm"
                className="flex items-center gap-2 px-6 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm transition cursor-pointer"
              >
                <Check className="h-4 w-4" />
                Save Category
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
