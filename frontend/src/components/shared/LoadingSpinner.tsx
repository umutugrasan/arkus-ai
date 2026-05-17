import { Loader2, Brain } from 'lucide-react';

interface LoadingSpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  ai?: boolean;
}

export default function LoadingSpinner({ message = 'Yükleniyor...', size = 'md', ai = false }: LoadingSpinnerProps) {
  const sizeMap = { sm: 16, md: 24, lg: 40 };
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8">
      {ai ? (
        <div className="relative">
          <Brain size={sizeMap[size]} className="text-[var(--accent)] animate-pulse" />
          <div className="absolute -inset-2 rounded-full border-2 border-[var(--accent)]/20 border-t-[var(--accent)] animate-spin" />
        </div>
      ) : (
        <Loader2 size={sizeMap[size]} className="text-[var(--accent)] animate-spin" />
      )}
      {message && (
        <p className="text-[var(--text-muted)] text-sm">
          {ai ? `🤖 ${message}` : message}
        </p>
      )}
    </div>
  );
}
