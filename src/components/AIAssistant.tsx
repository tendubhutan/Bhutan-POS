import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, X, ChevronRight, Send, Loader2, Trash2 } from 'lucide-react';
import { processLocalQuery } from '../services/localAIService';

export const AIAssistant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

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
    // Regex matches [View ...]
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

      // Extract date and ledger if they exist in segments
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
      const responseText = await processLocalQuery(query, newHistory);
      setHistory([...newHistory, { role: 'model', parts: [{ text: responseText }] }]);
    } catch (error: any) {
      console.error(error);
      setHistory([...newHistory, { role: 'model', parts: [{ text: error.message || 'Sorry, I encountered a local error.' }] }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative z-50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-orange-600 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-md transition-colors duration-300 border border-orange-700 hover:border-emerald-700 cursor-pointer"
        title="AI Help (Ask anything)"
      >
        <Sparkles className="h-4 w-4" />
        <span className="inline">Click here for AI help</span>
      </button>

      {isOpen && (
        <div 
          ref={panelRef}
          className="absolute top-full right-0 mt-2 w-[340px] sm:w-[400px] bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[500px]"
        >
          <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-orange-500" />
              What would you like to find?
            </h3>
            <div className="flex items-center gap-2">
              {history.length > 0 && (
                <button onClick={() => setHistory([])} className="text-slate-400 hover:text-red-500 transition-colors p-1" title="Clear Chat">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-1">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="p-4 flex-1 overflow-y-auto bg-slate-50/50 flex flex-col gap-3 text-sm">
            {history.filter(h => h.role === 'user' && h.parts[0]?.text || h.role === 'model' && h.parts[0]?.text).map((h, i) => (
              <div key={i} className={`flex ${h.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 shadow-sm ${h.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none'}`}>
                  {h.role === 'model' ? (
                    <div className="whitespace-pre-wrap leading-relaxed">
                      {parseReportLink(h.parts[0].text)}
                    </div>
                  ) : (
                    <div>{h.parts[0].text}</div>
                  )}
                </div>
              </div>
            ))}
            
            {history.length === 0 && (
              <div className="text-slate-500 text-xs text-center mt-2">
                <p className="font-semibold mb-2 text-slate-600">Try asking:</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {["Today's sales", "Low stock items", "Top selling products", "August GST"].map(q => (
                    <button 
                      key={q}
                      onClick={() => setQuery(q)}
                      className="bg-white border border-slate-200 rounded-full px-3 py-1 hover:bg-orange-50 hover:border-orange-200 hover:text-orange-700 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-none px-3 py-2 shadow-sm flex items-center gap-2 text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Searching...
                </div>
              </div>
            )}
          </div>

          <div className="p-3 border-t border-slate-200 bg-white">
            <form onSubmit={handleQuery} className="flex items-center gap-1.5 bg-slate-100 rounded-lg p-1.5 border border-slate-200 focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-400/20 transition-all">
              <input
                ref={inputRef}
                type="text"
                placeholder="Ask or search anything in the system..."
                className="flex-1 bg-transparent border-none outline-none px-2 py-1 text-sm text-slate-800 min-w-0"
                value={query}
                onChange={e => setQuery(e.target.value)}
                disabled={loading}
              />
              <button 
                type="submit" 
                disabled={!query.trim() || loading}
                className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:hover:bg-orange-600 text-white p-2 rounded-md transition-colors flex-shrink-0 cursor-pointer"
                title="Search / Ask"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
