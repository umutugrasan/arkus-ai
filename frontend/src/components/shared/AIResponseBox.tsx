import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Brain, Sparkles } from 'lucide-react';

interface AIResponseBoxProps {
  content: string;
  title?: string;
}

export default function AIResponseBox({ content, title = 'Gemini AI Analizi' }: AIResponseBoxProps) {
  return (
    <div className="glass-card border border-indigo-500/20 animate-fade-in">
      <div className="flex items-center gap-2 p-4 border-b border-slate-700/50">
        <div className="flex items-center gap-2 bg-gradient-to-r from-indigo-500/20 to-violet-500/20 rounded-lg px-3 py-1.5">
          <Brain size={16} className="text-indigo-400" />
          <span className="text-indigo-300 text-sm font-semibold">{title}</span>
          <Sparkles size={12} className="text-violet-400" />
        </div>
      </div>
      <div className="p-4 ai-response text-sm leading-relaxed">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    </div>
  );
}
