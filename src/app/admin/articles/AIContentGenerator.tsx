'use client';

import { useState } from 'react';
import { aiGenerateArticle } from './actions';

const styles = [
  { value: 'practical_guide', label: 'Practical Guide', desc: 'How-to, step-by-step advice' },
  { value: 'news_report', label: 'News Report', desc: 'Current events, policies, incidents' },
  { value: 'in_depth_analysis', label: 'In-Depth Analysis', desc: 'Background, impact analysis' },
  { value: 'lifestyle', label: 'Lifestyle', desc: 'Personal experience, stories' },
];

const tones = [
  { value: 'friendly', label: 'Friendly' },
  { value: 'professional', label: 'Professional' },
  { value: 'casual', label: 'Casual' },
];

const audiences = [
  { value: 'new_immigrants', label: 'New Immigrants' },
  { value: 'families', label: 'Families' },
  { value: 'businesses', label: 'Businesses' },
  { value: 'students', label: 'Students' },
  { value: 'everyone', label: 'Everyone' },
];

interface AIContentGeneratorProps {
  onGenerated: (data: {
    title_zh: string;
    title_en: string;
    body_zh: string;
    body_en: string;
    ai_summary_zh: string;
    ai_summary_en: string;
    ai_tags: string[];
    ai_faq: Array<{ q: string; a: string }>;
    seo_title_zh: string;
    seo_desc_zh: string;
  }, meta?: { prompt: string; model: string; tokens: number }) => void;
}

