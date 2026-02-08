import { Page } from 'playwright';
import { VideoData } from '@/types';

function inferProvider(url: string): string | undefined {
  const value = url.toLowerCase();
  if (value.includes('youtube.com') || value.includes('youtu.be')) return 'youtube';
  if (value.includes('vimeo.com')) return 'vimeo';
  if (value.includes('dailymotion.com')) return 'dailymotion';
  if (value.includes('wistia.')) return 'wistia';
  if (value.includes('loom.com')) return 'loom';
  if (value.includes('brightcove')) return 'brightcove';
  if (value.includes('jwplayer')) return 'jwplayer';
  if (value.includes('twitch.tv')) return 'twitch';
  return undefined;
}

export async function extractVideos(page: Page): Promise<VideoData[]> {
  const videos = await page.evaluate(() => {
    const videoFilePattern = /\.(mp4|webm|mov|m4v|m3u8|mpd|ogv|mkv)(\?|#|$)/i;
    const videoTokens = new Set(['video', 'videos', 'watch', 'embed', 'player', 'stream', 'ccv']);

    const results: Array<{
      url: string;
      title?: string;
      poster?: string;
      durationSeconds?: number;
      width?: number;
      height?: number;
      provider?: string;
      mimeType?: string;
      isEmbedded?: boolean;
    }> = [];
    const seen = new Set<string>();

    const inferProvider = (url: string): string | undefined => {
      const value = url.toLowerCase();
      if (value.includes('youtube.com') || value.includes('youtu.be')) return 'youtube';
      if (value.includes('vimeo.com')) return 'vimeo';
      if (value.includes('dailymotion.com')) return 'dailymotion';
      if (value.includes('wistia.')) return 'wistia';
      if (value.includes('loom.com')) return 'loom';
      if (value.includes('brightcove')) return 'brightcove';
      if (value.includes('jwplayer')) return 'jwplayer';
      if (value.includes('twitch.tv')) return 'twitch';
      return undefined;
    };

    const normalizeUrl = (value: string) => value.trim();
    const hasStrongVideoPathToken = (value: string): boolean => {
      try {
        const parsed = new URL(value, window.location.href);
        const segments = parsed.pathname
          .toLowerCase()
          .split('/')
          .filter(Boolean);
        return segments.some((segment) => videoTokens.has(segment));
      } catch {
        return false;
      }
    };

    const hasVideoQueryToken = (value: string): boolean =>
      /[?&](video|v|embed|player|stream|media)=/i.test(value);

    const isLikelyVideoUrl = (value: string) =>
      videoFilePattern.test(value) ||
      !!inferProvider(value) ||
      hasStrongVideoPathToken(value) ||
      hasVideoQueryToken(value);

    const parseDurationToSeconds = (value: string | undefined): number | undefined => {
      if (!value) return undefined;
      // Supports ISO8601 duration like PT1H2M3S.
      const iso = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
      if (iso) {
        const h = parseInt(iso[1] || '0', 10);
        const m = parseInt(iso[2] || '0', 10);
        const s = parseInt(iso[3] || '0', 10);
        const total = h * 3600 + m * 60 + s;
        return total > 0 ? total : undefined;
      }

      const asNumber = Number(value);
      return Number.isFinite(asNumber) && asNumber > 0 ? asNumber : undefined;
    };

    const addVideo = (data: {
      url?: string | null;
      title?: string;
      poster?: string;
      durationSeconds?: number;
      width?: number;
      height?: number;
      provider?: string;
      mimeType?: string;
      isEmbedded?: boolean;
    }) => {
      const raw = data.url ? normalizeUrl(data.url) : '';
      if (!raw || raw.startsWith('data:') || seen.has(raw)) {
        return;
      }

      if (!isLikelyVideoUrl(raw) && !data.isEmbedded && !data.mimeType?.toLowerCase().includes('video')) {
        return;
      }

      seen.add(raw);
      results.push({
        url: raw,
        title: data.title,
        poster: data.poster,
        durationSeconds: data.durationSeconds,
        width: data.width,
        height: data.height,
        provider: data.provider || inferProvider(raw),
        mimeType: data.mimeType,
        isEmbedded: data.isEmbedded,
      });
    };

    const titleFromElement = (el: Element): string | undefined => {
      const title =
        el.getAttribute('title') ||
        el.getAttribute('aria-label') ||
        (el.closest('figure')?.querySelector('figcaption')?.textContent ?? '');
      const cleaned = title?.trim();
      return cleaned || undefined;
    };

    // Native <video> tags
    document.querySelectorAll('video').forEach((video) => {
      const url =
        video.currentSrc ||
        video.getAttribute('src') ||
        video.getAttribute('data-src') ||
        video.getAttribute('data-video') ||
        video.getAttribute('data-url');
      const poster = video.getAttribute('poster') || undefined;
      const duration = Number.isFinite(video.duration) ? video.duration : undefined;
      addVideo({
        url,
        title: titleFromElement(video),
        poster,
        durationSeconds: duration && duration > 0 ? duration : undefined,
        width: video.videoWidth || video.clientWidth || undefined,
        height: video.videoHeight || video.clientHeight || undefined,
        mimeType: video.getAttribute('type') || undefined,
        isEmbedded: false,
      });

      video.querySelectorAll('source').forEach((source) => {
        addVideo({
          url: source.getAttribute('src') || source.getAttribute('data-src'),
          title: titleFromElement(video),
          poster,
          durationSeconds: duration && duration > 0 ? duration : undefined,
          width: video.videoWidth || video.clientWidth || undefined,
          height: video.videoHeight || video.clientHeight || undefined,
          mimeType: source.getAttribute('type') || undefined,
          isEmbedded: false,
        });
      });
    });

    // Embedded players
    document.querySelectorAll('iframe, embed').forEach((frame) => {
      const src = frame.getAttribute('src') || frame.getAttribute('data-src');
      if (!src) return;
      const provider = inferProvider(src);
      const looksLikeEmbed = !!provider || isLikelyVideoUrl(src);
      if (!looksLikeEmbed) return;
      addVideo({
        url: src,
        title: titleFromElement(frame),
        provider,
        width:
          Number((frame as HTMLElement).getAttribute('width')) ||
          (frame as HTMLElement).clientWidth ||
          undefined,
        height:
          Number((frame as HTMLElement).getAttribute('height')) ||
          (frame as HTMLElement).clientHeight ||
          undefined,
        isEmbedded: true,
      });
    });

    // Meta tags commonly used by media pages
    const metaSelectors = [
      'meta[property="og:video"]',
      'meta[property="og:video:url"]',
      'meta[property="og:video:secure_url"]',
      'meta[name="twitter:player"]',
      'meta[name="twitter:player:stream"]',
    ];
    metaSelectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((meta) => {
        addVideo({
          url: meta.getAttribute('content'),
          isEmbedded: selector.includes('player') || selector.includes('og:video'),
        });
      });
    });

    // Direct video file links and player links
    document.querySelectorAll('a[href]').forEach((link) => {
      const href = link.getAttribute('href');
      if (!href) return;
      const lowered = href.toLowerCase();
      const provider = inferProvider(href);
      const hasVideoPathToken = hasStrongVideoPathToken(href);
      const hasVideoQueryParam = hasVideoQueryToken(lowered);
      const isVideoAnchor =
        videoFilePattern.test(lowered) ||
        !!provider ||
        hasVideoPathToken ||
        hasVideoQueryParam;
      if (!isVideoAnchor) return;

      addVideo({
        url: href,
        title: (link.textContent || '').trim() || titleFromElement(link),
        provider,
        isEmbedded: !!provider || !videoFilePattern.test(lowered),
      });
    });

    // Data attributes used by JS players.
    document
      .querySelectorAll(
        '[data-video], [data-video-url], [data-src], [data-hls], [data-m3u8], [data-mpd], [data-playlist], [data-url]'
      )
      .forEach((el) => {
        const candidates = [
          el.getAttribute('data-video'),
          el.getAttribute('data-video-url'),
          el.getAttribute('data-src'),
          el.getAttribute('data-hls'),
          el.getAttribute('data-m3u8'),
          el.getAttribute('data-mpd'),
          el.getAttribute('data-playlist'),
          el.getAttribute('data-url'),
        ];
        for (const candidate of candidates) {
          addVideo({
            url: candidate,
            title: titleFromElement(el),
            isEmbedded: !videoFilePattern.test((candidate || '').toLowerCase()),
          });
        }
      });

    // Extract media URLs from inline scripts (common in player config objects).
    document.querySelectorAll('script').forEach((script) => {
      const content = script.textContent || '';
      if (!content || content.length < 20) return;

      const regexes = [
        /(https?:\/\/[^"'\\\s<>]+?\.(?:mp4|webm|mov|m4v|m3u8|mpd)(?:\?[^"'\\\s<>]*)?)/gi,
        /["'](\/[^"']+?\.(?:mp4|webm|mov|m4v|m3u8|mpd)(?:\?[^"']*)?)["']/gi,
      ];

      for (const regex of regexes) {
        let match: RegExpExecArray | null;
        while ((match = regex.exec(content)) !== null) {
          addVideo({
            url: match[1],
            isEmbedded: !videoFilePattern.test(match[1].toLowerCase()),
          });
        }
      }
    });

    // Structured data (VideoObject)
    document.querySelectorAll('script[type="application/ld+json"]').forEach((script) => {
      const content = script.textContent?.trim();
      if (!content) return;
      try {
        const parsed = JSON.parse(content);
        const stack: any[] = [parsed];
        while (stack.length > 0) {
          const node = stack.pop();
          if (!node) continue;

          if (Array.isArray(node)) {
            stack.push(...node);
            continue;
          }

          if (typeof node !== 'object') continue;

          if (Array.isArray(node['@graph'])) {
            stack.push(...node['@graph']);
          }

          Object.values(node).forEach((value) => {
            if (value && typeof value === 'object') stack.push(value as any);
          });

          const type = String(node['@type'] || '').toLowerCase();
          if (!type.includes('videoobject')) continue;

          const contentUrl =
            typeof node.contentUrl === 'string'
              ? node.contentUrl
              : typeof node.embedUrl === 'string'
                ? node.embedUrl
                : typeof node.url === 'string'
                  ? node.url
                  : undefined;

          const thumbnail =
            typeof node.thumbnailUrl === 'string'
              ? node.thumbnailUrl
              : Array.isArray(node.thumbnailUrl) && typeof node.thumbnailUrl[0] === 'string'
                ? node.thumbnailUrl[0]
                : undefined;

          addVideo({
            url: contentUrl,
            title: typeof node.name === 'string' ? node.name : undefined,
            poster: thumbnail,
            durationSeconds: parseDurationToSeconds(
              typeof node.duration === 'string' ? node.duration : undefined
            ),
            provider: contentUrl ? inferProvider(contentUrl) : undefined,
            isEmbedded: !!(typeof node.embedUrl === 'string'),
          });
        }
      } catch {
        // Ignore malformed JSON-LD blocks
      }
    });

    return results;
  });

  return videos
    .map((video) => ({
      ...video,
      provider: video.provider || inferProvider(video.url),
    }))
    .slice(0, 100);
}
