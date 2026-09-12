import React, { useRef, useEffect } from 'react';
import { MessageSquarePlus, X, FileText } from 'lucide-react';

export interface ItemNoteButtonProps {
  hasNote: boolean;
  isOpen?: boolean;
  onClick: () => void;
  accentColor?: 'indigo' | 'violet' | 'cyan' | 'purple' | 'amber' | 'slate';
}

export const ItemNoteButton: React.FC<ItemNoteButtonProps> = ({
  hasNote,
  onClick,
  accentColor = 'indigo',
}) => {
  const colorMap = {
    indigo: hasNote ? 'bg-indigo-100 text-indigo-700 border-indigo-300' : 'bg-slate-100/90 text-slate-500 border-slate-200 hover:text-indigo-600 hover:bg-indigo-50',
    violet: hasNote ? 'bg-violet-100 text-violet-700 border-violet-300' : 'bg-slate-100/90 text-slate-500 border-slate-200 hover:text-violet-600 hover:bg-violet-50',
    cyan: hasNote ? 'bg-cyan-100 text-cyan-700 border-cyan-300' : 'bg-slate-100/90 text-slate-500 border-slate-200 hover:text-cyan-600 hover:bg-cyan-50',
    purple: hasNote ? 'bg-purple-100 text-purple-700 border-purple-300' : 'bg-slate-100/90 text-slate-500 border-slate-200 hover:text-purple-600 hover:bg-purple-50',
    amber: hasNote ? 'bg-amber-100 text-amber-700 border-amber-300' : 'bg-slate-100/90 text-slate-500 border-slate-200 hover:text-amber-600 hover:bg-amber-50',
    slate: hasNote ? 'bg-slate-200 text-slate-800 border-slate-300' : 'bg-slate-100/90 text-slate-500 border-slate-200 hover:text-slate-700 hover:bg-slate-200',
  };

  const scheme = colorMap[accentColor] || colorMap.indigo;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-6 px-1.5 text-[10px] font-bold rounded-md border flex items-center gap-1 transition cursor-pointer shrink-0 ${scheme}`}
      title={hasNote ? 'Edit note / specification' : 'Add note / specification'}
    >
      {hasNote ? <FileText className="h-3 w-3" /> : <MessageSquarePlus className="h-3 w-3" />}
      <span>{hasNote ? 'Note' : '+ Note'}</span>
    </button>
  );
};

export interface ItemNoteInputProps {
  value: string;
  onChange: (val: string) => void;
  onClose?: () => void;
  placeholder?: string;
  accentColor?: 'indigo' | 'violet' | 'cyan' | 'purple' | 'amber' | 'slate';
}

export const ItemNoteInput: React.FC<ItemNoteInputProps> = ({
  value,
  onChange,
  onClose,
  placeholder = "Specification / Note...",
  accentColor = 'indigo',
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(26, textareaRef.current.scrollHeight)}px`;
    }
  };

  useEffect(() => {
    adjustHeight();
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [value]);

  const colorClasses = {
    indigo: { border: 'border-indigo-200', text: 'text-indigo-600', bg: 'bg-indigo-50/50' },
    violet: { border: 'border-violet-200', text: 'text-violet-600', bg: 'bg-violet-50/50' },
    cyan: { border: 'border-cyan-200', text: 'text-cyan-600', bg: 'bg-cyan-50/50' },
    purple: { border: 'border-purple-200', text: 'text-purple-600', bg: 'bg-purple-50/50' },
    amber: { border: 'border-amber-200', text: 'text-amber-600', bg: 'bg-amber-50/50' },
    slate: { border: 'border-slate-200', text: 'text-slate-600', bg: 'bg-slate-50/50' },
  };

  const scheme = colorClasses[accentColor] || colorClasses.indigo;

  return (
    <div className="mt-1 w-full animate-in fade-in duration-100">
      <div className={`flex items-start gap-1 rounded-md border ${scheme.border} ${scheme.bg} px-1.5 py-0.5 shadow-2xs`}>
        <span className={`text-[10px] font-bold ${scheme.text} shrink-0 mt-0.5 select-none`}>
          Note:
        </span>
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            onChange(e.target.value);
            adjustHeight();
          }}
          className="w-full text-[11px] leading-snug font-medium text-slate-800 bg-transparent outline-none resize-none overflow-hidden"
        />
        <button
          type="button"
          onClick={() => {
            onChange('');
            if (onClose) onClose();
          }}
          className="text-slate-400 hover:text-rose-600 p-0.5 rounded transition shrink-0 cursor-pointer mt-0.5"
          title="Clear & close note"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
};
