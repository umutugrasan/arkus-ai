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
    'bg-[#4a3f44] hover:bg-[#6b6266] text-white shadow-lg shadow-[#4a3f44]/20 disabled:opacity-50',
  secondary:
    'bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 disabled:opacity-50',
  ghost:
    'bg-transparent hover:bg-gray-50 text-gray-600 disabled:opacity-50',
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
