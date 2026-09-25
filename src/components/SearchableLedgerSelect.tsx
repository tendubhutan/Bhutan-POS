import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Ledger } from '../types';
import { Plus, Pencil, Check, ChevronDown, Sparkles } from 'lucide-react';
import { getPartyOutstandingBills } from '../services/storageService';

interface SearchableLedgerSelectProps {
  id?: string;
  value: string;
  onChange: (ledgerName: string) => void;
  onEnterNext?: () => void;
  onArrowLeft?: () => void;
  onArrowRight?: () => void;
  onArrowUp?: () => void;
  onArrowDown?: () => void;
  ledgers: Ledger[];
  placeholder?: string;
  autoFocus?: boolean;
  onCreateNew?: () => void;
  onAddNew?: () => void;
  onEditLedger?: (ledgerName: string) => void;
  onShowInfo?: (ledgerName: string) => void;
  onSaveVoucher?: () => void;
  onFocusDate?: () => void;
  currencySymbol?: string;
  className?: string;
  disabled?: boolean;
  filterGroup?: string;
  filterGroups?: string[];
  prioritizeGroups?: string[];
  restrictToGroups?: string[];
}

export const SearchableLedgerSelect: React.FC<SearchableLedgerSelectProps> = ({
  id,
  value,
  onChange,
  onEnterNext,
  onArrowLeft,
  onArrowRight,
  onArrowUp,
  onArrowDown,
  ledgers,
  placeholder = 'Type or press ↓ to select ledger...',
  autoFocus = false,
  onCreateNew: onCreateNewProp,
  onAddNew,
  onEditLedger,
  onShowInfo,
  onSaveVoucher,
  onFocusDate,
  currencySymbol = 'Nu.',
  className = '',
  disabled = false,
  filterGroup,
  filterGroups,
  prioritizeGroups,
  restrictToGroups
}) => {
  const onCreateNew = onCreateNewProp || onAddNew;
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(value || '');
  const [userQuery, setUserQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [showAllGroups, setShowAllGroups] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, placement: 'bottom' });

  useEffect(() => {
    if (isOpen && containerRef.current) {
      const updatePosition = () => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        
        const windowHeight = window.innerHeight;
        const spaceBelow = windowHeight - rect.bottom;
        const spaceAbove = rect.top;
        const dropdownHeight = 300;
        
        let placement = 'bottom';
        if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
          placement = 'top';
        }

        setCoords({
          top: placement === 'bottom' ? rect.bottom + 4 : rect.top - 4,
          left: rect.left,
          width: Math.max(rect.width, 300),
          placement
        });
      };
      
      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
      return () => {
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition, true);
      };
    }
  }, [isOpen]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const hasCreateOption = Boolean(onCreateNew);

  const effectiveFilterGroups = React.useMemo(() => {
    if (showAllGroups) return undefined;
    if (filterGroups && filterGroups.length > 0) return filterGroups;
    if (filterGroup) return [filterGroup];
    return undefined;
  }, [filterGroups, filterGroup, showAllGroups]);

  // Sync internal search term when external value changes and dropdown is closed
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm(value || '');
      setUserQuery('');
    }
  }, [value, isOpen]);

  // Accounts that should NEVER be treated as a debtor customer or creditor vendor party
  const isNonPartyAccount = (ledgerName: string = '', ledgerGroup: string = ''): boolean => {
    const ln = ledgerName.trim().toLowerCase();
    const lg = ledgerGroup.trim().toLowerCase();

    if (
      ln.includes('accumulated') ||
      ln.includes('depreciation') ||
      ln.includes('suspense') ||
      ln.includes('provision') ||
      ln.includes('tax') ||
      ln.includes('gst') ||
      ln.includes('tds') ||
      ln.includes('pit') ||
      ln.includes('nppf') ||
      ln.includes('gis') ||
      ln.includes('duty') ||
      ln.includes('duties') ||
      ln.includes('capital') ||
      ln.includes('loan') ||
      ln.includes('drawing') ||
      ln.includes('bank') ||
      ln.includes('cash') ||
      ln.includes('discount received') ||
      ln.includes('discount allowed') ||
      ln.includes('round off')
    ) {
      return true;
    }

    if (
      lg.includes('fixed asset') ||
      lg.includes('bank account') ||
      lg.includes('cash-in-hand') ||
      lg.includes('duties & taxes') ||
      lg.includes('loans') ||
      lg.includes('capital account') ||
      lg.includes('provisions') ||
      lg.includes('suspense')
    ) {
      return true;
    }

    return false;
  };

  // Intelligent matching helper covering common ERP naming variations, aliases, and sub-groups
  const matchesPriorityGroup = (ledgerGroup: string = '', targetGroup: string = '', ledgerName: string = ''): boolean => {
    if (!ledgerGroup || !targetGroup) return false;
    const lg = ledgerGroup.trim().toLowerCase();
    const tg = targetGroup.trim().toLowerCase();

    // Debtors / Customers / Receivables - MUST be genuine party
    if (tg.includes('debtor') || tg.includes('customer') || tg.includes('receivable')) {
      if (isNonPartyAccount(ledgerName, ledgerGroup)) return false;
      return lg.includes('debtor') || lg.includes('customer') || lg.includes('receivable');
    }

    // Creditors / Vendors / Suppliers / Payables - MUST be genuine party
    if (tg.includes('creditor') || tg.includes('vendor') || tg.includes('supplier') || tg.includes('payable')) {
      if (isNonPartyAccount(ledgerName, ledgerGroup)) return false;
      return lg.includes('creditor') || lg.includes('vendor') || lg.includes('supplier') || lg.includes('payable');
    }

    // Exact or normalized match
    if (lg === tg) return true;
    if (lg.replace(/[-_\s]/g, '') === tg.replace(/[-_\s]/g, '')) return true;

    // Bank Accounts / Bank OD / OCC
    if (tg.includes('bank')) {
      return lg.includes('bank') || lg.includes('od') || lg.includes('occ');
    }

    // Cash-in-Hand / Cash Accounts
    if (tg.includes('cash')) {
      return lg.includes('cash');
    }

    // Expenses (Direct & Indirect & specific cost centers)
    if (tg.includes('expense')) {
      if (tg.includes('direct')) {
        return lg.includes('direct exp') || lg.includes('wages') || lg.includes('freight') || lg.includes('carriage');
      }
      if (tg.includes('indirect')) {
        return (
          lg.includes('indirect exp') ||
          lg.includes('admin') ||
          lg.includes('selling') ||
          lg.includes('financial') ||
          lg.includes('operating') ||
          lg.includes('rent') ||
          lg.includes('office')
        );
      }
      return lg.includes('expense') || lg.includes('wages') || lg.includes('freight');
    }

    // Incomes & Revenue & Sales
    if (tg.includes('income') || tg.includes('sales') || tg.includes('revenue')) {
      if (tg.includes('direct')) {
        return lg.includes('direct inc') || lg.includes('sales account') || lg.includes('sales');
      }
      if (tg.includes('indirect')) {
        return lg.includes('indirect inc') || lg.includes('interest') || lg.includes('commission') || lg.includes('discount received');
      }
      return lg.includes('income') || lg.includes('sales') || lg.includes('revenue');
    }

    // Assets & Liabilities
    if (tg.includes('asset')) {
      return lg.includes('asset');
    }
    if (tg.includes('liabilit')) {
      return lg.includes('liabilit');
    }

    return false;
  };

  // Filter ledgers based on filterGroups/restrictToGroups and active user query with intelligent prioritization
  const { filteredLedgers, prioritizedCount, hasPriority, partyDueMap } = React.useMemo(() => {
    let list = ledgers || [];
    if (restrictToGroups && restrictToGroups.length > 0) {
      list = list.filter(l => restrictToGroups.some(rg => matchesPriorityGroup(l.Group, rg, l['Ledger Name'])));
    } else if (effectiveFilterGroups && effectiveFilterGroups.length > 0) {
      list = list.filter(l => effectiveFilterGroups.some(eg => matchesPriorityGroup(l.Group, eg, l['Ledger Name'])));
    }

    const q = userQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(l => {
        const name = (l['Ledger Name'] || '').toLowerCase();
        const grp = (l.Group || '').toLowerCase();
        const tpn = (l['TPN No'] || '').toLowerCase();
        const gst = (l['GST No'] || '').toLowerCase();
        const phone = (l['Contact No'] || '').toLowerCase();
        return name.includes(q) || grp.includes(q) || tpn.includes(q) || gst.includes(q) || phone.includes(q);
      });
    }

    // Pre-calculate party due bills so debtors/creditors with pending unpaid invoices (like Prakash) rank at the very top!
    const dueMap: Record<string, { count: number; amount: number }> = {};
    const isDebtorPrioritized = prioritizeGroups?.some(g => g.toLowerCase().includes('debtor') || g.toLowerCase().includes('customer'));
    const isCreditorPrioritized = prioritizeGroups?.some(g => g.toLowerCase().includes('creditor') || g.toLowerCase().includes('supplier'));

    if (isDebtorPrioritized || isCreditorPrioritized) {
      list.forEach(l => {
        const lName = l['Ledger Name'];
        if (lName && !isNonPartyAccount(lName, l.Group)) {
          try {
            const pType = isDebtorPrioritized ? 'debtor' : 'creditor';
            const dueBills = getPartyOutstandingBills(lName, pType);
            if (dueBills && dueBills.length > 0) {
              const totalDue = dueBills.reduce((s, b) => s + (Number(b.pendingAmount) || 0), 0);
              dueMap[lName] = { count: dueBills.length, amount: Math.round(totalDue * 100) / 100 };
            }
          } catch {
            // ignore
          }
        }
      });
    }

    if (prioritizeGroups && prioritizeGroups.length > 0) {
      const assigned = new Set<string>();
      const prioritizedList: Ledger[] = [];

      prioritizeGroups.forEach(targetGroup => {
        const matchesForTarget: Ledger[] = [];
        for (const l of list) {
          const lName = l['Ledger Name'];
          if (assigned.has(lName)) continue;
          if (matchesPriorityGroup(l.Group, targetGroup, lName)) {
            assigned.add(lName);
            matchesForTarget.push(l);
          }
        }

        // Rank candidate matches:
        // 1. Parties with PENDING BILLS DUE (e.g. Prakash) rank first by highest pending amount!
        // 2. Ledgers with active non-zero balances rank next
        // 3. Alphabetical order
        matchesForTarget.sort((a, b) => {
          const aName = a['Ledger Name'] || '';
          const bName = b['Ledger Name'] || '';
          const dueA = dueMap[aName]?.amount || 0;
          const dueB = dueMap[bName]?.amount || 0;
          if (dueA > 0 && dueB === 0) return -1;
          if (dueB > 0 && dueA === 0) return 1;
          if (dueA > 0 && dueB > 0 && dueA !== dueB) return dueB - dueA;

          const balA = Math.abs(Number(a['Current Balance']) || 0);
          const balB = Math.abs(Number(b['Current Balance']) || 0);
          if (balA > 0 && balB === 0) return -1;
          if (balB > 0 && balA === 0) return 1;
          if (balA > 0 && balB > 0 && balA !== balB) return balB - balA;

          return aName.localeCompare(bName);
        });

        prioritizedList.push(...matchesForTarget);
      });

      const otherItems: Ledger[] = [];
      for (const l of list) {
        if (!assigned.has(l['Ledger Name'])) {
          otherItems.push(l);
        }
      }

      // Sort remaining ledgers alphabetically
      otherItems.sort((a, b) => (a['Ledger Name'] || '').localeCompare(b['Ledger Name'] || ''));

      return {
        filteredLedgers: [...prioritizedList, ...otherItems],
        prioritizedCount: prioritizedList.length,
        hasPriority: prioritizedList.length > 0 && otherItems.length > 0,
        partyDueMap: dueMap
      };
    }

    return {
      filteredLedgers: list,
      prioritizedCount: 0,
      hasPriority: false,
      partyDueMap: dueMap
    };
  }, [ledgers, restrictToGroups, effectiveFilterGroups, userQuery, prioritizeGroups]);

  // Total items in dropdown = (Create New option if present) + filteredLedgers.length
  const totalItems = (hasCreateOption ? 1 : 0) + filteredLedgers.length;

  // Ensure highlighted index stays in bounds
  useEffect(() => {
    if (highlightedIndex >= totalItems) {
      setHighlightedIndex(Math.max(0, totalItems - 1));
    }
  }, [totalItems, highlightedIndex]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const activeEl = listRef.current.querySelector(`[data-index="${highlightedIndex}"]`) as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  // Close dropdown on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleCaptureEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation?.();
        setIsOpen(false);
        setUserQuery('');
        setSearchTerm(value || '');
      }
    };
    window.addEventListener('keydown', handleCaptureEscape, true);
    return () => window.removeEventListener('keydown', handleCaptureEscape, true);
  }, [isOpen, value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current && 
        !containerRef.current.contains(e.target as Node) &&
        listRef.current &&
        !listRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setUserQuery('');
        setSearchTerm(value || '');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [value]);

  const selectLedger = (ledgerName: string) => {
    onChange(ledgerName);
    setSearchTerm(ledgerName);
    setUserQuery('');
    setIsOpen(false);
    if (onEnterNext) {
      setTimeout(() => {
        onEnterNext();
      }, 30);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    // Ctrl + A or F2: Save/Accept Voucher
    const isCtrlA = (e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A');
    const isF2 = e.key === 'F2';
    if (isCtrlA || isF2) {
      if (onSaveVoucher) {
        e.preventDefault();
        e.stopPropagation();
        onSaveVoucher();
        return;
      }
    }

    // F7 or Ctrl + I or Alt + I: Ledger Details & Financial Report
    const isF7 = e.key === 'F7';
    const isCtrlI = (e.ctrlKey || e.metaKey) && (e.key === 'i' || e.key === 'I');
    const isAltI = e.altKey && (e.key === 'i' || e.key === 'I');
    if (isF7 || isCtrlI || isAltI) {
      const targetLedgerName = filteredLedgers[highlightedIndex]?.['Ledger Name'] || value;
      if (onShowInfo && targetLedgerName) {
        e.preventDefault();
        e.stopPropagation();
        onShowInfo(targetLedgerName);
        setIsOpen(false);
        return;
      }
    }

    if (e.ctrlKey && e.key === 'Enter' && value && onEditLedger) {
      e.preventDefault();
      onEditLedger(value);
      return;
    }

    if (e.altKey && (e.key === 'c' || e.key === 'C') && onCreateNew) {
      e.preventDefault();
      onCreateNew();
      return;
    }

    if (e.key === 'ArrowLeft') {
      const target = e.currentTarget;
      const isAtStart = target.selectionStart === 0 && target.selectionEnd === 0;
      const isAllSelected = target.selectionStart === 0 && target.selectionEnd === target.value.length;
      if ((isAtStart || isAllSelected || !isOpen) && onArrowLeft) {
        e.preventDefault();
        setIsOpen(false);
        onArrowLeft();
        return;
      }
    }

    if (e.key === 'ArrowRight') {
      const target = e.currentTarget;
      const isAtEnd = target.selectionStart === target.value.length;
      const isAllSelected = target.selectionStart === 0 && target.selectionEnd === target.value.length;
      if ((isAtEnd || isAllSelected || !isOpen) && onArrowRight) {
        e.preventDefault();
        setIsOpen(false);
        onArrowRight();
        return;
      }
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        // Find current value index + 1
        const curIdx = filteredLedgers.findIndex(l => l['Ledger Name'] === value);
        setHighlightedIndex(curIdx >= 0 ? curIdx + 1 : 1);
      } else {
        setHighlightedIndex(prev => (prev + 1 < totalItems ? prev + 1 : 0));
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        if (onArrowUp) {
          onArrowUp();
        } else {
          setIsOpen(true);
          const curIdx = filteredLedgers.findIndex(l => l['Ledger Name'] === value);
          setHighlightedIndex(curIdx >= 0 ? curIdx + 1 : totalItems - 1);
        }
      } else {
        setHighlightedIndex(prev => (prev - 1 >= 0 ? prev - 1 : totalItems - 1));
      }
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen) {
        if (hasCreateOption && highlightedIndex === 0) {
          // Create New Option
          if (onCreateNew) {
            setIsOpen(false);
            setUserQuery('');
            onCreateNew();
          }
        } else {
          const ledgerIdx = hasCreateOption ? highlightedIndex - 1 : highlightedIndex;
          const selected = filteredLedgers[ledgerIdx];
          if (selected) {
            selectLedger(selected['Ledger Name']);
          } else if (filteredLedgers.length > 0) {
            selectLedger(filteredLedgers[0]['Ledger Name']);
          } else if (onEnterNext) {
            setIsOpen(false);
            setUserQuery('');
            onEnterNext();
          }
        }
      } else {
        // If closed and user pressed Enter, if search matches exact ledger select it, else advance
        const q = (userQuery || searchTerm).trim().toLowerCase();
        const exact = ledgers.find(l => l['Ledger Name'].toLowerCase() === q);
        if (exact) {
          selectLedger(exact['Ledger Name']);
        } else if (value) {
          if (onEnterNext) onEnterNext();
        } else if (filteredLedgers.length > 0) {
          selectLedger(filteredLedgers[0]['Ledger Name']);
        } else if (onEnterNext) {
          onEnterNext();
        }
      }
      return;
    }

    if (e.key === 'Escape') {
      if (isOpen) {
        e.preventDefault();
        e.stopPropagation();
        (e.nativeEvent as any)?.stopImmediatePropagation?.();
        setIsOpen(false);
        setUserQuery('');
        setSearchTerm(value || '');
      }
      return;
    }

    if (e.key === 'Tab') {
      if (isOpen) {
        const ledgerIdx = hasCreateOption ? highlightedIndex - 1 : highlightedIndex;
        if (ledgerIdx >= 0 && filteredLedgers[ledgerIdx]) {
          const selected = filteredLedgers[ledgerIdx];
          onChange(selected['Ledger Name']);
          setSearchTerm(selected['Ledger Name']);
        }
        setIsOpen(false);
        setUserQuery('');
      }
    }
  };

  const getLedgerBalance = (ledger: Ledger) => {
    const bal = Number(ledger['Current Balance']) || 0;
    const type = bal >= 0 ? (ledger['Balance Type (Dr/Cr)'] || 'Dr') : (ledger['Balance Type (Dr/Cr)'] === 'Dr' ? 'Cr' : 'Dr');
    return {
      amount: Math.abs(bal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      type,
      isDebit: type === 'Dr'
    };
  };

  // Wheel scroll handler to highlight ledger items when mouse is scrolled up or down
  const lastWheelTime = useRef<number>(0);
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (disabled) return;

    const now = Date.now();
    // Throttle wheel steps slightly for smooth, predictable row-by-row navigation
    if (now - lastWheelTime.current < 60) return;
    lastWheelTime.current = now;

    if (!isOpen) {
      setIsOpen(true);
      return;
    }

    e.stopPropagation();

    if (e.deltaY > 0) {
      // Scroll Down -> Highlight Next Ledger
      setHighlightedIndex(prev => (prev + 1 < totalItems ? prev + 1 : 0));
    } else if (e.deltaY < 0) {
      // Scroll Up -> Highlight Previous Ledger
      setHighlightedIndex(prev => (prev - 1 >= 0 ? prev - 1 : totalItems - 1));
    }
  };

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      className={`relative group ${className}`}
    >
      {/* Searchable Input */}
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          id={id}
          type="text"
          disabled={disabled}
          autoFocus={autoFocus}
          value={isOpen ? searchTerm : value || searchTerm}
          title={isOpen ? searchTerm : value || searchTerm}
          placeholder={placeholder}
          onFocus={() => {
            setIsOpen(true);
            setUserQuery('');
            const curIdx = ledgers.findIndex(l => l['Ledger Name'] === value);
            setHighlightedIndex(curIdx >= 0 ? curIdx + 1 : 1);
            setTimeout(() => {
              inputRef.current?.select();
            }, 50);
          }}
          onClick={() => {
            if (!isOpen) {
              setIsOpen(true);
              setUserQuery('');
            }
          }}
          onChange={(e) => {
            const newVal = e.target.value;
            setSearchTerm(newVal);
            setUserQuery(newVal);
            if (!isOpen) setIsOpen(true);
            setHighlightedIndex(1); // Point to first filtered ledger
          }}
          onKeyDown={handleKeyDown}
          className={`w-full h-8.5 rounded-lg border border-slate-300 bg-white px-2.5 pr-12 font-bold text-slate-900 text-xs outline-none transition shadow-2xs ${
            isOpen
              ? 'border-indigo-600 ring-2 ring-indigo-100'
              : 'focus:border-indigo-600 hover:border-slate-400'
          } ${disabled ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''}`}
        />

        {/* Action icons on right */}
        <div className="absolute right-1.5 flex items-center gap-0.5">
          {value && onEditLedger && (
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                onEditLedger(value);
              }}
              className="p-1 rounded bg-amber-100 hover:bg-amber-200 text-amber-800 transition active:scale-95 text-[10px] font-bold flex items-center"
              title="Modify ledger master (Ctrl+Enter)"
            >
              <Pencil className="h-3 w-3" />
            </button>
          )}

          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            onClick={() => {
              if (!disabled) {
                if (isOpen) {
                  setIsOpen(false);
                  setUserQuery('');
                } else {
                  setIsOpen(true);
                  setUserQuery('');
                  inputRef.current?.focus();
                }
              }
            }}
            className="p-1 rounded text-slate-400 hover:text-indigo-600 transition"
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180 text-indigo-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Dropdown Options List */}
      {isOpen && !disabled && (
        <div
          ref={listRef}
          onWheel={handleWheel}
          className="fixed right-4 top-24 bottom-24 z-[100] w-[350px] shadow-2xl overflow-y-auto rounded-xl border border-slate-300 bg-white divide-y divide-slate-100 animate-in slide-in-from-right-8 duration-200"
        >
          <div className="sticky top-0 bg-slate-800 text-white px-3 py-2 text-xs font-bold shadow-md z-20 flex justify-between items-center">
            <span>List of Ledger Accounts</span>
            <span className="text-[10px] text-slate-400 font-normal">Select (Enter)</span>
          </div>
          {/* 1. Quick Create Option Pinned at Top */}
          {onCreateNew && (
            <div
              data-index="0"
              onClick={() => {
                setIsOpen(false);
                onCreateNew();
              }}
              onMouseMove={() => {
                if (highlightedIndex !== 0) setHighlightedIndex(0);
              }}
              onMouseEnter={() => setHighlightedIndex(0)}
              className={`sticky top-0 z-10 px-3 py-2 flex items-center justify-between cursor-pointer transition text-xs font-bold border-b border-emerald-200/80 shadow-2xs ${
                highlightedIndex === 0 ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Sparkles className={`h-3.5 w-3.5 ${highlightedIndex === 0 ? 'text-emerald-200' : 'text-emerald-600'}`} />
                <span>+ Create New Ledger / Account...</span>
              </div>
              <kbd className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
                highlightedIndex === 0 ? 'bg-emerald-700 text-emerald-100' : 'bg-emerald-200 text-emerald-900'
              }`}>
                Alt+C
              </kbd>
            </div>
          )}

          {/* Group Filter Information Header */}
          {(filterGroups || filterGroup) && (
            <div className="px-3 py-1 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[10.5px]">
              <span className="text-slate-500 font-medium">
                {showAllGroups
                  ? 'Showing: All Ledgers'
                  : `Group: ${(filterGroups || [filterGroup]).join(', ')}`}
                <span className="text-slate-400 ml-1">({filteredLedgers.length})</span>
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAllGroups(prev => !prev);
                }}
                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
              >
                {showAllGroups ? 'Filter Group Only' : 'Show All Ledgers'}
              </button>
            </div>
          )}

          {/* 2. Ledger Items List */}
          {filteredLedgers.length === 0 ? (
            <div className="px-3 py-5 text-center text-xs text-slate-400">
              No matching ledger accounts found for "{userQuery || searchTerm}"
            </div>
          ) : (
            filteredLedgers.map((l, idx) => {
              const itemIdx = (hasCreateOption ? 1 : 0) + idx;
              const isSelected = l['Ledger Name'] === value;
              const isHighlighted = highlightedIndex === itemIdx;
              const isPrioritized = hasPriority && idx < prioritizedCount;
              const bal = getLedgerBalance(l);

              return (
                <React.Fragment key={l['Ledger Name']}>
                  {/* Intelligent Priority Section Header */}
                  {hasPriority && idx === 0 && (
                    <div className="sticky top-[37px] z-10 px-3 py-1.5 bg-gradient-to-r from-amber-50 to-indigo-50 border-b border-amber-200/80 flex items-center justify-between text-[10.5px] font-bold text-amber-950 shadow-2xs">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="h-3 w-3 text-amber-600 animate-pulse" />
                        <span>Recommended Accounts ({prioritizedCount})</span>
                      </div>
                      <span className="text-[9px] px-1.5 py-0.5 bg-white/90 rounded border border-amber-300 font-mono text-amber-800 font-bold">
                        Intelligent Match
                      </span>
                    </div>
                  )}

                  {/* General Master Accounts Section Divider */}
                  {hasPriority && idx === prioritizedCount && (
                    <div className="px-3 py-1 bg-slate-100 border-y border-slate-200 text-[10px] font-bold text-slate-600 flex items-center justify-between">
                      <span>Other Accounts ({filteredLedgers.length - prioritizedCount})</span>
                      <span className="text-[9px] font-normal text-slate-400">All Master Ledgers</span>
                    </div>
                  )}

                  <div
                    data-index={itemIdx}
                    onClick={() => selectLedger(l['Ledger Name'])}
                    onMouseMove={() => {
                      if (highlightedIndex !== itemIdx) setHighlightedIndex(itemIdx);
                    }}
                    onMouseEnter={() => setHighlightedIndex(itemIdx)}
                    className={`px-3 py-1.5 flex items-center justify-between gap-2 cursor-pointer transition-colors text-xs ${
                      isHighlighted
                        ? 'bg-indigo-600 text-white'
                        : isSelected
                        ? 'bg-indigo-50/90 text-indigo-950 font-bold'
                        : isPrioritized
                        ? 'bg-amber-50/35 hover:bg-amber-50/80 text-slate-800'
                        : 'text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex flex-col min-w-0 flex-1 pr-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          title={l['Ledger Name']}
                          className={`font-bold text-[12px] leading-snug break-words ${
                            isHighlighted ? 'text-white' : 'text-slate-900'
                          }`}
                        >
                          {l['Ledger Name']}
                        </span>
                        {isSelected && (
                          <Check className={`h-3 w-3 shrink-0 ${isHighlighted ? 'text-indigo-200' : 'text-indigo-600'}`} />
                        )}
                        {partyDueMap[l['Ledger Name']]?.count > 0 ? (
                          <span className={`px-1.5 py-0.2 rounded text-[8.5px] font-extrabold flex items-center gap-0.5 shrink-0 shadow-2xs ${
                            isHighlighted ? 'bg-amber-300 text-slate-950 font-black' : 'bg-amber-500 text-white'
                          }`}>
                            <span>🔥 {partyDueMap[l['Ledger Name']].count} Due ({currencySymbol}{partyDueMap[l['Ledger Name']].amount.toLocaleString()})</span>
                          </span>
                        ) : isPrioritized && !isHighlighted ? (
                          <span className="px-1.5 py-0.2 rounded text-[8.5px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300/80 shrink-0">
                            ⭐ Recommended
                          </span>
                        ) : isPrioritized && isHighlighted ? (
                          <span className="px-1.5 py-0.2 rounded text-[8.5px] font-extrabold bg-amber-400 text-slate-950 shrink-0">
                            ⭐ Recommended
                          </span>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-1 mt-0.5 text-[10px]">
                        <span className={`font-medium ${
                          isHighlighted ? 'text-indigo-100' : 'text-slate-500'
                        }`}>
                          {l.Group}
                        </span>
                        {(l['TPN No'] || l['GST No']) && (
                          <span className={`font-mono text-[9.5px] ${isHighlighted ? 'text-indigo-200' : 'text-slate-400'}`}>
                            • {l['TPN No'] || l['GST No']}
                          </span>
                        )}
                        {l['Contact No'] && (
                          <span className={`${isHighlighted ? 'text-indigo-200' : 'text-slate-400'}`}>
                            • 📞 {l['Contact No']}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0 pl-1 self-center">
                      <span className={`inline-flex items-center gap-0.5 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap ${
                        isHighlighted
                          ? 'bg-indigo-700/90 text-white'
                          : bal.isDebit
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                          : 'bg-rose-50 text-rose-700 border border-rose-200/80'
                      }`}>
                        <span className="text-[8.5px] opacity-75 font-sans font-medium">Bal:</span>
                        {currencySymbol} {bal.amount} {bal.type}
                      </span>
                    </div>
                  </div>
                </React.Fragment>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
