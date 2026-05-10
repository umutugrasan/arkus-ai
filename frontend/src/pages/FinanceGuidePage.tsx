import { useEffect, useState } from 'react';
import { Brain, CheckCircle, XCircle } from 'lucide-react';
import { financeGuideService } from '../services';
import GlassCard from '../components/shared/GlassCard';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import AIResponseBox from '../components/shared/AIResponseBox';
import { formatCurrency, formatPercent, scoreColor } from '../utils/formatters';

interface FinanceOption {
  name: string;
  provider: string;
  max_amount: string;
  interest: string;
  term: string;
  requirements: string;
  eligible: boolean;
}

export default function FinanceGuidePage() {
  const [eligible, setEligible] = useState<FinanceOption[]>([]);
  const [notEligible, setNotEligible] = useState<FinanceOption[]>([]);
  const [profile, setProfile] = useState<Record<string, number> | null>(null);
  const [eligibility, setEligibility] = useState<Record<string, unknown> | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    Promise.all([financeGuideService.options(), financeGuideService.eligibility()])
      .then(([opts, elig]) => {
        setEligible(opts.eligible_options || []);
        setNotEligible(opts.not_eligible_options || []);
        setProfile(opts.seller_profile);
        setEligibility(elig);
      }).finally(() => setLoading(false));
  }, []);

  const handleAi = async () => {
    setAiLoading(true);
    try {
      const res = await financeGuideService.analyze();
      setAiAnalysis(res.ai_analysis || '');
    } finally { setAiLoading(false); }
  };

  if (loading) return <LoadingSpinner message="Finansman seçenekleri yükleniyor..." size="lg" />;

  const statusConfig: Record<string, { color: string; bg: string }> = {
    guclu: { color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    orta: { color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
    zayif: { color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20' },
  };

  const status = eligibility?.status as string || 'orta';
  const cfg = statusConfig[status] || statusConfig.orta;

  const displayOptions = showAll ? [...eligible, ...notEligible] : [...eligible, ...notEligible];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Profile + Eligibility */}
      <div className="grid md:grid-cols-2 gap-4">
        {profile && (
          <GlassCard className="bg-slate-800/30">
            <h3 className="text-white font-semibold mb-3">Satıcı Profiliniz</h3>
            <div className="space-y-2">
              {[
                { label: 'Sağlık Skoru', value: `${profile.health_score}/100`, color: scoreColor(profile.health_score) },
                { label: 'Aylık Gelir', value: formatCurrency(profile.monthly_revenue) },
                { label: 'Aylık Net Kâr', value: formatCurrency(profile.monthly_net_profit) },
                { label: 'Net Marj', value: formatPercent(profile.net_margin) },
                { label: 'Nakit Bakiye', value: formatCurrency(profile.cash_balance) },
              ].map(m => (
                <div key={m.label} className="flex justify-between items-center py-1.5 border-b border-slate-700/30">
                  <span className="text-slate-400 text-sm">{m.label}</span>
                  <span className={`font-semibold text-sm ${m.color || 'text-white'}`}>{m.value}</span>
                </div>
              ))}
            </div>
          </GlassCard>
        )}

        <GlassCard className={`border ${cfg.bg}`}>
          <h3 className="text-white font-semibold mb-3">Uygunluk Durumu</h3>
          <div className="text-center py-4">
            <p className={`text-3xl font-bold ${cfg.color}`}>
              {status === 'guclu' ? '💪 Güçlü' : status === 'orta' ? '⚖️ Orta' : '⚠️ Zayıf'}
            </p>
            <p className="text-slate-300 text-sm mt-2">{eligibility?.message as string}</p>
            <div className="flex items-center justify-center gap-2 mt-4">
              <span className={`text-4xl font-bold ${cfg.color}`}>{eligibility?.eligible_options_count as number}</span>
              <span className="text-slate-400 text-sm">/ {eligibility?.total_options as number} seçenek<br />için uygunsunuz</span>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Finance Options */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-semibold">Finansman Seçenekleri</h3>
          <button onClick={() => setShowAll(s => !s)} className="text-indigo-400 text-xs hover:text-indigo-300">
            {showAll ? 'Sadece Uygun' : 'Tümünü Göster'}
          </button>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayOptions.map((opt, i) => (
            <GlassCard key={i} className={`${opt.eligible ? 'border border-emerald-500/20 bg-emerald-500/5' : 'opacity-60'}`}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-white font-semibold text-sm">{opt.name}</p>
                  <p className="text-slate-400 text-xs">{opt.provider}</p>
                </div>
                {opt.eligible
                  ? <CheckCircle size={18} className="text-emerald-400 flex-shrink-0" />
                  : <XCircle size={18} className="text-slate-600 flex-shrink-0" />
                }
              </div>
              <div className="space-y-1.5 mt-3">
                {[
                  { label: 'Tutar', value: opt.max_amount },
                  { label: 'Faiz', value: opt.interest },
                  { label: 'Vade', value: opt.term },
                  { label: 'Gereksinim', value: opt.requirements },
                ].map(m => (
                  <div key={m.label} className="flex gap-2">
                    <span className="text-slate-500 text-xs w-16 flex-shrink-0">{m.label}:</span>
                    <span className="text-slate-300 text-xs">{m.value}</span>
                  </div>
                ))}
              </div>
              {opt.eligible && (
                <div className="mt-3 bg-emerald-500/10 rounded-lg px-2 py-1 text-center">
                  <span className="text-emerald-400 text-xs font-medium">✓ Uygunluk Şartlarını Karşılıyorsunuz</span>
                </div>
              )}
            </GlassCard>
          ))}
        </div>
      </div>

      {/* AI */}
      {!aiAnalysis ? (
        <button
          onClick={handleAi}
          disabled={aiLoading}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500/20 to-violet-500/20 border border-indigo-500/30 hover:border-indigo-400/50 text-indigo-300 rounded-xl py-4 font-semibold text-sm transition-all"
        >
          {aiLoading ? <LoadingSpinner ai message="Finansman önerileri hazırlanıyor..." size="sm" /> : <><Brain size={18} /> 🤖 Kişiselleştirilmiş Finansman Önerisi Al</>}
        </button>
      ) : <AIResponseBox content={aiAnalysis} title="Finansman Danışmanlığı" />}
    </div>
  );
}
