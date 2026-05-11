interface SkeletonProps {
  className?: string;
  count?: number;
}

export function Skeleton({ className = 'h-4 w-full' }: SkeletonProps) {
  return <div className={`skeleton ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="glass-card p-5 space-y-3">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-3 w-40" />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="glass-card p-4 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-20" />
      </div>
      <Skeleton className="h-3 w-3/4" />
    </div>
  );
}
