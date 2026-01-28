'use client';

import { ImageData } from '@/types';
import { useState } from 'react';
import ImageCard from './ImageCard';
import ImageModal from './ImageModal';

interface ImageGridProps {
  images: ImageData[];
  onDownloadAll: () => void;
}

export default function ImageGrid({ images, onDownloadAll }: ImageGridProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);

  const handleDownloadSingle = async (image: ImageData) => {
    try {
      const response = await fetch(image.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Extract filename from URL
      const urlPath = new URL(image.url).pathname;
      const filename = urlPath.split('/').pop() || 'image.jpg';
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download image:', error);
      alert('Failed to download image');
    }
  };

  if (images.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-accent/60">no images found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with count and download all */}
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <h2 className="text-lg">
          found <span className="text-accent">{images.length}</span> image{images.length !== 1 ? 's' : ''}
        </h2>
        <button
          onClick={onDownloadAll}
          className="px-6 py-2 bg-accent hover:bg-foreground text-background rounded transition-colors"
        >
          download all
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {images.map((image, index) => (
          <ImageCard
            key={`${image.url}-${index}`}
            image={image}
            onClick={() => setSelectedImageIndex(index)}
            onDownload={() => handleDownloadSingle(image)}
          />
        ))}
      </div>

      {/* Modal */}
      {selectedImageIndex !== null && (
        <ImageModal
          image={images[selectedImageIndex]}
          currentIndex={selectedImageIndex}
          totalImages={images.length}
          onClose={() => setSelectedImageIndex(null)}
          onNext={
            selectedImageIndex < images.length - 1
              ? () => setSelectedImageIndex(selectedImageIndex + 1)
              : undefined
          }
          onPrev={
            selectedImageIndex > 0
              ? () => setSelectedImageIndex(selectedImageIndex - 1)
              : undefined
          }
        />
      )}
    </div>
  );
}

