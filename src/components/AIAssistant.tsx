import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, X, ChevronRight, Send, Loader2, Trash2, Search, Command } from 'lucide-react';
import { processLocalQuery } from '../services/localAIService';

interface AIAssistantProps {
  className?: string;
}

export const AIAssistant: React.FC<AIAssistantProps> = ({ className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setIsOpen(prev => !prev);
      } else if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [isOpen]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const parseReportLink = (text: string) => {
    const regex = /\[View (.*?)\]/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      
      const content = match[1];
      const segments = content.split(':').map(s => s.trim());
      const reportName = segments[0];
      
      let ledgerName = undefined;
      let fromDate = undefined;
      let toDate = undefined;

      for (let i = 1; i < segments.length; i++) {
        const seg = segments[i];
        const dateMatch = seg.match(/(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})/);
        if (dateMatch) {
          fromDate = dateMatch[1];
          toDate = dateMatch[2];
        } else {
          ledgerName = seg;
        }
      }

      parts.push(
        <button
          key={match.index}
          className="text-indigo-700 hover:text-indigo-900 font-bold flex items-center gap-1 my-1 text-xs bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg border border-indigo-200 cursor-pointer transition shadow-xs"
          onClick={() => {
            setIsOpen(false);
            if (reportName === 'Voucher' && ledgerName) {
              window.dispatchEvent(new CustomEvent('app:openVoucher', { detail: { refNo: ledgerName } }));
            } else {
              window.dispatchEvent(new CustomEvent('app:navigate', { 
                detail: { view: 'reports', report: reportName, ledgerName, fromDate, toDate } 
              }));
            }
          }}
        >
          {match[0].replace(/\[|\]/g, '')} <ChevronRight className="h-3.5 w-3.5" />
        </button>
      );
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }
    return parts;
  };

  const handleQuery = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim() || loading) return;

    const newHistory = [...history, { role: 'user', parts: [{ text: query }] }];
    setHistory(newHistory);
    setQuery('');
    setLoading(true);

    try {
      let responseText = await processLocalQuery(query, newHistory);
      
      // Parse for ACTION JSON
      const actionMatch = responseText.match(/```json[\s\n]*([\s\S]*?)[\s\n]*```/i);
      if (actionMatch) {
        try {
          const actionData = JSON.parse(actionMatch[1]);
          if (actionData.action === 'UPDATE_CONFIG' && actionData.payload) {
            window.dispatchEvent(new CustomEvent('app:updateConfig', { detail: actionData.payload }));
            responseText = responseText.replace(actionMatch[0], '').trim();
          } else if (actionData.action === 'UPDATE_POS_SETTINGS' && actionData.payload) {
            const savedStr = localStorage.getItem('tally_pos_settings_v1');
            let curSettings = {};
            if (savedStr) curSettings = JSON.parse(savedStr);
            const newSettings = { ...curSettings, ...actionData.payload };
            localStorage.setItem('tally_pos_settings_v1', JSON.stringify(newSettings));
            window.dispatchEvent(new CustomEvent('pos_settings_changed', { detail: newSettings }));
            responseText = responseText.replace(actionMatch[0], '').trim();
          } else if (actionData.action === 'NAVIGATE' && actionData.payload) {
             window.dispatchEvent(new CustomEvent('app:navigate', { detail: actionData.payload }));
             responseText = responseText.replace(actionMatch[0], '').trim();
          }
        } catch (err) {
          console.error("Failed to parse AI action JSON", err);
        }
      }

      setHistory([...newHistory, { role: 'model', parts: [{ text: responseText }] }]);
    } catch (error: any) {
      console.error(error);
      setHistory([...newHistory, { role: 'model', parts: [{ text: error.message || 'Sorry, I encountered a local error.' }] }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`relative flex items-center justify-center w-full min-w-0 ${className}`}>
      {/* Modern Desktop & Laptop Search Bar Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="hidden md:flex items-center justify-between gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl bg-blue-900/80 hover:bg-blue-900 border border-blue-400/40 hover:border-blue-300 text-blue-100 hover:text-white transition-all shadow-inner cursor-pointer w-full max-w-[260px] xl:max-w-[320px] min-w-0 group text-left"
        title="Search items, ledgers, vouchers, reports or ask AI (Ctrl+K)"
      >
        <div className="flex items-center gap-2 min-w-0 truncate">
          <Search className="h-3.5 w-3.5 text-blue-300 group-hover:text-amber-300 transition-colors shrink-0" />
          <span className="text-xs text-blue-200 group-hover:text-white truncate">
            Search or ask AI...
          </span>
        </div>
        <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-bold text-blue-100 bg-blue-950/70 group-hover:bg-blue-800 group-hover:text-white rounded-lg border border-blue-700/60 shadow-2xs shrink-0">
          Search
        </span>
      </button>

      {/* Compact Mobile / Tablet Search Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="md:hidden flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-900/80 hover:bg-blue-900 border border-blue-400/50 text-blue-100 hover:text-white text-xs font-bold shadow-xs transition cursor-pointer shrink-0"
        title="Search & AI Help (Ctrl+K)"
      >
        <Search className="h-3.5 w-3.5 text-amber-300" />
        <span className="text-[11px]">Search</span>
      </button>

      {/* Modern Centered Command Palette / Search Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-14 sm:pt-20 p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div 
            ref={panelRef}
            className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[82vh] animate-in zoom-in-95 duration-150"
          >
            {/* Header & Search Input Box */}
            <div className="p-3.5 sm:p-4 border-b border-slate-100 bg-slate-50/70">
              <form onSubmit={handleQuery} className="flex items-center gap-2 bg-white rounded-2xl px-3 py-2 border border-slate-200 shadow-inner focus-within:border-blue-500 focus-within:ring-3 focus-within:ring-blue-500/15 transition-all">
                <Search className="h-4 w-4 text-blue-600 shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Search ledgers, stock, vouchers, reports or ask AI..."
                  className="flex-1 bg-transparent border-none outline-none text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 min-w-0"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  disabled={loading}
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-md cursor-pointer"
                    title="Clear input"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
                <button 
                  type="submit" 
                  disabled={!query.trim() || loading}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
                  title="Submit query (Enter)"
                >
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  <span className="hidden sm:inline">Ask</span>
                </button>
              </form>

              {/* Quick suggestions if history is empty */}
              {history.length === 0 && (
                <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-amber-500" /> Suggestions:
                  </span>
                  {["Today's sales", "Low stock items", "Top selling products", "August GST", "Cash Book"].map(q => (
                    <button 
                      key={q}
                      type="button"
                      onClick={() => {
                        setQuery(q);
                        setTimeout(() => inputRef.current?.focus(), 10);
                      }}
                      className="text-[11px] bg-white border border-slate-200 text-slate-700 rounded-lg px-2.5 py-1 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition cursor-pointer shadow-2xs"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Conversation / Results Body */}
            <div className="p-4 flex-1 overflow-y-auto bg-slate-50/40 flex flex-col gap-3 text-xs sm:text-sm">
              {history.filter(h => (h.role === 'user' && h.parts[0]?.text) || (h.role === 'model' && h.parts[0]?.text)).map((h, i) => (
                <div key={i} className={`flex ${h.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 shadow-xs ${
                    h.role === 'user' 
                      ? 'bg-blue-600 text-white rounded-br-xs' 
                      : 'bg-white border border-slate-200 text-slate-800 rounded-bl-xs'
                  }`}>
                    {h.role === 'model' ? (
                      <div className="whitespace-pre-wrap leading-relaxed">
                        {parseReportLink(h.parts[0].text)}
                      </div>
                    ) : (
                      <div className="font-medium">{h.parts[0].text}</div>
                    )}
                  </div>
                </div>
              ))}
              
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-xs px-3.5 py-2.5 shadow-xs flex items-center gap-2 text-slate-500 text-xs font-medium">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" /> 
                    <span>Searching database and analyzing reports...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Footer with Actions and Keyboard Hints */}
            <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-mono text-[10px]">Enter</kbd>
                  to search
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-mono text-[10px]">Esc</kbd>
                  to close
                </span>
              </div>

              <div className="flex items-center gap-2">
                {history.length > 0 && (
                  <button 
                    type="button"
                    onClick={() => setHistory([])} 
                    className="text-slate-400 hover:text-rose-600 transition flex items-center gap-1 cursor-pointer font-bold" 
                    title="Clear search history"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Clear</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-2.5 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

