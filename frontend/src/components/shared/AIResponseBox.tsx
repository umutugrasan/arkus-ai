import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Brain, Sparkles } from 'lucide-react';

interface AIResponseBoxProps {
  content: string;
  title?: string;
}

export default function AIResponseBox({ content, title = 'AI Analizi' }: AIResponseBoxProps) {
  return (
    <div className="glass-card border border-[var(--border-color)] animate-fade-in">
      <div className="flex items-center gap-2 p-4 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-2 bg-[var(--accent)]/10 rounded-lg px-3 py-1.5">
          <Brain size={16} className="text-[var(--accent)]" />
          <span className="text-[var(--accent)] text-sm font-semibold">{title}</span>
          <Sparkles size={12} className="text-[var(--accent)]" />
        </div>
      </div>
      <div className="p-4 ai-response text-sm leading-relaxed">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    </div>
  );
}
