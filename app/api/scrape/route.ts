import { NextRequest, NextResponse } from 'next/server';
import { scrapeWithModules } from '@/lib/scraper';
import { AuthConfig } from '@/types';

// Python backend configuration
const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:8000';
const ENABLE_PYTHON_BACKEND = process.env.ENABLE_PYTHON_BACKEND === 'true';

// Determine if request should use Python backend
function shouldUsePythonBackend(body: any): boolean {
  if (!ENABLE_PYTHON_BACKEND) return false;
  
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
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to scrape website',
      },
      { status: 500 }
    );
  }
}
