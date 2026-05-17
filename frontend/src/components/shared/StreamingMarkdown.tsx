// Streaming sırasında ekrana yazıldıkça blinking cursor gösteren markdown component
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Clock } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';

interface Props {
  content: string;
  title?: string;
  streaming?: boolean;
  className?: string;
  webSources?: Array<{ title: string; uri: string }>;
}

export default function StreamingMarkdown({
  content,
  title,
  streaming = false,
  className = '',
  webSources,
}: Props) {
  const { t } = useI18n();
  const heading = title ?? t('ai.analysis');

  return (
    <section className={`bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-xl p-6 relative overflow-hidden flex items-center justify-between shadow-sm animate-fade-in ${className}`}>
      <div className="flex-1 relative z-10">
        <div className="flex items-center gap-2 mb-4">
          <div className="bg-[var(--accent-solid)] text-[var(--accent-fg)] text-[10px] px-2 py-1 rounded flex items-center gap-1 font-semibold shadow-sm">
            <Clock size={12} />
            {heading}
          </div>
          {streaming && (
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-faint)] font-medium">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--text-faint)] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--text-muted)]"></span>
              </span>
              <span>{t('ai.writing')}</span>
            </div>
          )}
        </div>

        <div className="border-t border-[var(--border-color)] pt-4">
          <div className="text-sm ai-response">
            {content ? (
              <div className="text-[var(--text-primary)]">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
                {streaming && <span className="inline-block w-2 h-4 bg-[var(--text-faint)] ml-0.5 animate-pulse" />}
              </div>
            ) : streaming ? (
              <p className="text-[var(--text-muted)] italic">{t('ai.waiting')}</p>
            ) : (
              <p className="text-[var(--text-muted)] italic">{t('ai.no_analysis')}</p>
            )}
          </div>

          {webSources && webSources.length > 0 && (
            <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
              <p className="text-[10px] text-[var(--text-faint)] mb-2 uppercase tracking-wider font-bold">
                {t('ai.web_sources')}
              </p>
              <div className="flex flex-wrap gap-2">
                {webSources.map((s, i) => (
                  <a
                    key={i}
                    href={s.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs px-2 py-1 rounded bg-[var(--bg-muted)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    {s.title}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="ml-8 opacity-[0.12] hidden sm:block pointer-events-none absolute right-4 bottom-4">
        <img src="/assets/logos/logo-bird.png" alt="" aria-hidden="true" width={160} height={160} className="object-contain" />
      </div>
    </section>
  );
}
