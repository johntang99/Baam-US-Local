'use client';
import { useState } from 'react';
import { ImagePickerModal } from '@/components/admin/ImagePickerModal';

interface Props {
  businessSlug: string;
  existingImages: string[];
}

export default function ImageUploader({ businessSlug, existingImages }: Props) {
  const [images, setImages] = useState<string[]>(existingImages);
  const [coverIndex, setCoverIndex] = useState(0); // first image is cover by default
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleSelect = (url: string) => {
    if (images.length >= 10) { alert('Max 10 images'); return; }
    setImages(prev => [...prev, url]);
  };

  const handleDelete = async (url: string) => {
    if (!confirm('Delete this image?')) return;
    try {
      const urlObj = new URL(url);
      const pathMatch = urlObj.pathname.match(/\/object\/public\/[^/]+\/(.+)/);
      if (pathMatch) {
        await fetch('/api/media/file', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: pathMatch[1] }),
        });
      }
    } catch {}
    const idx = images.indexOf(url);
    setImages(prev => prev.filter(i => i !== url));
    if (idx <= coverIndex && coverIndex > 0) setCoverIndex(coverIndex - 1);
  };

  const handleSetCover = async (idx: number) => {
    if (idx === coverIndex || busy) return;
    setBusy(true);

    try {
      // Move the selected image to position 0 by renaming with 000_ prefix
      const url = images[idx];
      const urlObj = new URL(url);
      const pathMatch = urlObj.pathname.match(/\/object\/public\/[^/]+\/(.+)/);

      if (pathMatch) {
        const oldPath = pathMatch[1];
        const folder = oldPath.substring(0, oldPath.lastIndexOf('/'));
        const fileName = oldPath.substring(oldPath.lastIndexOf('/') + 1);

        // Remove existing 000_ prefix from current cover
        const currentCoverUrl = images[coverIndex];
        const currentMatch = new URL(currentCoverUrl).pathname.match(/\/object\/public\/[^/]+\/(.+)/);
        if (currentMatch) {
          const currentName = currentMatch[1].substring(currentMatch[1].lastIndexOf('/') + 1);
          if (currentName.startsWith('000_')) {
            await fetch('/api/media/rename', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                from: currentMatch[1],
                to: `${folder}/${currentName.replace('000_', '')}`,
              }),
            });
          }
        }

        // Add 000_ prefix to new cover
        const newName = fileName.startsWith('000_') ? fileName : `000_${fileName}`;
        await fetch('/api/media/rename', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: oldPath,
            to: `${folder}/${newName}`,
          }),
        });
      }

      // Reorder: move selected to front
      const newImages = [...images];
      const [moved] = newImages.splice(idx, 1);
      newImages.unshift(moved);
      setImages(newImages);
      setCoverIndex(0);
    } catch (err) {
      console.error('Set cover failed:', err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {images.length > 0 && (
        <div className="grid grid-cols-4 gap-3 mb-3">
          {images.map((url, i) => (
            <div key={url} className={`relative group aspect-square rounded-lg overflow-hidden border-2 ${
              i === coverIndex ? 'border-primary ring-2 ring-primary/20' : 'border-gray-200'
            }`}>
              <img src={url} alt="" className="w-full h-full object-cover" />
              {i === coverIndex && (
                <div className="absolute top-1 left-1 bg-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                  Cover
                </div>
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100">
                {i !== coverIndex && (
                  <button
                    type="button"
                    onClick={() => handleSetCover(i)}
                    disabled={busy}
                    className="bg-white text-gray-800 text-xs px-2 py-1 rounded shadow hover:bg-gray-100 disabled:opacity-50"
                  >
                    Set as Cover
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(url)}
                  className="bg-red-600 text-white text-xs px-2 py-1 rounded shadow hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <button type="button" onClick={() => setPickerOpen(true)}
        className="h-9 px-4 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 inline-flex items-center gap-2">
        📷 Select Image
      </button>
      <span className="text-xs text-gray-400 ml-2">{images.length}/10</span>

      <ImagePickerModal
        open={pickerOpen}
        folder={`businesses/${businessSlug}`}
        onClose={() => setPickerOpen(false)}
        onSelect={handleSelect}
      />
    </div>
  );
}
