import type { InputHTMLAttributes, ReactNode } from 'react';
import { forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  leftIcon?: ReactNode;
  rightAddon?: ReactNode;
  fullWidth?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, leftIcon, rightAddon, fullWidth = true, className = '', ...rest },
  ref,
) {
  const id = rest.id || rest.name;
  return (
    <div className={fullWidth ? 'w-full' : ''}>
      {label && (
        <label htmlFor={id} className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none">
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          id={id}
          className={`w-full bg-[var(--bg-elevated)] border ${
            error ? 'border-rose-500/50' : 'border-[var(--border-strong)] focus:border-indigo-500/60'
          } rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition-colors ${
            leftIcon ? 'pl-10' : ''
          } ${rightAddon ? 'pr-12' : ''} ${className}`}
          {...rest}
        />
        {rightAddon && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">{rightAddon}</div>
        )}
      </div>
      {hint && !error && <p className="text-[11px] text-[var(--text-muted)] mt-1">{hint}</p>}
      {error && <p className="text-[11px] text-rose-400 mt-1">{error}</p>}
    </div>
  );
});

export default Input;
