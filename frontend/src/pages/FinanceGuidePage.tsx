import { useState, useEffect } from 'react';
import { Brain, XCircle, ExternalLink, Lightbulb } from 'lucide-react';
import GlassCard from '../components/shared/GlassCard';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import StreamingMarkdown from '../components/shared/StreamingMarkdown';
import { financeGuideService } from '../services';
import { formatCurrency, formatPercent } from '../utils/formatters';
import type { FinanceOptionsResponse, FinanceEligibilityResponse, FinanceAnalyzeResponse, FinanceOption } from '../types/api';

export default function FinanceGuidePage() {
  const [options, setOptions] = useState<FinanceOptionsResponse | null>(null);
  const [eligibility, setEligibility] = useState<FinanceEligibilityResponse | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [aiSources, setAiSources] = useState<Array<{ title: string; uri: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      financeGuideService.options(),
      financeGuideService.eligibility(),
    ]).then(([o, e]) => {
      setOptions(o);
      setEligibility(e);
    }).finally(() => setLoading(false));
  }, []);

  const handleAi = async () => {
    setAiLoading(true);
    try {
      const res: FinanceAnalyzeResponse = await financeGuideService.analyze(true);
      setAiAnalysis(res.ai_analysis || '');
      setAiSources(res.web_sources || []);
    } finally { setAiLoading(false); }
  };

  if (loading) return <LoadingSpinner message="Gerçek zamanlı banka kredileri ve destekler AI ile taranıyor…" size="lg" />;

  // FinanceOptionsResponse.seller_profile has: eligibility_score, monthly_revenue, monthly_net_profit, net_margin_pct, cash_balance
  const profile = options?.seller_profile;

  // FinanceEligibilityResponse has: status ('guclu'|'orta'|'zayif'), message, profile, eligible_options_count
  const eligStatus = eligibility?.status;
  const eligMsg = eligibility?.message;

  const eligColor = eligStatus === 'guclu' ? 'text-emerald-400' :
    eligStatus === 'orta' ? 'text-amber-400' : 'text-rose-400';
  const eligBg = eligStatus === 'guclu' ? 'from-emerald-500/20' :
    eligStatus === 'orta' ? 'from-amber-500/20' : 'from-rose-500/20';
  const eligLabel = eligStatus === 'guclu' ? '💪 Güçlü' :
    eligStatus === 'orta' ? '⚠️ Orta' : '❌ Zayıf';

  // Combine eligible + not_eligible lists from FinanceOptionsResponse
  const eligibleOpts: FinanceOption[] = options?.eligible_options || [];
  const notEligibleOpts: FinanceOption[] = options?.not_eligible_options || [];
  const allOptions = [...eligibleOpts, ...notEligibleOpts];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Satıcı Profili */}
      {profile && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <GlassCard className="bg-gradient-to-br from-indigo-500/20 to-indigo-600/10">
            <p className="text-slate-400 text-xs uppercase tracking-wider">Uygunluk Skoru</p>
            <p className="text-3xl font-bold text-indigo-400 mt-1">{profile.eligibility_score ?? '—'}</p>
          </GlassCard>
          <GlassCard className="bg-gradient-to-br from-emerald-500/20 to-emerald-600/10">
            <p className="text-slate-400 text-xs uppercase tracking-wider">Aylık Gelir</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{formatCurrency(profile.monthly_revenue)}</p>
          </GlassCard>
          <GlassCard className="bg-gradient-to-br from-violet-500/20 to-violet-600/10">
            <p className="text-slate-400 text-xs uppercase tracking-wider">Aylık Net Kâr</p>
            <p className="text-2xl font-bold text-violet-400 mt-1">{formatCurrency(profile.monthly_net_profit)}</p>
          </GlassCard>
          <GlassCard className="bg-gradient-to-br from-amber-500/20 to-amber-600/10">
            <p className="text-slate-400 text-xs uppercase tracking-wider">Net Marj</p>
            <p className="text-2xl font-bold text-amber-400 mt-1">{formatPercent(profile.net_margin_pct)}</p>
          </GlassCard>
        </div>
      )}

      {/* Uygunluk Durumu */}
      {eligibility && (
        <GlassCard className={`bg-gradient-to-br ${eligBg} to-transparent`}>
          <div>
            <p className="text-slate-400 text-sm uppercase tracking-wider font-medium">Kredi Uygunluk Durumu</p>
            <p className={`text-2xl font-bold mt-1 ${eligColor}`}>{eligLabel}</p>
            <p className="text-slate-300 text-sm mt-2">{eligMsg}</p>
            <p className="text-slate-400 text-xs mt-1">
              Bulunan finansman seçenekleri skorunuza göre filtrelenmiştir.
            </p>
          </div>
        </GlassCard>
      )}

      {/* Kredi Seçenekleri */}
      {allOptions.length > 0 && (
        <div>
          <h3 className="text-white font-semibold mb-3">Kredi & Finansman Seçenekleri</h3>
          <div className="grid md:grid-cols-2 gap-4">
            {allOptions.map((opt, i) => (
              <GlassCard key={i} className={`relative transition-all ${opt.is_recommended ? 'border-2 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.2)]' : (opt.eligible ? 'border border-emerald-500/30' : 'opacity-70')}`}>
                {opt.is_recommended && (
                  <div className="absolute -top-3 -right-3 bg-indigo-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg flex items-center gap-1">
                    <Lightbulb size={12} /> Önerilen
                  </div>
                )}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-white font-bold">{opt.provider}</p>
                    <p className="text-slate-400 text-sm">{opt.name}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    opt.eligible ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'
                  }`}>{opt.eligible ? '✅ Uygun' : '❌ Uygun Değil'}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="p-2 bg-slate-800/40 rounded-lg">
                    <p className="text-slate-400 text-xs">Max Tutar</p>
                    <p className="text-white font-semibold">{opt.max_amount}</p>
                  </div>
                  <div className="p-2 bg-slate-800/40 rounded-lg">
                    <p className="text-slate-400 text-xs">Faiz / Vade</p>
                    <p className="text-white font-semibold">{opt.interest}</p>
                  </div>
                </div>
                {opt.requirements && (
                  <p className="text-slate-400 text-xs mt-2">{opt.requirements}</p>
                )}
                {!opt.eligible && opt.reasons && opt.reasons.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {opt.reasons.map((r, ri) => (
                      <p key={ri} className="text-rose-400 text-xs flex items-center gap-1">
                        <XCircle size={10} /> {r}
                      </p>
                    ))}
                  </div>
                )}
                {/* Recommendation Reason */}
                {opt.is_recommended && opt.recommendation_reason && (
                  <div className="mt-3 p-3 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                    <p className="text-indigo-300 text-xs flex items-start gap-1">
                      <Lightbulb size={14} className="mt-0.5 flex-shrink-0" />
                      {opt.recommendation_reason}
                    </p>
                  </div>
                )}
                
                {/* Application URL */}
                {opt.url && (
                  <div className="mt-3">
                    <a href={opt.url} target="_blank" rel="noopener noreferrer" 
                       className="inline-flex items-center justify-center gap-1.5 w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors">
                      <ExternalLink size={14} /> Hemen Başvur
                    </a>
                  </div>
                )}
              </GlassCard>
            ))}
          </div>
        </div>
      )}

      {/* AI Analiz */}
      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold flex items-center gap-2"><Brain size={16} className="text-indigo-400" /> AI Finansman Analizi</h3>
          <button onClick={handleAi} disabled={aiLoading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50">
            {aiLoading ? <><span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> Analiz ediliyor…</> : <><Brain size={14} /> Analiz Et</>}
          </button>
        </div>
        {aiAnalysis
          ? <StreamingMarkdown content={aiAnalysis} webSources={aiSources} title="Finansman AI Analizi" />
          : <p className="text-slate-500 text-sm">KOSGEB desteği, KOBİ kredisi uygunluğu ve finansman stratejisi için Analiz Et'e tıklayın.</p>
        }
      </GlassCard>
    </div>
  );
}
