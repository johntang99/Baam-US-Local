'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { createEvent, updateEvent, publishEvent } from './actions';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

const statusOptions = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'cancelled', label: 'Cancelled' },
];

interface EventFormProps {
  event?: AnyRow | null;
  regions: AnyRow[];
  isNew: boolean;
  siteParams?: string;
}

export default function EventForm({ event, regions, isNew, siteParams = '' }: EventFormProps) {
  const siteQuery = siteParams ? `?${siteParams}` : '';
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [titleZh, setTitleZh] = useState(event?.title_zh || '');
  const [titleEn, setTitleEn] = useState(event?.title_en || '');
  const [summaryZh, setSummaryZh] = useState(event?.summary_zh || '');
  const [descriptionZh, setDescriptionZh] = useState(event?.description_zh || '');
  const [venueName, setVenueName] = useState(event?.venue_name || '');
  const [address, setAddress] = useState(event?.address || '');
  const [startAt, setStartAt] = useState(event?.start_at ? event.start_at.slice(0, 16) : '');
  const [endAt, setEndAt] = useState(event?.end_at ? event.end_at.slice(0, 16) : '');
  const [isFree, setIsFree] = useState(event?.is_free ?? true);
  const [ticketPrice, setTicketPrice] = useState(event?.ticket_price || '');
  const [organizerName, setOrganizerName] = useState(event?.organizer_name || '');
  const [regionId, setRegionId] = useState(event?.region_id || '');
  const [status, setStatus] = useState(event?.status || 'draft');

  const buildFormData = () => {
    const fd = new FormData();
    fd.set('title_zh', titleZh);
    fd.set('title_en', titleEn);
    fd.set('summary_zh', summaryZh);
    fd.set('description_zh', descriptionZh);
    fd.set('venue_name', venueName);
    fd.set('address', address);
    fd.set('start_at', startAt);
    fd.set('end_at', endAt);
    fd.set('is_free', String(isFree));
    fd.set('ticket_price', ticketPrice);
    fd.set('organizer_name', organizerName);
    fd.set('region_id', regionId);
    fd.set('status', status);
    return fd;
  };

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      const fd = buildFormData();
      if (isNew) {
        const result = await createEvent(fd);
        if (result.error) {
          setError(result.error);
        } else if (result.id) {
          router.push(`/admin/events/${result.id}/edit${siteQuery}`);
        }
      } else {
        const result = await updateEvent(event!.id, fd);
        if (result.error) {
          setError(result.error);
        } else {
          router.refresh();
        }
      }
    });
  };

  const handlePublish = () => {
    if (isNew) {
      setStatus('published');
      handleSave();
      return;
    }
    startTransition(async () => {
      await publishEvent(event!.id);
      router.refresh();
    });
  };

  return (
    <div>
      {/* Header */}
      <div className="bg-bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-text-muted mb-1">
              <a href={`/admin${siteQuery}`} className="hover:underline">Admin</a>
              {' > '}
              <a href={`/admin/events${siteQuery}`} className="hover:underline">Events</a>
              {' > '}
              {isNew ? 'New' : 'Edit'}
            </p>
            <h1 className="text-xl font-bold">{isNew ? 'New Event' : 'Edit Event'}</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={isPending}
              className="h-9 px-4 text-sm font-medium rounded-lg border border-border bg-bg-card hover:bg-bg-page disabled:opacity-50"
            >
              Save Draft
            </button>
            <button
              onClick={handlePublish}
              disabled={isPending}
              className="h-9 px-4 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
            >
              Publish
            </button>
          </div>
        </div>
        {error && (
          <p className="text-sm text-red-600 mt-2">{error}</p>
        )}
      </div>

      {/* Two-column layout */}
      <div className="p-6 flex gap-6">
        {/* Left column 70% */}
        <div className="flex-1 min-w-0 space-y-6" style={{ flex: '7' }}>
          {/* Title ZH */}
          <div className="bg-bg-card border border-border rounded-xl p-5">
            <label className="block text-sm font-medium mb-2">Event Title (Chinese)</label>
            <input
              type="text"
              value={titleZh}
              onChange={(e) => setTitleZh(e.target.value)}
              placeholder="Enter event title in Chinese"
              className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          {/* Title EN */}
          <div className="bg-bg-card border border-border rounded-xl p-5">
            <label className="block text-sm font-medium mb-2">Event Title (English)</label>
            <input
              type="text"
              value={titleEn}
              onChange={(e) => setTitleEn(e.target.value)}
              placeholder="Enter event title in English"
              className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          {/* Summary */}
          <div className="bg-bg-card border border-border rounded-xl p-5">
            <label className="block text-sm font-medium mb-2">Event Summary</label>
            <textarea
              value={summaryZh}
              onChange={(e) => setSummaryZh(e.target.value)}
              placeholder="Brief description of the event"
              rows={3}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-y"
            />
          </div>

          {/* Description */}
          <div className="bg-bg-card border border-border rounded-xl p-5">
            <label className="block text-sm font-medium mb-2">Event Details</label>
            <textarea
              value={descriptionZh}
              onChange={(e) => setDescriptionZh(e.target.value)}
              placeholder="Enter detailed event description (Markdown supported)"
              rows={8}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-y"
            />
          </div>

          {/* Venue & Address */}
          <div className="bg-bg-card border border-border rounded-xl p-5 space-y-4">
            <label className="block text-sm font-medium">Venue Info</label>
            <div>
              <label className="block text-xs text-text-muted mb-1">Venue Name</label>
              <input
                type="text"
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
                placeholder="e.g. Community Center"
                className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Enter event address"
                className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>
        </div>

        {/* Right column 30% */}
        <div className="space-y-6" style={{ flex: '3' }}>
          {/* Status */}
          <div className="bg-bg-card border border-border rounded-xl p-5">
            <label className="block text-sm font-medium mb-2">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
            >
              {statusOptions.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Dates */}
          <div className="bg-bg-card border border-border rounded-xl p-5 space-y-4">
            <label className="block text-sm font-medium">Event Time</label>
            <div>
              <label className="block text-xs text-text-muted mb-1">Start Time</label>
              <input
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">End Time</label>
              <input
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
              />
            </div>
          </div>

          {/* Price */}
          <div className="bg-bg-card border border-border rounded-xl p-5 space-y-4">
            <label className="block text-sm font-medium">Pricing</label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isFree}
                onChange={(e) => setIsFree(e.target.checked)}
                className="rounded border-gray-300"
              />
              Free Event
            </label>
            {!isFree && (
              <div>
                <label className="block text-xs text-text-muted mb-1">Ticket Price</label>
                <input
                  type="text"
                  value={ticketPrice}
                  onChange={(e) => setTicketPrice(e.target.value)}
                  placeholder="e.g. $20"
                  className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
            )}
          </div>

          {/* Organizer */}
          <div className="bg-bg-card border border-border rounded-xl p-5">
            <label className="block text-sm font-medium mb-2">Organizer</label>
            <input
              type="text"
              value={organizerName}
              onChange={(e) => setOrganizerName(e.target.value)}
              placeholder="Organizer name"
              className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          {/* Region */}
          <div className="bg-bg-card border border-border rounded-xl p-5">
            <label className="block text-sm font-medium mb-2">Region</label>
            <select
              value={regionId}
              onChange={(e) => setRegionId(e.target.value)}
              className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
            >
              <option value="">Select a region</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>{r.name_zh || r.slug}</option>
              ))}
            </select>
          </div>

          {/* Cover Image placeholder */}
          <div className="bg-bg-card border border-border rounded-xl p-5">
            <label className="block text-sm font-medium mb-2">Cover Image</label>
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <p className="text-sm text-text-muted">Click or drag to upload a cover image</p>
              <p className="text-xs text-text-muted mt-1">Recommended size 1200x630</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
