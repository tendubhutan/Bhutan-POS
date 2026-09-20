import React, { useState, useRef, useEffect, useMemo } from 'react';
import { X, Plus, ChevronDown, MapPin, Car } from 'lucide-react';

interface MultiTagSelectProps {
  value: string; // Comma-separated string, e.g. "Bin 1, Bin 2"
  onChange: (value: string) => void;
  options: string[];
  onAddNewOption?: (newVal: string) => void;
  placeholder?: string;
  label?: string;
  iconType?: 'location' | 'vehicle' | 'generic';
  badgeBgColor?: string;
}

export const MultiTagSelect: React.FC<MultiTagSelectProps> = ({
  value,
  onChange,
  options = [],
  onAddNewOption,
  placeholder = "Type to search or add...",
  label,
  iconType = 'generic',
  badgeBgColor = "bg-indigo-50 text-indigo-900 border-indigo-200"
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Parse comma-separated string into an array of selected tags
  const selectedTags = useMemo(() => {
    if (!value) return [];
    return value
      .split(/[,/;|]+/)
      .map(s => s.trim())
      .filter(Boolean);
  }, [value]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addTag = (tagToAdd: string) => {
    const trimmed = tagToAdd.trim();
    if (!trimmed) return;
    
    // Avoid duplicate case-insensitive tags
    if (selectedTags.some(t => t.toLowerCase() === trimmed.toLowerCase())) {
      setQuery('');
      return;
    }

    const updated = [...selectedTags, trimmed].join(', ');
    onChange(updated);
    setQuery('');
    setIsOpen(true);
    
    // Save to master options list if provided
    if (onAddNewOption && !options.some(o => o.toLowerCase() === trimmed.toLowerCase())) {
      onAddNewOption(trimmed);
    }

    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const removeTag = (tagToRemove: string) => {
    const updated = selectedTags.filter(t => t !== tagToRemove).join(', ');
    onChange(updated);
  };

  const filteredOptions = useMemo(() => {
    const qLower = query.toLowerCase().trim();
    return options.filter(opt => {
      const isAlreadySelected = selectedTags.some(t => t.toLowerCase() === opt.toLowerCase());
      if (isAlreadySelected) return false;
      if (!qLower) return true;
      return opt.toLowerCase().includes(qLower);
    });
  }, [options, selectedTags, query]);

  const isExactMatch = useMemo(() => {
    const qLower = query.toLowerCase().trim();
    if (!qLower) return true;
    return options.some(o => o.toLowerCase() === qLower) || selectedTags.some(t => t.toLowerCase() === qLower);
  }, [options, selectedTags, query]);

  const renderBadgeIcon = () => {
    if (iconType === 'location') return <MapPin className="h-3 w-3 text-amber-700 shrink-0" />;
    if (iconType === 'vehicle') return <Car className="h-3 w-3 text-indigo-700 shrink-0" />;
    return null;
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      {label && <label className="block font-semibold text-slate-700 mb-1 text-xs">{label}</label>}

      {/* Main Multi-Selection Container displaying Floating Badges/Tags */}
      <div 
        onClick={() => {
          setIsOpen(true);
          inputRef.current?.focus();
        }}
        className="min-h-[38px] w-full rounded-lg border border-slate-300 p-1.5 bg-white focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 flex flex-wrap items-center gap-1.5 cursor-text transition shadow-2xs"
      >
        {selectedTags.map((tag, idx) => (
          <span
            key={idx}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-xs border shadow-2xs transition ${badgeBgColor}`}
          >
            {renderBadgeIcon()}
            <span>{tag}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(tag);
              }}
              className="ml-0.5 p-0.5 hover:bg-black/10 rounded-full transition cursor-pointer"
              title="Remove"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}

        <div className="flex-1 min-w-[140px] flex items-center">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={e => {
              if (e.key === 'Enter' && query.trim()) {
                e.preventDefault();
                addTag(query.trim());
              } else if (e.key === 'Backspace' && !query && selectedTags.length > 0) {
                removeTag(selectedTags[selectedTags.length - 1]);
              }
            }}
            className="w-full text-xs outline-none bg-transparent py-0.5 px-1 font-medium placeholder:text-slate-400"
            placeholder={selectedTags.length === 0 ? placeholder : "Type to search or add more..."}
          />
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
        >
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Floating Dropdown */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-xl bg-white border border-slate-200 shadow-xl py-1 text-xs animate-in fade-in duration-100">
          {query.trim() && !isExactMatch && (
            <button
              type="button"
              onClick={() => addTag(query.trim())}
              className="w-full text-left px-3 py-2 text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100 font-bold flex items-center gap-2 border-b border-indigo-100 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5 text-indigo-600" />
              <span>Add new: "{query.trim()}"</span>
            </button>
          )}

          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => addTag(opt)}
                className="w-full text-left px-3 py-1.5 hover:bg-indigo-50/60 font-semibold text-slate-800 flex items-center justify-between transition cursor-pointer"
              >
                <div className="flex items-center gap-1.5">
                  {renderBadgeIcon()}
                  <span>{opt}</span>
                </div>
                <span className="text-[10px] text-slate-400 font-normal">Click to select</span>
              </button>
            ))
          ) : !query.trim() ? (
            <div className="px-3 py-2 text-slate-400 italic text-center text-[11px]">
              {options.length === 0 ? "Type to search or add a location/vehicle." : "All options selected."}
            </div>
          ) : isExactMatch && filteredOptions.length === 0 ? (
            <div className="px-3 py-2 text-slate-400 italic text-center text-[11px]">
              Option already selected.
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};
