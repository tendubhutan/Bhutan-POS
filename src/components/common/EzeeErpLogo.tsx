import React from 'react';

interface EzeeErpLogoProps {
  className?: string;
  variant?: 'full' | 'compact' | 'light';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const EzeeErpLogo: React.FC<EzeeErpLogoProps> = ({
  className = '',
  variant = 'full',
  size = 'md'
}) => {
  const sizeMap = {
    sm: { height: 'h-8 sm:h-9', text: 'text-xl sm:text-2xl', sub: 'text-[9px]' },
    md: { height: 'h-10 sm:h-12', text: 'text-2xl sm:text-3xl', sub: 'text-[10px] sm:text-[11px]' },
    lg: { height: 'h-12 sm:h-16', text: 'text-3xl sm:text-4xl lg:text-5xl', sub: 'text-xs sm:text-sm' },
    xl: { height: 'h-16 sm:h-20', text: 'text-4xl sm:text-5xl lg:text-6xl', sub: 'text-sm sm:text-base' }
  };

  const currentSize = sizeMap[size];

  return (
    <div className={`inline-flex items-center gap-2.5 sm:gap-3.5 text-left ${className}`}>
      {/* Official Ezee ERP Curved 'E' Swoosh Emblem SVG */}
      <svg 
        className={`${currentSize.height} w-auto shrink-0 drop-shadow-sm transition-transform hover:scale-105 duration-200`} 
        viewBox="0 0 180 150" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="ezeeOuterGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0066FF" />
            <stop offset="50%" stopColor="#00A3FF" />
            <stop offset="100%" stopColor="#00D5FF" />
          </linearGradient>
          <linearGradient id="ezeeInnerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00D5FF" />
            <stop offset="100%" stopColor="#0099FF" />
          </linearGradient>
          <linearGradient id="ezeeArrowGrad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0055FF" />
            <stop offset="100%" stopColor="#00A8FF" />
          </linearGradient>
        </defs>
        
        {/* Curved 'E' Ring Outer Shape */}
        <path
          d="M 125 15 C 65 15 15 50 15 95 C 15 135 50 148 90 148 C 122 148 152 130 165 102 L 132 102 C 122 115 104 124 86 124 C 60 124 42 108 42 88 C 42 62 65 40 118 40 L 142 40 L 142 20 L 125 15 Z"
          fill="url(#ezeeOuterGrad)"
        />
        
        {/* Inner Parallel Bars of 'E' */}
        <rect x="52" y="58" width="72" height="18" rx="4" fill="url(#ezeeInnerGrad)" />
        <rect x="52" y="88" width="58" height="18" rx="4" fill="url(#ezeeInnerGrad)" />
        
        {/* Upward Curved Growth Arrow Swoosh */}
        <path
          d="M 125 102 L 172 72 L 168 128 L 152 110 L 125 102 Z"
          fill="url(#ezeeArrowGrad)"
        />
      </svg>

      {/* Brand Text Block */}
      <div className="flex flex-col leading-none">
        <div className="flex items-baseline font-black tracking-tight">
          <span className={`${currentSize.text} font-black text-[#001f54] tracking-tight`}>Ezee</span>
          <span className={`${currentSize.text} font-black text-transparent bg-clip-text bg-gradient-to-r from-[#0066ff] to-[#00a8ff] ml-1.5`}>ERP</span>
        </div>
        
        {variant === 'full' && (
          <p className={`${currentSize.sub} font-bold text-slate-700 tracking-tight mt-1`}>
            Everything Your Business Needs, in One Place.
          </p>
        )}
      </div>
    </div>
  );
};
