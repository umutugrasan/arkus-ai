import { useState, useEffect } from 'react';
import { FileText, Plus, Loader2, Calendar, DollarSign, TrendingUp, X } from 'lucide-react';
import GlassCard from '../components/shared/GlassCard';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import EmptyState from '../components/shared/EmptyState';
import StreamingMarkdown from '../components/shared/StreamingMarkdown';
import { reportService } from '../services';
import { tokenStorage } from '../api/client';
import { formatCurrency, formatDate, formatNumber } from '../utils/formatters';
import type { ReportItem } from '../types/api';

// ReportsListResponse.reports is Omit<ReportItem, 'content'> & { preview: string }
type ReportListItem = Omit<ReportItem, 'content'> & { preview: string };

export default function ReportsPage() {
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
    try {
      const token = tokenStorage.getAccess() || '';
      const url = type === 'daily' ? '/api/v1/reports/daily/stream' : '/api/v1/reports/weekly/stream';
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!resp.ok || !resp.body) throw new Error('Stream başlatılamadı');
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (line.startsWith('data:')) {
            try {
              const data = JSON.parse(line.slice(5).trim());
              if (data.text) { accumulated += data.text; setStreamText(accumulated); }
              if (data.full_text) { accumulated = data.full_text; setStreamText(accumulated); }
            } catch { /* ignore */ }
          }
        }
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
    setSelectedReport({ ...item, content: 'Yükleniyor...' } as ReportItem);
    try {
      const full = await reportService.byId(item.id);
      setSelectedReport(full);
    } catch {
      setSelectedReport({ ...item, content: 'Rapor yüklenemedi.' } as ReportItem);
    }
  };

  if (loading) return <LoadingSpinner message="Raporlar yükleniyor…" size="lg" />;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Actions */}
      <GlassCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-white font-semibold">AI Raporlar</h3>
            <p className="text-slate-400 text-sm mt-0.5">Gemini destekli otomatik performans raporları</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => handleStream('daily')} disabled={!!generating}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50">
              {generating === 'daily' ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Günlük Rapor
            </button>
            <button onClick={() => handleStream('weekly')} disabled={!!generating}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50">
              {generating === 'weekly' ? <Loader2 size={14} className="animate-spin" /> : <Calendar size={14} />}
              Haftalık Rapor
            </button>
          </div>
        </div>
      </GlassCard>

      {/* Streaming Report */}
      {(streaming || streamText) && (
        <StreamingMarkdown content={streamText} streaming={streaming} title={generating === 'weekly' ? 'Haftalık Rapor Oluşturuluyor' : 'Günlük Rapor Oluşturuluyor'} />
      )}

      {/* Filter */}
      <div className="flex gap-2">
        {(['all', 'daily', 'weekly'] as const).map(f => (
          <button key={f} onClick={() => setFilterType(f)}
            className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
              filterType === f ? 'bg-indigo-600 text-white' : 'bg-slate-800/60 text-slate-400 hover:text-white'
            }`}>
            {f === 'all' ? 'Tümü' : f === 'daily' ? '📅 Günlük' : '📊 Haftalık'}
          </button>
        ))}
      </div>

      {/* Reports List */}
      {reports.length === 0
        ? <EmptyState title="Rapor Yok" description='Yukarıdaki butonları kullanarak ilk raporunuzu oluşturun.' />
        : (
          <div className="space-y-3">
            {reports.map(r => (
              <GlassCard key={r.id} className="cursor-pointer hover:border-slate-600 transition-all"
                onClick={() => handleViewReport(r)}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-xl ${r.type === 'daily' ? 'bg-indigo-500/20' : 'bg-violet-500/20'}`}>
                      <FileText size={16} className={r.type === 'daily' ? 'text-indigo-400' : 'text-violet-400'} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-white font-semibold text-sm">{r.title}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          r.type === 'daily' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-violet-500/20 text-violet-400'
                        }`}>{r.type === 'daily' ? 'Günlük' : 'Haftalık'}</span>
                      </div>
                      <p className="text-slate-400 text-xs mt-0.5">{formatDate(r.created_at)}</p>
                      {r.preview && <p className="text-slate-500 text-xs mt-1 line-clamp-2">{r.preview}</p>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-slate-400 text-xs">Gelir</p>
                    <p className="text-white font-semibold text-sm">{formatCurrency(r.revenue)}</p>
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
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-700/50">
              <div>
                <p className="text-white font-semibold">{selectedReport.title}</p>
                <p className="text-slate-400 text-xs mt-0.5">{formatDate(selectedReport.created_at)}</p>
              </div>
              <button onClick={() => setSelectedReport(null)} className="p-2 hover:bg-slate-800 rounded-xl transition-colors">
                <X size={16} className="text-slate-400" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3 p-5 border-b border-slate-700/50">
              {[
                { icon: <DollarSign size={14} />, label: 'Gelir', value: formatCurrency(selectedReport.revenue) },
                { icon: <TrendingUp size={14} />, label: 'Net Kâr', value: formatCurrency(selectedReport.net_profit) },
                { icon: <FileText size={14} />, label: 'Satış', value: formatNumber(selectedReport.sales) },
              ].map(m => (
                <div key={m.label} className="p-3 bg-slate-800/50 rounded-xl text-center">
                  <div className="flex justify-center text-slate-400 mb-1">{m.icon}</div>
                  <p className="text-white font-bold">{m.value}</p>
                  <p className="text-slate-400 text-xs">{m.label}</p>
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
