'use client';

import { ImageData } from '@/types';
import { useState } from 'react';

interface ImageCardProps {
  image: ImageData;
  onClick: () => void;
  onDownload: () => void;
}

export default function ImageCard({ image, onClick, onDownload }: ImageCardProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    onDownload();
  };

  if (hasError) {
    return (
      <div className="relative aspect-square bg-hover border border-border rounded flex items-center justify-center">
        <span className="text-xs text-accent/50">failed to load</span>
      </div>
    );
  }

  return (
    <div
      className="relative aspect-square bg-hover border border-border rounded overflow-hidden cursor-pointer group transition-all hover:border-accent"
      onClick={onClick}
    >
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs text-accent/50">loading...</span>
        </div>
      )}
      
      <img
        src={image.url}
        alt={image.alt || 'Scraped image'}
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
        loading="lazy"
      />

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-background/90 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
        <button
          onClick={handleDownload}
          className="px-4 py-2 bg-accent text-background rounded text-sm hover:bg-foreground transition-colors"
        >
          download
        </button>
        {image.width && image.height && (
          <span className="text-xs text-accent">
            {image.width} × {image.height}
          </span>
        )}
      </div>
    </div>
  );
}

