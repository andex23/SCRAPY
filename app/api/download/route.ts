import { NextRequest } from 'next/server';
import archiver from 'archiver';
import { upgradeToHighQuality } from '@/lib/utils';

type ImageDownloadFormat = 'original' | 'jpg' | 'jpeg' | 'png' | 'webp' | 'gif' | 'svg' | 'avif';

function normalizeImageFormat(value: unknown): ImageDownloadFormat {
  const format = String(value || 'original').toLowerCase();
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'avif'].includes(format)) {
    return format as ImageDownloadFormat;
  }
  return 'original';
}

function inferImageExtension(url: URL, contentType?: string): string {
  const type = (contentType || '').toLowerCase();
  if (type.includes('image/png')) return '.png';
  if (type.includes('image/webp')) return '.webp';
  if (type.includes('image/gif')) return '.gif';
  if (type.includes('image/svg+xml')) return '.svg';
  if (type.includes('image/avif')) return '.avif';
  if (type.includes('image/jpeg') || type.includes('image/jpg')) return '.jpg';

  const pathname = url.pathname.toLowerCase();
  if (pathname.endsWith('.png')) return '.png';
  if (pathname.endsWith('.webp')) return '.webp';
  if (pathname.endsWith('.gif')) return '.gif';
  if (pathname.endsWith('.svg')) return '.svg';
  if (pathname.endsWith('.avif')) return '.avif';
  if (pathname.endsWith('.jpeg')) return '.jpeg';
  if (pathname.endsWith('.jpg')) return '.jpg';
  return '.jpg';
}

function matchesImageFormat(ext: string, requested: ImageDownloadFormat): boolean {
  if (requested === 'original') return true;

  const normalized = ext.replace(/^\./, '').toLowerCase();
  if (requested === 'jpg' || requested === 'jpeg') {
    return normalized === 'jpg' || normalized === 'jpeg';
  }
  return normalized === requested;
}

function getFetchStatusFromError(error: unknown): number | undefined {
  const message = error instanceof Error ? error.message : String(error);
  const match = message.match(/IMAGE_FETCH_STATUS_(\d{3})/);
  return match ? Number(match[1]) : undefined;
}

async function fetchImageFile(
  imageUrl: string,
  index: number,
  requestedFormat: ImageDownloadFormat
): Promise<{ name: string; buffer: Buffer } | null> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(imageUrl);
  } catch {
    return null;
  }

  const response = await fetch(imageUrl, {
    redirect: 'follow',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'image/avif,image/webp,image/png,image/jpeg,image/svg+xml,*/*',
      Referer: parsedUrl.origin,
    },
  });

  if (!response.ok) {
    throw new Error(`IMAGE_FETCH_STATUS_${response.status}`);
  }

  const finalUrl = new URL(response.url || imageUrl);
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/html') || contentType.includes('application/xhtml+xml')) {
    return null;
  }

  const ext = inferImageExtension(finalUrl, contentType);
  if (!matchesImageFormat(ext, requestedFormat)) {
    return null;
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const rawFilename = finalUrl.pathname.split('/').pop() || `image-${index + 1}${ext}`;
  const hasExtension = /\.[a-z0-9]{2,5}$/i.test(rawFilename);
  const filename = `${String(index + 1).padStart(3, '0')}_${rawFilename}${hasExtension ? '' : ext}`;

  return { name: filename, buffer };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageUrls, downloadFormat } = body;

    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      return Response.json(
        { error: 'Image URLs are required' },
        { status: 400 }
      );
    }

    const requestedFormat = normalizeImageFormat(downloadFormat);
    const files: Array<{ name: string; buffer: Buffer }> = [];
    const fetchStatusCounts = new Map<number, number>();
    let hadFormatFilteredMatch = false;

    const recordFetchFailure = (error: unknown) => {
      const status = getFetchStatusFromError(error);
      if (!status) return;
      fetchStatusCounts.set(status, (fetchStatusCounts.get(status) || 0) + 1);
    };

    for (let i = 0; i < imageUrls.length; i++) {
      const originalUrl = imageUrls[i];
      if (typeof originalUrl !== 'string') continue;

      try {
        const upgradedUrl = upgradeToHighQuality(originalUrl);
        let upgraded: { name: string; buffer: Buffer } | null = null;
        try {
          upgraded = await fetchImageFile(upgradedUrl, i, requestedFormat);
        } catch (error) {
          recordFetchFailure(error);
        }

        if (upgraded) {
          files.push(upgraded);
          continue;
        }

        if (upgradedUrl !== originalUrl) {
          let fallback: { name: string; buffer: Buffer } | null = null;
          try {
            fallback = await fetchImageFile(originalUrl, i, requestedFormat);
          } catch (error) {
            recordFetchFailure(error);
          }
          if (fallback) {
            files.push(fallback);
            continue;
          }
        }

        if (requestedFormat !== 'original') {
          try {
            const originalCandidate = await fetchImageFile(originalUrl, i, 'original');
            if (originalCandidate) {
              hadFormatFilteredMatch = true;
            }
          } catch {
            // Ignore; this is only used to improve error messaging.
          }
        }
      } catch (error) {
        console.error(`Error fetching image ${originalUrl}:`, error);
      }
    }

    if (files.length === 0) {
      const blockedCount = (fetchStatusCounts.get(401) || 0) + (fetchStatusCounts.get(403) || 0);
      const rateLimitedCount = fetchStatusCounts.get(429) || 0;
      const notFoundCount = fetchStatusCounts.get(404) || 0;

      let formatHint =
        requestedFormat === 'original'
          ? 'No downloadable image files found for the selected links.'
          : `No downloadable ${requestedFormat.toUpperCase()} image files found for the selected links.`;

      if (blockedCount > 0) {
        formatHint =
          'The target site blocked image downloads (HTTP 401/403). Try downloading from the source page directly or provide auth cookies.';
      } else if (rateLimitedCount > 0) {
        formatHint = 'The target site is rate-limiting image downloads (HTTP 429). Please retry shortly.';
      } else if (notFoundCount > 0) {
        formatHint = 'Some image links are no longer available (HTTP 404). Try scraping again for fresh URLs.';
      } else if (requestedFormat !== 'original' && hadFormatFilteredMatch) {
        formatHint =
          `No ${requestedFormat.toUpperCase()} files were available for the selected items. Try "Original" format.`;
      }

      return Response.json(
        { error: formatHint },
        { status: 400 }
      );
    }

    const stream = new ReadableStream({
      async start(controller) {
        const archive = archiver('zip', {
          zlib: { level: 9 },
        });

        archive.on('data', (chunk) => {
          controller.enqueue(chunk);
        });

        archive.on('end', () => {
          controller.close();
        });

        archive.on('error', (err) => {
          console.error('Archive error:', err);
          controller.error(err);
        });

        for (const file of files) {
          archive.append(file.buffer, { name: file.name });
        }

        await archive.finalize();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="scraped-images-${Date.now()}.zip"`,
      },
    });
  } catch (error) {
    console.error('Download error:', error);
    return Response.json(
      {
        error: error instanceof Error ? error.message : 'Failed to download images',
      },
      { status: 500 }
    );
  }
}
