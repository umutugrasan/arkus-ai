import { useState, useEffect } from 'react';
import { Brain } from 'lucide-react';
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
import GlassCard from '../components/shared/GlassCard';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import StreamingMarkdown from '../components/shared/StreamingMarkdown';
import { healthScoreService } from '../services';
import { formatCurrency, formatPercent } from '../utils/formatters';
import type { HealthScoreResponse, HealthBreakdownResponse, HealthHistoryResponse, HealthAnalyzeResponse } from '../types/api';

const CATEGORY_LABELS: Record<string, string> = {
  satis_trendi: 'Satış Trendi',
  kar_marji: 'Kâr Marjı',
  iade_orani: 'İade Oranı',
  yorum_puani: 'Yorum Puanı',
  nakit_akisi: 'Nakit Akışı',
  pazaryeri_cesitliligi: 'Pazaryeri Çeşitliliği',
  urun_cesitliligi: 'Ürün Çeşitliliği',
  stok_sagligi: 'Stok Sağlığı',
};

export default function HealthScorePage() {
  const [score, setScore] = useState<HealthScoreResponse | null>(null);
  const [breakdown, setBreakdown] = useState<HealthBreakdownResponse | null>(null);
  const [history, setHistory] = useState<HealthHistoryResponse | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [aiSources, setAiSources] = useState<Array<{ title: string; uri: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);

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

  const handleAiAnalysis = async () => {
    setAiLoading(true);
    try {
      const res: HealthAnalyzeResponse = await healthScoreService.analyze(true);
      setAiAnalysis(res.ai_analysis || '');
      setAiSources(res.web_sources || []);
    } finally { setAiLoading(false); }
  };

  if (loading) return <LoadingSpinner message="Sağlık skoru hesaplanıyor…" size="lg" />;

  const totalScore = score?.total_score ?? 0;
  const grade = score?.grade ?? 'C';
  const label = score?.label ?? '';
  // HealthScoreResponse.metrics is typed with explicit fields
  const metrics = score?.metrics;

  const gradeConfig: Record<string, { text: string; bg: string; ring: string }> = {
    A: { text: 'text-emerald-400', bg: 'from-emerald-500/30 to-emerald-600/10', ring: '#10b981' },
    B: { text: 'text-indigo-400', bg: 'from-indigo-500/30 to-indigo-600/10', ring: '#6366f1' },
    C: { text: 'text-amber-400', bg: 'from-amber-500/30 to-amber-600/10', ring: '#f59e0b' },
    D: { text: 'text-rose-400', bg: 'from-rose-500/30 to-rose-600/10', ring: '#ef4444' },
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
                  <RadialBar background={{ fill: '#1e293b' }} dataKey="value" cornerRadius={10} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className={`text-5xl font-extrabold ${cfg.text}`}>{totalScore}</p>
                <p className="text-slate-400 text-sm">/ 100</p>
              </div>
            </div>
            <div className="mt-4 text-center">
              <span className={`text-4xl font-bold ${cfg.text}`}>{grade}</span>
              <p className="text-white font-medium mt-1">{label}</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="md:col-span-2">
          <h3 className="text-white font-semibold mb-4">Metrikler</h3>
          <div className="grid grid-cols-2 gap-3">
            {metrics && [
              { label: 'Ort. Puan', value: metrics.avg_rating.toFixed(1) + ' ⭐' },
              { label: 'İade Oranı', value: formatPercent(metrics.return_rate) },
              { label: 'Net Marj', value: formatPercent(metrics.net_margin) },
              { label: 'Pazaryeri Sayısı', value: String(metrics.marketplace_count) },
              { label: 'Toplam Ürün', value: String(metrics.unique_products) },
              { label: 'Aylık Net Kâr', value: formatCurrency(metrics.monthly_net_profit) },
            ].map(m => (
              <div key={m.label} className="p-3 bg-slate-800/40 rounded-xl">
                <p className="text-slate-400 text-xs">{m.label}</p>
                <p className="text-white font-semibold mt-0.5">{m.value}</p>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* Kategori Breakdown */}
      {breakdown && (
        <GlassCard>
          <h3 className="text-white font-semibold mb-4">Kategori Bazlı Puan</h3>
          <div className="space-y-3">
            {(breakdown.breakdown || []).map((item) => {
              const pct = item.percentage;
              const barColor = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-indigo-500' : pct >= 30 ? 'bg-amber-500' : 'bg-rose-500';
              return (
                <div key={item.category}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-slate-300 text-sm">{CATEGORY_LABELS[item.category] || item.category}</span>
                    <span className="text-white font-semibold text-sm">{item.score}/{item.max_score}</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
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
          <h3 className="text-white font-semibold mb-4">Aylık Skor Tarihçesi</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={historyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                formatter={(value) => `${value}/100`} />
              <Line type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </GlassCard>
      )}

      {/* AI Analiz */}
      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold flex items-center gap-2"><Brain size={16} className="text-indigo-400" /> AI Skor Analizi</h3>
          <button onClick={handleAiAnalysis} disabled={aiLoading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50">
            {aiLoading ? <><span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> Analiz ediliyor…</> : <><Brain size={14} /> Analiz Et</>}
          </button>
        </div>
        {aiAnalysis
          ? <StreamingMarkdown content={aiAnalysis} webSources={aiSources} title="Sağlık Skoru AI Analizi" />
          : <p className="text-slate-500 text-sm">Güçlü/zayıf yönler ve skor artırma yol haritası için Analiz Et'e tıklayın.</p>
        }
      </GlassCard>
    </div>
  );
}
