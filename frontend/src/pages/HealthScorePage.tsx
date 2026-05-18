import { useState, useEffect } from 'react';
import { Brain } from 'lucide-react';
import {
  RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer,
  AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip,
} from 'recharts';
import { motion } from 'framer-motion';
import GlassCard from '../components/shared/GlassCard';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import StreamingMarkdown from '../components/shared/StreamingMarkdown';
import { healthScoreService } from '../services';
import { formatCurrency, formatPercent } from '../utils/formatters';
import { useI18n } from '../context/I18nContext';
import { useTheme } from '../hooks/useTheme';
import { getChartTheme } from '../utils/chartTheme';
import { useBackgroundAnalysis } from '../context/AnalysisContext';
import { pageVariants, staggerItem, staggerContainer } from '../utils/motion';
import type { TranslationKey } from '../i18n';
import type { HealthScoreResponse, HealthBreakdownResponse, HealthHistoryResponse } from '../types/api';

export default function HealthScorePage() {
  const { t } = useI18n();
  const { isDark } = useTheme();
  const chart = getChartTheme(isDark);
  const [score, setScore] = useState<HealthScoreResponse | null>(null);
  const [breakdown, setBreakdown] = useState<HealthBreakdownResponse | null>(null);
  const [history, setHistory] = useState<HealthHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const { text: aiAnalysis, isRunning: aiLoading, startFetch } = useBackgroundAnalysis({
    type: 'health',
    id: 'global',
    label: 'Sağlık Skoru Analizi',
    navigateTo: '/health',
  });

  const categoryLabel = (cat: string) => {
    const translated = t(`health.cat.${cat}` as TranslationKey);
    return translated === `health.cat.${cat}` ? cat : translated;
  };

  useEffect(() => {
    Promise.all([
      healthScoreService.score(),
      healthScoreService.breakdown(),
      healthScoreService.history(),
    ]).then(([s, b, h]) => {
      setScore(s);
      setBreakdown(b);
      setHistory(h);
    }).finally(() => setLoading(false));
  }, []);

  const handleAiAnalysis = () => {
    startFetch(async () => {
      const res = await healthScoreService.analyze(true);
      return res.ai_analysis || '';
    });
  };

  if (loading) return <LoadingSpinner message={t('health.loading')} size="lg" />;

  const totalScore = score?.total_score ?? 0;
  const grade = score?.grade ?? 'C';
  const label = score?.label ?? '';
  // HealthScoreResponse.metrics is typed with explicit fields
  const metrics = score?.metrics;

  const gradeConfig: Record<string, { text: string; bg: string; ring: string }> = {
    A: { text: 'text-emerald-500', bg: 'from-emerald-500/20 to-emerald-600/5', ring: '#7fae94' },
    B: { text: 'text-[var(--accent)]', bg: 'from-[var(--accent)]/20 to-[var(--accent)]/5', ring: '#6b6266' },
    C: { text: 'text-amber-500', bg: 'from-amber-500/20 to-amber-600/5', ring: '#d9a86a' },
    D: { text: 'text-rose-500', bg: 'from-rose-500/20 to-rose-600/5', ring: '#cf8a8a' },
  };
  const cfg = gradeConfig[grade] || gradeConfig.C;

  const gaugeData = [{ value: totalScore, fill: cfg.ring }];
  const historyData = (history?.history || []).filter(h => h.month !== 'current');

  return (
    <motion.div className="space-y-6" variants={pageVariants} initial="hidden" animate="visible">
      {/* Ana Skor Kartı */}
      <div className="grid md:grid-cols-3 gap-6">
        <GlassCard index={0} className={`md:col-span-1 bg-gradient-to-br ${cfg.bg}`}>
          <div className="flex flex-col items-center py-4">
            <div className="relative w-[180px] h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart cx="50%" cy="50%" innerRadius="70%" outerRadius="100%"
                  data={gaugeData} startAngle={180} endAngle={-180}>
                  <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                  <RadialBar background={{ fill: isDark ? '#3a2f33' : '#e5e7eb' }} dataKey="value" cornerRadius={10} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className={`text-5xl font-extrabold ${cfg.text}`}>{totalScore}</p>
                <p className="text-[var(--text-muted)] text-sm">/ 100</p>
              </div>
            </div>
            <div className="mt-4 text-center">
              <span className={`text-4xl font-bold ${cfg.text}`}>{grade}</span>
              <p className="text-[var(--text-primary)] font-medium mt-1">{label}</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard index={1} className="md:col-span-2">
          <h3 className="text-[var(--text-primary)] font-semibold mb-4">{t('health.metrics')}</h3>
          <div className="grid grid-cols-2 gap-3">
            {metrics && [
              { label: t('health.m_avg_rating'), value: metrics.avg_rating.toFixed(1) + ' ⭐' },
              { label: t('health.m_return_rate'), value: formatPercent(metrics.return_rate) },
              { label: t('health.m_net_margin'), value: formatPercent(metrics.net_margin) },
              { label: t('health.m_mp_count'), value: String(metrics.marketplace_count) },
              { label: t('health.m_total_products'), value: String(metrics.unique_products) },
              { label: t('health.m_monthly_profit'), value: formatCurrency(metrics.monthly_net_profit) },
            ].map(m => (
              <div key={m.label} className="p-3 bg-[var(--bg-elevated)] rounded-xl">
                <p className="text-[var(--text-muted)] text-xs">{m.label}</p>
                <p className="text-[var(--text-primary)] font-semibold mt-0.5">{m.value}</p>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* Kategori Breakdown */}
      {breakdown && (
        <motion.div variants={staggerItem}>
          <GlassCard index={2}>
            <h3 className="text-[var(--text-primary)] font-semibold mb-4">{t('health.breakdown_title')}</h3>
            <motion.div
              className="space-y-3"
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
            >
              {(breakdown.breakdown || []).map((item, idx) => {
                const pct = item.percentage;
                const barColor = pct >= 80 ? '#7fae94' : pct >= 50 ? '#6b6266' : pct >= 30 ? '#c9a05c' : '#cf8a8a';
                return (
                  <motion.div key={item.category} variants={staggerItem}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[var(--text-secondary)] text-sm">{categoryLabel(item.category)}</span>
                      <span className="text-[var(--text-primary)] font-semibold text-sm">{item.score}/{item.max_score}</span>
                    </div>
                    <div className="h-2 bg-[var(--bg-muted)] rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.7, ease: 'easeOut', delay: idx * 0.06 }}
                        style={{ background: barColor }}
                      />
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </GlassCard>
        </motion.div>
      )}

      {/* Tarihçe Grafiği — Dashboard stili AreaChart */}
      {historyData.length > 0 && (
        <motion.div variants={staggerItem}>
          <GlassCard index={3} className="p-5">
            <h3 className="text-[var(--text-primary)] font-bold mb-5">{t('health.history_title')}</h3>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={historyData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradScore" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"  stopColor="#6b6266" stopOpacity={0.22} />
                    <stop offset="85%" stopColor="#6b6266" stopOpacity={0.02} />
                    <stop offset="100%" stopColor="#6b6266" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  stroke={chart.grid}
                  strokeDasharray="4 4"
                  vertical={false}
                  strokeOpacity={0.7}
                />
                <XAxis
                  dataKey="month"
                  stroke={chart.axis}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  dy={4}
                />
                <YAxis
                  domain={[0, 100]}
                  stroke={chart.axis}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={32}
                  tickFormatter={(v: number) => String(v)}
                />
                <Tooltip
                  formatter={(value) => [`${value}/100`, t('health.history_title')]}
                  contentStyle={{
                    background: chart.tooltipBg,
                    border: `1px solid ${chart.tooltipBorder}`,
                    borderRadius: 10,
                    fontSize: 12,
                    boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
                    padding: '8px 12px',
                  }}
                  labelStyle={{ color: chart.tooltipText, fontWeight: 600, marginBottom: 4 }}
                  itemStyle={{ color: chart.tooltipText }}
                  cursor={{ stroke: chart.grid, strokeWidth: 1.5, strokeDasharray: '3 3' }}
                />
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke="#6b6266"
                  fillOpacity={1}
                  fill="url(#gradScore)"
                  strokeWidth={2.5}
                  dot={false}
                  connectNulls={true}
                  activeDot={{ r: 4, strokeWidth: 2, fill: '#6b6266' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </GlassCard>
        </motion.div>
      )}

      {/* AI Analiz */}
      <motion.div variants={staggerItem}>
        <GlassCard index={4}>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <h3 className="text-[var(--text-primary)] font-semibold flex items-center gap-2 flex-1"><Brain size={16} className="text-[var(--accent)]" /> {t('health.ai_title')}</h3>
            <motion.button
              onClick={handleAiAnalysis}
              disabled={aiLoading}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-fg)] rounded-xl text-sm font-medium transition-all disabled:opacity-50 shadow-[0_4px_16px_rgba(74,63,68,0.2)]"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {aiLoading ? <><span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> {t('common.analyzing')}</> : <><Brain size={14} /> {t('common.analyze')}</>}
            </motion.button>
          </div>
          {aiAnalysis
            ? <StreamingMarkdown content={aiAnalysis} title={t('health.ai_analysis_title')} />
            : <p className="text-[var(--text-muted)] text-sm">{t('health.ai_hint')}</p>
          }
        </GlassCard>
      </motion.div>
    </motion.div>
  );
}
