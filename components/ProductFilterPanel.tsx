'use client';

import { useState } from 'react';
import { ProductData } from '@/types';

interface ProductFilterPanelProps {
  products: ProductData[];
  onFiltered: (filtered: ProductData[]) => void;
}

export default function ProductFilterPanel({ products, onFiltered }: ProductFilterPanelProps) {
  const [filters, setFilters] = useState({
    minPrice: '',
    maxPrice: '',
    currency: '',
    keyword: '',
    hasImage: null as boolean | null,
    hasDescription: null as boolean | null,
    hasPrice: null as boolean | null,
    inStock: null as boolean | null,
    categories: [] as string[],
  });

  const applyFilters = () => {
    let filtered = [...products];

    // Price range
    if (filters.minPrice || filters.maxPrice) {
      filtered = filtered.filter((p) => {
        const priceStr = p.price || '';
        const priceNum = parseFloat(priceStr.replace(/[^0-9.]/g, ''));
        if (filters.minPrice) {
          const min = parseFloat(filters.minPrice.replace(/[^0-9.]/g, ''));
          if (priceNum < min) return false;
        }
        if (filters.maxPrice) {
          const max = parseFloat(filters.maxPrice.replace(/[^0-9.]/g, ''));
          if (priceNum > max) return false;
        }
        return true;
      });
    }

    // Currency filter
    if (filters.currency) {
      filtered = filtered.filter((p) => {
        const priceStr = (p.price || '').toLowerCase();
        return priceStr.includes(filters.currency.toLowerCase());
      });
    }

    // Keyword filter
    if (filters.keyword) {
      const keyword = filters.keyword.toLowerCase();
      filtered = filtered.filter((p) => {
        const title = (p.title || '').toLowerCase();
        const desc = (p.description || '').toLowerCase();
        return title.includes(keyword) || desc.includes(keyword);
      });
    }

    // Has image
    if (filters.hasImage !== null) {
      filtered = filtered.filter((p) => (p.image ? true : false) === filters.hasImage);
    }

    // Has description
    if (filters.hasDescription !== null) {
      filtered = filtered.filter((p) => (p.description ? true : false) === filters.hasDescription);
    }

    // Has price
    if (filters.hasPrice !== null) {
      filtered = filtered.filter((p) => (p.price ? true : false) === filters.hasPrice);
    }

    onFiltered(filtered);
  };

  const resetFilters = () => {
    setFilters({
      minPrice: '',
      maxPrice: '',
      currency: '',
      keyword: '',
      hasImage: null,
      hasDescription: null,
      hasPrice: null,
      inStock: null,
      categories: [],
    });
    onFiltered(products);
  };

  const hasActiveFilters = Object.values(filters).some(
    (v) => v !== null && v !== '' && (Array.isArray(v) ? v.length > 0 : true)
  );

  return (
    <div className="border border-border rounded p-4 mb-6 bg-hover/30">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm text-accent/70">product filters</h4>
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
        {/* Price Range */}
        <div>
          <h5 className="text-xs text-accent/50 mb-2">price range</h5>
          <div className="grid grid-cols-3 gap-2">
            <input
              type="text"
              placeholder="min price"
              value={filters.minPrice}
              onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })}
              className="px-2 py-1 text-xs border border-border bg-background rounded"
            />
            <input
              type="text"
              placeholder="max price"
              value={filters.maxPrice}
              onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })}
              className="px-2 py-1 text-xs border border-border bg-background rounded"
            />
            <select
              value={filters.currency}
              onChange={(e) => setFilters({ ...filters, currency: e.target.value })}
              className="px-2 py-1 text-xs border border-border bg-background rounded"
            >
              <option value="">all currencies</option>
              <option value="$">USD ($)</option>
              <option value="€">EUR (€)</option>
              <option value="£">GBP (£)</option>
              <option value="¥">JPY (¥)</option>
            </select>
          </div>
        </div>

        {/* Keyword */}
        <div>
          <h5 className="text-xs text-accent/50 mb-2">keyword</h5>
          <input
            type="text"
            placeholder="search in title or description"
            value={filters.keyword}
            onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
            className="w-full px-2 py-1 text-xs border border-border bg-background rounded"
          />
        </div>

        {/* Quality Filters */}
        <div>
          <h5 className="text-xs text-accent/50 mb-2">quality</h5>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={filters.hasImage === true}
                onChange={(e) => setFilters({ ...filters, hasImage: e.target.checked ? true : null })}
                className="w-4 h-4"
              />
              has image
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={filters.hasDescription === true}
                onChange={(e) => setFilters({ ...filters, hasDescription: e.target.checked ? true : null })}
                className="w-4 h-4"
              />
              has description
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={filters.hasPrice === true}
                onChange={(e) => setFilters({ ...filters, hasPrice: e.target.checked ? true : null })}
                className="w-4 h-4"
              />
              has price
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={filters.inStock === true}
                onChange={(e) => setFilters({ ...filters, inStock: e.target.checked ? true : null })}
                className="w-4 h-4"
              />
              in stock
            </label>
          </div>
        </div>

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
