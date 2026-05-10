import { MARKETPLACES } from '../../utils/constants';

interface MarketplaceBadgeProps {
  marketplace: string;
  size?: 'sm' | 'md';
}

export default function MarketplaceBadge({ marketplace, size = 'sm' }: MarketplaceBadgeProps) {
  const config = MARKETPLACES[marketplace] || { label: marketplace, bgColor: 'bg-slate-500/20', textColor: 'text-slate-400' };
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1';
  return (
    <span className={`inline-flex items-center rounded-full font-medium ${sizeClass} ${config.bgColor} ${config.textColor} border border-current/20`}>
      {config.label}
    </span>
  );
}
