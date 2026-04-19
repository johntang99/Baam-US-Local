'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface HeroSearchProps {
  placeholder: string;
}

const QUICK_TAGS = [
  { label: '🍕 Restaurants', query: 'Best restaurants' },
  { label: '🔧 Auto Repair', query: 'Auto repair' },
  { label: '🦷 Dentist', query: 'Dentist' },
  { label: '🎉 Weekend Events', query: 'Weekend events' },
  { label: '🏠 Home Services', query: 'Home services' },
];

const TOWNS = [
  { label: 'Middletown', value: 'Middletown' },
  { label: 'Goshen', value: 'Goshen' },
  { label: 'Monroe', value: 'Monroe' },
  { label: 'Newburgh', value: 'Newburgh' },
  { label: 'Warwick', value: 'Warwick' },
  { label: 'Chester', value: 'Chester' },
  { label: 'Cornwall', value: 'Cornwall' },
  { label: 'Port Jervis', value: 'Port Jervis' },
];

export default function HeroSearch({ placeholder }: HeroSearchProps) {
  const [query, setQuery] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [locationContext, setLocationContext] = useState('');
  const [locationMenuOpen, setLocationMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const isSupported = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setLocationMenuOpen(false);
    };
    if (locationMenuOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [locationMenuOpen]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const startListening = useCallback(() => {
    if (!isSupported) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const recognition = new SR();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const text = event.results[0][0].transcript;
      setQuery(text);
      setIsListening(false);
      submitQuery(text);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isSupported]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleVoice = useCallback(() => {
    if (isListening) stopListening();
    else startListening();
  }, [isListening, startListening, stopListening]);

  useEffect(() => {
    return () => { recognitionRef.current?.stop(); };
  }, []);

  const submitQuery = (q: string) => {
    let finalQuery = q.trim();
    if (!finalQuery) return;
    // Append location if set and not already in query
    const townNames = ['middletown','goshen','monroe','newburgh','warwick','chester','cornwall','port jervis'];
    const hasLocation = townNames.some(t => finalQuery.toLowerCase().includes(t)) || /near me/i.test(finalQuery);
    if (locationContext && !hasLocation) {
      finalQuery = `${finalQuery} in ${locationContext}`;
    }
    router.push(`/en/helper?q=${encodeURIComponent(finalQuery)}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitQuery(query);
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Two-row input box */}
      <form onSubmit={handleSubmit}>
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.15)] border border-white/30 overflow-visible">
          {/* Row 1: Text input */}
          <div className="px-5 pt-4 pb-2">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isListening ? 'Listening...' : (locationContext ? `Ask about ${locationContext}...` : placeholder)}
              className="w-full text-[15px] text-gray-900 outline-none bg-transparent placeholder:text-gray-400"
            />
          </div>

          {/* Row 2: Controls */}
          <div className="flex items-center justify-between px-3 pb-3 pt-0.5">
            {/* Left: + button, location badge, AI Helper link */}
            <div className="flex items-center gap-1.5">
              {/* "+" location button */}
              <div className="relative" ref={menuRef}>
                <button type="button"
                  onClick={() => setLocationMenuOpen(!locationMenuOpen)}
                  className={`h-8 w-8 flex items-center justify-center rounded-full border-2 transition-all ${
                    locationContext
                      ? 'border-primary text-white bg-primary hover:bg-primary/90'
                      : 'border-primary/40 text-primary hover:border-primary hover:bg-primary/10'
                  }`}
                  title="Set location">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                </button>

                {/* Location dropdown */}
                {locationMenuOpen && (
                  <div className="absolute top-10 left-0 bg-white border border-gray-200 rounded-xl shadow-xl p-2 w-[320px] z-50">
                    <p className="text-[10px] text-gray-400 px-2 pt-0.5 pb-2 font-medium uppercase tracking-wide">Set your location</p>
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
                      className={`w-full text-left text-sm px-3 py-2 rounded-lg mb-1 transition-colors ${
                        locationContext === 'near me' ? 'bg-primary/10 text-primary font-medium' : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >📍 Use my location</button>
                    <div className="grid grid-cols-2 gap-1">
                      {TOWNS.map((t) => (
                        <button key={t.value} type="button"
                          onClick={() => { setLocationContext(t.value); setLocationMenuOpen(false); }}
                          className={`text-left text-sm px-3 py-2 rounded-lg transition-colors ${
                            locationContext === t.value ? 'bg-primary/10 text-primary font-medium' : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >🏘️ {t.label}</button>
                      ))}
                    </div>
                    {locationContext && (
                      <>
                        <div className="border-t border-gray-100 mt-1.5 mb-1" />
                        <button type="button" onClick={() => { setLocationContext(''); setLocationMenuOpen(false); }}
                          className="w-full text-left text-sm px-3 py-2 rounded-lg text-red-500 hover:bg-red-50 transition-colors">
                          ✕ Clear location
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Location badge */}
              {locationContext && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 rounded-full px-2 py-0.5">
                  📍 {locationContext}
                  <button type="button" onClick={() => setLocationContext('')} className="hover:text-red-500 text-[10px]">✕</button>
                </span>
              )}

              {/* AI Helper link */}
              <Link href="/en/helper"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary/70 hover:text-primary transition-colors px-1">
                <span className="w-5 h-5 bg-gradient-to-br from-primary to-orange-500 rounded-md flex items-center justify-center text-[10px] text-white">AI</span>
                Helper
              </Link>
            </div>

            {/* Right: Voice + Send */}
            <div className="flex items-center gap-1.5">
              {isSupported && (
                <button type="button" onClick={toggleVoice}
                  className={`h-9 w-9 flex items-center justify-center rounded-full transition-all ${
                    isListening
                      ? 'bg-red-500 text-white animate-pulse shadow-md'
                      : 'text-primary/70 hover:text-primary hover:bg-primary/10'
                  }`}
                  title={isListening ? 'Stop' : 'Voice input'}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-[18px] h-[18px]">
                    {isListening
                      ? <path d="M6 6h12v12H6z" />
                      : <path d="M12 14a3 3 0 003-3V5a3 3 0 10-6 0v6a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 0014 0h-2zm-4 7.93A7.001 7.001 0 0012 19a7.001 7.001 0 01-1 0V22h2v-3.07z" />
                    }
                  </svg>
                </button>
              )}
              <button type="submit"
                className={`h-9 w-9 flex items-center justify-center rounded-full transition-all ${
                  query.trim()
                    ? 'bg-primary text-white shadow-md hover:bg-primary/90'
                    : 'bg-primary/15 text-primary/50'
                }`}
                title="Search">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Quick tags */}
      <div className="flex flex-wrap justify-center gap-2 mt-5">
        {QUICK_TAGS.map(tag => (
          <Link key={tag.label} href={`/helper?q=${encodeURIComponent(tag.query)}`}
            className="px-4 py-1.5 bg-white/15 backdrop-blur-sm text-white text-sm rounded-full border border-white/20 hover:bg-white/25 hover:border-white/40 transition-all">
            {tag.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
