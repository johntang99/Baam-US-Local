'use client';

import { useState, useRef, useCallback } from 'react';

interface ImageUploaderProps {
  images: string[];
  onChange: (images: string[]) => void;
  maxImages?: number;
}

export function ImageUploader({ images, onChange, maxImages = 9 }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File): Promise<string | null> => {
    const formData = new FormData();
    formData.set('file', file);
    formData.set('folder', 'discover');

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!res.ok) return null;
      const data = await res.json();
      return data.url || null;
    } catch {
      return null;
    }
  };

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(f => f.type.startsWith('image/'));
    const slotsLeft = maxImages - images.length;
    const toUpload = fileArray.slice(0, slotsLeft);

    if (toUpload.length === 0) return;

    setUploading(true);
    const urls: string[] = [];

    for (const file of toUpload) {
      const url = await uploadFile(file);
      if (url) urls.push(url);
    }

    if (urls.length > 0) {
      onChange([...images, ...urls]);
    }
    setUploading(false);
  }, [images, maxImages, onChange]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
  };

  const removeImage = (index: number) => {
    onChange(images.filter((_, i) => i !== index));
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6">
      <label className="text-sm font-semibold text-gray-900 mb-3 block">
        Add Photos <span className="text-gray-400 font-normal">(Max {maxImages} photos)</span>
      </label>

      {/* Image Grid */}
      {(images.length > 0 || uploading) && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          {images.map((url, i) => (
            <div key={i} className="aspect-square rounded-xl overflow-hidden relative group">
              <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removeImage(i)}
                className="absolute top-1 right-1 w-5.5 h-5.5 bg-black/50 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              >
                &times;
              </button>
              {i === 0 && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/40 to-transparent py-1 px-2">
                  <span className="text-white text-[10px]">Cover</span>
                </div>
              )}
            </div>
          ))}

          {/* Add more slot */}
          {images.length < maxImages && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="aspect-square rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-primary hover:text-primary hover:bg-orange-50 transition-colors"
            >
              <svg className="w-8 h-8 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-xs">Add</span>
            </button>
          )}

          {uploading && (
            <div className="aspect-square rounded-xl bg-gray-50 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      )}

      {/* Drag & Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors ${
          dragOver
            ? 'border-primary bg-orange-50'
            : 'border-gray-300 hover:border-primary hover:bg-orange-50/50'
        }`}
      >
        <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <p className="text-sm text-gray-500 mb-1">
          Drag photos here, or <span className="text-primary font-medium">click to upload</span>
        </p>
        <p className="text-xs text-gray-400">Supports JPG, PNG, WebP. Max 10MB per image</p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileInput}
        className="hidden"
      />
    </div>
  );
}
