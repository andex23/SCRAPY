'use client';

import { useState } from 'react';
import { ScrapeResult, ImageData, ProductData } from '@/types';

interface FilterPanelProps {
  results: ScrapeResult;
  onFiltered: (filtered: ScrapeResult) => void;
}

export default function FilterPanel({ results, onFiltered }: FilterPanelProps) {
  const [imageFilters, setImageFilters] = useState({
    minWidth: '',
    minHeight: '',
    keyword: '',
  });
  const [productFilters, setProductFilters] = useState({
    minPrice: '',
    maxPrice: '',
    keyword: '',
  });
  const [textFilters, setTextFilters] = useState({
    keyword: '',
  });

  const applyFilters = () => {
    const filtered: ScrapeResult = {};

    // Filter images
    if (results.images) {
      let filteredImages = [...results.images];

      if (imageFilters.minWidth) {
        const minW = parseInt(imageFilters.minWidth);
        filteredImages = filteredImages.filter((img) => (img.width || 0) >= minW);
      }

      if (imageFilters.minHeight) {
        const minH = parseInt(imageFilters.minHeight);
        filteredImages = filteredImages.filter((img) => (img.height || 0) >= minH);
      }

      if (imageFilters.keyword) {
        const keyword = imageFilters.keyword.toLowerCase();
        filteredImages = filteredImages.filter(
          (img) =>
            img.url.toLowerCase().includes(keyword) ||
            (img.alt || '').toLowerCase().includes(keyword)
        );
      }

      if (filteredImages.length > 0) {
        filtered.images = filteredImages;
      }
    }

    // Filter products
    if (results.products) {
      let filteredProducts = [...results.products];

      if (productFilters.minPrice) {
        const minP = parseFloat(productFilters.minPrice.replace(/[^0-9.]/g, ''));
        filteredProducts = filteredProducts.filter((p) => {
          const price = parseFloat((p.price || '0').replace(/[^0-9.]/g, ''));
          return price >= minP;
        });
      }

      if (productFilters.maxPrice) {
        const maxP = parseFloat(productFilters.maxPrice.replace(/[^0-9.]/g, ''));
        filteredProducts = filteredProducts.filter((p) => {
          const price = parseFloat((p.price || '0').replace(/[^0-9.]/g, ''));
          return price <= maxP;
        });
      }

      if (productFilters.keyword) {
        const keyword = productFilters.keyword.toLowerCase();
        filteredProducts = filteredProducts.filter(
          (p) => p.title.toLowerCase().includes(keyword)
        );
      }

      if (filteredProducts.length > 0) {
        filtered.products = filteredProducts;
      }
    }

    // Filter text
    if (results.text && textFilters.keyword) {
      const keyword = textFilters.keyword.toLowerCase();
      const filteredText = { ...results.text };

      if (filteredText.headings) {
        filteredText.headings = filteredText.headings.filter((h) =>
          h.toLowerCase().includes(keyword)
        );
      }

      if (filteredText.paragraphs) {
        filteredText.paragraphs = filteredText.paragraphs.filter((p) =>
          p.toLowerCase().includes(keyword)
        );
      }

      if (
        filteredText.title?.toLowerCase().includes(keyword) ||
        filteredText.meta?.toLowerCase().includes(keyword) ||
        filteredText.headings.length > 0 ||
        filteredText.paragraphs.length > 0
      ) {
        filtered.text = filteredText;
      }
    } else if (results.text && !textFilters.keyword) {
      filtered.text = results.text;
    }

    // Copy other data
    if (results.contacts) filtered.contacts = results.contacts;
    if (results.assets) filtered.assets = results.assets;
    if (results.videos) filtered.videos = results.videos;
    if (results.crawl) filtered.crawl = results.crawl;
    if (results.screenshot) filtered.screenshot = results.screenshot;

    onFiltered(filtered);
  };

  const resetFilters = () => {
    setImageFilters({ minWidth: '', minHeight: '', keyword: '' });
    setProductFilters({ minPrice: '', maxPrice: '', keyword: '' });
    setTextFilters({ keyword: '' });
    onFiltered(results);
  };

  const hasActiveFilters =
    imageFilters.minWidth ||
    imageFilters.minHeight ||
    imageFilters.keyword ||
    productFilters.minPrice ||
    productFilters.maxPrice ||
    productFilters.keyword ||
    textFilters.keyword;

  return (
    <div className="border border-border rounded p-4 mb-6 bg-hover/30">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm text-accent/70">filters</h4>
        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="text-xs text-accent/60 hover:text-foreground underline"
          >
            reset
          </button>
        )}
      </div>

      <div className="space-y-4">
        {/* Image Filters */}
        {results.images && results.images.length > 0 && (
          <div>
            <h5 className="text-xs text-accent/50 mb-2">images</h5>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="number"
                placeholder="min width"
                value={imageFilters.minWidth}
                onChange={(e) => setImageFilters({ ...imageFilters, minWidth: e.target.value })}
                className="px-2 py-1 text-xs border border-border bg-background rounded"
              />
              <input
                type="number"
                placeholder="min height"
                value={imageFilters.minHeight}
                onChange={(e) => setImageFilters({ ...imageFilters, minHeight: e.target.value })}
                className="px-2 py-1 text-xs border border-border bg-background rounded"
              />
              <input
                type="text"
                placeholder="keyword"
                value={imageFilters.keyword}
                onChange={(e) => setImageFilters({ ...imageFilters, keyword: e.target.value })}
                className="px-2 py-1 text-xs border border-border bg-background rounded"
              />
            </div>
          </div>
        )}

        {/* Product Filters */}
        {results.products && results.products.length > 0 && (
          <div>
            <h5 className="text-xs text-accent/50 mb-2">products</h5>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                placeholder="min price"
                value={productFilters.minPrice}
                onChange={(e) => setProductFilters({ ...productFilters, minPrice: e.target.value })}
                className="px-2 py-1 text-xs border border-border bg-background rounded"
              />
              <input
                type="text"
                placeholder="max price"
                value={productFilters.maxPrice}
                onChange={(e) => setProductFilters({ ...productFilters, maxPrice: e.target.value })}
                className="px-2 py-1 text-xs border border-border bg-background rounded"
              />
              <input
                type="text"
                placeholder="keyword"
                value={productFilters.keyword}
                onChange={(e) => setProductFilters({ ...productFilters, keyword: e.target.value })}
                className="px-2 py-1 text-xs border border-border bg-background rounded"
              />
            </div>
          </div>
        )}

        {/* Text Filters */}
        {results.text && (
          <div>
            <h5 className="text-xs text-accent/50 mb-2">text</h5>
            <input
              type="text"
              placeholder="keyword"
              value={textFilters.keyword}
              onChange={(e) => setTextFilters({ ...textFilters, keyword: e.target.value })}
              className="w-full px-2 py-1 text-xs border border-border bg-background rounded"
            />
          </div>
        )}

        <button
          onClick={applyFilters}
          className="w-full px-4 py-2 bg-accent hover:bg-foreground text-background rounded transition-colors text-sm"
        >
          apply filters
        </button>
      </div>
    </div>
  );
}
