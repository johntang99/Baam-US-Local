'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { askHelper, submitHelperFeedback } from './actions';
import BusinessCard from '@/components/map/BusinessCard';

const BaamMap = dynamic(() => import('@/components/map/BaamMap'), { ssr: false });

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  fullContent?: string;
  sources?: {
    type: string;
    title: string;
    url: string;
    snippet?: string;
    isExternal?: boolean;
  }[];
  usedWebFallback?: boolean;
  quickReplies?: string[];
  query?: string; // the user query that triggered this answer
  answerType?: string;
  provider?: string;
  keywords?: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mapBusinesses?: any[];
}

const sourceTypeMeta: Record<string, { icon: string; badgeClass: string }> = {
  'Business': { icon: '🏪', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200' },
  'Guide': { icon: '📘', badgeClass: 'bg-green-50 text-green-700 border-green-200' },
  'Forum': { icon: '💬', badgeClass: 'bg-purple-50 text-purple-700 border-purple-200' },
  'Discover': { icon: '📝', badgeClass: 'bg-rose-50 text-rose-700 border-rose-200' },
  'News': { icon: '📰', badgeClass: 'bg-red-50 text-red-700 border-red-200' },
  'Event': { icon: '🎪', badgeClass: 'bg-orange-50 text-orange-700 border-orange-200' },
  // Chinese labels (from Baam fetcher — will show if fetcher uses Chinese labels)
  '商家': { icon: '🏪', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200' },
  '指南': { icon: '📘', badgeClass: 'bg-green-50 text-green-700 border-green-200' },
  '论坛': { icon: '💬', badgeClass: 'bg-purple-50 text-purple-700 border-purple-200' },
  '新闻': { icon: '📰', badgeClass: 'bg-red-50 text-red-700 border-red-200' },
  '活动': { icon: '🎪', badgeClass: 'bg-orange-50 text-orange-700 border-orange-200' },
  '网页': { icon: '🌐', badgeClass: 'bg-slate-50 text-slate-700 border-slate-200' },
};

const QUESTION_CATEGORIES = [
  {
    icon: '🍕',
    label: 'Food & Dining',
    questions: [
      'Please list the Best restaurants in Middletown?',
      'Best pizza in Middletown for a family dinner?',
      'Where can I get good seafood in Middletown?',
      'Best steakhouse in Middletown?',
    ],
  },
  {
    icon: '🏥',
    label: 'Health & Medical',
    questions: [
      'My tooth has been hurting, who should I see?',
      'Need a pediatrician in Middletown for my 3-year-old',
      'Any good chiropractors near Middletown?',
      'Where can I get an eye exam and glasses?',
    ],
  },
  {
    icon: '🏠',
    label: 'Home Services',
    questions: [
      'My sink is leaking, who should I call?',
      'Need a reliable electrician in Middletown',
      'Looking for a house cleaning service',
      'Who does the best landscaping around here?',
    ],
  },
  {
    icon: '⚖️',
    label: 'Legal & Finance',
    questions: [
      'I got a speeding ticket, what should I do?',
      'Need help with my immigration case',
      'Looking for a good tax preparer in Middletown',
      'Who can help me with estate planning?',
    ],
  },
  {
    icon: '🚗',
    label: 'Auto & Transport',
    questions: [
      'Where can I get my car inspected in Middletown?',
      'My car broke down, who does affordable repairs?',
      'Best place for an oil change near Goshen?',
    ],
  },
  {
    icon: '👶',
    label: 'Family & Education',
    questions: [
      "Looking for daycare that's open on weekends",
      'Good martial arts classes for kids in Middletown?',
      'Any music lessons for beginners nearby?',
    ],
  },
  {
    icon: '💇',
    label: 'Beauty & Wellness',
    questions: [
      'Where can I get a good haircut in Middletown?',
      'Best nail salon in the area?',
      'Looking for a spa day — any recommendations?',
    ],
  },
  {
    icon: '📋',
    label: 'Guides & Info',
    questions: [
      'How do I register my car in New York?',
      'What do I need to know about property taxes?',
      'We just moved here, what should we know?',
      "What's fun to do this weekend with kids?",
    ],
  },
];

const LOADING_MESSAGES = [
  'Looking up the best results...',
  'Checking businesses, guides, and forum...',
  'Verifying ratings and sources...',
  'Almost done — putting together your answer.',
];

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

function extractPhone(text: string): string | null {
  const phoneMatch = text.match(/\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4}/);
  return phoneMatch ? phoneMatch[0] : null;
}

function nodeToText(node: unknown): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map((item) => nodeToText(item)).join('');
  if (node && typeof node === 'object' && 'props' in node) {
    const maybeProps = (node as { props?: { children?: unknown } }).props;
    return nodeToText(maybeProps?.children ?? '');
  }
  return '';
}

