// Streaming sırasında ekrana yazıldıkça blinking cursor gösteren markdown component
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Brain, Sparkles } from 'lucide-react';

interface Props {
  content: string;
  title?: string;
  streaming?: boolean;
  className?: string;
  webSources?: Array<{ title: string; uri: string }>;
}

export default function StreamingMarkdown({
  content,
  title = 'AI Analizi',
  streaming = false,
  className = '',
  webSources,
}: Props) {
  return (
    <div className={`glass-card border border-indigo-500/20 animate-fade-in ${className}`}>
      <div className="flex items-center justify-between gap-2 p-4 border-b border-slate-700/50">
        <div className="flex items-center gap-2 bg-gradient-to-r from-indigo-500/20 to-violet-500/20 rounded-lg px-3 py-1.5">
          <Brain size={16} className="text-indigo-400" />
          <span className="text-indigo-300 text-sm font-semibold">{title}</span>
          <Sparkles size={12} className="text-violet-400" />
        </div>
        {streaming && (
          <div className="flex items-center gap-1.5 text-xs text-indigo-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            <span>yazıyor…</span>
          </div>
        )}
      </div>
      <div className="p-4 ai-response text-sm leading-relaxed">
        {content ? (
          <>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            {streaming && <span className="inline-block w-2 h-4 bg-indigo-400 ml-0.5 animate-pulse" />}
          </>
        ) : streaming ? (
          <div className="text-slate-400 text-sm italic">yanıt bekleniyor…</div>
        ) : (
          <div className="text-slate-500 text-sm">Henüz analiz yok.</div>
        )}

        {webSources && webSources.length > 0 && (
          <div className="mt-6 pt-4 border-t border-slate-700/50">
            <p className="text-xs text-slate-400 mb-2 uppercase tracking-wider font-semibold">
              Web Kaynakları ({webSources.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {webSources.map((s, i) => (
                <a
                  key={i}
                  href={s.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-2 py-1 rounded-md bg-slate-800/60 border border-slate-700 text-indigo-300 hover:bg-indigo-500/10 hover:border-indigo-500/40 transition-colors"
                >
                  {s.title}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
