import { Link } from 'react-router-dom';
import { Compass, Home } from 'lucide-react';
import { motion } from 'framer-motion';
import { useI18n } from '../context/I18nContext';

export default function NotFoundPage() {
  const { t } = useI18n();
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="min-h-[60vh] flex flex-col items-center justify-center text-center"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 240, damping: 18, delay: 0.1 }}
        className="w-20 h-20 rounded-2xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center mb-6"
      >
        <Compass size={36} className="text-[var(--accent)]" />
      </motion.div>
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
    </motion.div>
  );
}
