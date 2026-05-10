import { useEffect, useState } from 'react';
import { FileText, Loader2, Calendar, TrendingUp } from 'lucide-react';
import { reportService } from '../services';
import GlassCard from '../components/shared/GlassCard';
import AIResponseBox from '../components/shared/AIResponseBox';
import { formatCurrency, formatNumber } from '../utils/formatters';

interface Report {
  id: string;
  type: string;
  title: string;
  content: string;
  metrics: { revenue: number; profit: number; sales: number };
  created_at: string;
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [selected, setSelected] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<'daily' | 'weekly' | null>(null);

  useEffect(() => {
    reportService.list().then(r => setReports(r.reports || [])).finally(() => setLoading(false));
  }, []);

  const handleGenerate = async (type: 'daily' | 'weekly') => {
    setGenerating(type);
    try {
      const newReport = type === 'daily' ? await reportService.generateDaily() : await reportService.generateWeekly();
      setReports(r => [newReport, ...r]);
      setSelected(newReport);
    } finally { setGenerating(null); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Generate Buttons */}
      <div className="grid sm:grid-cols-2 gap-4">
        {[
          { type: 'daily', label: '📅 Günlük Rapor Oluştur', sub: 'Bugünün özet analizi' },
          { type: 'weekly', label: '📊 Haftalık Rapor Oluştur', sub: 'Haftalık performans analizi' },
        ].map(({ type, label, sub }) => (
          <button
            key={type}
            onClick={() => handleGenerate(type as 'daily' | 'weekly')}
            disabled={!!generating}
            className="glass-card p-5 text-left hover:border-indigo-500/40 transition-all hover:bg-indigo-500/5 group disabled:opacity-50"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-white font-semibold group-hover:text-indigo-300 transition-colors">{label}</p>
                <p className="text-slate-400 text-sm mt-1">{sub}</p>
              </div>
              {generating === type ? (
                <Loader2 size={20} className="text-indigo-400 animate-spin" />
              ) : (
                <FileText size={20} className="text-slate-500 group-hover:text-indigo-400 transition-colors" />
              )}
            </div>
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Report List */}
        <div className="lg:col-span-1 space-y-3">
          <h3 className="text-white font-semibold">Rapor Geçmişi</h3>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 size={24} className="text-indigo-400 animate-spin" /></div>
          ) : reports.length === 0 ? (
            <GlassCard className="text-center py-8">
              <FileText size={32} className="text-slate-600 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">Henüz rapor oluşturulmadı.</p>
            </GlassCard>
          ) : (
            reports.map(r => (
              <GlassCard
                key={r.id}
                hover
                onClick={() => setSelected(r)}
                className={`${selected?.id === r.id ? 'border border-indigo-500/40 bg-indigo-500/5' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${r.type === 'daily' ? 'bg-blue-500/20' : 'bg-violet-500/20'}`}>
                    {r.type === 'daily' ? <Calendar size={14} className="text-blue-400" /> : <TrendingUp size={14} className="text-violet-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-medium truncate">{r.title}</p>
                    <p className="text-slate-500 text-xs mt-0.5">{r.created_at}</p>
                    <div className="flex gap-3 mt-1">
                      <span className="text-slate-400 text-xs">{formatCurrency(r.metrics.revenue)}</span>
                      <span className="text-emerald-400 text-xs">{formatCurrency(r.metrics.profit)}</span>
                    </div>
                  </div>
                </div>
              </GlassCard>
            ))
          )}
        </div>

        {/* Report Detail */}
        <div className="lg:col-span-2">
          {selected ? (
            <div className="space-y-4">
              <GlassCard className="bg-slate-800/30">
                <h3 className="text-white font-bold text-lg">{selected.title}</h3>
                <p className="text-slate-400 text-xs mt-1">{selected.created_at}</p>
                <div className="grid grid-cols-3 gap-3 mt-4">
                  {[
                    { label: 'Gelir', value: formatCurrency(selected.metrics.revenue), color: 'text-indigo-400' },
                    { label: 'Net Kâr', value: formatCurrency(selected.metrics.profit), color: 'text-emerald-400' },
                    { label: 'Satış', value: formatNumber(selected.metrics.sales), color: 'text-violet-400' },
                  ].map(m => (
                    <div key={m.label} className="glass-card p-3 text-center">
                      <p className="text-slate-400 text-xs">{m.label}</p>
                      <p className={`font-bold mt-1 ${m.color}`}>{m.value}</p>
                    </div>
                  ))}
                </div>
              </GlassCard>
              <AIResponseBox content={selected.content} title={`${selected.type === 'daily' ? 'Günlük' : 'Haftalık'} Rapor`} />
            </div>
          ) : (
            <GlassCard className="h-full flex flex-col items-center justify-center py-16 text-center">
              <FileText size={48} className="text-slate-700 mb-3" />
              <p className="text-slate-400">Görüntülemek için bir rapor seçin</p>
              <p className="text-slate-600 text-sm mt-1">veya yeni rapor oluşturun</p>
            </GlassCard>
          )}
        </div>
      </div>
    </div>
  );
}
