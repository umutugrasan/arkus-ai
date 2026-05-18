import { useState, useEffect } from 'react';
import { Brain, XCircle, ExternalLink, Lightbulb } from 'lucide-react';
import GlassCard from '../components/shared/GlassCard';
import { Skeleton, SkeletonCard } from '../components/shared/Skeleton';
import StreamingMarkdown from '../components/shared/StreamingMarkdown';
import { financeGuideService } from '../services';
import { formatCurrency, formatPercent } from '../utils/formatters';
import { useI18n } from '../context/I18nContext';
import { useBackgroundAnalysis } from '../context/AnalysisContext';
import type { FinanceOptionsResponse, FinanceEligibilityResponse, FinanceOption } from '../types/api';

export default function FinanceGuidePage() {
  const { t } = useI18n();
  const [options, setOptions] = useState<FinanceOptionsResponse | null>(null);
  const [eligibility, setEligibility] = useState<FinanceEligibilityResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const { text: aiAnalysis, isRunning: aiLoading, startFetch } = useBackgroundAnalysis({
    type: 'finance',
    id: 'global',
    label: 'Finansman Analizi',
    navigateTo: '/finance-guide',
  });

  useEffect(() => {
    Promise.all([
      financeGuideService.options(),
      financeGuideService.eligibility(),
    ]).then(([o, e]) => {
      setOptions(o);
      setEligibility(e);
    }).finally(() => setLoading(false));
  }, []);

  const handleAi = () => {
    startFetch(async () => {
      const res = await financeGuideService.analyze(true);
      return res.ai_analysis || '';
    });
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // FinanceOptionsResponse.seller_profile has: eligibility_score, monthly_revenue, monthly_net_profit, net_margin_pct, cash_balance
  const profile = options?.seller_profile;

  // FinanceEligibilityResponse has: status ('guclu'|'orta'|'zayif'), message, profile, eligible_options_count
  const eligStatus = eligibility?.status;
  const eligMsg = eligibility?.message;

  const eligColor = eligStatus === 'guclu' ? 'text-emerald-500' :
    eligStatus === 'orta' ? 'text-amber-500' : 'text-rose-500';
  const eligBg = eligStatus === 'guclu' ? 'from-emerald-500/20' :
    eligStatus === 'orta' ? 'from-amber-500/20' : 'from-rose-500/20';
  const eligLabel = eligStatus === 'guclu' ? `💪 ${t('finance.elig_strong')}` :
    eligStatus === 'orta' ? `⚠️ ${t('finance.elig_medium')}` : `❌ ${t('finance.elig_weak')}`;

  // Combine eligible + not_eligible lists from FinanceOptionsResponse
  const eligibleOpts: FinanceOption[] = options?.eligible_options || [];
  const notEligibleOpts: FinanceOption[] = options?.not_eligible_options || [];
  const allOptions = [...eligibleOpts, ...notEligibleOpts];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Satıcı Profili */}
      {profile && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <GlassCard className="bg-gradient-to-br from-[var(--accent)]/20 to-[var(--accent)]/5">
            <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider">{t('finance.score')}</p>
            <p className="text-3xl font-bold text-[var(--accent)] mt-1">{profile.eligibility_score ?? '—'}</p>
          </GlassCard>
          <GlassCard className="bg-gradient-to-br from-emerald-500/20 to-emerald-600/10">
            <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider">{t('financials.cf_monthly_revenue')}</p>
            <p className="text-2xl font-bold text-emerald-500 mt-1">{formatCurrency(profile.monthly_revenue)}</p>
          </GlassCard>
          <GlassCard className="bg-gradient-to-br from-[var(--accent)]/15 to-[var(--accent)]/5">
            <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider">{t('financials.cf_monthly_profit')}</p>
            <p className="text-2xl font-bold text-[var(--accent)] mt-1">{formatCurrency(profile.monthly_net_profit)}</p>
          </GlassCard>
          <GlassCard className="bg-gradient-to-br from-amber-500/20 to-amber-600/10">
            <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider">{t('financials.net_margin')}</p>
            <p className="text-2xl font-bold text-amber-500 mt-1">{formatPercent(profile.net_margin_pct)}</p>
          </GlassCard>
        </div>
      )}

      {/* Uygunluk Durumu */}
      {eligibility && (
        <GlassCard className={`bg-gradient-to-br ${eligBg} to-transparent`}>
          <div>
            <p className="text-[var(--text-muted)] text-sm uppercase tracking-wider font-medium">{t('finance.elig_status')}</p>
            <p className={`text-2xl font-bold mt-1 ${eligColor}`}>{eligLabel}</p>
            <p className="text-[var(--text-secondary)] text-sm mt-2">{eligMsg}</p>
            <p className="text-[var(--text-muted)] text-xs mt-1">
              {t('finance.elig_note')}
            </p>
          </div>
        </GlassCard>
      )}

      {/* Kredi Seçenekleri */}
      {allOptions.length > 0 && (
        <div>
          <h3 className="text-[var(--text-primary)] font-semibold mb-3">{t('finance.options_title')}</h3>
          <div className="grid md:grid-cols-2 gap-4">
            {allOptions.map((opt, i) => (
              <GlassCard key={`${opt.name}-${opt.provider}-${i}`} className={`relative transition-all ${opt.is_recommended ? 'border-2 border-[var(--accent-solid)] shadow-[0_0_15px_rgba(74,63,68,0.15)]' : (opt.eligible ? 'border border-emerald-500/30' : 'opacity-70')}`}>
                {opt.is_recommended && (
                  <div className="absolute -top-3 -right-3 bg-[var(--accent-solid)] text-[var(--accent-fg)] text-xs font-bold px-3 py-1 rounded-full shadow-lg flex items-center gap-1">
                    <Lightbulb size={12} /> {t('finance.recommended')}
                  </div>
                )}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-[var(--text-primary)] font-bold">{opt.provider}</p>
                    <p className="text-[var(--text-muted)] text-sm">{opt.name}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    opt.eligible ? 'bg-emerald-500/20 text-emerald-500' : 'bg-[var(--bg-muted)] text-[var(--text-muted)]'
                  }`}>{opt.eligible ? `✅ ${t('finance.eligible')}` : `❌ ${t('finance.not_eligible')}`}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="p-2 bg-[var(--bg-elevated)] rounded-lg">
                    <p className="text-[var(--text-muted)] text-xs">{t('finance.max_amount')}</p>
                    <p className="text-[var(--text-primary)] font-semibold">{opt.max_amount}</p>
                  </div>
                  <div className="p-2 bg-[var(--bg-elevated)] rounded-lg">
                    <p className="text-[var(--text-muted)] text-xs">{t('finance.interest_term')}</p>
                    <p className="text-[var(--text-primary)] font-semibold">{opt.interest}</p>
                  </div>
                </div>
                {opt.requirements && (
                  <p className="text-[var(--text-muted)] text-xs mt-2">{opt.requirements}</p>
                )}
                {!opt.eligible && opt.reasons && opt.reasons.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {opt.reasons.map((r, ri) => (
                      <p key={ri} className="text-rose-500 text-xs flex items-center gap-1">
                        <XCircle size={10} /> {r}
                      </p>
                    ))}
                  </div>
                )}
                {/* Recommendation Reason */}
                {opt.is_recommended && opt.recommendation_reason && (
                  <div className="mt-3 p-3 bg-[var(--accent)]/10 rounded-lg border border-[var(--border-color)]">
                    <p className="text-[var(--accent)] text-xs flex items-start gap-1">
                      <Lightbulb size={14} className="mt-0.5 flex-shrink-0" />
                      {opt.recommendation_reason}
                    </p>
                  </div>
                )}

                {/* Application URL */}
                {opt.url && opt.url.startsWith('http') && (
                  <div className="mt-3">
                    <a href={opt.url} target="_blank" rel="noopener noreferrer"
                       onClick={(e) => {
                         try { new URL(opt.url!); } catch { e.preventDefault(); }
                       }}
                       className="inline-flex items-center justify-center gap-1.5 w-full py-2 bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-fg)] rounded-lg text-sm font-medium transition-colors">
                      <ExternalLink size={14} /> {t('finance.apply')}
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
          <h3 className="text-[var(--text-primary)] font-semibold flex items-center gap-2"><Brain size={16} className="text-[var(--accent)]" /> {t('finance.ai_title')}</h3>
          <button onClick={handleAi} disabled={aiLoading}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-fg)] rounded-xl text-sm font-medium transition-all disabled:opacity-50">
            {aiLoading ? <><span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> {t('common.analyzing')}</> : <><Brain size={14} /> {t('common.analyze')}</>}
          </button>
        </div>
        {aiAnalysis
          ? <StreamingMarkdown content={aiAnalysis} title={t('finance.ai_analysis_title')} />
          : <p className="text-[var(--text-muted)] text-sm">{t('finance.ai_hint')}</p>
        }
      </GlassCard>
    </div>
  );
}
