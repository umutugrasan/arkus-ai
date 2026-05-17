import { useState, useEffect } from 'react';
import { FileText, Plus, Loader2, Calendar, DollarSign, TrendingUp, X } from 'lucide-react';
import GlassCard from '../components/shared/GlassCard';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import EmptyState from '../components/shared/EmptyState';
import StreamingMarkdown from '../components/shared/StreamingMarkdown';
import { reportService } from '../services';
import { streamSSE } from '../utils/streaming';
import { formatCurrency, formatDate, formatNumber } from '../utils/formatters';
import { useI18n } from '../context/I18nContext';
import type { ReportItem } from '../types/api';

// ReportsListResponse.reports is Omit<ReportItem, 'content'> & { preview: string }
type ReportListItem = Omit<ReportItem, 'content'> & { preview: string };

export default function ReportsPage() {
  const { t } = useI18n();
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<'daily' | 'weekly' | null>(null);
  const [streamText, setStreamText] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'daily' | 'weekly'>('all');

  const fetchReports = async () => {
    const res = await reportService.list(
      filterType === 'all' ? undefined : filterType, 50
    );
    setReports(res.reports as ReportListItem[]);
  };

  useEffect(() => {
    setLoading(true);
    fetchReports().finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType]);

  const handleStream = async (type: 'daily' | 'weekly') => {
    setGenerating(type);
    setStreamText('');
    setStreaming(true);
    const url = type === 'daily'
      ? reportService.generateDailyStreamUrl()
      : reportService.generateWeeklyStreamUrl();
    let accumulated = '';
    let streamFailed = false;
    try {
      await streamSSE(
        url,
        {
          onChunk: (chunk) => {
            accumulated += chunk;
            setStreamText(accumulated);
          },
          onDone: (data) => {
            const full = typeof data.full_text === 'string' ? data.full_text : '';
            if (full) {
              accumulated = full;
              setStreamText(accumulated);
            }
            if (data.error) streamFailed = true;
          },
          onError: () => { streamFailed = true; },
        },
        { method: 'POST' },
      );
      if (streamFailed && !accumulated) {
        const res = type === 'daily' ? await reportService.generateDaily(true) : await reportService.generateWeekly(true);
        setStreamText(res.content || '');
      }
    } catch {
      try {
        const res = type === 'daily' ? await reportService.generateDaily(true) : await reportService.generateWeekly(true);
        setStreamText(res.content || '');
      } catch { /* ignore */ }
    } finally {
      setStreaming(false);
      setGenerating(null);
      await fetchReports();
    }
  };

  const handleViewReport = async (item: ReportListItem) => {
    setSelectedReport({ ...item, content: t('common.loading') } as ReportItem);
    try {
      const full = await reportService.byId(item.id);
      setSelectedReport(full);
    } catch {
      setSelectedReport({ ...item, content: t('reports.load_failed') } as ReportItem);
    }
  };

  if (loading) return <LoadingSpinner message={t('reports.loading')} size="lg" />;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Actions */}
      <GlassCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-[var(--text-primary)] font-semibold">{t('reports.title')}</h3>
            <p className="text-[var(--text-muted)] text-sm mt-0.5">{t('reports.subtitle')}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => handleStream('daily')} disabled={!!generating}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-fg)] rounded-xl text-sm font-medium transition-all disabled:opacity-50">
              {generating === 'daily' ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {t('reports.daily_btn')}
            </button>
            <button onClick={() => handleStream('weekly')} disabled={!!generating}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-solid-hover)] hover:bg-[var(--accent-solid)] text-[var(--accent-fg)] rounded-xl text-sm font-medium transition-all disabled:opacity-50">
              {generating === 'weekly' ? <Loader2 size={14} className="animate-spin" /> : <Calendar size={14} />}
              {t('reports.weekly_btn')}
            </button>
          </div>
        </div>
      </GlassCard>

      {/* Streaming Report */}
      {(streaming || streamText) && (
        <StreamingMarkdown content={streamText} streaming={streaming} title={generating === 'weekly' ? t('reports.weekly_generating') : t('reports.daily_generating')} />
      )}

      {/* Filter */}
      <div className="flex gap-2">
        {(['all', 'daily', 'weekly'] as const).map(f => (
          <button key={f} onClick={() => setFilterType(f)}
            className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
              filterType === f ? 'bg-[var(--accent-solid)] text-[var(--accent-fg)]' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}>
            {f === 'all' ? t('reports.filter_all') : f === 'daily' ? `📅 ${t('reports.daily')}` : `📊 ${t('reports.weekly')}`}
          </button>
        ))}
      </div>

      {/* Reports List */}
      {reports.length === 0
        ? <EmptyState title={t('reports.empty_title')} description={t('reports.empty_desc')} />
        : (
          <div className="space-y-3">
            {reports.map(r => (
              <GlassCard key={r.id} className="cursor-pointer hover:border-[var(--border-strong)] transition-all"
                onClick={() => handleViewReport(r)}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-xl ${r.type === 'daily' ? 'bg-indigo-50' : 'bg-violet-500/20'}`}>
                      <FileText size={16} className={r.type === 'daily' ? 'text-indigo-600 dark:text-indigo-300' : 'text-violet-500'} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-[var(--text-primary)] font-semibold text-sm">{r.title}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          r.type === 'daily' ? 'bg-indigo-50 text-indigo-600 dark:text-indigo-300' : 'bg-violet-500/20 text-violet-500'
                        }`}>{r.type === 'daily' ? t('reports.daily') : t('reports.weekly')}</span>
                      </div>
                      <p className="text-[var(--text-muted)] text-xs mt-0.5">{formatDate(r.created_at)}</p>
                      {r.preview && <p className="text-[var(--text-muted)] text-xs mt-1 line-clamp-2">{r.preview}</p>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[var(--text-muted)] text-xs">{t('financials.revenue')}</p>
                    <p className="text-[var(--text-primary)] font-semibold text-sm">{formatCurrency(r.revenue)}</p>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        )
      }

      {/* Rapor Detay Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setSelectedReport(null)}>
          <div className="bg-[var(--bg-card)] border border-[var(--border-strong)] rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-[var(--border-color)]">
              <div>
                <p className="text-[var(--text-primary)] font-semibold">{selectedReport.title}</p>
                <p className="text-[var(--text-muted)] text-xs mt-0.5">{formatDate(selectedReport.created_at)}</p>
              </div>
              <button onClick={() => setSelectedReport(null)} className="p-2 hover:bg-[var(--bg-muted)] rounded-xl transition-colors">
                <X size={16} className="text-[var(--text-muted)]" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3 p-5 border-b border-[var(--border-color)]">
              {[
                { icon: <DollarSign size={14} />, label: t('financials.revenue'), value: formatCurrency(selectedReport.revenue) },
                { icon: <TrendingUp size={14} />, label: t('common.net_profit'), value: formatCurrency(selectedReport.net_profit) },
                { icon: <FileText size={14} />, label: t('common.sales'), value: formatNumber(selectedReport.sales) },
              ].map(m => (
                <div key={m.label} className="p-3 bg-[var(--bg-elevated)] rounded-xl text-center">
                  <div className="flex justify-center text-[var(--text-muted)] mb-1">{m.icon}</div>
                  <p className="text-[var(--text-primary)] font-bold">{m.value}</p>
                  <p className="text-[var(--text-muted)] text-xs">{m.label}</p>
                </div>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <StreamingMarkdown content={selectedReport.content || ''} title={selectedReport.title} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
