import { NextRequest } from 'next/server';
import archiver from 'archiver';
import { upgradeToHighQuality } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageUrls } = body;

    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      return Response.json(
        { error: 'Image URLs are required' },
        { status: 400 }
      );
    }

    // Create a readable stream for the response
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

        // Fetch and add images to the archive
        for (let i = 0; i < imageUrls.length; i++) {
          const originalUrl = imageUrls[i];
          // Upgrade URL to highest quality version before downloading
          const imageUrl = upgradeToHighQuality(originalUrl);

          try {
            const response = await fetch(imageUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'image/avif,image/webp,image/png,image/jpeg,*/*',
                'Referer': new URL(imageUrl).origin,
              },
            });

            if (response.ok) {
              const buffer = Buffer.from(await response.arrayBuffer());
              const url = new URL(imageUrl);
              let filename = url.pathname.split('/').pop() || `image-${i + 1}.jpg`;

              // Ensure unique filenames
              const ext = filename.includes('.') ? '' : '.jpg';
              filename = `${String(i + 1).padStart(3, '0')}_${filename}${ext}`;

              archive.append(buffer, { name: filename });
            } else {
              // Try original URL if upgraded one fails
              if (imageUrl !== originalUrl) {
                const fallbackResponse = await fetch(originalUrl);
                if (fallbackResponse.ok) {
                  const buffer = Buffer.from(await fallbackResponse.arrayBuffer());
                  const url = new URL(originalUrl);
                  let filename = url.pathname.split('/').pop() || `image-${i + 1}.jpg`;
                  filename = `${String(i + 1).padStart(3, '0')}_${filename}`;
                  archive.append(buffer, { name: filename });
                }
              }
            }
          } catch (error) {
            console.error(`Error fetching image ${imageUrl}:`, error);
            // Continue with other images even if one fails
          }
        }

        // Finalize the archive
        await archive.finalize();
      },
    });

    // Return the zip file as a stream
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
