'use client';

import { ImageData } from '@/types';
import { useEffect } from 'react';

interface ImageModalProps {
  image: ImageData;
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  currentIndex: number;
  totalImages: number;
}

export default function ImageModal({
  image,
  onClose,
  onNext,
  onPrev,
  currentIndex,
  totalImages,
}: ImageModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && onNext) onNext();
      if (e.key === 'ArrowLeft' && onPrev) onPrev();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onNext, onPrev]);

  return (
    <div
      className="fixed inset-0 bg-foreground/80 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="relative max-w-6xl max-h-[90vh] bg-background border border-border rounded p-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center bg-accent hover:bg-foreground text-background rounded transition-colors z-10"
          aria-label="Close"
        >
          ✕
        </button>

        {/* Navigation buttons */}
        {onPrev && (
          <button
            onClick={onPrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-accent hover:bg-foreground text-background rounded transition-colors"
            aria-label="Previous"
          >
            ←
          </button>
        )}
        {onNext && (
          <button
            onClick={onNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-accent hover:bg-foreground text-background rounded transition-colors"
            aria-label="Next"
          >
            →
          </button>
        )}

        {/* Image */}
        <div className="flex flex-col items-center">
          <img
            src={image.url}
            alt={image.alt || 'Full size image'}
            className="max-w-full max-h-[70vh] object-contain"
          />

          {/* Image info */}
          <div className="mt-4 text-sm text-accent space-y-1 max-w-full">
            <div className="flex items-center justify-between gap-4">
              <span>
                {currentIndex + 1} / {totalImages}
              </span>
              {image.width && image.height && (
                <span>
                  {image.width} × {image.height}px
                </span>
              )}
            </div>
            <div className="text-xs break-all opacity-60 max-w-2xl">
              {image.url}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

