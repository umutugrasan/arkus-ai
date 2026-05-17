import { Link } from 'react-router-dom';
import { Compass, Home } from 'lucide-react';
import { useI18n } from '../context/I18nContext';

export default function NotFoundPage() {
  const { t } = useI18n();
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
      <div className="w-20 h-20 rounded-2xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center mb-6">
        <Compass size={36} className="text-[var(--accent)]" />
      </div>
      <h1 className="text-6xl font-extrabold text-[var(--text-primary)] tracking-tight">404</h1>
      <p className="text-[var(--text-muted)] mt-3 mb-1 text-lg">{t('notfound.title')}</p>
      <p className="text-[var(--text-muted)] text-sm max-w-md">
        {t('notfound.desc')}
      </p>
      <Link
        to="/dashboard"
        className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-fg)] text-sm font-medium transition-all shadow-lg shadow-black/20"
      >
        <Home size={16} />
        {t('notfound.back')}
      </Link>
    </div>
  );
}
