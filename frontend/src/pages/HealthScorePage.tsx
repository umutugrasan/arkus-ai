import { useState, useEffect } from 'react';
import { Brain } from 'lucide-react';
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
import GlassCard from '../components/shared/GlassCard';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import StreamingMarkdown from '../components/shared/StreamingMarkdown';
import { healthScoreService } from '../services';
import { formatCurrency, formatPercent } from '../utils/formatters';
import { useI18n } from '../context/I18nContext';
import { useTheme } from '../hooks/useTheme';
import { getChartTheme } from '../utils/chartTheme';
import { useBackgroundAnalysis } from '../context/AnalysisContext';
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
    A: { text: 'text-emerald-500', bg: 'from-emerald-500/30 to-emerald-600/10', ring: '#10b981' },
    B: { text: 'text-indigo-600 dark:text-indigo-300', bg: 'from-indigo-500/30 to-indigo-600/10', ring: '#6366f1' },
    C: { text: 'text-amber-500', bg: 'from-amber-500/30 to-amber-600/10', ring: '#f59e0b' },
    D: { text: 'text-rose-500', bg: 'from-rose-500/30 to-rose-600/10', ring: '#ef4444' },
  };
  const cfg = gradeConfig[grade] || gradeConfig.C;

  const gaugeData = [{ value: totalScore, fill: cfg.ring }];
  const historyData = (history?.history || []).filter(h => h.month !== 'current');

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Ana Skor Kartı */}
      <div className="grid md:grid-cols-3 gap-6">
        <GlassCard className={`md:col-span-1 bg-gradient-to-br ${cfg.bg}`}>
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

        <GlassCard className="md:col-span-2">
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
        <GlassCard>
          <h3 className="text-[var(--text-primary)] font-semibold mb-4">{t('health.breakdown_title')}</h3>
          <div className="space-y-3">
            {(breakdown.breakdown || []).map((item) => {
              const pct = item.percentage;
              const barColor = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-indigo-500' : pct >= 30 ? 'bg-amber-500' : 'bg-rose-500';
              return (
                <div key={item.category}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[var(--text-secondary)] text-sm">{categoryLabel(item.category)}</span>
                    <span className="text-[var(--text-primary)] font-semibold text-sm">{item.score}/{item.max_score}</span>
                  </div>
                  <div className="h-2 bg-[var(--bg-muted)] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}

      {/* Tarihçe Grafiği */}
      {historyData.length > 0 && (
        <GlassCard>
          <h3 className="text-[var(--text-primary)] font-semibold mb-4">{t('health.history_title')}</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={historyData}>
              <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
              <XAxis dataKey="month" tick={{ fill: chart.axis, fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fill: chart.axis, fontSize: 11 }} />
              <Tooltip contentStyle={{ background: chart.tooltipBg, border: `1px solid ${chart.tooltipBorder}`, borderRadius: 8 }}
                labelStyle={{ color: chart.tooltipText }} itemStyle={{ color: chart.tooltipText }}
                formatter={(value) => `${value}/100`} />
              <Line type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </GlassCard>
      )}

      {/* AI Analiz */}
      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[var(--text-primary)] font-semibold flex items-center gap-2"><Brain size={16} className="text-indigo-600 dark:text-indigo-300" /> {t('health.ai_title')}</h3>
          <button onClick={handleAiAnalysis} disabled={aiLoading}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-fg)] rounded-xl text-sm font-medium transition-all disabled:opacity-50">
            {aiLoading ? <><span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> {t('common.analyzing')}</> : <><Brain size={14} /> {t('common.analyze')}</>}
          </button>
        </div>
        {aiAnalysis
          ? <StreamingMarkdown content={aiAnalysis} title={t('health.ai_analysis_title')} />
          : <p className="text-[var(--text-muted)] text-sm">{t('health.ai_hint')}</p>
        }
      </GlassCard>
    </div>
  );
}
