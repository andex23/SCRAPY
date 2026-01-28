import { ScrapeResult } from '@/types';
import { upgradeToHighQuality } from './utils';

export function downloadJson(data: ScrapeResult, filename?: string) {
  // Create a copy with upgraded image URLs for maximum quality export
  const exportData: ScrapeResult = {
    ...data,
    products: data.products?.map(p => ({
      ...p,
      image: p.image ? upgradeToHighQuality(p.image) : undefined,
    })),
    images: data.images?.map(img => ({
      ...img,
      url: upgradeToHighQuality(img.url),
    })),
  };

  const json = JSON.stringify(exportData, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `scrape-results-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
