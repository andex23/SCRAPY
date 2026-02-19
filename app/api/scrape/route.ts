import { NextRequest, NextResponse } from 'next/server';
import { scrapeWithModules } from '@/lib/scraper';
import { AuthConfig, ScrapeResult } from '@/types';
import {
  isLikelyTransientScrapeError,
  scrapeCircuitBreaker,
  scrapeQueue,
  withRetry,
} from '@/lib/reliability';
import { adaptSiteConfig } from '@/lib/site-adapters';
import { discoverSitemapUrls } from '@/lib/sitemap';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Python backend configuration
const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:8000';
const ENABLE_PYTHON_BACKEND = process.env.ENABLE_PYTHON_BACKEND === 'true';

// Determine if request should use Python backend
function shouldUsePythonBackend(body: any): boolean {
  if (!ENABLE_PYTHON_BACKEND) return false;

  // Keep video extraction on TypeScript path until backend parity is added
  if (Array.isArray(body.modules) && body.modules.includes('videos')) {
    return false;
  }
  
  // Use Python for bulk URLs
  if (body.bulkUrls && Array.isArray(body.bulkUrls) && body.bulkUrls.length > 1) {
    return true;
  }
  
  // Use Python for recursive crawl depth > 1
  if (body.crawlDepth && typeof body.crawlDepth === 'number' && body.crawlDepth > 1) {
    return true;
  }
  
  // Use Python for multiple modules (3+)
  if (body.modules && Array.isArray(body.modules) && body.modules.length >= 3) {
    return true;
  }
  
  // Use Python if custom selectors are provided
  if (body.customSelectors && Object.keys(body.customSelectors).length > 0) {
    return true;
  }
  
  return false;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return String(error);
}

function mapScrapeErrorToResponse(error: unknown): {
  status: number;
  message: string;
  retryAfterSeconds?: number;
} {
  const message = toErrorMessage(error);
  const fallbackStatusMatch = message.match(/\((\d{3})\)/);
  const fallbackStatusCode = fallbackStatusMatch ? Number(fallbackStatusMatch[1]) : undefined;

  if (message.startsWith('SCRAPER_QUEUE_TIMEOUT:')) {
    return {
      status: 503,
      message: 'Scraper is currently busy. Please retry in a moment.',
      retryAfterSeconds: 15,
    };
  }

  if (message.startsWith('SCRAPER_CIRCUIT_OPEN:')) {
    const retryMatch = message.match(/retry_after=(\d+)/i);
    const retryAfterSeconds = retryMatch ? Number(retryMatch[1]) : 60;
    return {
      status: 429,
      message: `Temporary pause for this site due to repeated failures. Retry in ${retryAfterSeconds}s.`,
      retryAfterSeconds,
    };
  }

  if (message.startsWith('SCRAPER_BROWSER_MISSING:')) {
    return {
      status: 503,
      message:
        'Scraper runtime is missing the Playwright browser binary. Deploy with a runtime that includes Chromium or install Playwright browsers during build.',
    };
  }

  if (message.startsWith('SCRAPER_BROWSER_LAUNCH_FAILED:')) {
    return {
      status: 503,
      message: 'Scraper browser failed to start in this environment. Please try again later.',
    };
  }

  if (/Navigation timeout|Timeout \d+ms exceeded/i.test(message)) {
    return {
      status: 504,
      message: 'The target page took too long to load. Please retry or use a simpler page URL.',
    };
  }

  if (/ERR_NAME_NOT_RESOLVED|ERR_CONNECTION_REFUSED|ERR_CONNECTION_TIMED_OUT|ERR_INTERNET_DISCONNECTED/i.test(message)) {
    return {
      status: 502,
      message: 'Could not reach the target site from the scraper server. Please verify the URL and try again.',
    };
  }

  if (/Failed to fetch page for fallback scraping|Unable to fetch page for video extraction/i.test(message) && fallbackStatusCode) {
    if (fallbackStatusCode === 401 || fallbackStatusCode === 403) {
      return {
        status: 502,
        message:
          'The target site blocked scraper access (HTTP ' +
          fallbackStatusCode +
          '). Try adding auth cookies/headers or scrape a public page.',
      };
    }

    if (fallbackStatusCode === 404) {
      return {
        status: 404,
        message: 'The target page could not be found (HTTP 404). Please verify the URL.',
      };
    }

    if (fallbackStatusCode === 429) {
      return {
        status: 429,
        message: 'The target site is rate-limiting requests (HTTP 429). Please retry after a short wait.',
      };
    }

    if (fallbackStatusCode >= 500) {
      return {
        status: 502,
        message:
          'The target site returned a server error (HTTP ' +
          fallbackStatusCode +
          '). Please retry in a moment.',
      };
    }
  }

  if (/fetch failed|ECONNRESET|EHOSTUNREACH|ENOTFOUND/i.test(message)) {
    return {
      status: 502,
      message: 'Network connection to the target site failed from the scraper server. Please retry.',
    };
  }

  if (
    /access denied|forbidden|captcha|cloudflare|cf-ray|bot detection|verify you are human|attention required/i.test(
      message
    )
  ) {
    return {
      status: 403,
      message:
        'The target site challenged or blocked automated access. Try authorized cookies/headers for permitted access, or use that site’s official API/feed.',
    };
  }

  return {
    status: 500,
    message: 'Failed to scrape website. Please retry in a moment.',
  };
}

