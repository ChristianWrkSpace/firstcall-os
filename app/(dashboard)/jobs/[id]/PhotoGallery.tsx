"use client";

import { useEffect, useState } from "react";
import { getPhotoSignedUrl, deleteJobPhoto } from "@/app/actions/scope";

interface Photo {
  id: string;
  storage_path: string;
}

export default function PhotoGallery({ jobId, photos }: { jobId: string; photos: Photo[] }) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      for (const p of photos) {
        const url = await getPhotoSignedUrl(p.storage_path);
        if (url) next[p.id] = url;
      }
      if (!cancelled) setUrls(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [photos]);

  if (photos.length === 0) {
    return (
      <p className="text-zinc-500 text-sm italic">
        No photos uploaded yet. Snap photos of every affected area, water source, and damage close-ups.
      </p>
    );
  }

  return (
    <>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
        {photos.map((p) => (
          <div key={p.id} className="relative group aspect-square bg-zinc-800 rounded-lg overflow-hidden">
            {urls[p.id] ? (
              <img
                src={urls[p.id]}
                alt=""
                onClick={() => setLightbox(urls[p.id])}
                className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">
                Loading…
              </div>
            )}
            <button
              type="button"
              onClick={async () => {
                if (confirm("Delete this photo?")) {
                  await deleteJobPhoto(p.id, jobId);
                }
              }}
              className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 hover:bg-red-600 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-8 cursor-zoom-out"
        >
          <img src={lightbox} alt="" className="max-w-full max-h-full object-contain" />
        </div>
      )}
    </>
  );
}
