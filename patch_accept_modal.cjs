const fs = require('fs');

function patchAcceptModal() {
  let content = fs.readFileSync('src/components/AcceptModal.tsx', 'utf8');

  // We rewrite it entirely for simplicity
  const newContent = `import React, { useEffect, useRef } from 'react';
import { playPromptSound } from '../utils/audio';

interface AcceptModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
}

export const AcceptModal: React.FC<AcceptModalProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  title = "Accept ?"
}) => {
  useEffect(() => {
    if (isOpen) {
      playPromptSound();
      
      const handleGlobalKeyDown = (e: KeyboardEvent) => {
        const key = e.key.toLowerCase();
        if (key === 'y' || key === 'enter') {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation?.();
          onConfirm();
        } else if (key === 'n' || key === 'escape') {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation?.();
          onCancel();
        }
      };
      
      window.addEventListener('keydown', handleGlobalKeyDown, { capture: true });
      return () => {
        window.removeEventListener('keydown', handleGlobalKeyDown, { capture: true });
      };
    }
  }, [isOpen, onConfirm, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-white/10 backdrop-blur-[0.5px]">
      <div 
        className="bg-white border border-[#9d605c] outline-none w-[180px] shadow-sm flex flex-col items-center justify-center py-6 px-4 animate-in fade-in duration-75"
        style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
      >
        <div className="text-xl text-black mb-8">
          {title}
        </div>
        <div className="text-[17px] font-bold text-black flex items-center gap-1.5">
          <button 
            type="button"
            onClick={onConfirm}
            className="text-[#2b579a] cursor-pointer"
          >
            Yes
          </button>
          <span className="font-normal text-black text-[15px]">or</span>
          <button 
            type="button"
            onClick={onCancel}
            className="text-[#2b579a] cursor-pointer"
          >
            No
          </button>
        </div>
      </div>
    </div>
  );
};
`;

  fs.writeFileSync('src/components/AcceptModal.tsx', newContent);
}

patchAcceptModal();
