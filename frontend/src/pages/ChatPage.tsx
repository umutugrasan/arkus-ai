import { useState, useEffect, useRef, type KeyboardEvent } from 'react';
import { Send, Trash2, Bot, User, Sparkles } from 'lucide-react';
import { chatService } from '../services';
import GlassCard from '../components/shared/GlassCard';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

const SUGGESTED = [
  'Satışlarım bu ay nasıl?',
  'Hangi ürün en kârlı?',
  'Stok durumum kritik mi?',
  'Hangi pazaryeri daha avantajlı?',
  'Reklam harcamalarım verimli mi?',
  'Rakiplerimden nasıl ayrışabilirim?',
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [histLoading, setHistLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatService.history().then(r => {
      const hist: Message[] = (r.history || []).map((h: { question: string; answer: string; timestamp?: string }) => ([
        { role: 'user', content: h.question, timestamp: h.timestamp },
        { role: 'assistant', content: h.answer, timestamp: h.timestamp },
      ])).flat();
      if (hist.length === 0) {
        setMessages([{ role: 'assistant', content: 'Merhaba! Ben **Basiret AI**, e-ticaret danışmanınızım. 🤖\n\nMağazanızla ilgili her türlü soruyu yanıtlayabilirim. Ne öğrenmek istersiniz?' }]);
      } else {
        setMessages(hist);
      }
    }).finally(() => setHistLoading(false));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');
    setMessages(m => [...m, { role: 'user', content: msg }]);
    setLoading(true);
    try {
      const res = await chatService.ask(msg);
      setMessages(m => [...m, { role: 'assistant', content: res.response || 'Yanıt alınamadı.' }]);
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: '⚠️ Bağlantı hatası. Lütfen backend\'in çalıştığından emin olun.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    await chatService.clearHistory();
    setMessages([{ role: 'assistant', content: 'Sohbet geçmişi temizlendi. Yeni bir konuyla başlayalım!' }]);
  };

  const handleKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (histLoading) return <LoadingSpinner message="Sohbet geçmişi yükleniyor..." size="lg" />;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-h-[800px] animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Bot size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-white font-bold">Basiret AI Danışman</h2>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-emerald-400 text-xs font-medium">Gemini AI ile Güçlendirildi</p>
            </div>
          </div>
        </div>
        <button onClick={handleClear} className="flex items-center gap-1.5 text-slate-400 hover:text-rose-400 text-xs transition-colors px-3 py-1.5 rounded-lg hover:bg-rose-500/10">
          <Trash2 size={13} /> Temizle
        </button>
      </div>

      {/* Messages */}
      <GlassCard className="flex-1 overflow-y-auto p-4 space-y-4 mb-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''} animate-fade-in`}>
            <div className={`w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center ${msg.role === 'user' ? 'bg-indigo-500' : 'bg-gradient-to-br from-violet-500 to-indigo-600'}`}>
              {msg.role === 'user' ? <User size={14} className="text-white" /> : <Sparkles size={14} className="text-white" />}
            </div>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${msg.role === 'user'
              ? 'bg-indigo-500/20 border border-indigo-500/20 text-slate-200 rounded-tr-sm'
              : 'bg-slate-800/60 border border-slate-700/30 text-slate-200 rounded-tl-sm'
            }`}>
              {msg.role === 'assistant' ? (
                <div className="ai-response text-sm">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p>{msg.content}</p>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3 animate-fade-in">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <Sparkles size={14} className="text-white animate-pulse" />
            </div>
            <div className="bg-slate-800/60 border border-slate-700/30 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1 items-center h-5">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </GlassCard>

      {/* Suggested questions */}
      {messages.length <= 2 && (
        <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
          {SUGGESTED.map(s => (
            <button
              key={s}
              onClick={() => handleSend(s)}
              className="flex-shrink-0 text-xs bg-slate-800/60 border border-slate-700/50 hover:border-indigo-500/40 text-slate-300 hover:text-white rounded-full px-3 py-1.5 transition-all"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Bir soru sorun... (Enter ile gönderin)"
            rows={1}
            className="w-full bg-slate-800/60 border border-slate-700/50 focus:border-indigo-500/50 text-white rounded-2xl px-4 py-3 pr-12 text-sm resize-none focus:outline-none transition-all max-h-32"
            style={{ minHeight: '48px' }}
          />
        </div>
        <button
          onClick={() => handleSend()}
          disabled={loading || !input.trim()}
          className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30 disabled:opacity-50 hover:shadow-indigo-500/50 transition-all flex-shrink-0"
        >
          <Send size={18} className="text-white" />
        </button>
      </div>
    </div>
  );
}
