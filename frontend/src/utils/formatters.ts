// Defensive formatters — undefined/null/NaN durumlarda crash etmesin
export const formatCurrency = (value: number | null | undefined): string => {
  const v = typeof value === 'number' && !isNaN(value) ? value : 0;
  if (v >= 1_000_000) return `₺${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `₺${(v / 1_000).toFixed(1)}K`;
  return `₺${v.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

export const formatPercent = (value: number | null | undefined): string => {
  const v = typeof value === 'number' && !isNaN(value) ? value : 0;
  return `%${v.toFixed(1)}`;
};

export const formatNumber = (value: number | null | undefined): string => {
  const v = typeof value === 'number' && !isNaN(value) ? value : 0;
  return v.toLocaleString('tr-TR');
};

export const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const formatScore = (value: number | null | undefined): string => {
  const v = typeof value === 'number' && !isNaN(value) ? value : 0;
  return `${Math.round(v)}/100`;
};

export const scoreColor = (score: number | null | undefined): string => {
  const s = typeof score === 'number' && !isNaN(score) ? score : 0;
  if (s >= 80) return 'text-green-400';
  if (s >= 60) return 'text-yellow-400';
  if (s >= 40) return 'text-orange-400';
  return 'text-red-400';
};

export const scoreBgColor = (score: number | null | undefined): string => {
  const s = typeof score === 'number' && !isNaN(score) ? score : 0;
  if (s >= 80) return 'bg-green-500';
  if (s >= 60) return 'bg-yellow-500';
  if (s >= 40) return 'bg-orange-500';
  return 'bg-red-500';
};
