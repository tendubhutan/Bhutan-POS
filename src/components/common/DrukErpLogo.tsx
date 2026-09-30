import React from 'react';

export interface DrukErpLogoProps {
  className?: string;
  variant?: 'full' | 'compact' | 'light' | 'icon';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

export const DrukErpLogo: React.FC<DrukErpLogoProps> = ({
  className = '',
  variant = 'full',
  size = 'md'
}) => {
  const heightMap = {
    xs: 'h-7 sm:h-8',
    sm: 'h-9 sm:h-10',
    md: 'h-12 sm:h-14',
    lg: 'h-16 sm:h-18',
    xl: 'h-22 sm:h-26'
  };

  const textMap = {
    xs: { text: 'text-base sm:text-lg', sub: 'text-[7.5px]' },
    sm: { text: 'text-lg sm:text-xl', sub: 'text-[9px]' },
    md: { text: 'text-2xl sm:text-3xl', sub: 'text-[10px] sm:text-[11px]' },
    lg: { text: 'text-3xl sm:text-4xl', sub: 'text-xs sm:text-sm' },
    xl: { text: 'text-4xl sm:text-5xl', sub: 'text-sm sm:text-base' }
  };

  // If variant is full on normal/light background, we can directly render the official logo asset
  if (variant === 'full') {
    return (
      <div className={`inline-flex items-center text-left select-none ${className}`}>
        <img 
          src="/druk_erp_logo.svg" 
          alt="Druk ERP - Everything Your Business Needs, in One Place." 
          className={`${heightMap[size]} w-auto object-contain transition-transform hover:scale-102 duration-200`}
        />
      </div>
    );
  }

  // If variant is icon only
  if (variant === 'icon') {
    return (
      <div className={`inline-flex items-center select-none ${className}`}>
        <svg 
          className={`${heightMap[size]} w-auto drop-shadow-xs`} 
          viewBox="0 0 170 155" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="iconDGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1d4ed8" />
              <stop offset="35%" stopColor="#2563eb" />
              <stop offset="75%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#60a5fa" />
            </linearGradient>
            <linearGradient id="iconSwooshGrad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#1e40af" />
              <stop offset="40%" stopColor="#0284c7" />
              <stop offset="85%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#7dd3fc" />
            </linearGradient>
          </defs>
          <path d="M 38 12 L 88 12 C 122 12, 146 34, 146 72 C 146 106, 120 128, 88 128 L 38 128 Z" fill="url(#iconDGrad)" />
          <path d="M 76 44 L 105 106 L 76 106 Z" fill="#0c234a" />
          <path d="M 105 106 L 120 124 L 92 124 Z" fill="#162d66" />
          <path d="M 76 44 L 46 112 L 66 112 L 76 74 L 88 106 L 76 106 Z" fill="#ffffff" />
          <polygon points="76,44 68,64 84,60" fill="#ffffff" />
          <polygon points="76,44 84,60 92,72 86,74" fill="#cbd5e1" />
          <path d="M 52 30 L 86 30 C 108 30, 126 46, 126 72 C 126 88, 116 104, 98 110 L 98 98 C 110 92, 114 82, 114 72 C 114 54, 102 42, 82 42 L 52 42 Z" fill="#ffffff" />
          <path d="M 16 110 C 10 132, 34 146, 74 146 C 110 146, 140 130, 150 102 L 138 98 C 128 120, 102 134, 74 134 C 44 134, 26 122, 28 106 C 30 96, 40 86, 58 76 L 52 66 C 32 78, 18 92, 16 110 Z" fill="url(#iconSwooshGrad)" />
          <path d="M 134 90 L 162 84 L 152 118 L 144 100 L 134 90 Z" fill="url(#iconSwooshGrad)" />
        </svg>
      </div>
    );
  }

  // Compact or Light variant (e.g. inside dark background or compact header)
  const isLight = variant === 'light';
  const currentText = textMap[size];

  return (
    <div className={`inline-flex items-center gap-2 sm:gap-2.5 text-left select-none ${className}`}>
      {/* Mountain Emblem SVG */}
      <svg 
        className={`${heightMap[size]} w-auto drop-shadow-xs shrink-0`} 
        viewBox="0 0 170 155" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="drukEmblemD" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1d4ed8" />
            <stop offset="35%" stopColor="#2563eb" />
            <stop offset="75%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#60a5fa" />
          </linearGradient>
          <linearGradient id="drukEmblemSwoosh" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#1e40af" />
            <stop offset="40%" stopColor="#0284c7" />
            <stop offset="85%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#7dd3fc" />
          </linearGradient>
        </defs>
        <path d="M 38 12 L 88 12 C 122 12, 146 34, 146 72 C 146 106, 120 128, 88 128 L 38 128 Z" fill="url(#drukEmblemD)" />
        <path d="M 76 44 L 105 106 L 76 106 Z" fill="#0c234a" />
        <path d="M 105 106 L 120 124 L 92 124 Z" fill="#162d66" />
        <path d="M 76 44 L 46 112 L 66 112 L 76 74 L 88 106 L 76 106 Z" fill="#ffffff" />
        <polygon points="76,44 68,64 84,60" fill="#ffffff" />
        <polygon points="76,44 84,60 92,72 86,74" fill="#cbd5e1" />
        <path d="M 52 30 L 86 30 C 108 30, 126 46, 126 72 C 126 88, 116 104, 98 110 L 98 98 C 110 92, 114 82, 114 72 C 114 54, 102 42, 82 42 L 52 42 Z" fill="#ffffff" />
        <path d="M 16 110 C 10 132, 34 146, 74 146 C 110 146, 140 130, 150 102 L 138 98 C 128 120, 102 134, 74 134 C 44 134, 26 122, 28 106 C 30 96, 40 86, 58 76 L 52 66 C 32 78, 18 92, 16 110 Z" fill="url(#drukEmblemSwoosh)" />
        <path d="M 134 90 L 162 84 L 152 118 L 144 100 L 134 90 Z" fill="url(#drukEmblemSwoosh)" />
      </svg>

      {/* Typography */}
      <div className="flex flex-col leading-none">
        <div className="flex items-baseline font-black tracking-tight">
          <span className={`${currentText.text} font-black ${isLight ? 'text-white drop-shadow-md' : 'text-[#0c234a]'} tracking-tight`}>
            Druk
          </span>
          <span className={`${currentText.text} font-black ${isLight ? 'text-sky-300 drop-shadow-md' : 'text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-400'} ml-1.5`}>
            ERP
          </span>
        </div>
        
        {variant !== 'compact' && (
          <div className={`mt-0.5 font-bold ${isLight ? 'text-blue-100 drop-shadow-xs' : 'text-slate-700'} tracking-tight leading-tight`}>
            <p className={currentText.sub}>Everything Your Business Needs,</p>
            <p className={currentText.sub}>in One Place.</p>
          </div>
        )}
      </div>
    </div>
  );
};
