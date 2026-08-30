import React, { useState } from 'react';
import { ChevronUp, ChevronDown, Maximize2, Minimize2 } from 'lucide-react';

interface VoucherEntryShellProps {
  title: string;
  voucherNo: React.ReactNode;
  headerPrimary: React.ReactNode;
  headerSecondary?: React.ReactNode;
  grid: React.ReactNode;
  footer?: React.ReactNode;
  actions: React.ReactNode;
}

export const VoucherEntryShell: React.FC<VoucherEntryShellProps> = ({
  title,
  voucherNo,
  headerPrimary,
  headerSecondary,
  grid,
  footer,
  actions
}) => {
  const [headerExpanded, setHeaderExpanded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  return (
    <div className={`flex flex-col bg-slate-50 transition-all ${isFullscreen ? 'fixed inset-0 z-[100] h-screen w-screen' : 'h-full w-full relative'}`}>
      {/* Top Title Bar */}
      <div className="bg-slate-900 text-white px-4 py-2 flex items-center justify-between shrink-0 shadow-md">
        <div className="flex items-center gap-3">
          <h2 className="font-black text-sm uppercase tracking-wide text-slate-100">{title}</h2>
          <div className="text-xs font-mono bg-slate-800 px-2 py-0.5 rounded text-indigo-300 border border-slate-700">
            {voucherNo}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Mode"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Header Container */}
      <div className="bg-white border-b border-slate-200 shrink-0 shadow-sm relative z-20">
        <div className="p-3">
          {/* Primary Header Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-3">
            {headerPrimary}
          </div>

          {/* Secondary Header Fields (Collapsible) */}
          {headerSecondary && (
            <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-3 transition-all duration-300 overflow-hidden ${headerExpanded ? 'mt-3 opacity-100 max-h-[500px]' : 'max-h-0 opacity-0'}`}>
              {headerSecondary}
            </div>
          )}
        </div>

        {/* Header Toggle Bar */}
        {headerSecondary && (
          <div 
            className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-white border border-slate-200 rounded-full shadow-sm cursor-pointer hover:bg-slate-50 hover:shadow transition flex items-center justify-center w-8 h-6"
            onClick={() => setHeaderExpanded(!headerExpanded)}
            title={headerExpanded ? "Collapse Header" : "Expand Header"}
          >
            {headerExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
          </div>
        )}
      </div>

      {/* Main Grid Area */}
      <div className="flex-1 min-h-0 relative z-10 flex flex-col bg-slate-100 mt-1">
        <div className="flex-1 min-h-0 bg-white border-y border-slate-200 shadow-sm overflow-hidden flex flex-col">
          {grid}
        </div>
      </div>

      {/* Totals & Actions Footer */}
      <div className="bg-white border-t border-slate-300 shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
        {footer && (
          <div className="p-3 border-b border-slate-100 bg-slate-50/50">
            {footer}
          </div>
        )}
        <div className="p-3 flex items-center justify-between gap-3 flex-wrap bg-slate-100/80">
          {actions}
        </div>
      </div>
    </div>
  );
};