function nodeContainsAnchor(node: unknown): boolean {
  if (!node) return false;
  if (Array.isArray(node)) return node.some((item) => nodeContainsAnchor(item));
  if (typeof node === 'object') {
    const maybeNode = node as { type?: unknown; props?: { href?: unknown; children?: unknown } };
    // Check both element type and if it has href (covers custom components)
    if (maybeNode.type === 'a' || maybeNode.props?.href) return true;
    // Check type name for function components
    if (typeof maybeNode.type === 'function' && (maybeNode.type as { name?: string }).name === 'a') return true;
    return nodeContainsAnchor(maybeNode.props?.children);
  }
  return false;
}

function looksLikeAddress(text: string): boolean {
  const cleaned = text.trim();
  if (cleaned.length < 10) return false;
  return /\d/.test(cleaned) && /(st|ave|blvd|rd|dr|lane|ln|way|court|ct|place|pl|street|avenue|broadway|ny)/i.test(cleaned);
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
        const transcript = event.results[0]?.[0]?.transcript || '';
        if (transcript) onResult(transcript);
      };
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);
      recognitionRef.current = recognition;
    }
  }, [onResult]);

  const toggle = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    if (isListening) recognition.stop();
    else { recognition.start(); setIsListening(true); }
  }, [isListening]);

  return { isListening, isSupported, toggle };
}

