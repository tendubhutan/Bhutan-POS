import React, { useState } from 'react';
import { Unit } from '../../types';
import { saveUnit, deleteUnit } from '../../services/storageService';
import { Edit2, Trash2, Check, X, Plus } from 'lucide-react';

interface UnitMasterProps {
  units: Unit[];
  onUpdated: () => void;
}

export const UnitMaster: React.FC<UnitMasterProps> = ({ units, onUpdated }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Unit>>({});

  const handleEdit = (u: Unit) => {
    setEditingId(u['Unit Name']);
    setForm({ ...u, oldName: u['Unit Name'] });
  };

  const handleSave = () => {
    if (!form['Unit Name']) {
      alert("Unit Name is required");
      return;
    }
    const unitToSave = {
      'Unit Name': form['Unit Name'],
      Symbol: form.Symbol || form['Unit Name'].toLowerCase(),
      Group: form.Group || 'Count',
      'Conversion Factor': Number(form['Conversion Factor']) || 1,
      'Base Unit': form['Base Unit'] || '',
      oldName: form.oldName
    } as Unit;

    saveUnit(unitToSave);
    setEditingId(null);
    setForm({});
    onUpdated();
  };

  const handleDelete = (name: string) => {
    if (confirm(`Are you sure you want to delete unit '${name}'?`)) {
      deleteUnit(name);
      onUpdated();
    }
  };

  const handleAddNew = () => {
    setEditingId('NEW');
    setForm({
      'Unit Name': '',
      Symbol: '',
      Group: 'Count',
      'Conversion Factor': 1,
      'Base Unit': ''
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Unit Master & Conversions</h3>
        <button
          onClick={handleAddNew}
          disabled={editingId !== null}
          className="flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-700 transition disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          Add Unit
        </button>
      </div>
      
      <p className="text-xs text-slate-500 mb-2">Define basic units (e.g., Pcs, Kg) and compound units (e.g., Box = 10 Pcs).</p>

      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="py-2 px-3 font-bold text-slate-700 text-xs">Unit Name</th>
              <th className="py-2 px-3 font-bold text-slate-700 text-xs">Symbol</th>
              <th className="py-2 px-3 font-bold text-slate-700 text-xs">Base Unit</th>
              <th className="py-2 px-3 font-bold text-slate-700 text-xs">Conversion Factor</th>
              <th className="py-2 px-3 font-bold text-slate-700 text-xs text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {editingId === 'NEW' && (
              <tr className="bg-indigo-50/30">
                <td className="py-2 px-3">
                  <input
                    type="text"
                    value={form['Unit Name'] || ''}
                    onChange={e => setForm({ ...form, 'Unit Name': e.target.value })}
                    placeholder="e.g. Box"
                    className="w-full h-8 px-2 rounded-lg border border-slate-300 text-xs"
                  />
                </td>
                <td className="py-2 px-3">
                  <input
                    type="text"
                    value={form.Symbol || ''}
                    onChange={e => setForm({ ...form, Symbol: e.target.value })}
                    placeholder="e.g. bx"
                    className="w-full h-8 px-2 rounded-lg border border-slate-300 text-xs"
                  />
                </td>
                <td className="py-2 px-3">
                  <select
                    value={form['Base Unit'] || ''}
                    onChange={e => setForm({ ...form, 'Base Unit': e.target.value })}
                    className="w-full h-8 px-2 rounded-lg border border-slate-300 text-xs"
                  >
                    <option value="">- None (Base Unit) -</option>
                    {units.map(u => (
                      <option key={u['Unit Name']} value={u['Unit Name']}>{u['Unit Name']}</option>
                    ))}
                  </select>
                </td>
                <td className="py-2 px-3">
                  <input
                    type="number"
                    value={form['Conversion Factor'] || 1}
                    onChange={e => setForm({ ...form, 'Conversion Factor': Number(e.target.value) })}
                    className="w-full h-8 px-2 rounded-lg border border-slate-300 text-xs"
                  />
                </td>
                <td className="py-2 px-3 text-right">
                  <div className="flex justify-end gap-1">
                    <button onClick={handleSave} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded"><Check className="w-4 h-4" /></button>
                    <button onClick={() => setEditingId(null)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded"><X className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            )}

            {units.map((u) => {
              const isEditing = editingId === u['Unit Name'];
              return isEditing ? (
                <tr key={u['Unit Name']} className="bg-indigo-50/30">
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      value={form['Unit Name'] || ''}
                      onChange={e => setForm({ ...form, 'Unit Name': e.target.value })}
                      className="w-full h-8 px-2 rounded-lg border border-slate-300 text-xs"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      value={form.Symbol || ''}
                      onChange={e => setForm({ ...form, Symbol: e.target.value })}
                      className="w-full h-8 px-2 rounded-lg border border-slate-300 text-xs"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <select
                      value={form['Base Unit'] || ''}
                      onChange={e => setForm({ ...form, 'Base Unit': e.target.value })}
                      className="w-full h-8 px-2 rounded-lg border border-slate-300 text-xs"
                    >
                      <option value="">- None (Base Unit) -</option>
                      {units.filter(un => un['Unit Name'] !== u['Unit Name']).map(un => (
                        <option key={un['Unit Name']} value={un['Unit Name']}>{un['Unit Name']}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="number"
                      value={form['Conversion Factor'] || 1}
                      onChange={e => setForm({ ...form, 'Conversion Factor': Number(e.target.value) })}
                      className="w-full h-8 px-2 rounded-lg border border-slate-300 text-xs"
                    />
                  </td>
                  <td className="py-2 px-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={handleSave} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded"><Check className="w-4 h-4" /></button>
                      <button onClick={() => setEditingId(null)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded"><X className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={u['Unit Name']} className="hover:bg-slate-50 transition">
                  <td className="py-2 px-3 font-semibold text-slate-800 text-xs">{u['Unit Name']}</td>
                  <td className="py-2 px-3 text-slate-600 text-xs">{u.Symbol}</td>
                  <td className="py-2 px-3 text-slate-600 text-xs">
                    {u['Base Unit'] ? (
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-bold">{u['Base Unit']}</span>
                    ) : (
                      <span className="text-slate-400 italic text-[10px]">Self</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-slate-600 text-xs">
                    {u['Base Unit'] ? (
                      <span className="font-bold text-indigo-600 text-[10px]">1 {u['Unit Name']} = {u['Conversion Factor']} {u['Base Unit']}</span>
                    ) : (
                      <span className="text-slate-400 italic text-[10px]">1</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => handleEdit(u)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDelete(u['Unit Name'])} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            
            {units.length === 0 && editingId !== 'NEW' && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-500 text-xs italic">No units found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
