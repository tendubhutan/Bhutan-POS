import React, { useState, useEffect } from 'react';
import { Custodian } from '../../types/assetManagement';
import { Config, Employee } from '../../types';
import { getCustodians, saveCustodians } from '../../services/assetManagementService';
import { loadJson } from '../../services/storageService';
import { STORAGE_KEYS } from '../../services/storageService';
import { Plus, Edit2, Check, X, Search, User } from 'lucide-react';

interface CustodiansProps {
  config: Config;
}

export const Custodians: React.FC<CustodiansProps> = ({ config }) => {
  const [custodians, setCustodians] = useState<Custodian[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustodian, setEditingCustodian] = useState<Custodian | null>(null);
  
  const [formData, setFormData] = useState<Partial<Custodian>>({
    custodianCode: '',
    employeeId: '',
    name: '',
    department: '',
    designation: '',
    contact: '',
    status: 'Active'
  });

  useEffect(() => {
    setCustodians(getCustodians());
    // Load employees to potentially link
    const loadedEmployees = loadJson<Employee[]>(STORAGE_KEYS.EMPLOYEES, []);
    setEmployees(loadedEmployees);
  }, []);

  const handleOpenModal = (custodian?: Custodian) => {
    if (custodian) {
      setEditingCustodian(custodian);
      setFormData(custodian);
    } else {
      setEditingCustodian(null);
      setFormData({
        custodianCode: `CST-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
        employeeId: '',
        name: '',
        department: '',
        designation: '',
        contact: '',
        status: 'Active'
      });
    }
    setIsModalOpen(true);
  };

  const handleEmployeeSelect = (empId: string) => {
    if (!empId) {
      setFormData({ ...formData, employeeId: '' });
      return;
    }
    const emp = employees.find(e => e.id === empId);
    if (emp) {
      setFormData({
        ...formData,
        employeeId: emp.id,
        name: emp.fullName,
        department: emp.department || '',
        designation: emp.designation || '',
        contact: emp.contactNo || ''
      });
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.custodianCode) {
      alert("Name and Custodian Code are required.");
      return;
    }

    let updatedList = [...custodians];
    
    if (editingCustodian) {
      updatedList = updatedList.map(c => 
        c.id === editingCustodian.id 
          ? { ...c, ...formData } as Custodian
          : c
      );
    } else {
      const newCustodian: Custodian = {
        ...(formData as Custodian),
        id: crypto.randomUUID()
      };
      updatedList.push(newCustodian);
    }
    
    saveCustodians(updatedList);
    setCustodians(updatedList);
    setIsModalOpen(false);
  };

  const filteredList = custodians.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.custodianCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.department && c.department.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-full">
      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 rounded-t-xl shrink-0">
        <h2 className="text-lg font-bold text-slate-800">Custodians</h2>
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search custodians..."
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
            Add Custodian
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 custom-scrollbar">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-100 text-slate-600 font-semibold">
              <tr>
                <th className="px-4 py-3 rounded-l-lg">Code</th>
                <th className="px-4 py-3">Custodian Name</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Designation</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 rounded-r-lg text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredList.length > 0 ? (
                filteredList.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3 font-mono text-slate-700">{c.custodianCode}</td>
                    <td className="px-4 py-3 font-bold text-slate-900 flex items-center gap-2">
                      <div className="bg-indigo-100 p-1.5 rounded-full text-indigo-600">
                        <User className="h-4 w-4" />
                      </div>
                      {c.name}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{c.department || '-'}</td>
                    <td className="px-4 py-3 text-slate-700">{c.designation || '-'}</td>
                    <td className="px-4 py-3 text-slate-700">{c.contact || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold ${c.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleOpenModal(c)}
                        className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 transition cursor-pointer"
                        title="Edit Custodian"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No custodians found. Click "Add Custodian" to create one.
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
              <h3 className="text-lg font-bold text-slate-800">
                {editingCustodian ? 'Edit Custodian' : 'Create Custodian'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-200 p-1.5 rounded-lg transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6">
              <form id="custodianForm" onSubmit={handleSave} className="space-y-4">
                
                {employees.length > 0 && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Link to Employee (Optional)</label>
                    <select
                      value={formData.employeeId || ''}
                      onChange={(e) => handleEmployeeSelect(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-indigo-500 outline-none"
                    >
                      <option value="">-- Do not link / Create manual --</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.fullName} ({emp.empCode})</option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-500 mt-1">Selecting an employee will auto-fill the details below.</p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Custodian Code *</label>
                    <input
                      type="text"
                      required
                      value={formData.custodianCode || ''}
                      onChange={(e) => setFormData({ ...formData, custodianCode: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:border-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    <label className="block text-xs font-bold text-slate-700 mb-1">Designation</label>
                    <input
                      type="text"
                      value={formData.designation || ''}
                      onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Contact No.</label>
                    <input
                      type="text"
                      value={formData.contact || ''}
                      onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                    <select
                      value={formData.status || 'Active'}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as 'Active' | 'Inactive' })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-indigo-500 outline-none font-semibold"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
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
                form="custodianForm"
                className="flex items-center gap-2 px-6 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm transition cursor-pointer"
              >
                <Check className="h-4 w-4" />
                Save Custodian
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
