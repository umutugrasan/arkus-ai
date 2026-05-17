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

  return (
    <div
      onClick={handleClick}
      className="flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl cursor-pointer transition-all duration-300 hover:scale-[1.02]"
      style={{
        background: isRunning
          ? 'linear-gradient(135deg, rgba(99,102,241,0.97) 0%, rgba(139,92,246,0.97) 100%)'
          : isDone
          ? 'linear-gradient(135deg, rgba(16,185,129,0.97) 0%, rgba(5,150,105,0.97) 100%)'
          : 'linear-gradient(135deg, rgba(239,68,68,0.97) 0%, rgba(220,38,38,0.97) 100%)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.2)',
        minWidth: '240px',
        maxWidth: '320px',
      }}
    >
      {/* Icon */}
      <div className="flex-shrink-0">
        {isRunning && <Loader2 size={18} className="text-white animate-spin" />}
        {isDone && <CheckCircle2 size={18} className="text-white" />}
        {!isRunning && !isDone && <AlertCircle size={18} className="text-white" />}
      </div>

      {/* Label */}
      <div className="flex-1 min-w-0">
        <p className="text-white text-xs font-semibold">
          {TYPE_LABELS[job.type] ?? job.type}
        </p>
        <p className="text-white/80 text-xs truncate">{job.label}</p>
        {isRunning && (
          <div className="mt-1.5 h-1 rounded-full bg-white/20 overflow-hidden">
            <div className="h-full bg-white/60 rounded-full animate-pulse" style={{ width: '65%' }} />
          </div>
        )}
        {isDone && job.navigateTo && (
          <p className="text-white/80 text-xs mt-0.5">Tamamlandı — görüntülemek için tıklayın</p>
        )}
      </div>

      {/* Dismiss (only when not running) */}
      {!isRunning && (
        <button
          onClick={(e) => { e.stopPropagation(); onDismiss(); }}
          className="flex-shrink-0 text-white/70 hover:text-white transition-colors"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

export default function AnalysisProgressBadge() {
  const { jobs, dismissJob } = useAnalysis();
  if (jobs.length === 0) return null;

  const runningCount = jobs.filter((j) => j.status === 'running').length;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2" style={{ pointerEvents: 'all' }}>
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-sm self-end">
        <Brain size={12} className="text-violet-300" />
        <span className="text-xs text-white/80 font-medium">
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
