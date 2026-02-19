import { Page } from 'playwright';
import { ProductData } from '@/types';

export async function extractProducts(page: Page): Promise<ProductData[]> {
  const products = await page.evaluate(() => {
    const productData: ProductData[] = [];
    const seenLinks = new Set<string>();

    const clean = (s?: string | null) => (s || '').replace(/\s+/g, ' ').trim();

    // Helper to resolve relative URLs to absolute
    const resolveUrl = (url: string | undefined | null): string | undefined => {
      if (!url) return undefined;
      if (url.startsWith('http://') || url.startsWith('https://')) return url;
      if (url.startsWith('//')) return window.location.protocol + url;
      if (url.startsWith('/')) return window.location.origin + url;
      // Relative path
      return new URL(url, window.location.href).href;
    };

    const pickImg = (img: HTMLImageElement | null) => {
      if (!img) return undefined;
      // Prefer currentSrc if available for responsive images
      const src =
        img.currentSrc ||
        img.getAttribute('src') ||
        img.getAttribute('data-src') ||
        img.getAttribute('data-original') ||
        undefined;
      if (!src || src.startsWith('data:')) return undefined;
      // Resolve to absolute URL
      return resolveUrl(src);
    };

    const linkPath = (url: string): string => {
      try {
        return new URL(url, window.location.href).pathname.toLowerCase();
      } catch {
        return url.toLowerCase();
      }
    };

    const isExcludedProductLink = (url: string): boolean => {
      const path = linkPath(url);
      if (path.includes('/product-category/') || path.includes('/category/') || path.includes('/tag/')) return true;
      if (/\/(?:cart|checkout|account|my-account|wishlist)(?:\/|$)/.test(path)) return true;
      return /[?&](add-to-cart|orderby|filter_|min_price|max_price|rating_filter)=/i.test(url);
    };

    const hasProductPathHint = (url: string): boolean => {
      const path = linkPath(url);
      return (
        /\/(?:product|products|item|dp)\//.test(path) ||
        /\/p\/[^/]+/.test(path) ||
        path.includes('productpage.')
      );
    };

    const isLikelyDecorativeImage = (imageUrl: string): boolean => {
      const value = imageUrl.toLowerCase();
      return (
        value.includes('placeholder') ||
        value.includes('sprite') ||
        value.includes('icon') ||
        value.includes('logo') ||
        value.includes('/wp-content/plugins/')
      );
    };

    const addProduct = (candidate: Partial<ProductData>) => {
      const resolvedLink = resolveUrl(candidate.link);
      if (!resolvedLink || seenLinks.has(resolvedLink) || isExcludedProductLink(resolvedLink)) return;

      const title = clean(candidate.title);
      if (!title || title.length < 2) return;

      const rawImage = resolveUrl(candidate.image || undefined);
      const image = rawImage && !isLikelyDecorativeImage(rawImage) ? rawImage : undefined;
      const price = clean(candidate.price);
      const description = clean(candidate.description);

      const likelyByPath = hasProductPathHint(resolvedLink);
      const hasPrice = /\d/.test(price);
      const hasImage = !!image;

      // Keep strict quality: product path OR both image+price hints.
      if (!likelyByPath && !(hasPrice && hasImage)) return;

      seenLinks.add(resolvedLink);
      productData.push({
        title,
        price: price || undefined,
        image,
        link: resolvedLink,
        description: description || undefined,
      });
    };

    // Strategy 1: Look for JSON-LD structured data
    const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
    jsonLdScripts.forEach((script) => {
      try {
        const data = JSON.parse(script.textContent || '');

        // Handle single product
        if (data['@type'] === 'Product') {
          addProduct({
            title: data.name || '',
            price: data.offers?.price || data.offers?.lowPrice || undefined,
            image: data.image?.[0] || data.image,
            link: data.url || window.location.href,
            description: data.description || undefined,
          });
        }

        // Handle product list
        if (data['@type'] === 'ItemList' && data.itemListElement) {
          data.itemListElement.forEach((item: any) => {
            if (item['@type'] === 'Product' || item.item?.['@type'] === 'Product') {
              const product = item.item || item;
              addProduct({
                title: product.name || '',
                price: product.offers?.price || product.offers?.lowPrice || undefined,
                image: product.image?.[0] || product.image,
                link: product.url,
                description: product.description || undefined,
              });
            }
          });
        }
      } catch (e) {
        // Invalid JSON, skip
      }
    });

    // Strategy 2: Fallback DOM scraping for common eCommerce patterns
    if (productData.length === 0) {
      // Heuristic A: H&M specific patterns
      const hmLinks = Array.from(document.querySelectorAll('a[href]'))
        .map((a) => a as HTMLAnchorElement)
        .filter((a) => {
          const href = a.getAttribute('href') || '';
          return href.includes('productpage.') ||
            href.includes('/productpage.') ||
            href.includes('/products/') ||
            href.includes('/p/') ||
            (href.includes('hm.com') && (href.match(/\/[a-z]{2}\/[a-z]{2}\/productpage/) || href.includes('/product')));
        });

      // Also check for H&M product cards/items
      const hmProductCards = document.querySelectorAll(
        '[data-product-id], [data-product-code], .product-item, .item, [class*="product-item"], [class*="ProductItem"]'
      );

      // Combine both approaches
      const allProductElements = new Set<HTMLElement>();

      hmLinks.forEach(link => {
        const card = link.closest('[data-product-id], [data-product-code], .product-item, .item, [class*="product"], article, li') || link.parentElement;
        if (card) allProductElements.add(card as HTMLElement);
      });

      hmProductCards.forEach(card => {
        allProductElements.add(card as HTMLElement);
      });

      for (const card of Array.from(allProductElements)) {
        const a = card.querySelector('a[href]') as HTMLAnchorElement | null;
        const link = a?.href || (card.querySelector('a') as HTMLAnchorElement)?.href;
        if (!link) continue;

        // Try multiple title selectors for H&M
        const title =
          clean(card.querySelector('[data-testid*="product-name"], [data-testid*="name"], .item-heading, .product-item-heading, .product-item-name, [class*="title"], [class*="name"], h2, h3, h4')?.textContent || '') ||
          clean(a?.getAttribute('aria-label')) ||
          clean(a?.getAttribute('title')) ||
          clean(a?.textContent) ||
          clean(card.getAttribute('aria-label')) ||
          clean(card.getAttribute('data-product-name'));

        // Try multiple price selectors
        const price =
          clean(card.querySelector('[data-testid*="price"], .price, [class*="price"], .money, [class*="Money"], [data-price]')?.textContent || '') ||
          clean(card.getAttribute('data-price'));

        // Try multiple image selectors
        const img = card.querySelector('img') as HTMLImageElement | null;
        const image = pickImg(img);

        addProduct({ title, price: price || undefined, image, link });
      }

      // Heuristic B: listing grids using productpage.* links (fallback)
      if (productData.length === 0) {
        const listingLinks = Array.from(document.querySelectorAll('a[href]'))
          .map((a) => a as HTMLAnchorElement)
          .filter((a) => {
            const href = a.getAttribute('href') || '';
            return href.includes('productpage.') || href.includes('/productpage.');
          });

        for (const a of listingLinks) {
          const link = a.href;
          if (!link) continue;

          // Find a reasonable card/container
          const card =
            a.closest('[data-product], article, li, .product-item, .product-card, [class*="product"]') ||
            a.parentElement;

          const title =
            clean(a.getAttribute('aria-label')) ||
            clean(card?.querySelector('[data-testid*="product-name"], .item-heading, .product-item-heading, .product-item-name, [class*="title"], h2, h3')?.textContent || '') ||
            clean(a.textContent);

          const price =
            clean(card?.querySelector('[data-testid*="price"], .price, [class*="price"], .money')?.textContent || '');

          const img = card ? (card.querySelector('img') as HTMLImageElement | null) : null;
          const image = pickImg(img);

          addProduct({ title, price: price || undefined, image, link });
        }
      }

      // Heuristic C: Generic cards with anchors (Shopify/Woo/etc.)
      if (productData.length === 0) {
        const cards = document.querySelectorAll('.product-item, .product-card, [data-product], [class*="product"], article, [role="article"]');
        cards.forEach((product) => {
          const a = product.querySelector('a[href]') as HTMLAnchorElement | null;
          const link = a?.href;
          if (!link) return;

          const title =
            clean(product.querySelector('.product-title, .product-name, [data-testid*="product-name"], [data-testid*="name"], [class*="title"], [class*="name"], h2, h3, h4')?.textContent || '') ||
            clean(a?.getAttribute('aria-label')) ||
            clean(a?.getAttribute('title')) ||
            clean(a?.textContent);

          const price = clean(product.querySelector('.price, [data-testid*="price"], [class*="price"], .money, [data-price]')?.textContent || '');
          const image = pickImg(product.querySelector('img') as HTMLImageElement | null);

          addProduct({ title, price: price || undefined, image, link });
        });
      }

      // Heuristic D: Any link that looks like a product link with nearby title/price
      if (productData.length === 0) {
        const allLinks = Array.from(document.querySelectorAll('a[href]')) as HTMLAnchorElement[];
        for (const a of allLinks) {
          const href = a.href;
          if (!href) continue;

          // Check if link looks like a product link
          const isProductLink =
            href.includes('/product') ||
            href.includes('/p/') ||
            href.includes('/item/') ||
            href.includes('/dp/') ||
            (href.match(/\/[a-z]{2}\/[a-z]{2}\/[^\/]+\/[^\/]+/) && !href.includes('/category') && !href.includes('/collection'));

          if (isProductLink) {
            // Find container
            const container = a.closest('article, li, div[class*="item"], div[class*="card"], div[class*="product"]') || a.parentElement?.parentElement;

            if (container) {
              const title =
                clean(container.querySelector('h1, h2, h3, h4, [class*="title"], [class*="name"]')?.textContent || '') ||
                clean(a.textContent) ||
                clean(a.getAttribute('aria-label'));

              const price = clean(container.querySelector('[class*="price"], .money')?.textContent || '');
              const img = container.querySelector('img') as HTMLImageElement | null;
              const image = pickImg(img);

              addProduct({ title, price: price || undefined, image, link: href });
            }
          }
        }
      }
    }

    return productData;
  });

  return products.slice(0, 50); // Limit to 50 products
}
