// Streaming sırasında ekrana yazıldıkça blinking cursor gösteren markdown component
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BrainCircuit, Clock } from 'lucide-react';

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
    <section className={`bg-[#fcfaf9] border border-gray-100 rounded-xl p-6 relative overflow-hidden flex items-center justify-between shadow-sm animate-fade-in ${className}`}>
      <div className="flex-1 relative z-10">
        <div className="flex items-center gap-2 mb-4">
          <div className="bg-[#4a3f44] text-white text-[10px] px-2 py-1 rounded flex items-center gap-1 font-semibold shadow-sm">
            <Clock size={12} />
            {title}
          </div>
          {streaming && (
            <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gray-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-gray-500"></span>
              </span>
              <span>yazıyor…</span>
            </div>
          )}
        </div>
        
        <div className="border-t border-gray-200 pt-4">
          <div className="text-sm ai-response">
            {content ? (
              <div className="text-gray-800">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
                {streaming && <span className="inline-block w-2 h-4 bg-gray-400 ml-0.5 animate-pulse" />}
              </div>
            ) : streaming ? (
              <p className="text-gray-400 italic">yanıt bekleniyor...</p>
            ) : (
              <p className="text-gray-400 italic">Henüz analiz yok.</p>
            )}
          </div>

          {webSources && webSources.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-[10px] text-gray-400 mb-2 uppercase tracking-wider font-bold">
                Web Kaynakları
              </p>
              <div className="flex flex-wrap gap-2">
                {webSources.map((s, i) => (
                  <a
                    key={i}
                    href={s.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs px-2 py-1 rounded bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-800 transition-colors"
                  >
                    {s.title}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="ml-8 opacity-[0.15] hidden sm:block pointer-events-none absolute right-4 bottom-4">
        <BrainCircuit size={80} className="text-[#4a3f44]" />
      </div>
    </section>
  );
}
