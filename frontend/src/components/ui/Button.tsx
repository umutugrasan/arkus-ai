import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

const VARIANT: Record<Variant, string> = {
  primary:
    'bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white shadow-lg shadow-indigo-500/30 disabled:opacity-50',
  secondary:
    'bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700 text-slate-200 disabled:opacity-50',
  ghost:
    'bg-transparent hover:bg-slate-800/60 text-slate-300 disabled:opacity-50',
  danger:
    'bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-500/30 disabled:opacity-50',
  success:
    'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/30 disabled:opacity-50',
};

const SIZE: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-3 text-base',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  loading,
  leftIcon,
  rightIcon,
  fullWidth,
  children,
  disabled,
  className = '',
  ...rest
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all ${VARIANT[variant]} ${SIZE[size]} ${
        fullWidth ? 'w-full' : ''
      } ${className}`}
      {...rest}
    >
      {loading ? <Loader2 size={size === 'lg' ? 18 : 14} className="animate-spin" /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  );
}
