import React, { useState, useEffect, useRef } from 'react';
import { Truck, FileText, Calendar, X, Check, ArrowRight } from 'lucide-react';

interface OrderDispatchDetailsModalProps {
  isOpen: boolean;
  customerName: string;
  initialChallanNo?: string;
  initialOrderNo?: string;
  initialOrderDate?: string;
  onSave: (details: { deliveryNoteNo: string; orderNo: string; orderDate: string }) => void;
  onClose: () => void;
}

export const OrderDispatchDetailsModal: React.FC<OrderDispatchDetailsModalProps> = ({
  isOpen,
  customerName,
  initialChallanNo = '',
  initialOrderNo = '',
  initialOrderDate = '',
  onSave,
  onClose,
}) => {
  const [challanNo, setChallanNo] = useState(initialChallanNo);
  const [orderNo, setOrderNo] = useState(initialOrderNo);
  const [orderDate, setOrderDate] = useState(
    initialOrderDate || new Date().toISOString().split('T')[0]
  );

  const challanInputRef = useRef<HTMLInputElement>(null);
  const orderInputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setChallanNo(initialChallanNo || '');
      setOrderNo(initialOrderNo || '');
      setOrderDate(initialOrderDate || new Date().toISOString().split('T')[0]);

      setTimeout(() => {
        if (challanInputRef.current) {
          challanInputRef.current.focus();
          challanInputRef.current.select();
        }
      }, 60);
    }
  }, [isOpen, initialChallanNo, initialOrderNo, initialOrderDate]);

  if (!isOpen) return null;

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    onSave({
      deliveryNoteNo: challanNo.trim(),
      orderNo: orderNo.trim(),
      orderDate: orderDate || new Date().toISOString().split('T')[0],
    });
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150"
      onKeyDown={handleKeyDown}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Floating Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Truck className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm tracking-wide text-white">
                Order &amp; Dispatch Details
              </h3>
              <p className="text-[11px] text-indigo-200 font-medium truncate max-w-[280px]">
                Party: <span className="font-bold text-amber-300">{customerName || 'Sundry Debtor'}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-7 w-7 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
            title="Skip / Close (Esc)"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSave} className="p-4 space-y-3.5">
          {/* Delivery Challan No */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
              Delivery Challan / Note No
            </label>
            <div className="relative">
              <Truck className="h-4 w-4 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
              <input
                ref={challanInputRef}
                type="text"
                value={challanNo}
                onChange={(e) => setChallanNo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    orderInputRef.current?.focus();
                    orderInputRef.current?.select();
                  }
                }}
                placeholder="e.g. DLV-1 (optional)"
                className="w-full pl-9 pr-3 py-1.5 font-mono text-xs font-bold text-slate-800 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-200"
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">
              If goods were dispatched via Delivery Note, enter note number here.
            </p>
          </div>

          {/* Order Ref & Order Date Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Order Ref / PO No
              </label>
              <div className="relative">
                <FileText className="h-4 w-4 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
                <input
                  ref={orderInputRef}
                  type="text"
                  value={orderNo}
                  onChange={(e) => setOrderNo(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      dateInputRef.current?.focus();
                    }
                  }}
                  placeholder="e.g. SO-101"
                  className="w-full pl-9 pr-3 py-1.5 font-mono text-xs font-bold text-slate-800 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-200"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Order Date
              </label>
              <div className="relative">
                <Calendar className="h-4 w-4 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
                <input
                  ref={dateInputRef}
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSave();
                    }
                  }}
                  className="w-full pl-9 pr-2 py-1.5 text-xs font-bold text-slate-800 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-200 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            >
              Skip (Esc)
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-extrabold rounded-lg shadow-sm flex items-center gap-1.5 transition cursor-pointer"
            >
              <Check className="h-3.5 w-3.5" />
              <span>Done / Continue (Enter)</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
