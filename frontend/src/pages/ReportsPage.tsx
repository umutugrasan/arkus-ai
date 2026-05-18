import { useState, useEffect } from 'react';
import { FileText, Plus, Loader2, Calendar, DollarSign, TrendingUp, X, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import GlassCard from '../components/shared/GlassCard';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import EmptyState from '../components/shared/EmptyState';
import StreamingMarkdown from '../components/shared/StreamingMarkdown';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import { reportService } from '../services';
import { streamSSE } from '../utils/streaming';
import { formatCurrency, formatDate, formatNumber } from '../utils/formatters';
import { useI18n } from '../context/I18nContext';
import { useToast } from '../context/ToastContext';
import { pageVariants, staggerContainer, staggerItem } from '../utils/motion';
import type { ReportItem } from '../types/api';

// ReportsListResponse.reports is Omit<ReportItem, 'content'> & { preview: string }
type ReportListItem = Omit<ReportItem, 'content'> & { preview: string };

export default function ReportsPage() {
  const { t } = useI18n();
  const toast = useToast();
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<'daily' | 'weekly' | null>(null);
  const [streamText, setStreamText] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'daily' | 'weekly'>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

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

  const handleDelete = async () => {
    if (confirmDeleteId == null) return;
    const id = confirmDeleteId;
    try {
      await reportService.delete(id);
      setReports(prev => prev.filter(r => r.id !== id));
      if (selectedReport?.id === id) setSelectedReport(null);
      toast.success(t('reports.delete_success'));
    } catch {
      toast.error(t('reports.delete_failed'));
    } finally {
      setConfirmDeleteId(null);
    }
  };

  if (loading) return <LoadingSpinner message={t('reports.loading')} size="lg" />;

  return (
    <motion.div
      className="space-y-6"
      variants={pageVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Actions */}
      <motion.div variants={staggerItem}>
        <GlassCard>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-[var(--accent)]/10 rounded-xl ring-1 ring-[var(--accent)]/15">
                <FileText size={18} className="text-[var(--accent)]" />
              </div>
              <div>
                <h3 className="text-[var(--text-primary)] font-semibold">{t('reports.title')}</h3>
                <p className="text-[var(--text-muted)] text-sm mt-0.5">{t('reports.subtitle')}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <motion.button
                onClick={() => handleStream('daily')}
                disabled={!!generating}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-fg)] rounded-xl text-sm font-medium transition-all disabled:opacity-50 shadow-[0_4px_16px_rgba(74,63,68,0.2)]"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {generating === 'daily' ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                {t('reports.daily_btn')}
              </motion.button>
              <motion.button
                onClick={() => handleStream('weekly')}
                disabled={!!generating}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-solid-hover)] hover:bg-[var(--accent-solid)] text-[var(--accent-fg)] rounded-xl text-sm font-medium transition-all disabled:opacity-50 shadow-[0_4px_16px_rgba(74,63,68,0.15)]"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {generating === 'weekly' ? <Loader2 size={14} className="animate-spin" /> : <Calendar size={14} />}
                {t('reports.weekly_btn')}
              </motion.button>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Streaming Report */}
      {(streaming || streamText) && (
        <motion.div variants={staggerItem}>
          <StreamingMarkdown
            content={streamText}
            streaming={streaming}
            title={generating === 'weekly' ? t('reports.weekly_generating') : t('reports.daily_generating')}
          />
        </motion.div>
      )}

      {/* Filter */}
      <motion.div variants={staggerItem} className="flex gap-2">
        {(['all', 'daily', 'weekly'] as const).map(f => (
          <button key={f} onClick={() => setFilterType(f)}
            className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
              filterType === f
                ? 'bg-[var(--accent-solid)] text-[var(--accent-fg)] shadow-sm'
                : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}>
            {f === 'all' ? t('reports.filter_all') : f === 'daily' ? `📅 ${t('reports.daily')}` : `📊 ${t('reports.weekly')}`}
          </button>
        ))}
      </motion.div>

      {/* Reports List */}
      {reports.length === 0
        ? <EmptyState title={t('reports.empty_title')} description={t('reports.empty_desc')} />
        : (
          <motion.div
            className="space-y-3"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {reports.map(r => (
              <motion.div key={r.id} variants={staggerItem}>
                <GlassCard
                  className="cursor-pointer hover:border-[var(--border-strong)] transition-all hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] group"
                  onClick={() => handleViewReport(r)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-xl bg-[var(--accent)]/10">
                        <FileText size={16} className="text-[var(--accent)]" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-[var(--text-primary)] font-semibold text-sm">{r.title}</p>
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-[var(--accent)]/10 text-[var(--accent)]">
                            {r.type === 'daily' ? t('reports.daily') : t('reports.weekly')}
                          </span>
                        </div>
                        <p className="text-[var(--text-muted)] text-xs mt-0.5">{formatDate(r.created_at)}</p>
                        {r.preview && <p className="text-[var(--text-muted)] text-xs mt-1 line-clamp-2">{r.preview}</p>}
                      </div>
                    </div>
                    <div className="flex items-start gap-3 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-[var(--text-muted)] text-xs">{t('financials.revenue')}</p>
                        <p className="text-[var(--text-primary)] font-semibold text-sm">{formatCurrency(r.revenue)}</p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(r.id); }}
                        aria-label={t('common.delete')}
                        title={t('common.delete')}
                        className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-rose-500 hover:bg-rose-500/10 transition-colors opacity-60 group-hover:opacity-100"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </motion.div>
        )
      }

      {/* Rapor Detay Modal */}
      {selectedReport && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setSelectedReport(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            className="bg-[var(--bg-card)] border border-[var(--border-strong)] rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col shadow-[0_24px_60px_rgba(0,0,0,0.2)]"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-[var(--border-color)]">
              <div>
                <p className="text-[var(--text-primary)] font-semibold">{selectedReport.title}</p>
                <p className="text-[var(--text-muted)] text-xs mt-0.5">{formatDate(selectedReport.created_at)}</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setConfirmDeleteId(selectedReport.id)}
                  aria-label={t('common.delete')}
                  title={t('common.delete')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-rose-500 hover:bg-rose-500/10 transition-colors"
                >
                  <Trash2 size={14} />
                  {t('common.delete')}
                </button>
                <button onClick={() => setSelectedReport(null)} className="p-2 hover:bg-[var(--bg-muted)] rounded-xl transition-colors">
                  <X size={16} className="text-[var(--text-muted)]" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 p-5 border-b border-[var(--border-color)]">
              {[
                { icon: <DollarSign size={14} />, label: t('financials.revenue'), value: formatCurrency(selectedReport.revenue) },
                { icon: <TrendingUp size={14} />, label: t('common.net_profit'), value: formatCurrency(selectedReport.net_profit) },
                { icon: <FileText size={14} />, label: t('common.sales'), value: formatNumber(selectedReport.sales) },
              ].map(m => (
                <div key={m.label} className="p-3 bg-[var(--bg-elevated)] rounded-xl text-center border border-[var(--border-color)]">
                  <div className="flex justify-center text-[var(--text-muted)] mb-1">{m.icon}</div>
                  <p className="text-[var(--text-primary)] font-bold">{m.value}</p>
                  <p className="text-[var(--text-muted)] text-xs">{m.label}</p>
                </div>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <StreamingMarkdown content={selectedReport.content || ''} title={selectedReport.title} />
            </div>
          </motion.div>
        </motion.div>
      )}

      <ConfirmDialog
        open={confirmDeleteId !== null}
        title={t('reports.delete_title')}
        message={t('reports.delete_msg')}
        confirmLabel={t('common.delete')}
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </motion.div>
  );
}
