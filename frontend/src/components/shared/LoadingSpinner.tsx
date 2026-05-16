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
          <Brain size={sizeMap[size]} className="text-[#4a3f44] animate-pulse" />
          <div className="absolute -inset-2 rounded-full border-2 border-[#4a3f44]/20 border-t-[#4a3f44] animate-spin" />
        </div>
      ) : (
        <Loader2 size={sizeMap[size]} className="text-[#4a3f44] animate-spin" />
      )}
      {message && (
        <p className="text-gray-500 text-sm">
          {ai ? `🤖 ${message}` : message}
        </p>
      )}
    </div>
  );
}
