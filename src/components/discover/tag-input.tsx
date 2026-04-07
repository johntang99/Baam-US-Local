'use client';

import { useState, KeyboardEvent } from 'react';

const suggestedTags = [
  'hidden gems', 'best pizza', 'local favorite', 'budget eats', 'date night',
  'family friendly', 'new in town', 'weekend plans', 'happy hour', 'outdoor dining',
];

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  maxTags?: number;
}

export function TagInput({ tags, onChange, maxTags = 5 }: TagInputProps) {
  const [input, setInput] = useState('');

  const addTag = (tag: string) => {
    const trimmed = tag.trim().replace(/^#/, '');
    if (!trimmed || tags.length >= maxTags) return;
    if (tags.includes(trimmed)) return;
    onChange([...tags, trimmed]);
    setInput('');
  };

  const removeTag = (index: number) => {
    onChange(tags.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(input);
    }
    if (e.key === 'Backspace' && !input && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };

  // Filter out already-added tags from suggestions
  const availableSuggestions = suggestedTags.filter(s => !tags.includes(s));

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6">
      <label className="text-sm font-semibold text-gray-900 mb-3 block">Tags</label>

      {/* Tag Input Area */}
      <div className="flex flex-wrap gap-2 px-3.5 py-2.5 border border-gray-200 rounded-xl min-h-[44px] items-center focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10 transition cursor-text">
        {tags.map((tag, i) => (
          <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-orange-50 text-orange-600 rounded-full text-[13px] font-medium">
            #{tag}
            <button
              type="button"
              onClick={() => removeTag(i)}
              className="opacity-60 hover:opacity-100 text-sm leading-none"
            >
              &times;
            </button>
          </span>
        ))}
        {tags.length < maxTags && (
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={tags.length === 0 ? 'Enter a tag...' : ''}
            className="flex-1 min-w-[120px] border-0 outline-none text-sm bg-transparent placeholder:text-gray-400"
          />
        )}
      </div>

      {/* Suggested Tags */}
      {availableSuggestions.length > 0 && tags.length < maxTags && (
        <div className="mt-3">
          <p className="text-xs text-gray-400 mb-2">Suggested</p>
          <div className="flex flex-wrap gap-2">
            {availableSuggestions.slice(0, 8).map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => addTag(tag)}
                className="px-3 py-1 bg-gray-50 text-gray-500 text-xs rounded-full hover:bg-orange-50 hover:text-primary transition border border-gray-200"
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400 mt-2">Max {maxTags} tags. Press Enter or comma to add</p>
    </div>
  );
}
