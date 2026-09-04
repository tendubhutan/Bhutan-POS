import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Item } from '../types';
import { Search, Check, ChevronDown, X, Package, Plus, Hash } from 'lucide-react';
import { getActiveUser, getSerialNumbersStockReport } from '../services/storageService';

interface SearchableItemSelectProps {
  id?: string;
  valueCode?: string;
  onSelect: (item: Item, scannedSerial?: string) => void;
  onClear?: () => void;
  onEnterNext?: () => void;
  items: Item[];
  placeholder?: string;
  autoFocus?: boolean;
  currencySymbol?: string;
  className?: string;
  disabled?: boolean;
  showStockBadge?: boolean;
  showPrice?: boolean;
  priceType?: 'sale' | 'purchase' | 'mrp';
  onCreateNew?: (onSelect?: (item: Item) => void) => void;
  onEditItem?: (item: Item) => void;
  onShowInfo?: (item: Item) => void;
  onSaveVoucher?: () => void;
  onEndOfList?: (id?: string) => void;
  onFocusDate?: () => void;
  onInputChange?: (value: string) => void;
  clearOnSelect?: boolean;
  autoClearAfterSelect?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  dropdownPosition?: 'up' | 'down' | 'auto';
  variant?: 'default' | 'grid';
}

export const SearchableItemSelect: React.FC<SearchableItemSelectProps> = ({
  id,
  valueCode,
  onSelect,
  onClear,
  onEnterNext,
  items,
  placeholder = 'Search item...',
  autoFocus = false,
  currencySymbol = 'Nu.',
  className = '',
  disabled = false,
  showStockBadge = true,
  showPrice = true,
  priceType = 'sale',
  onCreateNew,
  onEditItem,
  onShowInfo,
  onSaveVoucher,
  onEndOfList,
  onFocusDate,
  onInputChange,
  clearOnSelect = false,
  autoClearAfterSelect = false,
  dropdownPosition = 'auto',
  onKeyDown,
  variant = 'default'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [showCostPrice, setShowCostPrice] = useState(false);
  const [securityDenied, setSecurityDenied] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const justSelectedRef = useRef(false);

  const [coords, setCoords] = useState({ top: 0, bottom: 0, left: 0, width: 0, placement: 'bottom' });

  // Update coordinates for the portal overlay
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const updatePosition = () => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        
        const windowHeight = window.innerHeight;
        const spaceBelow = windowHeight - rect.bottom;
        const spaceAbove = rect.top;
        const dropdownHeight = 260; 
        
        let placement = 'bottom';
        if (dropdownPosition === 'auto') {
           if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
             placement = 'top';
           }
        } else if (dropdownPosition === 'up') {
           placement = 'top';
        }

        const dropdownWidth = Math.max(rect.width, 380);
        const maxLeft = Math.max(10, window.innerWidth - dropdownWidth - 15);
        const clampLeft = Math.min(Math.max(10, rect.left), maxLeft);

        setCoords({
          top: rect.top,
          bottom: rect.bottom,
          left: clampLeft,
          width: dropdownWidth,
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
  }, [isOpen, dropdownPosition]);

  const selectedItem = useMemo(() => 
    items.find(i => i['Item Code'] === valueCode),
  [items, valueCode]);

  const shouldClearOnSelect = clearOnSelect || autoClearAfterSelect;

  useEffect(() => {
    if (selectedItem && !shouldClearOnSelect) {
      setSearchTerm(selectedItem['Item Name']);
    } else if (shouldClearOnSelect && !isOpen) {
      setSearchTerm('');
    }
  }, [selectedItem, shouldClearOnSelect, valueCode]);

  useEffect(() => {
    if (!isOpen) {
      if (shouldClearOnSelect) {
        setSearchTerm('');
      } else {
        setSearchTerm(selectedItem ? selectedItem['Item Name'] : '');
      }
    }
  }, [selectedItem, isOpen, shouldClearOnSelect]);

  const inStockSerials = useMemo(() => {
    try {
      return getSerialNumbersStockReport().filter(s => s.status === 'In Stock');
    } catch {
      return [];
    }
  }, [isOpen, searchTerm]);

  const matchedSerialMap = useMemo(() => {
    if (!searchTerm) return new Map<string, string>();
    const term = searchTerm.trim().toLowerCase();
    const map = new Map<string, string>();
    inStockSerials.forEach(s => {
      if (s.serialNo.toLowerCase().includes(term)) {
        if (!map.has(s.itemCode)) {
          map.set(s.itemCode, s.serialNo);
        }
      }
    });
    return map;
  }, [inStockSerials, searchTerm]);

  const exactSerialMatch = useMemo(() => {
    if (!searchTerm) return null;
    const term = searchTerm.trim().toLowerCase();
    return inStockSerials.find(s => s.serialNo.toLowerCase() === term);
  }, [inStockSerials, searchTerm]);

  const filteredItems = useMemo(() => {
    if (!searchTerm) return items.slice(0, 100);
    const searchLower = searchTerm.toLowerCase();
    
    return items
      .filter(item => {
        const name = (item['Item Name'] || '').toLowerCase();
        const code = (item['Item Code'] || '').toLowerCase();
        const barcode = (item['Barcode'] || '').toLowerCase();
        const alias = (item['Alias'] || '').toLowerCase();
        const hasSerial = matchedSerialMap.has(item['Item Code']);
        
        return (
          name.includes(searchLower) ||
          code.includes(searchLower) ||
          barcode === searchLower ||
          alias.includes(searchLower) ||
          hasSerial
        );
      })
      .sort((a, b) => {
        const aCode = (a['Item Code'] || '').toLowerCase();
        const bCode = (b['Item Code'] || '').toLowerCase();
        
        // Exact serial number match gets top priority
        const aExactSerial = exactSerialMatch && exactSerialMatch.itemCode === a['Item Code'];
        const bExactSerial = exactSerialMatch && exactSerialMatch.itemCode === b['Item Code'];
        if (aExactSerial && !bExactSerial) return -1;
        if (!aExactSerial && bExactSerial) return 1;

        const aBarcode = (a['Barcode'] || '').toLowerCase();
        const bBarcode = (b['Barcode'] || '').toLowerCase();

        // Exact barcode match first
        if (aBarcode === searchLower && bBarcode !== searchLower) return -1;
        if (bBarcode === searchLower && aBarcode !== searchLower) return 1;

        // Exact code match second
        if (aCode === searchLower && bCode !== searchLower) return -1;
        if (bCode === searchLower && aCode !== searchLower) return 1;

        // Serial substring match
        const aHasSerial = matchedSerialMap.has(a['Item Code']);
        const bHasSerial = matchedSerialMap.has(b['Item Code']);
        if (aHasSerial && !bHasSerial) return -1;
        if (!aHasSerial && bHasSerial) return 1;

        const aName = (a['Item Name'] || '').toLowerCase();
        const bName = (b['Item Name'] || '').toLowerCase();

        // Exact name match third
        if (aName === searchLower && bName !== searchLower) return -1;
        if (bName === searchLower && aName !== searchLower) return 1;

        // Starts with name
        const aStartsName = aName.startsWith(searchLower);
        const bStartsName = bName.startsWith(searchLower);
        if (aStartsName && !bStartsName) return -1;
        if (!aStartsName && bStartsName) return 1;
        
        return 0;
      })
      .slice(0, 100); // Increased slightly for portal
  }, [items, searchTerm, matchedSerialMap, exactSerialMatch]);

  const showEndOfList = (!!onSaveVoucher || !!onEndOfList) && !searchTerm.trim();
  const endOfListIdx = showEndOfList ? 0 : -1;
  const createNewIdx = onCreateNew ? (showEndOfList ? 1 : 0) : -1;
  const itemsOffset = (showEndOfList ? 1 : 0) + (onCreateNew ? 1 : 0);
  const totalItems = itemsOffset + filteredItems.length;

  useEffect(() => {
    if (isOpen && listRef.current) {
      const activeEl = listRef.current.querySelector(
        `[data-index="${highlightedIndex}"]`
      ) as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  useEffect(() => {
    setHighlightedIndex(showEndOfList ? endOfListIdx : (onCreateNew && !filteredItems.length ? createNewIdx : itemsOffset));
  }, [searchTerm, itemsOffset, showEndOfList, endOfListIdx, createNewIdx, filteredItems.length]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Check if click is outside both the input container and the portal
      if (
        containerRef.current && 
        !containerRef.current.contains(e.target as Node) &&
        listRef.current &&
        !listRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setSearchTerm(shouldClearOnSelect ? '' : (selectedItem ? selectedItem['Item Name'] : ''));
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedItem, shouldClearOnSelect]);

  const handleSelect = (item: Item, scannedSerial?: string) => {
    if (disabled) return;
    justSelectedRef.current = true;
    const finalSerial = scannedSerial || (exactSerialMatch && exactSerialMatch.itemCode === item['Item Code'] ? exactSerialMatch.serialNo : undefined);
    onSelect(item, finalSerial);
    
    if (autoClearAfterSelect) {
      setSearchTerm('');
    } else {
      setSearchTerm(item['Item Name']);
    }
    
    setIsOpen(false);
    
    if (onEnterNext) {
      setTimeout(() => onEnterNext(), 10);
    }
    
    setTimeout(() => {
      justSelectedRef.current = false;
    }, 200);
  };

  const getItemPrice = (item: Item) => {
    switch (priceType) {
      case 'sale': return Number((item as any)['Sale Rate'] ?? (item as any)['Sales Rate'] ?? item.MRP ?? 0);
      case 'purchase': return Number(item['Purchase Rate'] ?? 0);
      case 'mrp': return Number(item.MRP ?? 0);
      default: return 0;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    // Ctrl+P or Alt+P to secret toggle Purchase Cost
    if ((e.ctrlKey || e.altKey) && e.key.toLowerCase() === 'p') {
      e.preventDefault();
      e.stopPropagation();
      try {
        const user = getActiveUser();
        const isAllowed = !user || user.role === 'Administrator' || user.role === 'Manager' || user.role === 'Accountant' || (user.role !== 'Cashier' && user.permissions?.some(p => p.display));
        if (isAllowed) {
          setShowCostPrice(prev => !prev);
        } else {
          setSecurityDenied(true);
          setTimeout(() => setSecurityDenied(false), 2500);
        }
      } catch {
        setShowCostPrice(prev => !prev);
      }
      return;
    }

    if (onKeyDown) {
      onKeyDown(e);
      if (e.defaultPrevented) return;
    }
    const isCtrlA = e.ctrlKey && e.key.toLowerCase() === 'a';
    const isF2 = e.key === 'F2';
    
    if (isCtrlA || isF2) {
      if (onSaveVoucher) {
        e.preventDefault();
        e.stopPropagation();
        onSaveVoucher();
        return;
      }
    }

    // Alt+C for Quick Create
    if (e.altKey && e.key.toLowerCase() === 'c' && onCreateNew) {
      e.preventDefault();
      onCreateNew(handleSelect);
      setIsOpen(false);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) setIsOpen(true);
      else setHighlightedIndex(prev => (prev < totalItems - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) setIsOpen(true);
      else setHighlightedIndex(prev => (prev > (showEndOfList ? endOfListIdx : (onCreateNew ? createNewIdx : itemsOffset)) ? prev - 1 : prev));
    } else if (e.key === 'Enter') {
      if (exactSerialMatch) {
        e.preventDefault();
        const matchedItem = items.find(i => i['Item Code'] === exactSerialMatch.itemCode);
        if (matchedItem) {
          handleSelect(matchedItem, exactSerialMatch.serialNo);
          return;
        }
      }
      if (isOpen) {
        e.preventDefault();
        if (showEndOfList && highlightedIndex === endOfListIdx) {
          e.preventDefault();
          setIsOpen(false);
          inputRef.current?.blur();
          if (onEndOfList) { onEndOfList(id); } else if (onSaveVoucher) { onSaveVoucher(); }
        } else if (onCreateNew && highlightedIndex === createNewIdx) {
          e.preventDefault();
          onCreateNew(handleSelect);
          setIsOpen(false);
        } else {
          const itemIdx = highlightedIndex - itemsOffset;
          if (filteredItems[itemIdx]) {
            handleSelect(filteredItems[itemIdx]);
          }
        }
      } else {
        if (onEnterNext) {
          e.preventDefault();
          onEnterNext();
        }
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      if (shouldClearOnSelect) {
        setSearchTerm('');
      } else {
        setSearchTerm(selectedItem ? selectedItem['Item Name'] : '');
      }
    }
  };

  
  const portalContent = isOpen && (
    <div
      ref={listRef}
      style={{
        position: 'fixed',
        top: coords.placement === 'bottom' ? `${coords.bottom + 2}px` : 'auto',
        bottom: coords.placement === 'top' ? `${window.innerHeight - coords.top + 2}px` : 'auto',
        left: `${coords.left}px`,
        width: `${coords.width}px`,
        zIndex: 999999
      }}
      className={`max-h-[240px] flex flex-col overflow-hidden rounded shadow-lg border border-slate-300 bg-white `}
    >
      <div className="flex items-center justify-between bg-slate-800 text-white px-2 py-1 text-[11px] font-bold shadow-md z-20">
        <div className="flex-[3] min-w-0 pr-2">Item Name</div>
        
        <div className="w-12 text-center shrink-0 pr-2">Unit</div>
        <div className="w-16 text-right shrink-0 pr-2">Stock</div>
        {showCostPrice && <div className="w-20 text-right shrink-0 text-amber-300 font-extrabold">P.Cost</div>}
        {showPrice && <div className="w-20 text-right shrink-0">Price</div>}
      </div>

      {securityDenied && (
        <div className="bg-rose-600 text-white px-2 py-0.5 text-[10px] font-bold text-center">
          🔒 Access Denied: Only Admin/Manager can view purchase cost
        </div>
      )}
      
      <div className="overflow-y-auto flex-1 bg-white">
        {showEndOfList && (
          <div
            data-index={endOfListIdx}
            onClick={() => {
              setIsOpen(false);
              if (onEndOfList) { onEndOfList(id); } else if (onSaveVoucher) { onSaveVoucher(); }
            }}
            onMouseEnter={() => setHighlightedIndex(endOfListIdx)}
            className={`flex items-center px-2 py-1 text-[11px] font-bold transition cursor-pointer border-b border-slate-100 ${
              highlightedIndex === endOfListIdx
                ? 'bg-amber-100 text-amber-800'
                : 'text-amber-700 hover:bg-amber-50'
            }`}
          >
            <div className="flex-1 text-center uppercase tracking-wide">
              -- End of List --
            </div>
          </div>
        )}
        
        {onCreateNew && (
          <div
            data-index={createNewIdx}
            onClick={() => {
              onCreateNew(handleSelect);
              setIsOpen(false);
            }}
            onMouseEnter={() => setHighlightedIndex(createNewIdx)}
            className={`flex items-center gap-2 px-2 py-1 text-[11px] font-bold transition cursor-pointer border-b border-slate-100 ${
              highlightedIndex === createNewIdx
                ? 'bg-indigo-100 text-indigo-800'
                : 'text-indigo-700 hover:bg-indigo-50'
            }`}
          >
            <Plus className="h-3 w-3 shrink-0" />
            <span>+ Create New Item Master</span>
            <kbd className="ml-auto rounded bg-white px-1 py-0.5 text-[9px] font-mono border border-indigo-200 text-indigo-700">
              Alt+C
            </kbd>
          </div>
        )}
        
        {filteredItems.length === 0 ? (
          <div className="py-3 px-4 text-center">
            <p className="text-[11px] font-bold text-slate-500">No items found</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredItems.map((item, idx) => {
              const itemActualIndex = itemsOffset + idx;
              const isHighlighted = highlightedIndex === itemActualIndex;
              const isSelected = item['Item Code'] === valueCode;
              const stock = Number(item['Current Stock']) || 0;
              const price = getItemPrice(item);
              const costPrice = Number(item['Purchase Rate'] || 0);
              return (
                <div
                  key={item['Item Code']}
                  data-index={itemActualIndex}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setHighlightedIndex(itemActualIndex)}
                  className={`flex items-center px-2 py-1 text-[11px] transition cursor-pointer ${
                    isHighlighted
                      ? 'bg-indigo-600 text-white font-semibold'
                      : isSelected
                      ? 'bg-slate-100 font-bold text-slate-900'
                      : 'text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex-[3] min-w-0 pr-2 truncate font-medium flex items-center gap-1.5">
                    <span className="truncate">{item['Item Name']}</span>
                    {matchedSerialMap.has(item['Item Code']) && (
                      <span className={`shrink-0 inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
                        isHighlighted ? 'bg-indigo-700 text-indigo-100' : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}>
                        <Hash className="h-2.5 w-2.5" />
                        {matchedSerialMap.get(item['Item Code'])}
                      </span>
                    )}
                  </div>
                  
                  <div className={`w-12 text-center shrink-0 pr-2 ${isHighlighted ? 'text-indigo-200' : 'text-slate-500'}`}>
                    {item.Unit}
                  </div>
                  <div className={`w-16 text-right shrink-0 pr-2 font-mono ${
                    isHighlighted ? 'text-white' : item['Maintain Stock'] === 'N' ? 'text-slate-400' : stock > 0 ? 'text-emerald-600' : 'text-rose-500'
                  }`}>
                    {item['Maintain Stock'] === 'N' ? 'N/A' : stock}
                  </div>
                  {showCostPrice && (
                    <div className={`w-20 text-right shrink-0 font-mono font-extrabold ${
                      isHighlighted ? 'text-amber-200' : 'text-amber-700'
                    }`}>
                      {costPrice.toFixed(2)}
                    </div>
                  )}
                  {showPrice && (
                    <div className="w-20 text-right shrink-0 font-mono font-bold">
                      {price.toFixed(2)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className={`relative flex items-center ${className}`} ref={containerRef}>
      <input
        ref={inputRef}
        id={id}
        type="text"
        disabled={disabled}
        placeholder={placeholder}
        value={searchTerm}
        autoFocus={autoFocus}
        onFocus={e => {
          if (justSelectedRef.current) return;
          setIsOpen(true);
          e.target.select();
        }}
        onChange={e => {
          setSearchTerm(e.target.value);
          setIsOpen(true);
          if (onInputChange) onInputChange(e.target.value);
        }}
        onKeyDown={handleKeyDown}
        className={`w-full h-[34px] ${variant === 'grid' ? 'bg-transparent border-0 px-1 text-sm rounded-none focus:ring-0 focus:outline-none shadow-none font-medium text-slate-800' : 'rounded-lg border border-slate-300 bg-white px-3 shadow-sm focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 text-xs font-bold text-slate-900'} pr-10 outline-none transition placeholder:font-normal placeholder:text-slate-400 ${
          disabled ? 'opacity-75 cursor-not-allowed text-slate-500 ' + (variant !== 'grid' ? 'bg-slate-100' : '') : ''
        }`}
      />
      
      <div className="absolute right-1.5 flex items-center gap-0.5">
        {searchTerm && onClear && !disabled && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => {
              setSearchTerm('');
              onClear();
              setIsOpen(false);
              inputRef.current?.focus();
            }}
            className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
            title="Clear selection"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={() => {
            if (!disabled) {
              setIsOpen(!isOpen);
              inputRef.current?.focus();
            }
          }}
          className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
        >
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Render overlay via React Portal */}
      {isOpen && typeof document !== 'undefined' && createPortal(portalContent, document.body)}
    </div>
  );
};
