import { chromium } from 'playwright';
import { ScrapeResult, AuthConfig } from '@/types';
import { resolveUrl, deduplicateImages, filterImages, upgradeToHighQuality } from './utils';
import { extractImages } from './modules/images';
import { extractProducts } from './modules/products';
import { extractContacts } from './modules/contacts';
import { extractAssets } from './modules/assets';
import { extractLinks, extractLinksRecursive } from './modules/crawl';
import { extractText } from './modules/text';
import { extractScreenshot } from './modules/screenshot';

export async function scrapeWithModules(
  url: string,
  modules: string[],
  authConfig?: AuthConfig,
  crawlDepth?: number
): Promise<ScrapeResult> {
  // Launch browser with stealth settings to avoid bot detection
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--window-size=1920,1080',
    ],
  });

  try {
    // Enhanced browser context to avoid geo-blocks and bot detection
    const contextOptions: any = {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      locale: 'en-US',
      timezoneId: 'America/New_York',
      viewport: { width: 1920, height: 1080 },
      // Realistic screen dimensions
      screen: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
      hasTouch: false,
      isMobile: false,
      // Accept language headers
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0',
        'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
      },
    };

    // Add cookies if provided
    if (authConfig?.cookies) {
      try {
        const cookieStrings = authConfig.cookies.split(';').map(c => c.trim());
        const cookies = cookieStrings.map(cookieStr => {
          const [name, ...valueParts] = cookieStr.split('=');
          const value = valueParts.join('=');
          return {
            name: name.trim(),
            value: value.trim(),
            domain: new URL(url).hostname,
            path: '/',
          };
        });
        contextOptions.cookies = cookies;
      } catch (error) {
        console.error('Failed to parse cookies:', error);
      }
    }

    // Proxy support (from authConfig or environment variable)
    const proxyConfig = authConfig?.proxy || (process.env.PROXY_SERVER ? {
      server: process.env.PROXY_SERVER,
      username: process.env.PROXY_USERNAME,
      password: process.env.PROXY_PASSWORD,
    } : undefined);
    
    if (proxyConfig) {
      contextOptions.proxy = {
        server: proxyConfig.server,
        username: proxyConfig.username,
        password: proxyConfig.password,
      };
    }

    // Override locale/timezone if provided
    if (authConfig?.locale) {
      contextOptions.locale = authConfig.locale;
    }
    if (authConfig?.timezone) {
      contextOptions.timezoneId = authConfig.timezone;
    }

    const context = await browser.newContext(contextOptions);

    // Merge custom headers with default headers
    if (authConfig?.headers) {
      const mergedHeaders = {
        ...contextOptions.extraHTTPHeaders,
        ...authConfig.headers,
      };
      await context.setExtraHTTPHeaders(mergedHeaders);
    } else {
      await context.setExtraHTTPHeaders(contextOptions.extraHTTPHeaders);
    }

    // Add API key header if provided
    if (authConfig?.apiKey && authConfig?.apiKeyHeader) {
      await context.setExtraHTTPHeaders({
        ...contextOptions.extraHTTPHeaders,
        [authConfig.apiKeyHeader]: authConfig.apiKey,
      });
    }

    const page = await context.newPage();

    // Set a reasonable timeout
    page.setDefaultTimeout(45000);

    // Inject stealth scripts to avoid bot detection
    await page.addInitScript(() => {
      // Override navigator.webdriver
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });

      // Override navigator.plugins to look like a real browser
      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
          { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
          { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
        ],
      });

      // Override navigator.languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });

      // Override permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters: any) =>
        parameters.name === 'notifications'
          ? Promise.resolve({ state: Notification.permission } as PermissionStatus)
          : originalQuery(parameters);

      // Add chrome object
      (window as any).chrome = {
        runtime: {},
        loadTimes: function() {},
        csi: function() {},
        app: {},
      };
    });

    // Navigate to the URL with fallback strategy
    try {
      // Try networkidle first (best for complete page load)
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: 30000,
      });
    } catch (error) {
      // Fallback: if networkidle times out, try with domcontentloaded
      try {
        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 15000,
        });
        // Give it a bit more time for images and lazy-loaded content
        await page.waitForTimeout(5000);
      } catch (fallbackError) {
        // Last resort: just try to load the page
        await page.goto(url, {
          waitUntil: 'load',
          timeout: 20000,
        });
        await page.waitForTimeout(3000);
      }
    }

    // Handle common consent/cookie banners that might block content
    try {
      // Wait a bit for any modals/banners to appear
      await page.waitForTimeout(2000);
      
      // Try to dismiss common consent buttons
      const consentSelectors = [
        'button[id*="accept"]',
        'button[class*="accept"]',
        'button[id*="consent"]',
        'button[class*="consent"]',
        'button:has-text("Accept")',
        'button:has-text("I Accept")',
        'button:has-text("Agree")',
        '[data-testid*="accept"]',
        '[id*="cookie-accept"]',
        '.cookie-consent button',
        '#onetrust-accept-btn-handler',
      ];
      
      for (const selector of consentSelectors) {
        try {
          const button = await page.$(selector);
          if (button) {
            await button.click();
            await page.waitForTimeout(1000);
            break;
          }
        } catch (e) {
          // Continue to next selector
        }
      }
    } catch (e) {
      // Consent handling failed, continue anyway
      console.log('Note: Could not auto-dismiss consent banner');
    }

    const result: ScrapeResult = {};

    // Helper: scroll to trigger lazy-loading/infinite lists (category pages like H&M)
    const ensureLazyContentLoaded = async () => {
      try {
        // Wait for basic DOM
        await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
      } catch {
        // ignore
      }

      // Wait a bit for initial content
      await page.waitForTimeout(2000);

      // Scroll a few times to trigger lazy-loading (safe on most pages)
      try {
        await page.evaluate(async () => {
          const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
          let lastHeight = 0;
          let stableCount = 0;
          
          // More aggressive scrolling for H&M-style infinite scroll
          for (let i = 0; i < 10; i++) {
            const height = document.body.scrollHeight;
            if (height === lastHeight) {
              stableCount++;
              if (stableCount >= 2) break; // Content stable, stop scrolling
            } else {
              stableCount = 0;
            }
            lastHeight = height;
            
            // Scroll down
            window.scrollTo(0, height);
            await sleep(800);
            
            // Also try scrolling by viewport height
            window.scrollBy(0, window.innerHeight);
            await sleep(500);
          }
          
          // Scroll back to top
          window.scrollTo(0, 0);
          await sleep(1000);
        });
      } catch {
        // ignore
      }
      
      // Final wait for any remaining lazy-loaded content
      await page.waitForTimeout(2000);
    };

    // Extract data based on selected modules
    for (const module of modules) {
      try {
        switch (module) {
          case 'images':
            // Scroll page to trigger lazy loading before extracting images
            await ensureLazyContentLoaded();
            const rawImages = await extractImages(page, url);
            // Process images (resolve URLs, upgrade quality, filter, deduplicate)
            const resolvedImages = rawImages.map((img) => ({
              ...img,
              url: upgradeToHighQuality(resolveUrl(img.url, url)),
            }));
            const filteredImages = filterImages(resolvedImages);
            result.images = deduplicateImages(filteredImages);
            break;

          case 'products':
            // Listing pages often require a bit of scroll to load product cards/images
            await ensureLazyContentLoaded();
            const products = await extractProducts(page);
            result.products = products;
            // Debug logging
            if (products.length === 0) {
              console.log('⚠️ No products found. Page title:', await page.title());
              console.log('Page URL:', page.url());
              // Try to get page structure for debugging
              try {
                const hasProductLinks = await page.evaluate(() => {
                  const links = Array.from(document.querySelectorAll('a[href]'));
                  return links.some(a => {
                    const href = a.getAttribute('href') || '';
                    return href.includes('product') || href.includes('productpage');
                  });
                });
                console.log('Has product links:', hasProductLinks);
              } catch (e) {
                // ignore
              }
            } else {
              console.log(`✅ Found ${products.length} products`);
            }
            break;

          case 'contacts':
            result.contacts = await extractContacts(page);
            break;

          case 'assets':
            const rawAssets = await extractAssets(page);
            // Resolve asset URLs
            result.assets = rawAssets.map(asset => ({
              ...asset,
              url: resolveUrl(asset.url, url),
            }));
            break;

          case 'crawl':
            if (crawlDepth && crawlDepth > 1) {
              result.crawl = await extractLinksRecursive(context, url, crawlDepth - 1);
            } else {
              result.crawl = await extractLinks(page, url);
            }
            break;

          case 'text':
            result.text = await extractText(page);
            break;

          case 'screenshot':
            result.screenshot = await extractScreenshot(page, url);
            break;
        }
      } catch (moduleError) {
        console.error(`Error extracting ${module}:`, moduleError);
        // Continue with other modules even if one fails
      }
    }

    await context.close();
    return result;
  } catch (error) {
    throw error;
  } finally {
    await browser.close();
  }
}

// Legacy function for backwards compatibility (images only)
export async function scrapeImages(url: string) {
  const result = await scrapeWithModules(url, ['images']);
  return result.images || [];
}