export function AIContentGenerator({ onGenerated }: AIContentGeneratorProps) {
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<'generate' | 'rewrite'>('generate');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastPrompt, setLastPrompt] = useState('');
  const [lastModel, setLastModel] = useState('');
  const [lastTokens, setLastTokens] = useState(0);
  const [showPromptModal, setShowPromptModal] = useState(false);

  // Generate mode
  const [topic, setTopic] = useState('');
  const [keywords, setKeywords] = useState('');
  const [region, setRegion] = useState('New York');
  const [category, setCategory] = useState('Guide');
  const [style, setStyle] = useState('practical_guide');
  const [tone, setTone] = useState('friendly');
  const [audience, setAudience] = useState('everyone');
  const [sourceUrl, setSourceUrl] = useState('');
  const [notes, setNotes] = useState('');

  // Rewrite mode
  const [sourceContent, setSourceContent] = useState('');

  const handleGenerate = async () => {
    setError('');
    setLoading(true);

    const result = await aiGenerateArticle({
      mode,
      topic,
      keywords,
      region,
      category,
      style,
      tone,
      audience,
      sourceUrl,
      notes,
      sourceContent,
    });

    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    if (result.article) {
      const meta = { prompt: result.prompt || '', model: result.model || '', tokens: result.tokens || 0 };
      setLastPrompt(meta.prompt);
      setLastModel(meta.model);
      setLastTokens(meta.tokens);
      onGenerated(result.article, meta);
      setExpanded(false);
    }
  };

  const inputClass = 'w-full h-9 px-3 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-bg-card';
  const selectClass = 'w-full h-9 px-3 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-bg-card cursor-pointer';

  return (
    <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl overflow-hidden mb-6">
      {/* Header - always visible */}
      <div className="flex items-center justify-between px-5 py-4">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <span className="text-lg">🤖</span>
          <span className="font-semibold text-sm">AI Content Generator</span>
          <span className="text-xs text-text-muted bg-blue-100 px-2 py-0.5 rounded-full">Enter a topic, generate a full article in one click</span>
        </button>
        <div className="flex items-center gap-3">
          {lastPrompt && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowPromptModal(true); }}
              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
              View Prompt ({lastModel} · {lastTokens} tokens)
            </button>
          )}
          <button type="button" onClick={() => setExpanded(!expanded)}>
            <svg className={`w-4 h-4 text-text-muted transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-blue-200">
          {/* Mode Toggle */}
          <div className="flex gap-2 mt-4 mb-4">
            <button
              type="button"
              onClick={() => setMode('generate')}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                mode === 'generate'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-border text-text-secondary hover:bg-gray-50'
              }`}
            >
              Generate from Scratch
            </button>
            <button
              type="button"
              onClick={() => setMode('rewrite')}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                mode === 'rewrite'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-border text-text-secondary hover:bg-gray-50'
              }`}
            >
              Rewrite Existing Content
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>
          )}

          {mode === 'generate' ? (
            <div className="space-y-3">
              {/* Row 1: Topic + Keywords */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Topic / Title *</label>
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g.: Best family doctors in Middletown"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Keywords</label>
                  <input
                    type="text"
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                    placeholder="Comma separated, e.g.: family doctor, Middletown, insurance"
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Row 2: Region + Category + Style + Tone */}
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Region</label>
                  <select value={region} onChange={(e) => setRegion(e.target.value)} className={selectClass}>
                    <option value="New York">New York</option>
                    <option value="Orange County">Orange County</option>
                    <option value="Middletown">Middletown</option>
                    <option value="Goshen">Goshen</option>
                    <option value="Monroe">Monroe</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Category</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectClass}>
                    <option value="Guide">Guide</option>
                    <option value="News">News</option>
                    <option value="Comparison">Comparison</option>
                    <option value="Checklist">Checklist</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Writing Style</label>
                  <select value={style} onChange={(e) => setStyle(e.target.value)} className={selectClass}>
                    {styles.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Tone</label>
                  <select value={tone} onChange={(e) => setTone(e.target.value)} className={selectClass}>
                    {tones.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 3: Audience + Source URL */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Target Audience</label>
                  <select value={audience} onChange={(e) => setAudience(e.target.value)} className={selectClass}>
                    {audiences.map((a) => (
                      <option key={a.value} value={a.value}>{a.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Reference Source URL</label>
                  <input
                    type="url"
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    placeholder="https://... (optional)"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Editor Notes</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Additional instructions for AI (optional)"
                    className={inputClass}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Source Content */}
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Source Content *</label>
                <textarea
                  value={sourceContent}
                  onChange={(e) => setSourceContent(e.target.value)}
                  placeholder="Paste the original content to rewrite..."
                  rows={6}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-bg-card resize-y"
                />
              </div>

              {/* Row: Style + Tone + Audience + Notes */}
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Rewrite Style</label>
                  <select value={style} onChange={(e) => setStyle(e.target.value)} className={selectClass}>
                    {styles.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Tone</label>
                  <select value={tone} onChange={(e) => setTone(e.target.value)} className={selectClass}>
                    {tones.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Target Audience</label>
                  <select value={audience} onChange={(e) => setAudience(e.target.value)} className={selectClass}>
                    {audiences.map((a) => (
                      <option key={a.value} value={a.value}>{a.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Editor Notes</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Additional instructions for AI"
                    className={inputClass}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Generate Button + Prompt Link */}
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading || (mode === 'generate' ? !topic.trim() : !sourceContent.trim())}
              className="h-10 px-6 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  AI Generating (Opus model, ~30-60s)...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  {mode === 'generate' ? 'AI Generate Full Article' : 'AI Rewrite Article'}
                </>
              )}
            </button>
            {loading && (
              <span className="text-xs text-text-muted">Will auto-fill title, body, summary, FAQ, SEO...</span>
            )}
          </div>
        </div>
      )}

      {/* Prompt Modal */}
      {showPromptModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]" onClick={() => setShowPromptModal(false)}>
          <div className="bg-white rounded-xl max-w-3xl w-[90%] max-h-[80vh] shadow-xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h3 className="font-semibold text-base">AI Prompt</h3>
                <p className="text-xs text-text-muted mt-0.5">Model: {lastModel} · Tokens: {lastTokens}</p>
              </div>
              <button onClick={() => setShowPromptModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>
            <div className="overflow-auto p-6">
              <pre className="text-sm text-text-secondary whitespace-pre-wrap font-mono bg-bg-page rounded-lg p-4 border border-border">{lastPrompt}</pre>
            </div>
            <div className="px-6 py-3 border-t border-border flex justify-end">
              <button
                type="button"
                onClick={() => { navigator.clipboard.writeText(lastPrompt); }}
                className="h-8 px-4 text-xs font-medium rounded-lg border border-border hover:bg-bg-page"
              >
                Copy Prompt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
