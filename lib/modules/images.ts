import { Page } from 'playwright';
import { ImageData } from '@/types';

export async function extractImages(page: Page, baseUrl: string): Promise<ImageData[]> {
  const images = await page.evaluate(() => {
    const imageData: Array<{
      url: string;
      alt?: string;
      width?: number;
      height?: number;
    }> = [];

    // Track seen URLs to avoid duplicates
    const seen = new Set<string>();

    const addImage = (url: string, alt?: string, width?: number, height?: number) => {
      if (url && !url.startsWith('data:') && !seen.has(url)) {
        seen.add(url);
        imageData.push({ url, alt, width, height });
      }
    };

    // Get all <img> elements
    document.querySelectorAll('img').forEach((img) => {
      // Check srcset and data-srcset for highest quality
      const srcset = img.srcset || img.getAttribute('srcset') || img.getAttribute('data-srcset');

      if (srcset) {
        // Parse srcset to get highest resolution
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
            width = parseFloat(descriptor) * 1000;
          }

          if (width > highestRes.width) {
            highestRes = { url, width };
          }
        }

        if (highestRes.url) {
          addImage(
            highestRes.url,
            img.alt || undefined,
            img.naturalWidth || undefined,
            img.naturalHeight || undefined
          );
        }
      }

      // Check multiple possible source attributes for lazy loading
      const srcAttrs = [
        'src', 'data-src', 'data-lazy-src', 'data-original',
        'data-image', 'data-lazy', 'data-url', 'data-img-src',
        'data-full-src', 'data-zoom-image', 'data-large-src',
        'data-hi-res-src', 'data-highres', 'data-main-image'
      ];

      for (const attr of srcAttrs) {
        const src = img.getAttribute(attr);
        if (src && !src.startsWith('data:')) {
          addImage(
            src,
            img.alt || undefined,
            img.naturalWidth || undefined,
            img.naturalHeight || undefined
          );
        }
      }
    });

    // Get images from <picture> and <source> elements
    document.querySelectorAll('picture source').forEach((source) => {
      const srcset = source.getAttribute('srcset') || source.getAttribute('data-srcset');
      if (srcset) {
        // Get highest resolution from srcset
        const sources = srcset.split(',').map(s => s.trim());
        let highestRes = { url: '', width: 0 };

        for (const src of sources) {
          const parts = src.split(/\s+/);
          const url = parts[0];
          const descriptor = parts[1] || '1x';

          let width = 0;
          if (descriptor.endsWith('w')) {
            width = parseInt(descriptor);
          } else if (descriptor.endsWith('x')) {
            width = parseFloat(descriptor) * 1000;
          }

          if (width > highestRes.width) {
            highestRes = { url, width };
          }
        }

        if (highestRes.url) {
          addImage(highestRes.url);
        }
      }
    });

    // Get images from data attributes on other elements (common in e-commerce)
    document.querySelectorAll('[data-image], [data-src], [data-background], [data-img]').forEach((el) => {
      const attrs = ['data-image', 'data-src', 'data-background', 'data-bg', 'data-img', 'data-poster'];
      for (const attr of attrs) {
        const url = el.getAttribute(attr);
        if (url && !url.startsWith('data:')) {
          addImage(url);
        }
      }
    });

    // Get images from anchor tags (product cards often wrap images in links)
    document.querySelectorAll('a[data-image], a[href*=".jpg"], a[href*=".png"], a[href*=".webp"]').forEach((a) => {
      const dataImg = a.getAttribute('data-image');
      if (dataImg) {
        addImage(dataImg);
      }
      const href = a.getAttribute('href');
      if (href && (href.endsWith('.jpg') || href.endsWith('.png') || href.endsWith('.webp') || href.endsWith('.jpeg'))) {
        addImage(href);
      }
    });

    // Get CSS background images
    const allElements = document.querySelectorAll('*');
    allElements.forEach((element) => {
      const style = window.getComputedStyle(element);
      const bgImage = style.backgroundImage;

      if (bgImage && bgImage !== 'none') {
        const matches = bgImage.match(/url\(['"]?(.*?)['"]?\)/g);
        if (matches) {
          matches.forEach((match) => {
            const url = match.replace(/url\(['"]?/, '').replace(/['"]?\)$/, '');
            if (url && !url.startsWith('data:')) {
              addImage(url);
            }
          });
        }
      }
    });

    // Look for images in style attributes (inline styles)
    document.querySelectorAll('[style*="background"]').forEach((el) => {
      const style = el.getAttribute('style') || '';
      const match = style.match(/url\(['"]?([^'")\s]+)['"]?\)/);
      if (match && match[1] && !match[1].startsWith('data:')) {
        addImage(match[1]);
      }
    });

    return imageData;
  });

  // Process and limit to 100 images
  return images.slice(0, 100);
}

