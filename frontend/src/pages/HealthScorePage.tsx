import { useEffect, useState } from 'react';
import { Brain } from 'lucide-react';
import { healthService } from '../services';
import GlassCard from '../components/shared/GlassCard';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import AIResponseBox from '../components/shared/AIResponseBox';
import { formatCurrency, formatPercent, scoreColor, scoreBgColor } from '../utils/formatters';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const CATEGORY_LABELS: Record<string, string> = {
  satis_trendi: '📈 Satış Trendi',
  kar_marji: '💰 Kâr Marjı',
  iade_orani: '↩️ İade Oranı',
  yorum_puani: '⭐ Yorum Puanı',
  nakit_akisi: '💵 Nakit Akışı',
  pazaryeri_cesitliligi: '🏪 Pazaryeri Çeşitliliği',
  urun_cesitliligi: '📦 Ürün Çeşitliliği',
  stok_sagligi: '📦 Stok Sağlığı',
};

export default function HealthScorePage() {
  const [score, setScore] = useState(0);
  const [breakdown, setBreakdown] = useState<{ category: string; score: number; max_score: number; percentage: number }[]>([]);
  const [metrics, setMetrics] = useState<Record<string, number> | null>(null);
  const [history, setHistory] = useState<{ week: string; score: number }[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    Promise.all([healthService.breakdown(), healthService.history()])
      .then(([bd, hist]) => {
        setScore(bd.total_score);
        setBreakdown(bd.breakdown || []);
        setMetrics(null);
        setHistory(hist.history || []);
      }).finally(() => setLoading(false));
  }, []);

  const handleAi = async () => {
    setAiLoading(true);
    try {
      const res = await healthService.analyze();
      setAiAnalysis(res.ai_analysis || '');
      setMetrics(res.metrics);
    } finally { setAiLoading(false); }
  };

  if (loading) return <LoadingSpinner message="Sağlık skoru hesaplanıyor..." size="lg" />;

  const scoreLabel = score >= 80 ? 'Mükemmel' : score >= 60 ? 'İyi' : score >= 40 ? 'Orta' : 'Zayıf';

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid md:grid-cols-2 gap-6">
        {/* Score Gauge */}
        <GlassCard className="flex flex-col items-center py-8">
          <div className="relative mb-4">
            <svg viewBox="0 0 200 120" className="w-56 h-32">
              {/* Background arc */}
              <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#1e293b" strokeWidth="16" strokeLinecap="round" />
              {/* Score arc */}
              <path
                d="M 20 100 A 80 80 0 0 1 180 100"
                fill="none"
                stroke={score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : score >= 40 ? '#f97316' : '#ef4444'}
                strokeWidth="16"
                strokeLinecap="round"
                strokeDasharray={`${(score / 100) * 251} 251`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
              <span className={`text-5xl font-bold ${scoreColor(score)}`}>{score}</span>
              <span className="text-slate-400 text-sm">/100</span>
            </div>
          </div>
          <span className={`text-xl font-bold ${scoreColor(score)}`}>{scoreLabel}</span>
          <p className="text-slate-400 text-sm mt-1">Mağaza Sağlık Skoru</p>
        </GlassCard>

        {/* History */}
        <GlassCard>
          <h3 className="text-white font-semibold mb-4">Skor Geçmişi</h3>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={history}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="week" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} />
              <YAxis domain={[50, 100]} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
              <Line type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={2.5} dot={{ fill: '#6366f1', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
          {metrics && (
            <div className="grid grid-cols-2 gap-2 mt-4">
              {[
                { label: 'Ort. Puan', value: `⭐ ${metrics.avg_rating}` },
                { label: 'İade Oranı', value: formatPercent(metrics.return_rate) },
                { label: 'Net Marj', value: formatPercent(metrics.net_margin) },
                { label: 'Toplam Gelir', value: formatCurrency(metrics.total_revenue) },
              ].map(m => (
                <div key={m.label} className="bg-slate-800/40 rounded-lg p-2 text-center">
                  <p className="text-slate-500 text-xs">{m.label}</p>
                  <p className="text-white text-sm font-semibold mt-0.5">{m.value}</p>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>

      {/* Breakdown */}
      <GlassCard>
        <h3 className="text-white font-semibold mb-4">Kategori Detayı</h3>
        <div className="space-y-3">
          {[...breakdown].reverse().map((item) => (
            <div key={item.category}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-slate-300 text-sm">{CATEGORY_LABELS[item.category] || item.category}</span>
                <span className="text-slate-400 text-xs">{item.score}/{item.max_score}</span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${scoreBgColor(item.percentage)}`}
                  style={{ width: `${item.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* AI */}
      {!aiAnalysis ? (
        <button
          onClick={handleAi}
          disabled={aiLoading}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500/20 to-violet-500/20 border border-indigo-500/30 hover:border-indigo-400/50 text-indigo-300 rounded-xl py-4 font-semibold text-sm transition-all"
        >
          {aiLoading ? <LoadingSpinner ai message="Sağlık analiz ediliyor..." size="sm" /> : <><Brain size={18} /> 🤖 AI Sağlık Analizi Al</>}
        </button>
      ) : <AIResponseBox content={aiAnalysis} title="Mağaza Sağlık Analizi" />}
    </div>
  );
}
