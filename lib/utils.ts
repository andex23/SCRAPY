import { ImageData } from '@/types';

/**
 * Resolve relative URLs to absolute URLs
 */
export function resolveUrl(url: string, baseUrl: string): string {
  try {
    return new URL(url, baseUrl).href;
  } catch {
    return url;
  }
}

/**
 * Deduplicate images by URL
 */
export function deduplicateImages(images: ImageData[]): ImageData[] {
  const seen = new Set<string>();
  return images.filter((img) => {
    if (seen.has(img.url)) {
      return false;
    }
    seen.add(img.url);
    return true;
  });
}

/**
 * Filter out invalid or unwanted images
 */
export function filterImages(images: ImageData[]): ImageData[] {
  return images.filter((img) => {
    // Filter out data URLs, empty strings, and common tracking pixels
    if (!img.url || img.url.startsWith('data:')) return false;
    if (img.width && img.height && (img.width < 20 || img.height < 20)) return false;
    return true;
  });
}

/**
 * Upgrade image URL to highest quality version
 * Removes size limitations and format constraints from popular CDNs
 */
export function upgradeToHighQuality(url: string): string {
  try {
    const urlObj = new URL(url);

    // H&M CDN - request largest available size
    if (urlObj.hostname.includes('lp2.hm.com') || urlObj.hostname.includes('hm.com')) {
      // H&M uses patterns like /hmgoepprod.123456789.jpg - try to get highest quality
      // Remove size parameters and request main image
      let upgraded = url
        .replace(/\?.*$/, '') // Remove query params
        .replace(/_[A-Z][A-Z]?_\d+/, '') // Remove size codes like _MN_1280
        .replace(/set=\w+/, 'set=source') // Request source quality
        .replace(/quality=\d+/, 'quality=100'); // Max quality

      // Try to get larger version by modifying the URL structure
      if (!upgraded.includes('source')) {
        upgraded = upgraded.includes('?')
          ? upgraded + '&set=source&quality=100'
          : upgraded + '?set=source&quality=100';
      }
      return upgraded;
    }

    // Squarespace CDN - remove format parameter to get original
    if (urlObj.hostname.includes('squarespace-cdn.com') || urlObj.hostname.includes('squarespace.com')) {
      urlObj.searchParams.delete('format');
      return urlObj.toString();
    }

    // Shopify CDN - change size to maximum
    if (urlObj.hostname.includes('shopify.com') || urlObj.hostname.includes('cdn.shopify.com')) {
      return url.replace(/_(pico|icon|thumb|small|compact|medium|large|grande|master|\d+x\d*)/g, '');
    }

    // WordPress/WooCommerce - get full size
    if (urlObj.hostname.includes('wordpress.com') || url.includes('/wp-content/')) {
      return url.replace(/-\d+x\d+\.(jpg|jpeg|png|gif|webp)/gi, '.$1');
    }

    // Cloudinary - request original quality
    if (urlObj.hostname.includes('cloudinary.com')) {
      return url
        .replace(/\/q_\d+/, '/q_100')
        .replace(/\/w_\d+/, '')
        .replace(/\/h_\d+/, '')
        .replace(/\/c_\w+/, '/c_limit')
        .replace(/\/fl_\w+/, '');
    }

    // Imgix - request max quality
    if (urlObj.hostname.includes('imgix.net')) {
      urlObj.searchParams.set('q', '100');
      urlObj.searchParams.delete('w');
      urlObj.searchParams.delete('h');
      urlObj.searchParams.delete('fit');
      return urlObj.toString();
    }

    // Amazon/AWS - get original size
    if (urlObj.hostname.includes('amazon.com') || urlObj.hostname.includes('ssl-images-amazon.com') || urlObj.hostname.includes('media-amazon.com')) {
      // Remove Amazon image transformation parameters
      return url
        .replace(/\._[A-Z]{2}\d+_/, '.') // Remove size codes like ._SL500_
        .replace(/\._[A-Z]+_\d+,\d+_/, '.'); // Remove crop codes
    }

    // Etsy CDN
    if (urlObj.hostname.includes('etsystatic.com')) {
      // Request full size image
      return url.replace(/il_\d+x[NF]?\./, 'il_fullxfull.');
    }

    // Wix CDN
    if (urlObj.hostname.includes('wixstatic.com')) {
      // Remove v1 transformations
      return url.replace(/\/v1\/fill\/.*?\//, '/v1/fill/w_0,h_0/');
    }

    // eBay CDN
    if (urlObj.hostname.includes('ebayimg.com')) {
      // Request full size
      return url.replace(/\/s-l\d+\./, '/s-l1600.');
    }

    // Pinterest CDN
    if (urlObj.hostname.includes('pinimg.com')) {
      return url
        .replace(/\/\d+x\//, '/originals/')
        .replace(/\/\d+x\d+\//, '/originals/');
    }

    // Akamai/Fastly generic CDN patterns
    if (url.includes('?')) {
      // Remove common resize/quality parameters
      const removeParams = ['w', 'width', 'h', 'height', 'size', 'quality', 'q', 'fit', 'crop', 'resize', 'auto', 'fm', 'format'];
      removeParams.forEach(param => {
        urlObj.searchParams.delete(param);
      });
    }

    // Generic patterns - try to get higher quality
    let result = urlObj.toString()
      .replace(/_thumb\./gi, '.')
      .replace(/_small\./gi, '.')
      .replace(/_medium\./gi, '.')
      .replace(/_large\./gi, '.')
      .replace(/_\d{2,4}x\d{2,4}\./gi, '.')
      .replace(/-\d{2,4}x\d{2,4}\./gi, '.');

    return result;
  } catch {
    return url;
  }
}

/**
 * From srcset, extract the highest resolution image URL
 */
export function getHighestResFromSrcset(srcset: string): string | null {
  const sources = srcset.split(',').map(s => s.trim());
  let highestRes = { url: '', width: 0 };

  for (const source of sources) {
    const parts = source.split(/\s+/);
    const url = parts[0];
    const descriptor = parts[1] || '1x';

    let width = 0;
    if (descriptor.endsWith('w')) {
      width = parseInt(descriptor);
    } else if (descriptor.endsWith('x')) {
      width = parseFloat(descriptor) * 1000; // Approximate
    }

    if (width > highestRes.width) {
      highestRes = { url, width };
    }
  }

  return highestRes.url || null;
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

