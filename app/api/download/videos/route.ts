import { NextRequest } from 'next/server';
import archiver from 'archiver';

function inferVideoExtension(url: URL, contentType?: string): string {
  const type = (contentType || '').toLowerCase();
  if (type.includes('application/vnd.apple.mpegurl') || type.includes('application/x-mpegurl')) return '.m3u8';
  if (type.includes('application/dash+xml')) return '.mpd';
  if (type.includes('video/webm')) return '.webm';
  if (type.includes('video/quicktime')) return '.mov';
  if (type.includes('video/mp2t')) return '.ts';
  if (type.includes('video/mp4')) return '.mp4';

  const pathname = url.pathname.toLowerCase();
  if (pathname.endsWith('.webm')) return '.webm';
  if (pathname.endsWith('.mov')) return '.mov';
  if (pathname.endsWith('.m4v')) return '.m4v';
  if (pathname.endsWith('.m3u8')) return '.m3u8';
  if (pathname.endsWith('.mpd')) return '.mpd';
  if (pathname.endsWith('.ogv')) return '.ogv';
  if (pathname.endsWith('.mkv')) return '.mkv';
  return '.mp4';
}

function isDownloadableVideoContent(contentType: string, finalUrl: URL): boolean {
  const type = (contentType || '').toLowerCase();
  if (!type) {
    return /\.(mp4|webm|mov|m4v|m3u8|mpd|ogv|mkv)(\?|#|$)/i.test(finalUrl.href);
  }

  if (type.includes('text/html') || type.includes('application/xhtml+xml')) return false;
  if (type.startsWith('video/')) return true;
  if (type.includes('application/vnd.apple.mpegurl')) return true;
  if (type.includes('application/x-mpegurl')) return true;
  if (type.includes('application/dash+xml')) return true;
  if (type.includes('application/octet-stream')) return true;
  if (type.includes('audio/')) return true;

  // Some CDNs return text/plain for playlist files.
  if (type.includes('text/plain') && /\.(m3u8|mpd)(\?|#|$)/i.test(finalUrl.href)) return true;

  return /\.(mp4|webm|mov|m4v|m3u8|mpd|ogv|mkv)(\?|#|$)/i.test(finalUrl.href);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { videoUrls } = body;

    if (!videoUrls || !Array.isArray(videoUrls) || videoUrls.length === 0) {
      return Response.json(
        { error: 'Video URLs are required' },
        { status: 400 }
      );
    }

    const files: Array<{ name: string; buffer: Buffer }> = [];

    for (let i = 0; i < videoUrls.length; i++) {
      const videoUrl = videoUrls[i];
      if (typeof videoUrl !== 'string') continue;

      try {
        const parsed = new URL(videoUrl);
        const response = await fetch(videoUrl, {
          redirect: 'follow',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'video/*,application/vnd.apple.mpegurl,application/x-mpegurl,application/dash+xml,application/octet-stream,*/*',
            'Referer': parsed.origin,
          },
        });

        if (!response.ok) continue;

        const finalUrl = new URL(response.url || videoUrl);
        const contentType = response.headers.get('content-type') || '';
        if (!isDownloadableVideoContent(contentType, finalUrl)) {
          continue;
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        const inferredExt = inferVideoExtension(finalUrl, contentType);
        const rawFilename = finalUrl.pathname.split('/').pop() || `video-${i + 1}${inferredExt}`;
        const hasExtension = /\.[a-z0-9]{2,5}$/i.test(rawFilename);
        const filename = `${String(i + 1).padStart(3, '0')}_${rawFilename}${hasExtension ? '' : inferredExt}`;

        files.push({ name: filename, buffer });
      } catch (error) {
        console.error(`Error fetching video ${videoUrl}:`, error);
      }
    }

    if (files.length === 0) {
      return Response.json(
        { error: 'No downloadable video files found for the selected links.' },
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
        'Content-Disposition': `attachment; filename="scraped-videos-${Date.now()}.zip"`,
      },
    });
  } catch (error) {
    console.error('Video download error:', error);
    return Response.json(
      {
        error: error instanceof Error ? error.message : 'Failed to download videos',
      },
      { status: 500 }
    );
  }
}
