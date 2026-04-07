'use client';

import { useState, useRef, useCallback } from 'react';

interface VideoUploaderProps {
  videoUrl: string | null;
  thumbnailUrl: string | null;
  duration: number | null;
  onChange: (data: { videoUrl: string | null; thumbnailUrl: string | null; duration: number | null }) => void;
}

export function VideoUploader({ videoUrl, thumbnailUrl, duration, onChange }: VideoUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const uploadFile = async (file: File): Promise<string | null> => {
    const formData = new FormData();
    formData.set('file', file);
    formData.set('folder', 'discover/videos');

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!res.ok) {
        const err = await res.json();
        setProgress(err.error || 'Upload failed');
        return null;
      }
      const data = await res.json();
      return data.url || null;
    } catch {
      setProgress('Upload failed, please try again');
      return null;
    }
  };

  // Extract duration and generate thumbnail from video element
  const extractMetadata = useCallback((file: File): Promise<{ duration: number; thumbnail: string | null }> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;

      video.onloadedmetadata = () => {
        const dur = Math.round(video.duration);

        // Seek to 1 second for thumbnail
        video.currentTime = Math.min(1, dur * 0.1);
      };

      video.onseeked = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0);
            const thumbnail = canvas.toDataURL('image/jpeg', 0.7);
            resolve({ duration: Math.round(video.duration), thumbnail });
          } else {
            resolve({ duration: Math.round(video.duration), thumbnail: null });
          }
        } catch {
          resolve({ duration: Math.round(video.duration), thumbnail: null });
        }
        URL.revokeObjectURL(video.src);
      };

      video.onerror = () => {
        resolve({ duration: 0, thumbnail: null });
        URL.revokeObjectURL(video.src);
      };

      video.src = URL.createObjectURL(file);
    });
  }, []);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('video/')) {
      setProgress('Please select a video file');
      return;
    }

    if (file.size > 200 * 1024 * 1024) {
      setProgress('Video file cannot exceed 200MB');
      return;
    }

    setUploading(true);
    setProgress('Extracting video info...');

    // Extract metadata first
    const metadata = await extractMetadata(file);

    if (metadata.duration < 5) {
      setProgress('Video must be at least 5 seconds');
      setUploading(false);
      return;
    }

    if (metadata.duration > 300) {
      setProgress('Video cannot exceed 5 minutes');
      setUploading(false);
      return;
    }

    // Upload video
    setProgress('Uploading video...');
    const url = await uploadFile(file);

    if (url) {
      // Upload thumbnail if we got one
      let thumbUrl: string | null = null;
      if (metadata.thumbnail) {
        setProgress('Generating thumbnail...');
        try {
          const blob = await fetch(metadata.thumbnail).then(r => r.blob());
          const thumbFile = new File([blob], 'thumbnail.jpg', { type: 'image/jpeg' });
          const thumbForm = new FormData();
          thumbForm.set('file', thumbFile);
          thumbForm.set('folder', 'discover/thumbnails');
          const thumbRes = await fetch('/api/upload', { method: 'POST', body: thumbForm });
          if (thumbRes.ok) {
            const thumbData = await thumbRes.json();
            thumbUrl = thumbData.url;
          }
        } catch { /* thumbnail upload failed, continue without */ }
      }

      onChange({
        videoUrl: url,
        thumbnailUrl: thumbUrl,
        duration: metadata.duration,
      });
      setProgress('');
    }

    setUploading(false);
  }, [extractMetadata, onChange]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const removeVideo = () => {
    onChange({ videoUrl: null, thumbnailUrl: null, duration: null });
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6">
      <label className="text-sm font-semibold text-gray-900 mb-3 block">
        Upload Video <span className="text-gray-400 font-normal">(5s - 5min, max 200MB)</span>
      </label>

      {/* Video Preview */}
      {videoUrl ? (
        <div className="mb-4">
          <div className="relative rounded-xl overflow-hidden bg-black">
            <video
              ref={videoRef}
              src={videoUrl}
              poster={thumbnailUrl || undefined}
              controls
              className="w-full max-h-[400px] object-contain"
            />
            <button
              type="button"
              onClick={removeVideo}
              className="absolute top-3 right-3 w-8 h-8 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black/80 transition"
            >
              &times;
            </button>
          </div>
          {duration && (
            <p className="text-xs text-gray-400 mt-2 text-center">
              Duration: {Math.floor(duration / 60)}:{String(duration % 60).padStart(2, '0')}
            </p>
          )}
        </div>
      ) : (
        /* Upload Zone */
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-10 text-center transition-colors ${
            uploading ? 'border-gray-200 bg-gray-50 cursor-wait' :
            dragOver ? 'border-primary bg-orange-50 cursor-pointer' :
            'border-gray-300 hover:border-primary hover:bg-orange-50/50 cursor-pointer'
          }`}
        >
          {uploading ? (
            <>
              <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-600">{progress}</p>
            </>
          ) : (
            <>
              <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <p className="text-sm text-gray-500 mb-1">
                Drag video here, or <span className="text-primary font-medium">click to upload</span>
              </p>
              <p className="text-xs text-gray-400">Supports MP4, WebM, MOV. 5s - 5min, max 200MB</p>
            </>
          )}
        </div>
      )}

      {progress && !uploading && (
        <p className="text-xs text-red-500 mt-2 text-center">{progress}</p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime,video/*"
        onChange={handleFileInput}
        className="hidden"
      />
    </div>
  );
}