const markdownComponents: Components = {
  table: ({ children }) => (
    <div className="my-6 rounded-lg border border-border bg-white/60 overflow-hidden">
      {/* Desktop: normal table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full border-collapse text-sm leading-6 [&_th]:whitespace-nowrap [&_th]:bg-bg-page [&_th]:px-2.5 [&_th]:py-2 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:border [&_th]:border-border [&_td]:px-2.5 [&_td]:py-2.5 [&_td]:text-sm [&_td]:align-top [&_td]:border [&_td]:border-border [&_td_p]:my-0">
          {children}
        </table>
      </div>
      {/* Mobile: card layout — CSS transforms table rows into stacked cards */}
      <div className="md:hidden [&_thead]:hidden [&_table]:block [&_tbody]:block [&_tr]:block [&_tr]:border-b [&_tr]:border-border [&_tr]:py-3 [&_tr]:px-4 [&_tr:last-child]:border-b-0 [&_td]:block [&_td]:border-0 [&_td]:px-0 [&_td]:py-0.5 [&_td]:text-sm [&_td:first-child]:font-bold [&_td:first-child]:text-primary [&_td:first-child]:text-xs [&_td:first-child]:mb-0.5 [&_td:nth-child(2)]:font-semibold [&_td:nth-child(2)]:text-base [&_td_p]:my-0">
        <table>
          {children}
        </table>
      </div>
    </div>
  ),
  hr: () => <hr className="mt-6 mb-8 border-border" />,
  a: ({ href, children, ...props }) => {
    if (!href) return <span>{children}</span>;
    if (href.startsWith('tel:')) {
      return <a href={href} {...props} className="underline underline-offset-2 whitespace-nowrap">{children}</a>;
    }
    // Internal links — no target="_blank", no wrapper nesting
    if (href.startsWith('/en/')) {
      return <a href={href} {...props} className="text-text-primary font-semibold hover:text-primary transition-colors">{children}</a>;
    }
    return <a href={href} target="_blank" rel="noopener noreferrer" {...props} className="underline underline-offset-2">{children}</a>;
  },
  td: ({ children, ...props }) => {
    // Never wrap if children already contain a link (prevents <a> inside <a>)
    if (nodeContainsAnchor(children)) return <td {...props}>{children}</td>;
    const text = nodeToText(children).replace(/\s+/g, ' ').trim();
    // Skip auto-linking if text is too short or looks like it contains URL/link artifacts
    if (text.length < 5 || /https?:\/\//.test(text)) return <td {...props}>{children}</td>;
    const phone = extractPhone(text);
    if (phone) {
      const normalized = normalizePhone(phone);
      if (normalized) {
        return (
          <td {...props}>
            <a href={`tel:${normalized}`} className="underline underline-offset-2 whitespace-nowrap" title={`Call ${phone}`}>{children}</a>
          </td>
        );
      }
    }
    if (looksLikeAddress(text)) {
      return (
        <td {...props}>
          <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2" title="Open in Google Maps">{children}</a>
        </td>
      );
    }
    return <td {...props}>{children}</td>;
  },
};

interface HelperChatProps {
  initialQuery?: string;
}

export function HelperChat({ initialQuery }: HelperChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState(initialQuery || '');
  const [loading, setLoading] = useState(false);
  const [renderingAnswer, setRenderingAnswer] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [autoAsked, setAutoAsked] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState<Record<string, 1 | -1>>({}); // messageId → rating
  const [locationContext, setLocationContext] = useState<string>(''); // town name to append
  const [locationMenuOpen, setLocationMenuOpen] = useState(false);
  const locationMenuRef = useRef<HTMLDivElement>(null);
  const [mapView, setMapView] = useState<Record<string, boolean>>({}); // messageId → show map
  const [mapSelectedId, setMapSelectedId] = useState<string | null>(null);
  const [mapExpandedId, setMapExpandedId] = useState<string | null>(null); // which message's map is expanded
  const [mapListMode, setMapListMode] = useState<Record<string, boolean>>({}); // messageId → show list below map

  // Browser back closes expanded map
  useEffect(() => {
    if (!mapExpandedId) return;
    window.history.pushState({ mapExpanded: true }, '');
    const onPopState = () => setMapExpandedId(null);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [mapExpandedId]);
  const lastMsgRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevMsgCount = useRef(0);
  const handleVoiceResult = useCallback((text: string) => { setInput(text); inputRef.current?.focus(); }, []);
  const voice = useVoiceInput(handleVoiceResult);

  // Auto-scroll only when a NEW message is added (not during progressive render)
  useEffect(() => {
    if (messages.length > prevMsgCount.current) {
      lastMsgRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    prevMsgCount.current = messages.length;
  }, [messages.length, loading]);

  useEffect(() => {
    if (!loading && !renderingAnswer) { setLoadingStep(0); return; }
    const timer = setInterval(() => setLoadingStep((p) => (p + 1) % LOADING_MESSAGES.length), 1200);
    return () => clearInterval(timer);
  }, [loading, renderingAnswer]);

  // Close location menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (locationMenuRef.current && !locationMenuRef.current.contains(e.target as Node)) {
        setLocationMenuOpen(false);
      }
    };
    if (locationMenuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [locationMenuOpen]);

  const progressivelyRenderAnswer = useCallback(
    async (messageId: string, fullContent: string, meta: Pick<Message, 'sources' | 'usedWebFallback' | 'quickReplies' | 'query' | 'answerType' | 'provider' | 'keywords' | 'mapBusinesses'>) => {
      setRenderingAnswer(true);
      const total = fullContent.length;
      const isTemplate = meta.provider === 'template' || meta.provider === 'safety-filter';
      // Template answers: fast reveal (~1-2s). AI answers: moderate typing (~2-3s).
      const targetMs = isTemplate
        ? Math.min(1500, Math.max(800, total * 3))
        : Math.min(3000, Math.max(1500, total * 5));
      const tickMs = 16;
      const step = Math.max(4, Math.ceil(total / Math.max(1, Math.floor(targetMs / tickMs))));
      let index = 0;
      while (index < total) {
        const c = fullContent[index] || '';
        const pause = isTemplate ? 0 : (/[.!?\n]/.test(c) ? 12 : 0);
        await new Promise((r) => setTimeout(r, tickMs + pause));
        index = Math.min(index + step, total);
        setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, content: fullContent.slice(0, index) } : m));
      }
      setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, content: fullContent, fullContent: undefined, ...meta } : m));
      // Auto-enable Map View + List mode for messages with map data
      if (meta.mapBusinesses && meta.mapBusinesses.length > 0) {
        setMapView((prev) => ({ ...prev, [messageId]: true }));
        setMapListMode((prev) => ({ ...prev, [messageId]: true }));
      }
      setRenderingAnswer(false);
      inputRef.current?.focus();
    },
    [],
  );

  async function handleAsk(rawQuery: string) {
    let query = rawQuery.trim();
    if (!query || loading) return;
    // Append location context if set and not already in the query
    const townNames = ['middletown', 'goshen', 'monroe', 'newburgh', 'warwick', 'chester', 'cornwall', 'port jervis'];
    const hasLocation = townNames.some(t => query.toLowerCase().includes(t)) || /near me/i.test(query);
    if (locationContext && !hasLocation) {
      query = `${query} in ${locationContext}`;
    }
    const nextHistory = messages.map((m) => ({ role: m.role, content: m.fullContent ?? m.content })) as { role: 'user' | 'assistant'; content: string }[];
    setInput('');
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: 'user', content: query }]);
    setLoading(true);

    // Update URL for shareability (first query only)
    if (messages.length === 0) {
      const url = new URL(window.location.href);
      url.searchParams.set('q', query);
      window.history.replaceState({}, '', url.toString());
    }

    const result = await askHelper(query, nextHistory);
    if (result.error || !result.data) {
      setMessages((prev) => [...prev, { id: `a-err-${Date.now()}`, role: 'assistant', content: result.error || 'Helper is temporarily unavailable.' }]);
      setLoading(false);
      inputRef.current?.focus();
      return;
    }

    const data = result.data;
    const assistantId = `a-${Date.now()}`;
    // Show map/business cards immediately while text animates
    setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '', fullContent: data.answer, mapBusinesses: data.mapBusinesses }]);
    // Auto-enable map view immediately so it shows during typing
    if (data.mapBusinesses && data.mapBusinesses.length > 0) {
      setMapView((prev) => ({ ...prev, [assistantId]: true }));
      setMapListMode((prev) => ({ ...prev, [assistantId]: true }));
    }
    setLoading(false);
    await progressivelyRenderAnswer(assistantId, data.answer, {
      sources: data.sources, usedWebFallback: data.usedWebFallback, quickReplies: data.quickReplies,
      query, answerType: data.intent, provider: data.provider, keywords: data.keywords,
      mapBusinesses: data.mapBusinesses,
    });
  }

  // Auto-ask from URL ?q= parameter — must be after handleAsk is defined
  useEffect(() => {
    if (initialQuery && !autoAsked && !loading) {
      setAutoAsked(true);
      const url = new URL(window.location.href);
      url.searchParams.delete('q');
      window.history.replaceState({}, '', url.toString());
      void handleAsk(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery, autoAsked, loading]);

  function handleNewChat() {
    setMessages([]);
    setInput('');
    setLoading(false);
    setRenderingAnswer(false);
    setFeedbackSent({});
    setMapView({});
    setMapSelectedId(null);
    setMapExpandedId(null);
    setMapListMode({});
    // Clear URL query param
    const url = new URL(window.location.href);
    url.searchParams.delete('q');
    window.history.replaceState({}, '', url.toString());
    inputRef.current?.focus();
  }

  return (
    <div>
      {/* New Chat button — shown when conversation has messages */}
      {messages.length > 0 && !loading && !renderingAnswer && (
        <div className="max-w-3xl mx-auto flex justify-end mb-3">
          <button type="button" onClick={handleNewChat}
            className="flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-primary px-3 py-1.5 rounded-lg border border-border hover:border-primary/30 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            New Chat
          </button>
        </div>
      )}

      <div className="space-y-4 pb-20 min-h-[220px]">
        {messages.length === 0 && !loading && !renderingAnswer && (
          <div className="max-w-6xl mx-auto">
            <p className="text-center text-text-muted text-sm mb-6">
              What can I help you with today?
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {QUESTION_CATEGORIES.map((cat) => (
                <div key={cat.label} className="space-y-1.5">
                  <div className="flex items-center gap-1.5 px-1 mb-2">
                    <span className="text-base">{cat.icon}</span>
                    <span className="text-xs font-semibold text-text-secondary">{cat.label}</span>
                  </div>
                  {cat.questions.map((q) => (
                    <button key={q} type="button" onClick={() => void handleAsk(q)} disabled={loading}
                      className="w-full text-left text-[13px] leading-snug text-text-primary bg-bg-card border border-border rounded-xl px-3 py-2.5 hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-colors disabled:opacity-50">
                      &ldquo;{q}&rdquo;
                    </button>
                  ))}
                </div>
              ))}
            </div>
            <p className="text-center text-[11px] text-text-muted mt-6">
              💡 Or just type anything — I know about 12,000+ local businesses, guides, events, and more
            </p>
          </div>
        )}

        {/* Messages area — narrower for readability */}
        <div className="max-w-3xl mx-auto space-y-4">
        {messages.map((message, msgIdx) => {
          // Skip empty assistant messages (content fills in progressively; loading indicator handles this state)
          if (message.role === 'assistant' && !message.content) return null;
          return (
          <div key={message.id} ref={msgIdx === messages.length - 1 ? lastMsgRef : undefined} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[90%] ${message.role === 'user' ? 'bg-primary text-white rounded-2xl rounded-br-md px-4 py-3' : 'bg-bg-card border border-border rounded-2xl rounded-bl-md px-5 py-4'}`}>
              {message.role === 'assistant' && message.content.length > 10 && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm">👩‍💼</span>
                  <span className="text-xs font-medium text-primary">Helper</span>
                  {message.usedWebFallback && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">+ web</span>
                  )}
                </div>
              )}
              {/* Map/List toggle for business recommendations — shows immediately */}
              {message.mapBusinesses && message.mapBusinesses.length > 0 && (
                <div className="flex border border-border rounded-lg overflow-hidden mb-4">
                  <button type="button" onClick={() => setMapView(prev => ({ ...prev, [message.id]: false }))}
                    className={`flex-1 py-2 text-xs font-semibold transition-colors ${!mapView[message.id] ? 'bg-bg-card text-text-primary' : 'bg-bg-page text-text-muted'}`}>
                    📋 List View
                  </button>
                  <button type="button" onClick={() => setMapView(prev => ({ ...prev, [message.id]: true }))}
                    className={`flex-1 py-2 text-xs font-semibold transition-colors ${mapView[message.id] ? 'bg-primary/10 text-primary border-b-2 border-primary' : 'bg-bg-page text-text-muted'}`}>
                    📍 Map View
                  </button>
                </div>
              )}

              {/* Map view (when toggled) */}
              {mapView[message.id] && message.mapBusinesses && (
                <>
                  {/* Google Maps-style expanded overlay: sidebar + map */}
                  {mapExpandedId === message.id && (
                    <div className="fixed inset-0 z-[9999] bg-white flex flex-col">
                      {/* Top bar */}
                      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border flex-shrink-0">
                        <span className="text-sm font-semibold">{message.mapBusinesses.length} results</span>
                        <button type="button" onClick={() => { setMapExpandedId(null); window.history.back(); }}
                          className="flex items-center gap-1.5 text-sm font-semibold text-text-secondary hover:text-primary transition-colors">
                          ← Back to Helper
                        </button>
                      </div>
                      {/* Sidebar + Map */}
                      <div className="flex flex-1 overflow-hidden">
                        {/* Left sidebar — business list */}
                        <div className="w-[360px] border-r border-border flex-shrink-0 overflow-y-auto hidden md:block">
                          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                          {message.mapBusinesses.map((biz: any, i: number) => (
                            <div key={biz.id}>
                              <BusinessCard business={biz} rank={i + 1} isActive={biz.id === mapSelectedId} onClick={() => setMapSelectedId(biz.id)} />
                            </div>
                          ))}
                        </div>
                        {/* Right map */}
                        <div className="flex-1">
                          <BaamMap businesses={message.mapBusinesses} selectedId={mapSelectedId} onSelectBusiness={(biz) => setMapSelectedId(biz?.id || null)} height="100%" className="rounded-none" />
                        </div>
                      </div>
                    </div>
                  )}
                  {/* Inline map */}
                  <div className="mb-4">
                    <div className="relative rounded-xl overflow-hidden border border-border">
                      <BaamMap businesses={message.mapBusinesses} selectedId={mapSelectedId} onSelectBusiness={(biz) => setMapSelectedId(biz?.id || null)} height="400px" />
                      <button type="button" onClick={() => setMapExpandedId(message.id)}
                        className="absolute top-3 left-3 z-[500] bg-white border border-border rounded-lg px-2.5 py-1.5 text-xs font-semibold text-text-secondary hover:text-primary hover:border-primary shadow-sm transition-colors"
                        title="Expand map">
                        ⛶ Expand
                      </button>
                    </div>

                    {/* Toggle: horizontal scroll vs vertical list */}
                    <div className="flex items-center justify-between mt-3 mb-2">
                      <span className="text-xs text-text-muted">{message.mapBusinesses.length} businesses</span>
                      <div className="flex border border-border rounded-md overflow-hidden">
                        <button type="button" onClick={() => setMapListMode(prev => ({ ...prev, [message.id]: false }))}
                          className={`px-2 py-1 text-[11px] font-semibold transition-colors ${!mapListMode[message.id] ? 'bg-primary/10 text-primary' : 'text-text-muted hover:text-text-secondary'}`}>
                          Cards
                        </button>
                        <button type="button" onClick={() => setMapListMode(prev => ({ ...prev, [message.id]: true }))}
                          className={`px-2 py-1 text-[11px] font-semibold transition-colors border-l border-border ${mapListMode[message.id] ? 'bg-primary/10 text-primary' : 'text-text-muted hover:text-text-secondary'}`}>
                          List
                        </button>
                      </div>
                    </div>

                    {mapListMode[message.id] ? (
                      /* Vertical list view */
                      <div className="space-y-2">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {message.mapBusinesses.map((biz: any, i: number) => (
                          <BusinessCard key={biz.id} business={biz} rank={i + 1} isActive={biz.id === mapSelectedId} onClick={() => setMapSelectedId(biz.id)} />
                        ))}
                      </div>
                    ) : (
                      /* Horizontal scroll cards */
                      <>
                        <div className="flex gap-2.5 overflow-x-auto py-1 no-scrollbar">
                          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                          {message.mapBusinesses.slice(0, 10).map((biz: any, i: number) => (
                            <BusinessCard key={biz.id} business={biz} rank={i + 1} isActive={biz.id === mapSelectedId} onClick={() => setMapSelectedId(biz.id)} compact />
                          ))}
                        </div>
                        <p className="text-[11px] text-text-muted text-center mt-1">← Scroll for more results →</p>
                      </>
                    )}
                  </div>
                </>
              )}

              {/* Content — always shown; in map view, strip business tables to avoid duplication */}
              {!message.fullContent && (() => {
                let content = message.content;
                // When map view is active and showing businesses, remove markdown tables
                // (the map + business cards already display them)
                // Exception: comparison type — keep the side-by-side comparison table
                if (mapView[message.id] && message.mapBusinesses && message.mapBusinesses.length > 1 && message.answerType !== 'comparison') {
                  // Strip markdown tables: header row + separator row + data rows
                  content = content.replace(/\n*\|[^\n]+\|\n\|[\s:|-]+\|\n(?:\|[^\n]+\|\n?)*/gm, '\n');
                  // Strip "Recommended X" or "Top X" headers that preceded the table
                  content = content.replace(/\n*#{1,3}\s*(?:🏪|📋|🔍)?\s*(?:Recommended|Top \d+|Here are)[^\n]*\n*/gi, '\n');
                  // Clean up multiple blank lines
                  content = content.replace(/\n{3,}/g, '\n\n').trim();
                }
                return (
                  <div className="text-[15px] leading-7 prose prose-sm max-w-none prose-p:my-3 prose-li:my-1 [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-[15px] [&_h3]:font-bold [&_h3]:mt-10 [&_h3]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_strong]:font-semibold [&_hr]:my-10">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                      {content}
                    </ReactMarkdown>
                  </div>
                );
              })()}

              {message.sources && message.sources.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-xs text-text-muted mb-2">Sources</p>
                  <div className="space-y-2">
                    {message.sources.slice(0, 8).map((source, i) => {
                      const href = source.isExternal ? source.url : `/en${source.url}`;
                      const meta = sourceTypeMeta[source.type] || { icon: '📎', badgeClass: 'bg-border-light text-text-secondary border-border' };
                      return (
                        <a key={`${source.title}-${i}`} href={href} target="_blank" rel="noopener noreferrer"
                          className="block rounded-xl border border-border px-3.5 py-3 hover:bg-bg-page transition">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${meta.badgeClass}`}>
                              <span>{meta.icon}</span>
                              <span>{source.type}</span>
                            </span>
                            <span className="text-sm font-semibold text-text-primary line-clamp-1">{source.title}</span>
                          </div>
                          {source.snippet && <p className="text-xs leading-5 text-text-secondary line-clamp-2">{source.snippet}</p>}
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}

              {message.quickReplies && message.quickReplies.length > 0 && (
                <div className="mt-4 pt-3 border-t border-border">
                  <div className="flex flex-wrap gap-2">
                    {message.quickReplies.map((chip) => (
                      <button key={chip} type="button" onClick={() => void handleAsk(chip)} disabled={loading || renderingAnswer}
                        className="text-xs bg-primary/5 text-primary border border-primary/20 px-3 py-1.5 rounded-full hover:bg-primary/15 transition disabled:opacity-50">
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Feedback thumbs */}
              {message.role === 'assistant' && message.query && !message.fullContent && (
                <div className="mt-3 pt-3 border-t border-border flex items-center gap-3">
                  <span className="text-xs text-text-muted">Was this helpful?</span>
                  {feedbackSent[message.id] ? (
                    <span className="text-xs text-text-muted">
                      {feedbackSent[message.id] === 1 ? '👍 Thanks!' : '👎 Thanks for the feedback'}
                    </span>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setFeedbackSent(prev => ({ ...prev, [message.id]: 1 }));
                          void submitHelperFeedback(message.query!, 1, {
                            answerType: message.answerType, keywords: message.keywords, provider: message.provider,
                          });
                        }}
                        className="text-lg hover:scale-125 transition-transform"
                        title="Helpful"
                      >👍</button>
                      <button
                        type="button"
                        onClick={() => {
                          setFeedbackSent(prev => ({ ...prev, [message.id]: -1 }));
                          void submitHelperFeedback(message.query!, -1, {
                            answerType: message.answerType, keywords: message.keywords, provider: message.provider,
                          });
                        }}
                        className="text-lg hover:scale-125 transition-transform"
                        title="Not helpful"
                      >👎</button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          );
        })}

        {(loading || renderingAnswer) && (
          <div className="flex justify-start">
            <div className="bg-bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-sm">👩‍💼</span>
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-xs text-text-muted">{loading ? LOADING_MESSAGES[loadingStep] : 'Rendering answer...'}</span>
              </div>
            </div>
          </div>
        )}

        <div />
        </div>{/* end max-w-3xl messages wrapper */}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); void handleAsk(input); }} className="sticky bottom-8 max-w-3xl mx-auto">
        <div className="bg-bg-card border-2 border-primary/20 rounded-2xl shadow-[0_4px_24px_rgba(249,115,22,0.12)] overflow-visible">
          {/* Row 1: Text input */}
          <div className="px-5 pt-4 pb-2">
            <input
              ref={inputRef} type="text" value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading || renderingAnswer}
              placeholder={voice.isListening ? 'Listening...' : (locationContext ? `Ask about ${locationContext}...` : 'Ask Helper anything about the local community...')}
              className="w-full text-[15px] outline-none bg-transparent text-text-primary placeholder:text-text-muted/60"
            />
          </div>

          {/* Row 2: Controls */}
          <div className="flex items-center justify-between px-3 pb-3 pt-0.5">
            {/* Left controls */}
            <div className="flex items-center gap-1.5">
              {/* "+" location button */}
              <div className="relative" ref={locationMenuRef}>
                <button type="button"
                  onClick={() => setLocationMenuOpen(!locationMenuOpen)}
                  className={`h-9 w-9 flex items-center justify-center rounded-full border-2 transition-all ${
                    locationContext
                      ? 'border-primary text-white bg-primary hover:bg-primary/90 shadow-sm'
                      : 'border-primary/40 text-primary hover:border-primary hover:bg-primary/10'
                  }`}
                  title="Set location context">
                  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                </button>

                {/* Location dropdown — two columns */}
                {locationMenuOpen && (
                  <div className="absolute bottom-11 left-0 bg-bg-card border border-border rounded-xl shadow-xl p-2 w-[340px] z-50">
                    <p className="text-[10px] text-text-muted px-2 pt-0.5 pb-2 font-medium uppercase tracking-wide">Set your location</p>

                    {/* GPS button — full width */}
                    <button type="button"
                      onClick={() => {
                        if (navigator.geolocation) {
                          navigator.geolocation.getCurrentPosition(
                            () => { setLocationContext('near me'); setLocationMenuOpen(false); },
                            () => { setLocationContext('Middletown'); setLocationMenuOpen(false); },
                            { enableHighAccuracy: false, timeout: 10000 },
                          );
                        } else { setLocationContext('Middletown'); setLocationMenuOpen(false); }
                      }}
                      className={`w-full text-left text-sm px-3 py-2 rounded-lg mb-1.5 transition-colors ${
                        locationContext === 'near me' ? 'bg-primary/10 text-primary font-medium' : 'text-text-primary hover:bg-bg-page'
                      }`}
                    >📍 Use my location</button>

                    {/* Town grid — two columns */}
                    <div className="grid grid-cols-2 gap-1">
                      {[
                        { label: 'Middletown', value: 'Middletown' },
                        { label: 'Goshen', value: 'Goshen' },
                        { label: 'Monroe', value: 'Monroe' },
                        { label: 'Newburgh', value: 'Newburgh' },
                        { label: 'Warwick', value: 'Warwick' },
                        { label: 'Chester', value: 'Chester' },
                        { label: 'Cornwall', value: 'Cornwall' },
                        { label: 'Port Jervis', value: 'Port Jervis' },
                      ].map((item) => (
                        <button key={item.value} type="button"
                          onClick={() => { setLocationContext(item.value); setLocationMenuOpen(false); }}
                          className={`text-left text-sm px-3 py-2 rounded-lg transition-colors ${
                            locationContext === item.value ? 'bg-primary/10 text-primary font-medium' : 'text-text-primary hover:bg-bg-page'
                          }`}
                        >🏘️ {item.label}</button>
                      ))}
                    </div>

                    {locationContext && (
                      <>
                        <div className="border-t border-border mt-1.5 mb-1" />
                        <button type="button" onClick={() => { setLocationContext(''); setLocationMenuOpen(false); }}
                          className="w-full text-left text-sm px-3 py-2 rounded-lg text-red-500 hover:bg-red-50 transition-colors">
                          ✕ Clear location
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Location badge — shown inline when selected */}
              {locationContext && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-primary bg-primary/5 border border-primary/15 rounded-full px-2 py-0.5">
                  📍 {locationContext}
                  <button type="button" onClick={() => setLocationContext('')} className="hover:text-red-500 ml-0.5 text-[10px]">✕</button>
                </span>
              )}
            </div>

            {/* Right controls */}
            <div className="flex items-center gap-1">
              {voice.isSupported && (
                <button type="button" onClick={voice.toggle} disabled={loading || renderingAnswer}
                  className={`h-9 w-9 flex items-center justify-center rounded-full transition-all ${
                    voice.isListening ? 'bg-red-500 text-white animate-pulse shadow-md' : 'text-primary hover:bg-primary/10'
                  } disabled:opacity-50`}
                  title={voice.isListening ? 'Stop' : 'Voice input'}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4.5 h-4.5">
                    {voice.isListening
                      ? <path d="M6 6h12v12H6z" />
                      : <path d="M12 14a3 3 0 003-3V5a3 3 0 10-6 0v6a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 0014 0h-2zm-4 7.93A7.001 7.001 0 0012 19a7.001 7.001 0 01-1 0V22h2v-3.07z" />
                    }
                  </svg>
                </button>
              )}
              <button type="submit" disabled={loading || renderingAnswer || !input.trim()}
                className={`h-9 w-9 flex items-center justify-center rounded-full transition-all ${
                  input.trim() ? 'bg-primary text-white hover:bg-primary/90 shadow-md' : 'bg-primary/10 text-primary/40'
                } disabled:opacity-40`}
                title="Send">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
