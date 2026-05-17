export interface ChartTheme {
  grid: string;
  axis: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
}

/** Theme-aware colors for Recharts (SVG attributes can't use CSS classes). */
export function getChartTheme(isDark: boolean): ChartTheme {
  return isDark
    ? {
        grid: '#3a2f33',
        axis: '#847579',
        tooltipBg: '#261f23',
        tooltipBorder: '#3a2f33',
        tooltipText: '#e9e1e3',
      }
    : {
        grid: '#e5e7eb',
        axis: '#9ca3af',
        tooltipBg: '#ffffff',
        tooltipBorder: '#e5e7eb',
        tooltipText: '#1e293b',
      };
}
