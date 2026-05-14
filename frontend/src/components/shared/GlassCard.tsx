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
      className={`bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.01)] border border-gray-100 p-6 transition-all duration-200 ${hover ? 'hover:shadow-md cursor-pointer' : ''} ${className}`}
    >
      {children}
    </div>
  );
}
