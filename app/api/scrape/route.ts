import { NextRequest, NextResponse } from 'next/server';
import { scrapeWithModules } from '@/lib/scraper';
import { AuthConfig } from '@/types';

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

function mapScrapeErrorToResponse(error: unknown): { status: number; message: string } {
  const message = toErrorMessage(error);

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

  return {
    status: 500,
    message: 'Failed to scrape website. Please retry in a moment.',
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, modules, authConfig, crawlDepth, customSelectors } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { success: false, error: 'URL is required' },
        { status: 400 }
      );
    }

    if (!modules || !Array.isArray(modules) || modules.length === 0) {
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

    // Route to Python backend if needed
    if (shouldUsePythonBackend(body)) {
      try {
        const pythonResponse = await fetch(`${PYTHON_API_URL}/api/scrape`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: finalUrl,
            modules,
            authConfig,
            crawlDepth,
            customSelectors,
          }),
        });

        if (pythonResponse.ok) {
          const pythonData = await pythonResponse.json();
          return NextResponse.json(pythonData);
        } else {
          // Fallback to TypeScript if Python fails
          console.warn('Python backend failed, falling back to TypeScript');
        }
      } catch (error) {
        // Fallback to TypeScript if Python unavailable
        console.warn('Python backend unavailable, falling back to TypeScript:', error);
      }
    }

    // Use TypeScript scraper (existing implementation)
    const auth: AuthConfig | undefined = authConfig ? {
      apiKey: authConfig.apiKey,
      apiKeyHeader: authConfig.apiKeyHeader,
      cookies: authConfig.cookies,
      headers: authConfig.headers,
    } : undefined;

    const depth = crawlDepth && typeof crawlDepth === 'number' && crawlDepth > 0 ? crawlDepth : 1;
    const data = await scrapeWithModules(finalUrl, modules, auth, depth);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Scraping error:', error);
    const mapped = mapScrapeErrorToResponse(error);
    return NextResponse.json(
      {
        success: false,
        error: mapped.message,
      },
      { status: mapped.status }
    );
  }
}
