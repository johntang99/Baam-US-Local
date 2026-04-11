'use client';

import type { MapBusiness } from './types';

interface BusinessCardProps {
  business: MapBusiness & { _distance?: number | null };
  rank: number;
  isActive: boolean;
  onClick: () => void;
  compact?: boolean;
}

export default function BusinessCard({ business: b, rank, isActive, onClick, compact = false }: BusinessCardProps) {
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
  const rankBg = rank <= 3 ? 'bg-red-600' : 'bg-primary';
  const shortAddr = b.address_full?.split(',').slice(0, 2).join(', ') || '';
  const dist = (b as { _distance?: number | null })._distance;
  const distLabel = dist != null ? (dist < 0.1 ? '< 0.1 mi' : `${dist.toFixed(1)} mi`) : null;

  if (compact) {
    // Horizontal scrolling card (for Helper chat / mobile bottom sheet)
    return (
      <button
        type="button"
        onClick={onClick}
        className={`min-w-[210px] text-left flex-shrink-0 rounded-xl p-3.5 transition-all ${
          isActive
            ? 'bg-primary/10 border-2 border-primary'
            : 'bg-bg-card border border-border hover:border-primary/40'
        }`}
      >
        <div className="flex items-center gap-2 mb-1.5">
          {medal ? <span className="text-base">{medal}</span> : <span className={`w-5 h-5 ${rankBg} text-white rounded-full text-[10px] font-bold flex items-center justify-center`}>{rank}</span>}
          <span className="text-sm font-bold truncate">{b.display_name}</span>
        </div>
        <div className="text-xs text-text-secondary">
          {b.avg_rating}⭐ · {b.review_count?.toLocaleString()} reviews
          {distLabel && <span className="text-blue-500 ml-1">· {distLabel}</span>}
        </div>
        {shortAddr && <div className="text-[11px] text-text-muted mt-1 truncate">{shortAddr}</div>}
        <div className="flex gap-3 mt-2.5">
          {b.phone && (
            <a href={`tel:${b.phone.replace(/\D/g, '').replace(/^(\d{10})$/, '+1$1')}`} onClick={(e) => e.stopPropagation()} className="text-[11px] text-primary font-semibold">
              📞 Call
            </a>
          )}
          <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(b.address_full || '')}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-[11px] text-primary font-semibold">
            🧭 Go
          </a>
        </div>
      </button>
    );
  }

  // Full sidebar card
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-4 py-3.5 border-b border-border-light transition-all ${
        isActive
          ? 'bg-primary/10 border-l-[3px] border-l-primary pl-[13px]'
          : 'hover:bg-primary/5'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-7 h-7 ${rankBg} rounded-full flex items-center justify-center text-white text-xs font-extrabold flex-shrink-0 mt-0.5`}>
          {rank}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold mb-0.5 truncate">{b.display_name}</div>
          <div className="flex items-center gap-1.5 text-xs text-text-secondary flex-wrap">
            <span className="text-amber-500">{'★'.repeat(Math.round(b.avg_rating || 0))}</span>
            <span className="font-semibold">{b.avg_rating}</span>
            <span className="text-border">·</span>
            <span>{b.review_count?.toLocaleString()} reviews</span>
            {distLabel && <><span className="text-border">·</span><span className="text-blue-500 font-medium">{distLabel}</span></>}
          </div>
          {shortAddr && <div className="text-xs text-text-muted mt-1">{shortAddr}</div>}
          {b.phone && <div className="text-xs text-text-muted mt-0.5">📞 {b.phone}</div>}
          {b.ai_tags.length > 0 && (
            <div className="flex gap-1 mt-2 flex-wrap">
              {b.ai_tags.slice(0, 3).map((tag) => (
                <span key={tag} className="text-[10px] bg-primary/5 text-primary/80 px-1.5 py-0.5 rounded border border-primary/10">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
