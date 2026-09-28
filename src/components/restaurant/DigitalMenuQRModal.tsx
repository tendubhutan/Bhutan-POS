import React, { useState } from 'react';
import { RestaurantTable } from '../../types/restaurant';
import { getTables } from '../../services/restaurantService';
import { Printer, Download, X, QrCode, ExternalLink, Check } from 'lucide-react';

interface DigitalMenuQRModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DigitalMenuQRModal: React.FC<DigitalMenuQRModalProps> = ({ isOpen, onClose }) => {
  const [tables] = useState<RestaurantTable[]>(() => getTables());
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(() => tables[0] || null);

  if (!isOpen) return null;

  const getTableQRUrl = (t: RestaurantTable) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/?table=${t.id}&portal=menu`;
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-purple-600" />
            <h3 className="font-extrabold text-slate-900 text-base">Table QR Code Printable Generator</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Table Selector */}
        <div className="my-4">
          <label className="block text-xs font-bold text-slate-700 mb-1">Select Table to Preview &amp; Print:</label>
          <select
            value={selectedTable?.id || ''}
            onChange={e => {
              const found = tables.find(t => t.id === e.target.value);
              if (found) setSelectedTable(found);
            }}
            className="w-full h-10 rounded-xl border border-slate-300 px-3 font-bold text-slate-900 text-xs outline-none bg-white"
          >
            {tables.map(t => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.area})
              </option>
            ))}
          </select>
        </div>

        {/* QR Preview Card */}
        {selectedTable && (
          <div className="p-6 bg-slate-900 rounded-2xl text-center space-y-4 text-white shadow-xl my-4">
            <span className="text-[10px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30 px-3 py-1 rounded-full">
              SCAN FOR DIGITAL MENU
            </span>

            <h2 className="text-2xl font-black text-white tracking-tight">{selectedTable.name}</h2>
            <p className="text-xs text-slate-400">{selectedTable.area}</p>

            {/* Generated QR Code Vector Representation */}
            <div className="bg-white p-4 rounded-2xl w-48 h-48 mx-auto flex flex-col items-center justify-center shadow-inner">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                  getTableQRUrl(selectedTable)
                )}`}
                alt={`QR Code for ${selectedTable.name}`}
                className="w-full h-full object-contain"
              />
            </div>

            <p className="text-[11px] font-mono text-slate-400 break-all px-2">
              {getTableQRUrl(selectedTable)}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
          >
            Close
          </button>

          <button
            onClick={handlePrint}
            className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs cursor-pointer flex items-center gap-2 shadow-md"
          >
            <Printer className="h-4 w-4" />
            <span>Print QR Stand Card</span>
          </button>
        </div>
      </div>
    </div>
  );
};
