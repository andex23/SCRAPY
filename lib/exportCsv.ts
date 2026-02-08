import { ScrapeResult, ProductData, ContactData } from '@/types';
import { upgradeToHighQuality } from './utils';

export function downloadCsv(data: ScrapeResult, filename?: string) {
  const rows: string[][] = [];

  // Products CSV
  if (data.products && data.products.length > 0) {
    rows.push(['=== PRODUCTS ===']);
    rows.push(['Title', 'Price', 'Image URL (High Quality)', 'Link', 'Description']);
    data.products.forEach((product: ProductData) => {
      rows.push([
        product.title || '',
        product.price || '',
        product.image ? upgradeToHighQuality(product.image) : '',
        product.link || '',
        product.description || '',
      ]);
    });
    rows.push([]);
  }

  // Contacts CSV
  if (data.contacts) {
    rows.push(['=== CONTACTS ===']);
    rows.push(['Type', 'Value']);
    data.contacts.emails.forEach((email) => {
      rows.push(['Email', email]);
    });
    data.contacts.phones.forEach((phone) => {
      rows.push(['Phone', phone]);
    });
    data.contacts.socials.forEach((social) => {
      rows.push(['Social', social]);
    });
    rows.push([]);
  }

  // Crawl URLs CSV
  if (data.crawl && data.crawl.length > 0) {
    rows.push(['=== CRAWL LINKS ===']);
    rows.push(['URL']);
    data.crawl.forEach((url) => {
      rows.push([url]);
    });
    rows.push([]);
  }

  // Assets CSV
  if (data.assets && data.assets.length > 0) {
    rows.push(['=== ASSETS ===']);
    rows.push(['Filename', 'URL', 'Type', 'Size']);
    data.assets.forEach((asset) => {
      rows.push([
        asset.filename || '',
        asset.url || '',
        asset.type || '',
        asset.size || '',
      ]);
    });
    rows.push([]);
  }

  // Images CSV
  if (data.images && data.images.length > 0) {
    rows.push(['=== IMAGES ===']);
    rows.push(['URL (High Quality)', 'Alt Text', 'Width', 'Height']);
    data.images.forEach((img) => {
      rows.push([
        img.url ? upgradeToHighQuality(img.url) : '',
        img.alt || '',
        img.width?.toString() || '',
        img.height?.toString() || '',
      ]);
    });
  }

  // Videos CSV
  if (data.videos && data.videos.length > 0) {
    rows.push([]);
    rows.push(['=== VIDEOS ===']);
    rows.push(['URL', 'Title', 'Provider', 'Duration (seconds)', 'Mime Type', 'Width', 'Height', 'Poster URL']);
    data.videos.forEach((video) => {
      rows.push([
        video.url || '',
        video.title || '',
        video.provider || '',
        video.durationSeconds?.toString() || '',
        video.mimeType || '',
        video.width?.toString() || '',
        video.height?.toString() || '',
        video.poster || '',
      ]);
    });
  }

  // Convert to CSV string
  const csvContent = rows
    .map((row) =>
      row
        .map((cell) => {
          const cellStr = String(cell);
          // Escape quotes and wrap in quotes if contains comma, quote, or newline
          if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
            return `"${cellStr.replace(/"/g, '""')}"`;
          }
          return cellStr;
        })
        .join(',')
    )
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `scrape-results-${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
