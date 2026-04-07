'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { askXiaoLin } from './actions';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface DebugPrompt {
  intent?: string;
  keywords: string[];
  systemPrompt: string;
  userPrompt: string;
  model: string;
  totalResults: number;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: { type: string; title: string; url: string; snippet?: string }[];
  relatedQuestions?: string[];
  debugPrompt?: DebugPrompt;
}

// ─── Voice input hook ────────────────────────────────────────
function useVoiceInput(onResult: (text: string) => void) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      setIsSupported(true);
      const recognition = new SR();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.continuous = false;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) onResult(transcript);
      };
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);

      recognitionRef.current = recognition;
    }
  }, [onResult]);

  const toggle = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    if (isListening) {
      rec.stop();
    } else {
      rec.start();
      setIsListening(true);
    }
  }, [isListening]);

  return { isListening, isSupported, toggle };
}

const SUGGESTED_QUESTIONS = [
  'Where can I find a family doctor nearby?',
  'What are the best restaurants in Middletown?',
  'What should I know about property taxes?',
  'What weekend events are coming up?',
  'Where can I find a good auto mechanic?',
  'How do I get a driver\'s license in NY?',
];

interface AskChatProps {
  initialQuery?: string;
}

export function AskChat({ initialQuery }: AskChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasAutoAsked, setHasAutoAsked] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleVoiceResult = useCallback((text: string) => {
    setInput(text);
    inputRef.current?.focus();
  }, []);
  const voice = useVoiceInput(handleVoiceResult);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-ask if initial query is provided (from homepage search)
  useEffect(() => {
    if (initialQuery && !hasAutoAsked) {
      setHasAutoAsked(true);
      handleAsk(initialQuery);
    }
  }, [initialQuery, hasAutoAsked]);

  const handleAsk = useCallback(async (query: string) => {
    const q = query.trim();
    if (!q) return;

    setInput('');
    // Capture current messages BEFORE adding the new user message
    const currentMessages = [...messages];
    setMessages(prev => [...prev, { role: 'user', content: q }]);
    setLoading(true);

    // Pass conversation history so AI can handle follow-ups like "需要", "再推荐几个"
    const history = currentMessages.map(m => ({ role: m.role, content: m.content }));
    const result = await askXiaoLin(q, history);

    if (result.error) {
      setMessages(prev => [...prev, { role: 'assistant', content: result.error! }]);
    } else if (result.data) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: result.data!.answer,
        sources: result.data!.sources,
        relatedQuestions: result.data!.relatedQuestions,
        debugPrompt: result.data!.debugPrompt,
      }]);
    }

    setLoading(false);
    inputRef.current?.focus();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !loading) {
      handleAsk(input);
    }
  };

  const [showPrompt, setShowPrompt] = useState<DebugPrompt | null>(null);

  const sourceTypeColors: Record<string, string> = {
    'Business': 'bg-blue-100 text-blue-700',
    'Guide': 'bg-green-100 text-green-700',
    'News': 'bg-red-100 text-red-700',
    'Forum': 'bg-purple-100 text-purple-700',
    'Event': 'bg-orange-100 text-orange-700',
    'Voice': 'bg-pink-100 text-pink-700',
    'Note': 'bg-rose-100 text-rose-700',
  };

  // Helper: find phone numbers in React children and wrap them in <a href="tel:">
  function linkifyPhones(children: React.ReactNode): React.ReactNode {
    if (!children) return children;
    const phoneRegex = /(\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4})/g;
    return Array.isArray(children) ? children.map((child, idx) => {
      if (typeof child !== 'string') return child;
      const parts = child.split(phoneRegex);
      if (parts.length === 1) return child;
      return parts.map((part, j) => {
        if (phoneRegex.test(part)) {
          phoneRegex.lastIndex = 0; // reset regex
          const digits = part.replace(/\D/g, '');
          return <a key={`${idx}-${j}`} href={`tel:+1${digits}`} className="text-primary underline">{part}</a>;
        }
        return part;
      });
    }) : typeof children === 'string' ? (() => {
      const parts = children.split(phoneRegex);
      if (parts.length === 1) return children;
      return parts.map((part, j) => {
        if (phoneRegex.test(part)) {
          phoneRegex.lastIndex = 0;
          const digits = part.replace(/\D/g, '');
          return <a key={j} href={`tel:+1${digits}`} className="text-primary underline">{part}</a>;
        }
        return part;
      });
    })() : children;
  }

  return (
    <div>
      {/* Prompt Debug Modal */}
      {showPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowPrompt(null)}>
          <div className="bg-bg-card rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-semibold">AI Prompt Debug</h3>
              <button onClick={() => setShowPrompt(null)} className="text-text-muted hover:text-text-primary text-lg">&times;</button>
            </div>
            <div className="p-4 space-y-4 text-sm">
              <div>
                <p className="font-medium text-text-muted mb-1">Model</p>
                <p className="bg-bg-page rounded px-3 py-1.5 font-mono text-xs">{showPrompt.model}</p>
              </div>
              <div>
                <p className="font-medium text-text-muted mb-1">Extracted Keywords</p>
                <div className="flex flex-wrap gap-1">
                  {showPrompt.keywords.map((kw, i) => (
                    <span key={i} className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs">{kw}</span>
                  ))}
                </div>
              </div>
              <div>
                <p className="font-medium text-text-muted mb-1">Found {showPrompt.totalResults} results</p>
              </div>
              <div>
                <p className="font-medium text-text-muted mb-1">System Prompt</p>
                <pre className="bg-bg-page rounded px-3 py-2 text-xs whitespace-pre-wrap overflow-x-auto max-h-40 overflow-y-auto">{showPrompt.systemPrompt}</pre>
              </div>
              <div>
                <p className="font-medium text-text-muted mb-1">User Prompt</p>
                <pre className="bg-bg-page rounded px-3 py-2 text-xs whitespace-pre-wrap overflow-x-auto max-h-60 overflow-y-auto">{showPrompt.userPrompt}</pre>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`System:\n${showPrompt.systemPrompt}\n\nUser:\n${showPrompt.userPrompt}`);
                }}
                className="text-xs text-primary hover:underline"
              >
                Copy Full Prompt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="space-y-4 mb-6 min-h-[200px]">
        {messages.length === 0 && !loading && (
          <div className="text-center py-8">
            <p className="text-text-muted text-sm mb-6">
              Ask me anything, and I will find answers from our community news, guides, businesses, forum, voices, and events
            </p>
            {/* Suggested questions inside chat component */}
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => handleAsk(q)}
                  disabled={loading}
                  className="text-xs bg-border-light text-text-secondary px-3 py-1.5 rounded-full hover:bg-primary/10 hover:text-primary transition cursor-pointer disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] ${
              msg.role === 'user'
                ? 'bg-primary text-white rounded-2xl rounded-br-md px-4 py-3'
                : 'bg-bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3'
            }`}>
              {msg.role === 'assistant' && (
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-sm">🤖</span>
                  <span className="text-xs font-medium text-primary">AI Assistant</span>
                </div>
              )}
              <div className="text-sm leading-relaxed prose prose-sm max-w-none [&_h2]:text-base [&_h2]:font-bold [&_h2]:mt-3 [&_h2]:mb-2 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:mb-2 [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:mb-2 [&_li]:mb-0.5 [&_strong]:font-semibold [&_hr]:my-3 [&_hr]:border-border [&_table]:w-full [&_table]:text-xs [&_table]:border-collapse [&_table]:my-3 [&_table]:rounded-lg [&_table]:overflow-hidden [&_table]:border [&_table]:border-border [&_thead]:bg-bg-page [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:text-text-secondary [&_th]:border-b [&_th]:border-border [&_th]:text-[11px] [&_th]:uppercase [&_th]:tracking-wider [&_td]:px-3 [&_td]:py-2 [&_td]:border-b [&_td]:border-border/50 [&_td]:align-top [&_tr:last-child_td]:border-b-0 [&_tr:hover]:bg-primary/5 [&_tbody_tr:nth-child(even)]:bg-bg-page/30">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    // Wrap tables in scrollable container for mobile
                    table: ({ children, ...props }) => (
                      <div className="overflow-x-auto -mx-1 px-1">
                        <table {...props}>{children}</table>
                      </div>
                    ),
                    // Make phone numbers click-to-call
                    td: ({ children, ...props }) => {
                      const text = String(children);
                      // Match phone patterns like (718) 275-2688, 917-900-7777, etc.
                      const phoneMatch = text.match(/\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4}/);
                      if (phoneMatch) {
                        const phone = phoneMatch[0];
                        const digits = phone.replace(/\D/g, '');
                        return (
                          <td {...props}>
                            <a href={`tel:+1${digits}`} className="text-primary underline whitespace-nowrap">
                              {text}
                            </a>
                          </td>
                        );
                      }
                      return <td {...props}>{children}</td>;
                    },
                    // Also make inline phone numbers clickable in paragraphs/list items
                    p: ({ children, ...props }) => {
                      return <p {...props}>{linkifyPhones(children)}</p>;
                    },
                    li: ({ children, ...props }) => {
                      return <li {...props}>{linkifyPhones(children)}</li>;
                    },
                  }}
                >{msg.content}</ReactMarkdown>
              </div>

              {/* Sources + Debug prompt link */}
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-text-muted">Sources:</p>
                    {msg.debugPrompt && (
                      <button
                        type="button"
                        onClick={() => setShowPrompt(msg.debugPrompt!)}
                        className="text-[10px] text-text-muted hover:text-primary transition-colors"
                      >
                        View Prompt
                      </button>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {msg.sources.slice(0, 8).map((source, j) => (
                      <a
                        key={j}
                        href={`/en${source.url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs hover:bg-bg-page rounded px-2 py-1 -mx-2 transition-colors"
                      >
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${sourceTypeColors[source.type] || 'bg-gray-100 text-gray-700'}`}>
                          {source.type}
                        </span>
                        <span className="text-text-primary hover:text-primary truncate">{source.title}</span>
                        <svg className="w-3 h-3 text-text-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Related Questions — clickable suggestions */}
              {msg.relatedQuestions && msg.relatedQuestions.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border/50">
                  <p className="text-xs text-text-muted mb-2">🔍 People also ask:</p>
                  <div className="flex flex-wrap gap-2">
                    {msg.relatedQuestions.map((rq, j) => (
                      <button
                        key={j}
                        type="button"
                        onClick={() => { setInput(rq); handleAsk(rq); }}
                        className="text-xs text-left px-3 py-1.5 rounded-full border border-primary/30 text-primary hover:bg-primary/5 hover:border-primary/50 transition-colors"
                      >
                        {rq}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-sm">🤖</span>
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-xs text-text-muted">Searching...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="sticky bottom-4">
        <div className="flex gap-2 bg-bg-card border border-border rounded-xl p-2 shadow-lg">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={voice.isListening ? 'Listening...' : 'Ask me any local question...'}
            disabled={loading}
            className="flex-1 h-10 px-3 text-sm outline-none bg-transparent"
          />
          {voice.isSupported && (
            <button
              type="button"
              onClick={voice.toggle}
              disabled={loading}
              className={`h-10 w-10 flex items-center justify-center rounded-lg transition-colors flex-shrink-0 ${
                voice.isListening
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-bg-page text-text-secondary hover:bg-primary/10 hover:text-primary'
              } disabled:opacity-50`}
              title={voice.isListening ? 'Stop voice' : 'Voice input'}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                {voice.isListening ? (
                  <path d="M6 6h12v12H6z" />
                ) : (
                  <path d="M12 14a3 3 0 003-3V5a3 3 0 10-6 0v6a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 0014 0h-2zm-4 7.93A7.001 7.001 0 0112 19a7.001 7.001 0 01-1 0V22h2v-3.07z" />
                )}
              </svg>
            </button>
          )}
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="h-10 px-5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark disabled:opacity-50 transition-colors flex-shrink-0"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
