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
  const sizeMap = {
    xs: { height: 'h-6 sm:h-7', text: 'text-base sm:text-lg', sub: 'text-[8px]' },
    sm: { height: 'h-8 sm:h-9', text: 'text-xl sm:text-2xl', sub: 'text-[9px]' },
    md: { height: 'h-11 sm:h-13', text: 'text-2xl sm:text-3xl', sub: 'text-[10px] sm:text-[11px]' },
    lg: { height: 'h-14 sm:h-18', text: 'text-3xl sm:text-4xl lg:text-5xl', sub: 'text-xs sm:text-sm' },
    xl: { height: 'h-18 sm:h-24', text: 'text-4xl sm:text-5xl lg:text-6xl', sub: 'text-sm sm:text-base' }
  };

  const currentSize = sizeMap[size];

  return (
    <div className={`inline-flex items-center gap-2.5 sm:gap-3.5 text-left select-none ${className}`}>
      {/* Official Druk ERP Himalayan Mountain 'D' Emblem with Upward Orbital Swoosh Arrow */}
      <svg 
        className={`${currentSize.height} w-auto shrink-0 drop-shadow-sm transition-transform hover:scale-105 duration-200`} 
        viewBox="0 0 160 145" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Main Blue Gradient for the capital 'D' */}
          <linearGradient id="drukDGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e3a8a" />
            <stop offset="35%" stopColor="#2563eb" />
            <stop offset="85%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#60a5fa" />
          </linearGradient>

          {/* Upward Curved Growth Swoosh Arrow Gradient */}
          <linearGradient id="drukSwooshGrad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#1d4ed8" />
            <stop offset="45%" stopColor="#0284c7" />
            <stop offset="80%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#7dd3fc" />
          </linearGradient>

          {/* Deep Navy Mountain Shadow */}
          <linearGradient id="mountainDarkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#1e3a8a" />
          </linearGradient>
        </defs>

        {/* 1. Main Capital 'D' Shape with Soft Curved Spine and Arc */}
        <path
          d="M 28 8 L 88 8 C 122 8, 146 32, 146 68 C 146 102, 122 124, 88 124 L 28 124 Z"
          fill="url(#drukDGrad)"
        />

        {/* 2. Inner Mountain Peaks Cutout / Facets */}
        {/* Mountain Base & Dark Shadow Right Facet */}
        <path
          d="M 68 38 L 96 98 L 68 98 Z"
          fill="url(#mountainDarkGrad)"
        />
        <path
          d="M 96 98 L 112 116 L 86 116 Z"
          fill="#0c234a"
        />

        {/* White Snow Peak Left Ridge & Facet */}
        <path
          d="M 68 38 L 40 102 L 58 102 L 68 62 L 78 98 L 68 98 Z"
          fill="#ffffff"
        />
        {/* Snow Cap Detail on Main Summit */}
        <polygon points="68,38 60,60 74,56" fill="#ffffff" />
        <polygon points="68,38 74,56 82,68 76,70" fill="#e2e8f0" />

        {/* Inner negative space contour creating the D counter */}
        <path
          d="M 44 26 L 82 26 C 108 26, 126 44, 126 68 C 126 84, 116 100, 98 106 L 98 94 C 110 88, 114 78, 114 68 C 114 50, 102 38, 80 38 L 44 38 Z"
          fill="#ffffff"
          opacity="0.95"
        />

        {/* 3. Upward Orbital Swoosh Ring wrapping from bottom left to top right */}
        <path
          d="M 12 108 C 6 128, 30 142, 68 142 C 104 142, 134 126, 145 98 L 134 94 C 124 116, 98 130, 68 130 C 38 130, 20 118, 22 104 C 24 94, 34 84, 52 74 L 46 64 C 26 76, 14 90, 12 108 Z"
          fill="url(#drukSwooshGrad)"
        />

        {/* 4. Swoosh Arrow Head pointing upward and to the right (↗) */}
        <path
          d="M 128 88 L 156 82 L 146 114 L 138 98 L 128 88 Z"
          fill="url(#drukSwooshGrad)"
        />
      </svg>

      {/* Brand Text Block (Unless variant is 'icon') */}
      {variant !== 'icon' && (
        <div className="flex flex-col leading-none">
          <div className="flex items-baseline font-black tracking-tight">
            <span className={`${currentSize.text} font-black ${variant === 'light' ? 'text-white drop-shadow-md' : 'text-[#0b192c]'} tracking-tight`}>
              Druk
            </span>
            <span className={`${currentSize.text} font-black ${variant === 'light' ? 'text-sky-300 drop-shadow-md' : 'text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-400'} ml-1.5 sm:ml-2`}>
              ERP
            </span>
          </div>
          
          {variant !== 'compact' && (
            <div className={`mt-0.5 sm:mt-1 font-bold ${variant === 'light' ? 'text-blue-100 drop-shadow-xs' : 'text-slate-700'} tracking-tight leading-tight`}>
              <p className={currentSize.sub}>Everything Your Business Needs,</p>
              <p className={currentSize.sub}>in One Place.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
