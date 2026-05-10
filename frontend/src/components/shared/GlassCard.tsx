import { type ReactNode } from 'react';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  hover?: boolean;
}

export default function GlassCard({ children, className = '', onClick, hover = false }: GlassCardProps) {
  return (
    <div
      onClick={onClick}
      className={`glass-card p-4 transition-all duration-200 ${hover ? 'hover:border-indigo-500/40 hover:shadow-lg hover:shadow-indigo-500/10 cursor-pointer' : ''} ${className}`}
    >
      {children}
    </div>
  );
}
