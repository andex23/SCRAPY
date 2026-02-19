'use client';

import { useState, useMemo } from 'react';
import { ScrapeResult } from '@/types';
import { downloadJson } from '@/lib/exportJson';
import { downloadCsv } from '@/lib/exportCsv';
import FilterPanel from './FilterPanel';
import ValidationPanel from './ValidationPanel';

type ImageDownloadFormat = 'original' | 'jpg' | 'jpeg' | 'png' | 'webp' | 'gif' | 'svg' | 'avif';
type VideoDownloadFormat = 'original' | 'mp4' | 'webm' | 'mov' | 'm4v' | 'm3u8' | 'mpd' | 'mkv' | 'ogv' | 'ts';

interface ResultsSectionProps {
  results: ScrapeResult;
  onDownloadAllImages?: (downloadFormat?: ImageDownloadFormat) => void;
  onDownloadAllVideos?: (downloadFormat?: VideoDownloadFormat) => void;
  onDownloadVideos?: (videoUrls: string[], downloadFormat?: VideoDownloadFormat) => void | Promise<void>;
}

export default function ResultsSection({
  results,
  onDownloadAllImages,
  onDownloadAllVideos,
  onDownloadVideos,
}: ResultsSectionProps) {
  const [filteredResults, setFilteredResults] = useState<ScrapeResult>(results);
  const [selectedProducts, setSelectedProducts] = useState<Set<number>>(new Set());
  const [selectedImages, setSelectedImages] = useState<Set<number>>(new Set());
  const [selectedVideos, setSelectedVideos] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState<string>('all');
  const [imageDownloadFormat, setImageDownloadFormat] = useState<ImageDownloadFormat>('original');
  const [videoDownloadFormat, setVideoDownloadFormat] = useState<VideoDownloadFormat>('original');

  const hasResults = Object.keys(results).some(key => {
    const value = results[key as keyof ScrapeResult];
    return Array.isArray(value) ? value.length > 0 : (value && Object.keys(value).length > 0);
  });

  // Calculate available tabs
  const availableTabs = useMemo(() => {
    const tabs = ['all'];
    if (results.images && results.images.length > 0) tabs.push('images');
    if (results.videos && results.videos.length > 0) tabs.push('videos');
    if (results.products && results.products.length > 0) tabs.push('products');
    if (results.contacts && (results.contacts.emails.length > 0 || results.contacts.phones.length > 0 || results.contacts.socials.length > 0)) tabs.push('contacts');
    if (results.assets && results.assets.length > 0) tabs.push('assets');
    if (results.text) tabs.push('text');
    if (results.crawl && results.crawl.length > 0) tabs.push('links');
    return tabs;
  }, [results]);

  if (!hasResults) {
    return (
      <div className="text-center py-20 text-accent/40 text-sm">
        <p>no data found</p>
      </div>
    );
  }

  const displayResults = Object.keys(filteredResults).length > 0 ? filteredResults : results;

  // Product selection handlers
  const toggleProductSelection = (index: number) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedProducts(newSelected);
  };

  const selectAllProducts = () => {
    if (displayResults.products) {
      setSelectedProducts(new Set(displayResults.products.map((_, i) => i)));
    }
  };

  const deselectAllProducts = () => {
    setSelectedProducts(new Set());
  };

  // Image selection handlers
  const toggleImageSelection = (index: number) => {
    const newSelected = new Set(selectedImages);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedImages(newSelected);
  };

  const selectAllImages = () => {
    if (displayResults.images) {
      setSelectedImages(new Set(displayResults.images.map((_, i) => i)));
    }
  };

  const deselectAllImages = () => {
    setSelectedImages(new Set());
  };

  // Video selection handlers
  const toggleVideoSelection = (index: number) => {
    const newSelected = new Set(selectedVideos);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedVideos(newSelected);
  };

  const selectAllVideos = () => {
    if (displayResults.videos) {
      setSelectedVideos(new Set(displayResults.videos.map((_, i) => i)));
    }
  };

  const deselectAllVideos = () => {
    setSelectedVideos(new Set());
  };

  // Export selected items
  const exportSelectedProducts = () => {
    if (displayResults.products) {
      const selected = displayResults.products.filter((_, i) => selectedProducts.has(i));
      downloadJson({ products: selected });
    }
  };

  const exportSelectedImages = () => {
    if (displayResults.images) {
      const selected = displayResults.images.filter((_, i) => selectedImages.has(i));
      downloadJson({ images: selected });
    }
  };

  const exportSelectedVideos = () => {
    if (displayResults.videos) {
      const selected = displayResults.videos.filter((_, i) => selectedVideos.has(i));
      downloadJson({ videos: selected });
    }
  };

  const getSelectedVideoUrls = () =>
    displayResults.videos
      ? displayResults.videos
          .filter((_, i) => selectedVideos.has(i))
          .map((video) => video.url)
      : [];

  const downloadSelectedVideos = () => {
    const urls = getSelectedVideoUrls();
    if (urls.length === 0) return;
    if (onDownloadVideos) {
      onDownloadVideos(urls, videoDownloadFormat);
      return;
    }
    if (onDownloadAllVideos && displayResults.videos && urls.length === displayResults.videos.length) {
      onDownloadAllVideos();
    }
  };

  const downloadSingleVideo = (url: string) => {
    if (onDownloadVideos) {
      onDownloadVideos([url], videoDownloadFormat);
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const shouldShowSection = (section: string) => {
    return activeTab === 'all' || activeTab === section;
  };

  const isDirectVideoFile = (url: string) => /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url);

  const toEmbedUrl = (url: string): string => {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();

      if (host.includes('youtube.com')) {
        if (parsed.pathname.includes('/embed/')) return url;
        const videoId = parsed.searchParams.get('v');
        if (videoId) return `https://www.youtube.com/embed/${videoId}`;
      }

      if (host.includes('youtu.be')) {
        const videoId = parsed.pathname.split('/').filter(Boolean)[0];
        if (videoId) return `https://www.youtube.com/embed/${videoId}`;
      }

      if (host.includes('vimeo.com')) {
        if (host.includes('player.vimeo.com')) return url;
        const videoId = parsed.pathname.split('/').filter(Boolean)[0];
        if (videoId && /^\d+$/.test(videoId)) return `https://player.vimeo.com/video/${videoId}`;
      }

      if (host.includes('dailymotion.com') && !parsed.pathname.includes('/embed/')) {
        const match = parsed.pathname.match(/\/video\/([^_/]+)/);
        if (match?.[1]) return `https://www.dailymotion.com/embed/video/${match[1]}`;
      }

      return url;
    } catch {
      return url;
    }
  };

  return (
    <div className="space-y-8">
      {/* Summary Stats Bar */}
      <div className="bg-gradient-to-r from-accent/5 to-transparent border border-border rounded-lg p-4">
        <div className="flex flex-wrap gap-6 text-sm">
          {displayResults.images && displayResults.images.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              <span className="text-accent/70">Images:</span>
              <span className="font-medium">{displayResults.images.length}</span>
            </div>
          )}
          {displayResults.videos && displayResults.videos.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full"></span>
              <span className="text-accent/70">Videos:</span>
              <span className="font-medium">{displayResults.videos.length}</span>
            </div>
          )}
          {displayResults.products && displayResults.products.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              <span className="text-accent/70">Products:</span>
              <span className="font-medium">{displayResults.products.length}</span>
            </div>
          )}
          {displayResults.contacts && (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
              <span className="text-accent/70">Contacts:</span>
              <span className="font-medium">
                {displayResults.contacts.emails.length + displayResults.contacts.phones.length + displayResults.contacts.socials.length}
              </span>
            </div>
          )}
          {displayResults.assets && displayResults.assets.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
              <span className="text-accent/70">Assets:</span>
              <span className="font-medium">{displayResults.assets.length}</span>
            </div>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-4">
        {availableTabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm rounded-lg transition-all ${
              activeTab === tab
                ? 'bg-accent text-background font-medium'
                : 'bg-hover/50 text-accent/70 hover:bg-hover hover:text-accent'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Validation Panel */}
      {activeTab === 'all' && (
        <ValidationPanel
          results={displayResults}
          onExport={() => downloadJson(displayResults)}
        />
      )}

      {/* Filter Panel */}
      {activeTab === 'all' && (
        <FilterPanel results={results} onFiltered={setFilteredResults} />
      )}

      {/* Export All Buttons */}
      {activeTab === 'all' && (
        <div className="flex flex-wrap justify-end gap-2">
          <button
            onClick={() => downloadCsv(displayResults)}
            className="px-6 py-2 bg-accent hover:bg-foreground text-background rounded-lg transition-colors text-sm"
          >
            Export CSV
          </button>
          <button
            onClick={() => downloadJson(displayResults)}
            className="px-6 py-2 bg-accent hover:bg-foreground text-background rounded-lg transition-colors text-sm"
          >
            Export JSON
          </button>
        </div>
      )}

      {/* Products Section */}
      {displayResults.products && displayResults.products.length > 0 && shouldShowSection('products') && (
        <section className="bg-background border border-border rounded-lg overflow-hidden">
          <div className="bg-gradient-to-r from-green-500/10 to-transparent px-6 py-4 border-b border-border">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                <h3 className="text-lg font-medium">Products</h3>
                <span className="text-sm text-accent/50">({displayResults.products.length} items)</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-accent/50">
                  {selectedProducts.size} selected
                </span>
                <button
                  onClick={selectAllProducts}
                  className="px-3 py-1.5 text-xs bg-hover hover:bg-accent/20 rounded-lg transition-colors"
                >
                  Select All
                </button>
                <button
                  onClick={deselectAllProducts}
                  className="px-3 py-1.5 text-xs bg-hover hover:bg-accent/20 rounded-lg transition-colors"
                >
                  Deselect All
                </button>
                {selectedProducts.size > 0 && (
                  <button
                    onClick={exportSelectedProducts}
                    className="px-3 py-1.5 text-xs bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded-lg transition-colors"
                  >
                    Export Selected
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="divide-y divide-border">
            {displayResults.products.map((product, idx) => (
              <div
                key={idx}
                className={`p-4 hover:bg-hover/30 transition-colors ${
                  selectedProducts.has(idx) ? 'bg-green-500/5 border-l-2 border-l-green-500' : ''
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                  {/* Checkbox */}
                  <div className="flex-shrink-0 pt-1">
                    <input
                      type="checkbox"
                      checked={selectedProducts.has(idx)}
                      onChange={() => toggleProductSelection(idx)}
                      className="w-4 h-4 rounded border-border bg-background accent-green-500 cursor-pointer"
                    />
                  </div>

                  {/* Image */}
                  <div className="flex-shrink-0 self-start sm:self-auto">
                    {product.image ? (
                      <img
                        src={product.image}
                        alt={product.title}
                        className="w-24 h-24 object-cover rounded-lg border border-border"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="%23666" stroke-width="1"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>';
                        }}
                      />
                    ) : (
                      <div className="w-24 h-24 bg-hover rounded-lg flex items-center justify-center text-accent/30">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <rect x="3" y="3" width="18" height="18" rx="2"/>
                          <circle cx="8.5" cy="8.5" r="1.5"/>
                          <path d="M21 15l-5-5L5 21"/>
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-base truncate">{product.title}</h4>
                        {product.price && (
                          <p className="text-green-500 font-semibold mt-1">{product.price}</p>
                        )}
                      </div>
                      {product.link && (
                        <a
                          href={product.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-shrink-0 px-3 py-1.5 text-xs bg-accent/10 hover:bg-accent/20 rounded-lg transition-colors"
                        >
                          View →
                        </a>
                      )}
                    </div>

                    {/* Description */}
                    {product.description && (
                      <p className="text-sm text-accent/70 mt-2 line-clamp-3">
                        {product.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Images Section */}
      {displayResults.images && displayResults.images.length > 0 && shouldShowSection('images') && (
        <section className="bg-background border border-border rounded-lg overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500/10 to-transparent px-6 py-4 border-b border-border">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                <h3 className="text-lg font-medium">Images</h3>
                <span className="text-sm text-accent/50">({displayResults.images.length} items)</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs text-accent/60">Format</label>
                <select
                  value={imageDownloadFormat}
                  onChange={(e) => setImageDownloadFormat(e.target.value as ImageDownloadFormat)}
                  className="px-2 py-1 text-xs border border-border bg-background rounded"
                >
                  <option value="original">Original</option>
                  <option value="jpg">JPG</option>
                  <option value="jpeg">JPEG</option>
                  <option value="png">PNG</option>
                  <option value="webp">WEBP</option>
                  <option value="gif">GIF</option>
                  <option value="svg">SVG</option>
                  <option value="avif">AVIF</option>
                </select>
                <span className="text-sm text-accent/50">
                  {selectedImages.size} selected
                </span>
                <button
                  onClick={selectAllImages}
                  className="px-3 py-1.5 text-xs bg-hover hover:bg-accent/20 rounded-lg transition-colors"
                >
                  Select All
                </button>
                <button
                  onClick={deselectAllImages}
                  className="px-3 py-1.5 text-xs bg-hover hover:bg-accent/20 rounded-lg transition-colors"
                >
                  Deselect All
                </button>
                {selectedImages.size > 0 && (
                  <button
                    onClick={exportSelectedImages}
                    className="px-3 py-1.5 text-xs bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded-lg transition-colors"
                  >
                    Export Selected
                  </button>
                )}
                <button
                  onClick={() => onDownloadAllImages?.(imageDownloadFormat)}
                  className="px-3 py-1.5 text-xs bg-blue-500 text-white hover:bg-blue-600 rounded-lg transition-colors"
                >
                  Download All
                </button>
              </div>
            </div>
          </div>

          <div className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {displayResults.images.map((image, idx) => (
                <div
                  key={idx}
                  className={`relative group rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                    selectedImages.has(idx)
                      ? 'border-blue-500 ring-2 ring-blue-500/20'
                      : 'border-transparent hover:border-accent/30'
                  }`}
                  onClick={() => toggleImageSelection(idx)}
                >
                  <div className="aspect-square bg-hover">
                    <img
                      src={image.url}
                      alt={image.alt || `Image ${idx + 1}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 24 24" fill="none" stroke="%23666" stroke-width="1"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>';
                      }}
                    />
                  </div>

                  {/* Checkbox overlay */}
                  <div className={`absolute top-2 left-2 transition-opacity ${
                    selectedImages.has(idx) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}>
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                      selectedImages.has(idx)
                        ? 'bg-blue-500 border-blue-500'
                        : 'bg-background/80 border-white/50'
                    }`}>
                      {selectedImages.has(idx) && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>

                  {/* Hover overlay with dimensions */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                    <div className="text-xs text-white/80 truncate w-full">
                      {image.width && image.height ? `${image.width}×${image.height}` : 'Click to select'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Videos Section */}
      {displayResults.videos && displayResults.videos.length > 0 && shouldShowSection('videos') && (
        <section className="bg-background border border-border rounded-lg overflow-hidden">
          <div className="bg-gradient-to-r from-red-500/10 to-transparent px-6 py-4 border-b border-border">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                <h3 className="text-lg font-medium">Videos</h3>
                <span className="text-sm text-accent/50">({displayResults.videos.length} items)</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs text-accent/60">Format</label>
                <select
                  value={videoDownloadFormat}
                  onChange={(e) => setVideoDownloadFormat(e.target.value as VideoDownloadFormat)}
                  className="px-2 py-1 text-xs border border-border bg-background rounded"
                >
                  <option value="original">Original</option>
                  <option value="mp4">MP4</option>
                  <option value="webm">WEBM</option>
                  <option value="mov">MOV</option>
                  <option value="m4v">M4V</option>
                  <option value="m3u8">M3U8</option>
                  <option value="mpd">MPD</option>
                  <option value="mkv">MKV</option>
                  <option value="ogv">OGV</option>
                  <option value="ts">TS</option>
                </select>
                <span className="text-sm text-accent/50">
                  {selectedVideos.size} selected
                </span>
                <button
                  onClick={selectAllVideos}
                  className="px-3 py-1.5 text-xs bg-hover hover:bg-accent/20 rounded-lg transition-colors"
                >
                  Select All
                </button>
                <button
                  onClick={deselectAllVideos}
                  className="px-3 py-1.5 text-xs bg-hover hover:bg-accent/20 rounded-lg transition-colors"
                >
                  Deselect All
                </button>
                {selectedVideos.size > 0 && (
                  <button
                    onClick={exportSelectedVideos}
                    className="px-3 py-1.5 text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg transition-colors"
                  >
                    Export Metadata
                  </button>
                )}
                {selectedVideos.size > 0 && (
                  <button
                    onClick={downloadSelectedVideos}
                    className="px-3 py-1.5 text-xs bg-red-500 text-white hover:bg-red-600 rounded-lg transition-colors"
                  >
                    Download Selected
                  </button>
                )}
                <button
                  onClick={() => onDownloadAllVideos?.(videoDownloadFormat)}
                  className="px-3 py-1.5 text-xs bg-red-700 text-white hover:bg-red-800 rounded-lg transition-colors"
                >
                  Download All
                </button>
              </div>
            </div>
          </div>

          <div className="px-6 py-2 border-b border-border text-xs text-accent/60">
            Download saves media files (mp4/m3u8/mpd/webm/mov). Export saves metadata JSON.
          </div>

          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayResults.videos.map((video, idx) => {
              const embedUrl = toEmbedUrl(video.url);
              const canRenderDirectVideo = isDirectVideoFile(video.url);
              const canRenderEmbed =
                embedUrl.includes('/embed/') || embedUrl.includes('player.vimeo.com/video/');

              return (
                <div
                  key={idx}
                  className={`border rounded-lg overflow-hidden transition-all ${
                    selectedVideos.has(idx)
                      ? 'border-red-500 ring-2 ring-red-500/20'
                      : 'border-border hover:border-accent/30'
                  }`}
                >
                  <div
                    className="cursor-pointer"
                    onClick={() => toggleVideoSelection(idx)}
                  >
                    {canRenderDirectVideo ? (
                      <video
                        src={video.url}
                        poster={video.poster}
                        controls
                        preload="metadata"
                        className="w-full aspect-video bg-black"
                      />
                    ) : canRenderEmbed ? (
                      <iframe
                        src={embedUrl}
                        title={video.title || `video-${idx + 1}`}
                        className="w-full aspect-video bg-black"
                        loading="lazy"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : (
                      <div className="w-full aspect-video bg-hover/40 flex items-center justify-center text-sm text-accent/60">
                        Preview unavailable
                      </div>
                    )}
                  </div>

                  <div className="p-3 space-y-2">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <h4 className="text-sm font-medium truncate">
                        {video.title || `Video ${idx + 1}`}
                      </h4>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => downloadSingleVideo(video.url)}
                          className="px-2 py-1 text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded transition-colors"
                        >
                          Download
                        </button>
                        <input
                          type="checkbox"
                          checked={selectedVideos.has(idx)}
                          onChange={() => toggleVideoSelection(idx)}
                          className="w-4 h-4 rounded border-border bg-background accent-red-500 cursor-pointer"
                        />
                      </div>
                    </div>

                    <a
                      href={video.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-red-400 hover:text-red-300 break-all line-clamp-2"
                    >
                      {video.url}
                    </a>

                    <div className="flex flex-wrap gap-2 text-xs text-accent/60">
                      {video.provider && (
                        <span className="px-2 py-0.5 bg-hover/50 rounded uppercase">{video.provider}</span>
                      )}
                      {video.durationSeconds && (
                        <span>{Math.round(video.durationSeconds)}s</span>
                      )}
                      {video.mimeType && <span>{video.mimeType}</span>}
                      {video.width && video.height && (
                        <span>{video.width}×{video.height}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Contacts Section */}
      {displayResults.contacts && (displayResults.contacts.emails.length > 0 || displayResults.contacts.phones.length > 0 || displayResults.contacts.socials.length > 0) && shouldShowSection('contacts') && (
        <section className="bg-background border border-border rounded-lg overflow-hidden">
          <div className="bg-gradient-to-r from-purple-500/10 to-transparent px-6 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 bg-purple-500 rounded-full"></span>
              <h3 className="text-lg font-medium">Contacts</h3>
            </div>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            {displayResults.contacts.emails.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-accent/70 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Emails ({displayResults.contacts.emails.length})
                </h4>
                <ul className="space-y-2">
                  {displayResults.contacts.emails.map((email, idx) => (
                    <li key={idx}>
                      <a
                        href={`mailto:${email}`}
                        className="text-sm text-blue-400 hover:text-blue-300 transition-colors break-all"
                      >
                        {email}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {displayResults.contacts.phones.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-accent/70 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  Phones ({displayResults.contacts.phones.length})
                </h4>
                <ul className="space-y-2">
                  {displayResults.contacts.phones.map((phone, idx) => (
                    <li key={idx}>
                      <a
                        href={`tel:${phone}`}
                        className="text-sm text-green-400 hover:text-green-300 transition-colors"
                      >
                        {phone}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {displayResults.contacts.socials.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-accent/70 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  Social Links ({displayResults.contacts.socials.length})
                </h4>
                <ul className="space-y-2">
                  {displayResults.contacts.socials.map((social, idx) => (
                    <li key={idx} className="truncate">
                      <a
                        href={social}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
                      >
                        {social.replace(/https?:\/\/(www\.)?/, '')}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Assets Section */}
      {displayResults.assets && displayResults.assets.length > 0 && shouldShowSection('assets') && (
        <section className="bg-background border border-border rounded-lg overflow-hidden">
          <div className="bg-gradient-to-r from-orange-500/10 to-transparent px-6 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 bg-orange-500 rounded-full"></span>
              <h3 className="text-lg font-medium">Assets</h3>
              <span className="text-sm text-accent/50">({displayResults.assets.length} files)</span>
            </div>
          </div>

          <div className="divide-y divide-border">
            {displayResults.assets.map((asset, idx) => (
              <div key={idx} className="flex flex-col gap-3 p-4 hover:bg-hover/30 transition-colors sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4 min-w-0">
                  <span className="px-2 py-1 text-xs font-medium bg-orange-500/20 text-orange-400 rounded uppercase">
                    {asset.type}
                  </span>
                  <span className="text-sm break-all">{asset.filename}</span>
                </div>
                <a
                  href={asset.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="px-4 py-1.5 text-sm bg-accent/10 hover:bg-accent/20 rounded-lg transition-colors"
                >
                  Download
                </a>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Links/Crawl Section */}
      {displayResults.crawl && displayResults.crawl.length > 0 && shouldShowSection('links') && (
        <section className="bg-background border border-border rounded-lg overflow-hidden">
          <div className="bg-gradient-to-r from-cyan-500/10 to-transparent px-6 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 bg-cyan-500 rounded-full"></span>
              <h3 className="text-lg font-medium">Crawled Links</h3>
              <span className="text-sm text-accent/50">({displayResults.crawl.length} links)</span>
            </div>
          </div>

          <div className="p-4 max-h-96 overflow-y-auto">
            <ul className="space-y-1">
              {displayResults.crawl.map((url, idx) => (
                <li key={idx} className="truncate py-1">
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    {url}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Text Section */}
      {displayResults.text && (displayResults.text.title || displayResults.text.meta || displayResults.text.headings.length > 0 || displayResults.text.paragraphs.length > 0) && shouldShowSection('text') && (
        <section className="bg-background border border-border rounded-lg overflow-hidden">
          <div className="bg-gradient-to-r from-pink-500/10 to-transparent px-6 py-4 border-b border-border">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-pink-500 rounded-full"></span>
                <h3 className="text-lg font-medium">Text Content</h3>
              </div>
              <button
                onClick={() => downloadTextFile(displayResults.text!)}
                className="px-4 py-1.5 text-sm bg-pink-500/20 text-pink-400 hover:bg-pink-500/30 rounded-lg transition-colors"
              >
                Download Text
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {displayResults.text.title && (
              <div>
                <h4 className="text-xs font-medium text-accent/50 uppercase tracking-wide mb-2">Page Title</h4>
                <p className="text-lg font-semibold">{displayResults.text.title}</p>
              </div>
            )}

            {displayResults.text.meta && (
              <div>
                <h4 className="text-xs font-medium text-accent/50 uppercase tracking-wide mb-2">Meta Description</h4>
                <p className="text-sm text-accent/80 italic">{displayResults.text.meta}</p>
              </div>
            )}

            {displayResults.text.headings.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-accent/50 uppercase tracking-wide mb-2">
                  Headings ({displayResults.text.headings.length})
                </h4>
                <ul className="space-y-1 list-disc list-inside text-sm">
                  {displayResults.text.headings.map((heading, idx) => (
                    <li key={idx}>{heading}</li>
                  ))}
                </ul>
              </div>
            )}

            {displayResults.text.paragraphs.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-accent/50 uppercase tracking-wide mb-2">
                  Content ({displayResults.text.paragraphs.length} paragraphs)
                </h4>
                <div className="bg-hover/50 rounded-lg p-4 max-h-[32rem] overflow-y-auto space-y-3 text-sm">
                  {displayResults.text.paragraphs.map((para, idx) => (
                    <p key={idx}>{para}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Screenshot Section */}
      {displayResults.screenshot && shouldShowSection('all') && (
        <section className="bg-background border border-border rounded-lg overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-500/10 to-transparent px-6 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 bg-indigo-500 rounded-full"></span>
              <h3 className="text-lg font-medium">Screenshot</h3>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {displayResults.screenshot.fullPage && (
              <div>
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h4 className="text-sm font-medium text-accent/70">Full Page</h4>
                  <button
                    onClick={() => downloadScreenshot(displayResults.screenshot!.fullPage!, 'fullpage')}
                    className="px-3 py-1 text-xs bg-accent/10 hover:bg-accent/20 rounded-lg transition-colors"
                  >
                    Download
                  </button>
                </div>
                <div className="border border-border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                  <img
                    src={`data:image/png;base64,${displayResults.screenshot.fullPage}`}
                    alt="Full page screenshot"
                    className="w-full h-auto"
                  />
                </div>
              </div>
            )}

            {displayResults.screenshot.viewport && (
              <div>
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h4 className="text-sm font-medium text-accent/70">Viewport</h4>
                  <button
                    onClick={() => downloadScreenshot(displayResults.screenshot!.viewport!, 'viewport')}
                    className="px-3 py-1 text-xs bg-accent/10 hover:bg-accent/20 rounded-lg transition-colors"
                  >
                    Download
                  </button>
                </div>
                <div className="border border-border rounded-lg overflow-hidden">
                  <img
                    src={`data:image/png;base64,${displayResults.screenshot.viewport}`}
                    alt="Viewport screenshot"
                    className="w-full h-auto"
                  />
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function downloadScreenshot(base64: string, type: 'fullpage' | 'viewport') {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: 'image/png' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `screenshot-${type}-${Date.now()}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

function downloadTextFile(textData: import('@/types').TextData) {
  let content = '';

  if (textData.title) {
    content += `TITLE\n${'='.repeat(50)}\n${textData.title}\n\n`;
  }

  if (textData.meta) {
    content += `DESCRIPTION\n${'='.repeat(50)}\n${textData.meta}\n\n`;
  }

  if (textData.headings.length > 0) {
    content += `HEADINGS (${textData.headings.length})\n${'='.repeat(50)}\n`;
    textData.headings.forEach((heading, idx) => {
      content += `${idx + 1}. ${heading}\n`;
    });
    content += '\n';
  }

  if (textData.paragraphs.length > 0) {
    content += `CONTENT (${textData.paragraphs.length} paragraphs)\n${'='.repeat(50)}\n`;
    textData.paragraphs.forEach((para, idx) => {
      content += `\n[${idx + 1}]\n${para}\n`;
    });
  }

  const blob = new Blob([content], { type: 'text/plain' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `scraped-text-${Date.now()}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
