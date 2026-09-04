import React from 'react';
import { Item, Unit } from '../types';
import { Plus, Trash2 } from 'lucide-react';

interface MultiUnitEditorProps {
  itemForm: Partial<Item>;
  setItemForm: (val: Partial<Item>) => void;
  units: Unit[];
  showWholesalePrice?: boolean;
}

export const MultiUnitEditor: React.FC<MultiUnitEditorProps> = ({ itemForm, setItemForm, units, showWholesalePrice = true }) => {
  const multiUnits = itemForm.multiUnits || [];

  const handleAdd = () => {
    setItemForm({ ...itemForm, multiUnits: [...multiUnits, { unit: '', conversionFactor: 1, purchaseRate: 0, saleRate: 0, wholesaleRate: 0, mrp: 0 }] });
  };

  const handleUpdate = (idx: number, key: string, value: any) => {
    const updated = [...multiUnits];
    updated[idx] = { ...updated[idx], [key]: value };
    setItemForm({ ...itemForm, multiUnits: updated });
  };

  const handleRemove = (idx: number) => {
    const updated = [...multiUnits];
    updated.splice(idx, 1);
    setItemForm({ ...itemForm, multiUnits: updated });
  };

  return (
    <div className="p-2.5 rounded-xl border border-indigo-100 bg-indigo-50/20 text-xs">
      <div className="flex justify-between items-center mb-1.5">
        <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
          Alternative Units & Prices
        </h4>
        <button
          type="button"
          onClick={handleAdd}
          className="flex items-center gap-1 text-[11px] font-bold bg-indigo-600 text-white px-2 py-0.5 rounded-md hover:bg-indigo-700 shadow-2xs transition cursor-pointer"
        >
          <Plus className="w-3 h-3" /> Add Unit
        </button>
      </div>
      
      {multiUnits.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-xs border-collapse min-w-[500px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase text-slate-600">
                <th className="py-1 px-2 font-bold w-32">Alt Unit</th>
                <th className="py-1 px-2 font-bold">Conv. Factor</th>
                <th className="py-1 px-2 font-bold">Pur. Rate</th>
                <th className="py-1 px-2 font-bold text-indigo-900">Sale Rate</th>
                {showWholesalePrice && (
                  <th className="py-1 px-2 font-bold text-emerald-800">Wholesale Rate</th>
                )}
                <th className="py-1 px-2 font-bold">MRP</th>
                <th className="py-1 px-2 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {multiUnits.map((mu, idx) => (
                <tr key={idx} className="hover:bg-slate-50/60">
                  <td className="py-1 px-2">
                    <select
                      value={mu.unit || ''}
                      onChange={e => handleUpdate(idx, 'unit', e.target.value)}
                      className="w-full h-7 rounded border border-slate-300 px-1 font-semibold text-slate-800 outline-none focus:border-indigo-500 text-xs"
                    >
                      <option value="">- Select Unit -</option>
                      {units.map(u => (
                        <option key={u['Unit Name']} value={u['Unit Name']}>{u['Unit Name']}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-1 px-2">
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400 font-bold text-[11px]">=</span>
                      <input
                        type="number" step="any" min="0.0001"
                        value={mu.conversionFactor !== undefined && mu.conversionFactor !== null ? mu.conversionFactor : ''}
                        onChange={e => handleUpdate(idx, 'conversionFactor', Number(e.target.value))}
                        className="w-12 h-7 rounded border border-slate-300 px-1 text-center font-mono font-bold outline-none focus:border-indigo-500 text-xs"
                      />
                      <span className="text-slate-500 text-[10px] font-bold truncate max-w-[40px]" title={itemForm.Unit}>
                        {itemForm.Unit || 'Base'}
                      </span>
                    </div>
                  </td>
                  <td className="py-1 px-2">
                    <input
                      type="number" step="any"
                      value={mu.purchaseRate || ''}
                      onChange={e => handleUpdate(idx, 'purchaseRate', e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-18 h-7 rounded border border-slate-300 px-1.5 font-mono outline-none focus:border-indigo-500 text-xs"
                    />
                  </td>
                  <td className="py-1 px-2">
                    <input
                      type="number" step="any"
                      value={mu.saleRate || ''}
                      onChange={e => handleUpdate(idx, 'saleRate', e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-18 h-7 rounded border border-slate-300 px-1.5 font-mono font-bold text-indigo-900 outline-none focus:border-indigo-500 text-xs"
                    />
                  </td>
                  {showWholesalePrice && (
                    <td className="py-1 px-2">
                      <input
                        type="number" step="any"
                        value={mu.wholesaleRate || ''}
                        onChange={e => handleUpdate(idx, 'wholesaleRate', e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-18 h-7 rounded border border-slate-300 px-1.5 font-mono font-bold text-emerald-800 outline-none focus:border-emerald-500 text-xs"
                      />
                    </td>
                  )}
                  <td className="py-1 px-2">
                    <input
                      type="number" step="any"
                      value={mu.mrp || ''}
                      onChange={e => handleUpdate(idx, 'mrp', e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-16 h-7 rounded border border-slate-300 px-1.5 font-mono outline-none focus:border-indigo-500 text-xs"
                    />
                  </td>
                  <td className="py-1 px-2 text-center">
                    <button type="button" onClick={() => handleRemove(idx)} className="p-0.5 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 cursor-pointer">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="py-1.5 px-3 text-center bg-white rounded-lg border border-dashed border-slate-200 text-slate-400 text-[11px]">
          No alternative units configured. Click "+ Add Unit" to set bulk/pack rates.
        </div>
      )}
    </div>
  );
};
