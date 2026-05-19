/**
 * AnalysisProgressBadge
 * ---------------------
 * Floating bottom-right badge showing all active/completed background analyses.
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Brain, CheckCircle2, AlertCircle, X, Loader2 } from 'lucide-react';
import { useAnalysis } from '../../context/AnalysisContext';
import type { AnalysisJobMeta } from '../../context/AnalysisContext';

const TYPE_LABELS: Record<string, string> = {
  reviews: 'Yorum Analizi',
  competitors: 'Rakip Analizi',
  arbitrage: 'Arbitraj Analizi',
  financials: 'Finansal Analiz',
  health: 'Sağlık Analizi',
  finance: 'Finansman Analizi',
  image: 'Görsel Analiz',
  image_suggestions: 'Görsel Önerileri',
};

function JobBadge({ job, onDismiss }: { job: AnalysisJobMeta; onDismiss: () => void }) {
  const navigate = useNavigate();
  const isRunning = job.status === 'running';
  const isDone = job.status === 'done';

  useEffect(() => {
    if (isDone) {
      const timer = setTimeout(onDismiss, 5000);
      return () => clearTimeout(timer);
    }
  }, [isDone, onDismiss]);

  const handleClick = () => {
    if (job.navigateTo) navigate(job.navigateTo);
  };

  if (isRunning) {
    return (
      <div
        onClick={handleClick}
        className="flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl cursor-pointer transition-all duration-300 hover:scale-[1.02]"
        style={{
          background: 'linear-gradient(135deg, rgba(74,63,68,0.97) 0%, rgba(107,98,102,0.97) 100%)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.15)',
          minWidth: '240px',
          maxWidth: '320px',
        }}
      >
        <div className="flex-shrink-0">
          <Loader2 size={18} className="text-white animate-spin" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-xs font-semibold">{TYPE_LABELS[job.type] ?? job.type}</p>
          <p className="text-white/80 text-xs truncate">{job.label}</p>
          <div className="mt-1.5 h-1 rounded-full bg-white/20 overflow-hidden">
            <div className="h-full bg-white/60 rounded-full animate-pulse" style={{ width: '65%' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={handleClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-lg cursor-pointer transition-all duration-300 hover:scale-[1.02] bg-[var(--bg-card)] border ${isDone ? 'border-emerald-500/40' : 'border-rose-500/40'}`}
      style={{ minWidth: '240px', maxWidth: '320px' }}
    >
      <div className="flex-shrink-0">
        {isDone
          ? <CheckCircle2 size={18} className="text-emerald-500" />
          : <AlertCircle size={18} className="text-rose-500" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[var(--text-primary)] text-xs font-semibold">{TYPE_LABELS[job.type] ?? job.type}</p>
        <p className="text-[var(--text-muted)] text-xs truncate">{job.label}</p>
        {isDone && job.navigateTo && (
          <p className="text-[var(--text-muted)] text-xs mt-0.5">Tamamlandı — görüntülemek için tıklayın</p>
        )}
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onDismiss(); }}
        className="flex-shrink-0 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export default function AnalysisProgressBadge() {
  const { jobs, dismissJob } = useAnalysis();
  if (jobs.length === 0) return null;

  const runningCount = jobs.filter((j) => j.status === 'running').length;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2" style={{ pointerEvents: 'all' }}>
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-card)] border border-[var(--border-strong)] self-end">
        <Brain size={12} className="text-[var(--accent)]" />
        <span className="text-xs text-[var(--text-muted)] font-medium">
          {runningCount > 0 ? `${runningCount} analiz çalışıyor` : 'Analiz tamamlandı'}
        </span>
      </div>
      {jobs.map((job) => (
        <JobBadge
          key={job.key}
          job={job}
          onDismiss={() => dismissJob(job.type, job.id)}
        />
      ))}
    </div>
  );
}
