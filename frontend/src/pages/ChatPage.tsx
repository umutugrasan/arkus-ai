import { useState, useEffect, useRef } from 'react';
import { Send, Trash2, MessageSquare, Bot, User, Loader2 } from 'lucide-react';
import GlassCard from '../components/shared/GlassCard';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { chatService } from '../services';
import { useI18n } from '../context/I18nContext';
import { streamSSE } from '../utils/streaming';
import type { ChatHistoryResponse } from '../types/api';

interface Message {
  id?: number;
  role: 'user' | 'ai';
  text: string;
  created_at?: string;
}

export default function ChatPage() {
  const { t } = useI18n();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [sending, setSending] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    chatService.history(50).then((res: ChatHistoryResponse) => {
      const msgs: Message[] = (res.history || []).flatMap(h => [
        { id: h.id, role: 'user' as const, text: h.question, created_at: h.created_at },
        { id: h.id, role: 'ai' as const, text: h.answer, created_at: h.created_at },
      ]);
      setMessages(msgs.reverse());
      setHistoryLoaded(true);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (historyLoaded) scrollToBottom();
  }, [messages, historyLoaded]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending || streaming) return;
    setInput('');
    setSending(true);

    const userMsg: Message = { role: 'user', text };
    setMessages(prev => [...prev, userMsg]);

    setStreaming(true);
    setStreamText('');
    let accumulated = '';
    let streamFailed = false;

    try {
      await streamSSE(
        chatService.askStreamUrl(),
        {
          onChunk: (chunk) => {
            accumulated += chunk;
            setStreamText(accumulated);
          },
          onDone: (data) => {
            const full = typeof data.full_text === 'string' ? data.full_text : '';
            if (full) accumulated = full;
            if (data.error) streamFailed = true;
          },
          onError: () => {
            streamFailed = true;
          },
        },
        { method: 'POST', body: { message: text } },
      );

      if (streamFailed && !accumulated) {
        // Stream koptu ve metin gelmedi → senkron fallback
        const res = await chatService.ask(text);
        setMessages(prev => [...prev, { role: 'ai', text: res.answer, created_at: res.created_at }]);
      } else {
        setMessages(prev => [...prev, { role: 'ai', text: accumulated || t('chat.error_response') }]);
      }
    } catch {
      // streamSSE'nin kendisi atarsa son çare olarak senkron çağrı
      try {
        const res = await chatService.ask(text);
        setMessages(prev => [...prev, { role: 'ai', text: res.answer, created_at: res.created_at }]);
      } catch {
        setMessages(prev => [...prev, { role: 'ai', text: t('chat.error_response') }]);
      }
    } finally {
      setSending(false);
      setStreaming(false);
      setStreamText('');
      scrollToBottom();
      inputRef.current?.focus();
    }
  };

  const handleClearHistory = async () => {
    if (!confirm(t('chat.clear_confirm'))) return;
    await chatService.clearHistory();
    setMessages([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (loading) return <LoadingSpinner message={t('chat.loading')} size="lg" />;

  const suggestions = [
    t('chat.suggestion_1'),
    t('chat.suggestion_2'),
    t('chat.suggestion_3'),
    t('chat.suggestion_4'),
  ];

  return (
    <div className="flex flex-col h-[calc(100dvh-7rem)] animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 rounded-xl">
            <Bot size={20} className="text-indigo-600 dark:text-indigo-300" />
          </div>
          <div>
            <h2 className="text-[var(--text-primary)] font-semibold">{t('chat.title')}</h2>
            <p className="text-[var(--text-muted)] text-xs">{t('chat.subtitle')}</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={handleClearHistory}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[var(--text-muted)] hover:text-rose-500 hover:bg-rose-500/10 rounded-xl text-sm transition-all"
          >
            <Trash2 size={14} /> {t('chat.clear')}
          </button>
        )}
      </div>

      {/* Messages */}
      <GlassCard className="flex-1 overflow-y-auto mb-4 p-4 space-y-4">
        {messages.length === 0 && !streaming ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
            <div className="p-4 bg-indigo-50 rounded-2xl">
              <MessageSquare size={40} className="text-indigo-600 dark:text-indigo-300" />
            </div>
            <div>
              <h3 className="text-[var(--text-primary)] font-semibold mb-1">{t('chat.empty_title')}</h3>
              <p className="text-[var(--text-muted)] text-sm">{t('chat.empty_desc')}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full max-w-md">
              {suggestions.map(s => (
                <button
                  key={s}
                  onClick={() => { setInput(s); inputRef.current?.focus(); }}
                  className="text-left text-xs px-3 py-2 bg-[var(--bg-elevated)] hover:bg-indigo-50 hover:border-indigo-500/40 border border-[var(--border-strong)] rounded-xl text-[var(--text-secondary)] transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center ${
                  m.role === 'user' ? 'bg-indigo-50' : 'bg-violet-500/20'
                }`}>
                  {m.role === 'user' ? <User size={14} className="text-indigo-600 dark:text-indigo-300" /> : <Bot size={14} className="text-violet-500" />}
                </div>
                <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm ${
                  m.role === 'user'
                    ? 'bg-[var(--accent-solid)] text-[var(--accent-fg)] rounded-tr-sm'
                    : 'bg-[var(--bg-elevated)] text-[var(--text-primary)] rounded-tl-sm ai-response'
                }`}>
                  {m.role === 'ai' ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.text}</ReactMarkdown>
                  ) : m.text}
                </div>
              </div>
            ))}

            {/* Streaming message */}
            {streaming && (
              <div className="flex gap-3 flex-row">
                <div className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center bg-violet-500/20">
                  <Bot size={14} className="text-violet-500" />
                </div>
                <div className="max-w-[80%] px-4 py-3 rounded-2xl rounded-tl-sm text-sm bg-[var(--bg-elevated)] text-[var(--text-primary)] ai-response">
                  {streamText
                    ? <><ReactMarkdown remarkPlugins={[remarkGfm]}>{streamText}</ReactMarkdown><span className="inline-block w-2 h-4 bg-indigo-400 ml-0.5 animate-pulse" /></>
                    : <div className="flex gap-1 items-center text-[var(--text-muted)]"><Loader2 size={14} className="animate-spin" /> {t('ai.writing')}</div>
                  }
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </GlassCard>

      {/* Input */}
      <div className="flex gap-3 items-end">
        <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('chat.placeholder')}
            rows={1}
            disabled={sending || streaming}
            className="w-full bg-[var(--bg-elevated)] border border-[var(--border-strong)] focus:border-[var(--accent)] text-[var(--text-primary)] rounded-2xl px-4 py-3 text-sm resize-none outline-none transition-all disabled:opacity-50 placeholder:text-[var(--text-muted)]"
            style={{ minHeight: 48, maxHeight: 160 }}
            onInput={e => {
              const ta = e.target as HTMLTextAreaElement;
              ta.style.height = 'auto';
              ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
            }}
          />
        </div>
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending || streaming}
          className="flex-shrink-0 w-12 h-12 bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] disabled:opacity-40 text-[var(--accent-fg)] rounded-2xl flex items-center justify-center transition-all shadow-lg shadow-black/10"
        >
          {sending || streaming ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </div>
    </div>
  );
}