async function applySitemapFallback(
  data: ScrapeResult,
  pageUrl: string,
  modules: string[],
  crawlDepth: number,
  enabled: boolean
): Promise<boolean> {
  if (!enabled) return false;
  if (!modules.includes('crawl')) return false;
  if (data.crawl && data.crawl.length > 0) return false;

  const sitemapUrls = await discoverSitemapUrls(pageUrl, crawlDepth > 1 ? 500 : 300);
  if (sitemapUrls.length === 0) return false;

  data.crawl = sitemapUrls;
  return true;
}

export async function POST(request: NextRequest) {
  let targetHost = '';

  try {
    const body = await request.json() as {
      url?: unknown;
      modules?: unknown;
      authConfig?: AuthConfig;
      crawlDepth?: unknown;
      customSelectors?: Record<string, unknown>;
      bulkUrls?: unknown;
    };
    const { url, modules, authConfig, crawlDepth, customSelectors } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { success: false, error: 'URL is required' },
        { status: 400 }
      );
    }

    if (!modules || !Array.isArray(modules) || modules.length === 0 || modules.some((module) => typeof module !== 'string')) {
      return NextResponse.json(
        { success: false, error: 'At least one module is required' },
        { status: 400 }
      );
    }

    // Validate URL format
    let finalUrl = url.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = 'https://' + finalUrl;
    }

    try {
      new URL(finalUrl);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    const adapted = adaptSiteConfig(finalUrl, modules as string[]);
    finalUrl = adapted.normalizedUrl;
    const adaptedModules = adapted.modules;
    targetHost = new URL(finalUrl).hostname.toLowerCase();

    const gate = scrapeCircuitBreaker.beforeRequest(targetHost);
    if (!gate.allowed) {
      const retryAfterSeconds = Math.max(1, Math.ceil(gate.retryAfterMs / 1000));
      return NextResponse.json(
        {
          success: false,
          error: `Temporary pause for this site due to repeated failures. Retry in ${retryAfterSeconds}s.`,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfterSeconds),
          },
        }
      );
    }

    const depth = crawlDepth && typeof crawlDepth === 'number' && crawlDepth > 0 ? crawlDepth : 1;
    let data: ScrapeResult | null = null;
    let backend: 'python' | 'typescript' = 'typescript';
    let retriesUsed = 1;
    let sitemapFallbackUsed = false;

    // Route to Python backend if needed
    if (shouldUsePythonBackend({ ...body, modules: adaptedModules })) {
      try {
        const pythonResponse = await fetch(`${PYTHON_API_URL}/api/scrape`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: finalUrl,
            modules: adaptedModules,
            authConfig,
            crawlDepth: depth,
            customSelectors,
          }),
        });

        if (pythonResponse.ok) {
          const pythonData = await pythonResponse.json();
          if (pythonData?.success && pythonData?.data) {
            data = pythonData.data as ScrapeResult;
            backend = 'python';
          }
        } else {
          // Fallback to TypeScript if Python fails
          console.warn('Python backend failed, falling back to TypeScript');
        }
      } catch (error) {
        // Fallback to TypeScript if Python unavailable
        console.warn('Python backend unavailable, falling back to TypeScript:', error);
      }
    }

    if (!data) {
      // Use TypeScript scraper with queue and retries
      const auth: AuthConfig | undefined = authConfig
        ? {
            apiKey: authConfig.apiKey,
            apiKeyHeader: authConfig.apiKeyHeader,
            cookies: authConfig.cookies,
            headers: authConfig.headers,
            proxy: authConfig.proxy,
            locale: authConfig.locale,
            timezone: authConfig.timezone,
          }
        : undefined;

      const queued = await scrapeQueue.enqueue(() =>
        withRetry(
          () => scrapeWithModules(finalUrl, adaptedModules, auth, depth),
          {
            maxAttempts: 3,
            baseDelayMs: 900,
            maxDelayMs: 7000,
            shouldRetry: (error) => isLikelyTransientScrapeError(error),
          }
        ),
        60000
      );

      data = queued.value;
      retriesUsed = queued.attempts;
      backend = 'typescript';
    }

    sitemapFallbackUsed = await applySitemapFallback(
      data,
      finalUrl,
      adaptedModules,
      depth,
      adapted.allowSitemapFallback
    );

    scrapeCircuitBreaker.recordSuccess(targetHost);

    return NextResponse.json({
      success: true,
      data,
      meta: {
        adapter: adapted.adapterId,
        backend,
        retriesUsed,
        sitemapFallbackUsed,
        queue: scrapeQueue.getSnapshot(),
      },
    });
  } catch (error) {
    console.error('Scraping error:', error);
    if (targetHost) {
      scrapeCircuitBreaker.recordFailure(targetHost, error);
    }

    const mapped = mapScrapeErrorToResponse(error);
    const headers: Record<string, string> = {};
    if (mapped.retryAfterSeconds) {
      headers['Retry-After'] = String(mapped.retryAfterSeconds);
    }

    return NextResponse.json(
      {
        success: false,
        error: mapped.message,
      },
      {
        status: mapped.status,
        headers,
      }
    );
  }
}
