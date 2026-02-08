import { ScrapeResult, ProductData, ImageData, VideoData } from '@/types';

export interface PreviewData {
  id: string;
  selected: boolean;
  data: any;
  type: 'product' | 'image' | 'video' | 'contact' | 'asset' | 'text' | 'crawl';
}

export function preparePreviewData(results: ScrapeResult): PreviewData[] {
  const preview: PreviewData[] = [];

  // Products
  if (results.products) {
    results.products.forEach((product, idx) => {
      preview.push({
        id: `product-${idx}`,
        selected: true,
        data: product,
        type: 'product',
      });
    });
  }

  // Images
  if (results.images) {
    results.images.forEach((image, idx) => {
      preview.push({
        id: `image-${idx}`,
        selected: true,
        data: image,
        type: 'image',
      });
    });
  }

  // Videos
  if (results.videos) {
    results.videos.forEach((video, idx) => {
      preview.push({
        id: `video-${idx}`,
        selected: true,
        data: video,
        type: 'video',
      });
    });
  }

  // Contacts (flattened)
  if (results.contacts) {
    if (results.contacts.emails && Array.isArray(results.contacts.emails)) {
      results.contacts.emails.forEach((email, idx) => {
        preview.push({
          id: `email-${idx}`,
          selected: true,
          data: { type: 'email', value: email },
          type: 'contact',
        });
      });
    }
    if (results.contacts.phones && Array.isArray(results.contacts.phones)) {
      results.contacts.phones.forEach((phone, idx) => {
        preview.push({
          id: `phone-${idx}`,
          selected: true,
          data: { type: 'phone', value: phone },
          type: 'contact',
        });
      });
    }
    if (results.contacts.socials && Array.isArray(results.contacts.socials)) {
      results.contacts.socials.forEach((social, idx) => {
        preview.push({
          id: `social-${idx}`,
          selected: true,
          data: { type: 'social', value: social },
          type: 'contact',
        });
      });
    }
  }

  // Assets
  if (results.assets) {
    results.assets.forEach((asset, idx) => {
      preview.push({
        id: `asset-${idx}`,
        selected: true,
        data: asset,
        type: 'asset',
      });
    });
  }

  // Crawl URLs
  if (results.crawl) {
    results.crawl.forEach((url, idx) => {
      preview.push({
        id: `crawl-${idx}`,
        selected: true,
        data: { url },
        type: 'crawl',
      });
    });
  }

  return preview;
}

export function filterPreviewData(
  preview: PreviewData[],
  filters: Record<string, any>
): PreviewData[] {
  return preview.filter((item) => {
    if (item.type === 'product') {
      const product = item.data as ProductData;
      
      // Price filter
      if (filters.minPrice || filters.maxPrice) {
        const priceStr = product.price || '';
        const priceNum = parseFloat(priceStr.replace(/[^0-9.]/g, ''));
        if (filters.minPrice && priceNum < filters.minPrice) return false;
        if (filters.maxPrice && priceNum > filters.maxPrice) return false;
      }

      // Keyword filter
      if (filters.keyword) {
        const keyword = filters.keyword.toLowerCase();
        const title = (product.title || '').toLowerCase();
        if (!title.includes(keyword)) return false;
      }

      // Has image filter
      if (filters.hasImage === true && !product.image) return false;
      if (filters.hasImage === false && product.image) return false;

      // Has price filter
      if (filters.hasPrice === true && !product.price) return false;
      if (filters.hasPrice === false && product.price) return false;
    }

    if (item.type === 'image') {
      const image = item.data as ImageData;
      
      // Size filters
      if (filters.minWidth && (image.width || 0) < filters.minWidth) return false;
      if (filters.minHeight && (image.height || 0) < filters.minHeight) return false;

      // Keyword filter
      if (filters.keyword) {
        const keyword = filters.keyword.toLowerCase();
        const url = (image.url || '').toLowerCase();
        const alt = (image.alt || '').toLowerCase();
        if (!url.includes(keyword) && !alt.includes(keyword)) return false;
      }
    }

    if (item.type === 'video') {
      const video = item.data as VideoData;
      if (filters.keyword) {
        const keyword = filters.keyword.toLowerCase();
        const url = (video.url || '').toLowerCase();
        const title = (video.title || '').toLowerCase();
        const provider = (video.provider || '').toLowerCase();
        if (!url.includes(keyword) && !title.includes(keyword) && !provider.includes(keyword)) return false;
      }
    }

    return true;
  });
}

export function exportPreviewData(preview: PreviewData[]): ScrapeResult {
  const result: ScrapeResult = {};

  const selected = preview.filter(p => p.selected);

  const products = selected
    .filter(p => p.type === 'product')
    .map(p => p.data as ProductData);
  if (products.length > 0) result.products = products;

  const images = selected
    .filter(p => p.type === 'image')
    .map(p => p.data as ImageData);
  if (images.length > 0) result.images = images;

  const videos = selected
    .filter(p => p.type === 'video')
    .map(p => p.data as VideoData);
  if (videos.length > 0) result.videos = videos;

  const contacts = {
    emails: [] as string[],
    phones: [] as string[],
    socials: [] as string[],
  };
  selected
    .filter(p => p.type === 'contact')
    .forEach(p => {
      if (p.data.type === 'email') contacts.emails.push(p.data.value);
      if (p.data.type === 'phone') contacts.phones.push(p.data.value);
      if (p.data.type === 'social') contacts.socials.push(p.data.value);
    });
  if (contacts.emails.length > 0 || contacts.phones.length > 0 || contacts.socials.length > 0) {
    result.contacts = contacts;
  }

  const assets = selected
    .filter(p => p.type === 'asset')
    .map(p => p.data);
  if (assets.length > 0) result.assets = assets;

  const crawl = selected
    .filter(p => p.type === 'crawl')
    .map(p => p.data.url);
  if (crawl.length > 0) result.crawl = crawl;

  return result;
}
