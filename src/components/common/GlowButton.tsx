import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface GlowButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  icon?: LucideIcon;
  variant?: 'blue' | 'cyan' | 'emerald' | 'purple' | 'amber';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
}

export const GlowButton: React.FC<GlowButtonProps> = ({
  children,
  icon: Icon,
  variant = 'blue',
  size = 'md',
  fullWidth = false,
  loading = false,
  className = '',
  disabled,
  ...props
}) => {
  const variantStyles = {
    blue: {
      bg: 'bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-700 hover:from-cyan-400 hover:via-blue-500 hover:to-indigo-600',
      ring: 'ring-2 ring-cyan-300/70 shadow-[0_0_20px_rgba(37,99,235,0.5)] hover:shadow-[0_0_28px_rgba(6,182,212,0.7)]',
      border: 'border border-white/40',
      badgeBg: 'bg-white/20 border-white/30 text-white shadow-inner',
    },
    cyan: {
      bg: 'bg-gradient-to-r from-teal-400 via-cyan-500 to-blue-600 hover:from-teal-300 hover:via-cyan-400 hover:to-blue-500',
      ring: 'ring-2 ring-cyan-200/80 shadow-[0_0_20px_rgba(6,182,212,0.6)] hover:shadow-[0_0_28px_rgba(20,184,166,0.8)]',
      border: 'border border-white/40',
      badgeBg: 'bg-white/20 border-white/30 text-white shadow-inner',
    },
    emerald: {
      bg: 'bg-gradient-to-r from-emerald-400 via-teal-500 to-emerald-700 hover:from-emerald-300 hover:via-teal-400 hover:to-emerald-600',
      ring: 'ring-2 ring-emerald-300/80 shadow-[0_0_20px_rgba(16,185,129,0.5)] hover:shadow-[0_0_28px_rgba(52,211,153,0.7)]',
      border: 'border border-white/40',
      badgeBg: 'bg-white/20 border-white/30 text-white shadow-inner',
    },
    purple: {
      bg: 'bg-gradient-to-r from-fuchsia-500 via-purple-600 to-indigo-700 hover:from-fuchsia-400 hover:via-purple-500 hover:to-indigo-600',
      ring: 'ring-2 ring-fuchsia-300/80 shadow-[0_0_20px_rgba(168,85,247,0.5)] hover:shadow-[0_0_28px_rgba(217,70,239,0.7)]',
      border: 'border border-white/40',
      badgeBg: 'bg-white/20 border-white/30 text-white shadow-inner',
    },
    amber: {
      bg: 'bg-gradient-to-r from-amber-400 via-orange-500 to-amber-600 hover:from-amber-300 hover:via-orange-400 hover:to-amber-500',
      ring: 'ring-2 ring-amber-300/80 shadow-[0_0_20px_rgba(245,158,11,0.5)] hover:shadow-[0_0_28px_rgba(251,191,36,0.7)]',
      border: 'border border-white/40',
      badgeBg: 'bg-white/20 border-white/30 text-white shadow-inner',
    },
  };

  const sizeStyles = {
    sm: {
      padding: 'px-3.5 py-1.5 rounded-xl text-xs gap-2',
      iconSize: 'w-3.5 h-3.5',
      badgePadding: 'p-1 rounded-lg',
    },
    md: {
      padding: 'px-5 py-2.5 rounded-2xl text-sm gap-2.5',
      iconSize: 'w-4 h-4',
      badgePadding: 'p-1.5 rounded-xl',
    },
    lg: {
      padding: 'px-6 py-3.5 rounded-2xl text-base gap-3',
      iconSize: 'w-5 h-5',
      badgePadding: 'p-2 rounded-xl',
    },
  };

  const v = variantStyles[variant];
  const s = sizeStyles[size];

  return (
    <button
      disabled={disabled || loading}
      className={`
        relative inline-flex items-center justify-center font-extrabold text-white tracking-wide
        select-none overflow-hidden transition-all duration-200 transform
        active:scale-[0.97] hover:scale-[1.02]
        disabled:opacity-50 disabled:pointer-events-none disabled:transform-none
        ${v.bg} ${v.ring} ${v.border} ${s.padding}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      {...props}
    >
      {/* Top Gloss Highlights Line */}
      <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-white/80 to-transparent opacity-90 pointer-events-none" />

      {/* Gloss Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-black/20 pointer-events-none rounded-[inherit]" />

      {/* Icon Badge */}
      {Icon && (
        <span
          className={`
            relative z-10 inline-flex items-center justify-center backdrop-blur-md border transition-transform duration-200 group-hover:scale-110
            ${v.badgeBg} ${s.badgePadding}
          `}
        >
          <Icon className={`${s.iconSize} stroke-[2.5] drop-shadow-sm`} />
        </span>
      )}

      {/* Button Text */}
      <span className="relative z-10 drop-shadow-[0_1.5px_3px_rgba(0,0,0,0.6)] font-bold">
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Processing...
          </span>
        ) : (
          children
        )}
      </span>
    </button>
  );
};

export default GlowButton;
