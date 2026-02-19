import { chromium } from 'playwright';
import { ScrapeResult, AuthConfig, ProductData, VideoData } from '@/types';
import { resolveUrl, deduplicateImages, filterImages, upgradeToHighQuality } from './utils';
import { extractImages } from './modules/images';
import { extractProducts } from './modules/products';
import { extractContacts } from './modules/contacts';
import { extractAssets } from './modules/assets';
import { extractVideos } from './modules/videos';
import { extractLinks, extractLinksRecursive } from './modules/crawl';
import { extractText } from './modules/text';
import { extractScreenshot } from './modules/screenshot';

const DIRECT_VIDEO_PATTERN = /\.(mp4|webm|mov|m4v|m3u8|mpd|ogv|mkv)(\?|#|$)/i;
const DEFAULT_CHROMIUM_ARGS = [
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
];

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return String(error);
}

function normalizeScraperRuntimeError(error: unknown): Error {
  const message = toErrorMessage(error);

  if (
    /Executable doesn't exist at/i.test(message) ||
    /Please run the following command to download new browsers/i.test(message)
  ) {
    return new Error(
      'SCRAPER_BROWSER_MISSING: Playwright browser executable is missing on this server runtime.'
    );
  }

  if (/browserType\.launch/i.test(message)) {
    return new Error(`SCRAPER_BROWSER_LAUNCH_FAILED: ${message}`);
  }

  return error instanceof Error ? error : new Error(message);
}

async function launchScraperBrowser() {
  try {
    return await chromium.launch({
      headless: true,
      args: DEFAULT_CHROMIUM_ARGS,
    });
  } catch (launchError) {
    const launchMessage = toErrorMessage(launchError);
    const looksLikeMissingExecutable =
      /Executable doesn't exist at/i.test(launchMessage) ||
      /Please run the following command to download new browsers/i.test(launchMessage);

    if (!looksLikeMissingExecutable) {
      throw normalizeScraperRuntimeError(launchError);
    }

    try {
      // Fallback for Vercel/serverless runtimes where Playwright browser binaries
      // are not present in the default cache path.
      const chromiumPackage = await import('@sparticuz/chromium');
      const lambdaChromium = chromiumPackage.default;
      const executablePath = await lambdaChromium.executablePath();
      const lambdaArgs = Array.isArray(lambdaChromium.args) ? lambdaChromium.args : [];

      return await chromium.launch({
        headless: true,
        executablePath,
        args: [...new Set([...lambdaArgs, ...DEFAULT_CHROMIUM_ARGS])],
      });
    } catch (fallbackError) {
      throw normalizeScraperRuntimeError(fallbackError);
    }
  }
}

function decodeEmbeddedUrl(value: string): string {
  return value
    .replace(/\\\//g, '/')
    .replace(/\\u0026/g, '&')
    .replace(/&amp;/g, '&');
}

function inferVideoProvider(url: string): string | undefined {
  const value = url.toLowerCase();
  if (value.includes('youtube.com') || value.includes('youtu.be')) return 'youtube';
  if (value.includes('vimeo.com')) return 'vimeo';
  if (value.includes('dailymotion.com')) return 'dailymotion';
  if (value.includes('wistia.')) return 'wistia';
  if (value.includes('loom.com')) return 'loom';
  if (value.includes('brightcove')) return 'brightcove';
  if (value.includes('jwplayer')) return 'jwplayer';
  if (value.includes('twitch.tv')) return 'twitch';
  if (value.includes('adobe.io/v1/player/ccv')) return 'behance';
  return undefined;
}

function isProviderVideoUrl(url: string, provider?: string): boolean {
  if (!provider) return false;

  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.toLowerCase();
    const search = parsed.search.toLowerCase();

    if (provider === 'youtube') {
      if (parsed.hostname.includes('youtu.be')) return pathname.split('/').filter(Boolean).length >= 1;
      return pathname.includes('/watch') && search.includes('v=') || pathname.includes('/embed/') || pathname.includes('/shorts/');
    }

    if (provider === 'vimeo') {
      return /\/\d+/.test(pathname) || pathname.includes('/video/');
    }

    if (provider === 'dailymotion') {
      return pathname.includes('/video/') || pathname.includes('/embed/video/');
    }

    if (provider === 'loom') {
      return pathname.includes('/share/');
    }

    if (provider === 'wistia') {
      return pathname.includes('/medias/') || pathname.includes('/embed/');
    }

    if (provider === 'brightcove' || provider === 'jwplayer') {
      return pathname.includes('/player/') || pathname.includes('/embed/');
    }

    if (provider === 'twitch') {
      return pathname.includes('/videos/') || pathname.includes('/embed');
    }

    if (provider === 'behance') {
      return pathname.includes('/v1/player/ccv');
    }
  } catch {
    return false;
  }

  return false;
}

function looksLikeKnownEmbedUrl(url: string): boolean {
  return /(youtube\.com\/embed\/|player\.vimeo\.com\/video\/|dailymotion\.com\/embed\/video\/|wistia\.com\/embed\/|loom\.com\/embed\/|brightcove|jwplayer|adobe\.io\/v1\/player\/ccv)/i.test(
    url
  );
}

function isValidVideoCandidate(video: Pick<VideoData, 'url' | 'provider' | 'mimeType' | 'isEmbedded'>): boolean {
  if (!video.url) return false;

  const provider = video.provider || inferVideoProvider(video.url);
  const mime = (video.mimeType || '').toLowerCase();
  const hasVideoMime = mime.includes('video') || mime.includes('mpegurl') || mime.includes('dash+xml');
  const isDirectVideoFile = DIRECT_VIDEO_PATTERN.test(video.url);
  const hasProviderVideoUrl = isProviderVideoUrl(video.url, provider);
  const hasKnownEmbed = !!video.isEmbedded && looksLikeKnownEmbedUrl(video.url);

  return isDirectVideoFile || hasVideoMime || hasProviderVideoUrl || hasKnownEmbed;
}

function shouldAttemptBrowserlessFallback(error: unknown): boolean {
  const message = toErrorMessage(error);
  return (
    /Navigation timeout|Timeout \d+ms exceeded/i.test(message) ||
    /ERR_NAME_NOT_RESOLVED|ERR_CONNECTION_REFUSED|ERR_CONNECTION_TIMED_OUT|ERR_INTERNET_DISCONNECTED/i.test(message) ||
    /net::ERR_/i.test(message) ||
    /Target page, context or browser has been closed/i.test(message) ||
    /SCRAPER_BROWSER_MISSING|SCRAPER_BROWSER_LAUNCH_FAILED/i.test(message)
  );
}

function collectMediaUrlsFromHtml(html: string): string[] {
  const matches: string[] = [];
  const patterns = [
    /"mp4URL"\s*:\s*"([^"]+)"/gi,
    /"m3u8URL"\s*:\s*"([^"]+)"/gi,
    /"contentUrl"\s*:\s*"([^"]+\.(?:mp4|webm|mov|m4v|m3u8|mpd|ogv|mkv)[^"]*)"/gi,
    /<source[^>]+src=["']([^"']+)["']/gi,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html)) !== null) {
      const raw = match[1];
      if (!raw) continue;
      const decoded = decodeEmbeddedUrl(raw.trim());
      if (decoded) matches.push(decoded);
    }
  }

  return matches;
}

function collectEmbeddedPlayerUrlsFromHtml(html: string): string[] {
  const matches: string[] = [];
  const patterns = [
    /<iframe[^>]+src=["']([^"']+)["']/gi,
    /<embed[^>]+src=["']([^"']+)["']/gi,
    /"embedUrl"\s*:\s*"([^"]+)"/gi,
    /"player"\s*:\s*"([^"]+)"/gi,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html)) !== null) {
      const raw = match[1];
      if (!raw) continue;
      const decoded = decodeEmbeddedUrl(raw.trim());
      if (decoded) matches.push(decoded);
    }
  }

  return matches;
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function extractAttribute(tag: string, attribute: string): string | undefined {
  const pattern = new RegExp(`${attribute}\\s*=\\s*["']([^"']+)["']`, 'i');
  const match = tag.match(pattern);
  return match?.[1] ? decodeHtmlEntities(match[1]) : undefined;
}

function extractTextContent(html: string, tag: string): string[] {
  const pattern = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  const values: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const cleaned = stripHtml(match[1] || '');
    if (cleaned) values.push(cleaned);
  }
  return values;
}

function extractLinksFromHtml(html: string, baseUrl: string): string[] {
  const links: string[] = [];
  const pattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    const href = decodeHtmlEntities((match[1] || '').trim());
    if (!href || href.startsWith('javascript:') || href.startsWith('#') || href.startsWith('mailto:')) continue;
    links.push(resolveUrl(href, baseUrl));
  }

  return Array.from(new Set(links));
}

function extractContactsFromHtml(html: string): ScrapeResult['contacts'] {
  const emailMatches = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}/g) || [];
  const phoneMatches =
    html.match(/(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}/g) || [];
  const socialMatches =
    html.match(/https?:\/\/(?:www\.)?(?:instagram|facebook|twitter|x|linkedin|tiktok|youtube|pinterest)\.com\/[^\s"'<>]+/gi) || [];

  return {
    emails: Array.from(new Set(emailMatches)).slice(0, 100),
    phones: Array.from(new Set(phoneMatches.map((value) => value.trim()).filter((value) => value.length >= 7))).slice(0, 100),
    socials: Array.from(new Set(socialMatches)).slice(0, 100),
  };
}

function extractAssetsFromHtml(html: string, baseUrl: string): ScrapeResult['assets'] {
  const assetPattern =
    /<a\b[^>]*href=["']([^"']+\.(?:pdf|zip|rar|doc|docx|xls|xlsx|csv|json|xml|mp3|wav|ogg|mp4|webm|mov|m4v))(?:\?[^"']*)?["'][^>]*>/gi;
  const assets: NonNullable<ScrapeResult['assets']> = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = assetPattern.exec(html)) !== null) {
    const rawUrl = decodeHtmlEntities(match[1] || '');
    if (!rawUrl) continue;
    const url = resolveUrl(rawUrl, baseUrl);
    if (seen.has(url)) continue;
    seen.add(url);

    const filename = url.split('/').pop() || 'asset';
    const extension = (filename.split('.').pop() || 'file').toLowerCase();
    assets.push({
      filename,
      url,
      type: extension,
    });
  }

  return assets.slice(0, 200);
}

function extractProductsFromHtml(html: string, baseUrl: string): ScrapeResult['products'] {
  const products: ProductData[] = [];
  const seenLinks = new Set<string>();

  const clean = (value?: string | null): string => decodeHtmlEntities(stripHtml(value || ''));

  const linkPath = (url: string): string => {
    try {
      return new URL(url, baseUrl).pathname.toLowerCase();
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
      /\/p\/[^/]+/.test(path)
    );
  };

  const addProduct = (candidate: Partial<ProductData>) => {
    const rawLink = candidate.link ? resolveUrl(candidate.link, baseUrl) : '';
    if (!rawLink || seenLinks.has(rawLink) || isExcludedProductLink(rawLink)) return;

    const title = clean(candidate.title);
    if (!title || title.length < 2) return;

    const image = candidate.image ? resolveUrl(candidate.image, baseUrl) : undefined;
    const price = clean(candidate.price);
    const description = clean(candidate.description);

    const likelyByPath = hasProductPathHint(rawLink);
    const hasPrice = /\d/.test(price);
    const hasImage = !!image;

    if (!likelyByPath && !(hasPrice && hasImage)) return;

    seenLinks.add(rawLink);
    products.push({
      title,
      price: price || undefined,
      image,
      link: rawLink,
      description: description || undefined,
    });
  };

  // Strategy 1: JSON-LD Product data.
  const jsonLdPattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let scriptMatch: RegExpExecArray | null;
  while ((scriptMatch = jsonLdPattern.exec(html)) !== null) {
    const rawJson = scriptMatch[1]?.trim();
    if (!rawJson) continue;
    try {
      const parsed = JSON.parse(rawJson);
      const stack: any[] = [parsed];

      while (stack.length > 0) {
        const node = stack.pop();
        if (!node) continue;

        if (Array.isArray(node)) {
          stack.push(...node);
          continue;
        }

        if (typeof node !== 'object') continue;

        if (Array.isArray(node['@graph'])) stack.push(...node['@graph']);
        if (Array.isArray(node.itemListElement)) {
          stack.push(...node.itemListElement.map((item: any) => item?.item || item));
        }
        if (node.item && typeof node.item === 'object') stack.push(node.item);

        const type = String(node['@type'] || '').toLowerCase();
        if (!type.includes('product')) continue;

        const image = Array.isArray(node.image) ? node.image[0] : node.image;
        const offers = Array.isArray(node.offers) ? node.offers[0] : node.offers;

        addProduct({
          title: node.name,
          link: node.url,
          image,
          price: offers?.price || offers?.lowPrice,
          description: node.description,
        });
      }
    } catch {
      // Ignore malformed JSON-LD.
    }
  }

  // Strategy 2: WooCommerce-style product list items.
  const itemPattern = /<(?:li|div)[^>]*class=["'][^"']*\bproduct\b[^"']*["'][^>]*>([\s\S]*?)<\/(?:li|div)>/gi;
  let itemMatch: RegExpExecArray | null;
  while ((itemMatch = itemPattern.exec(html)) !== null) {
    const block = itemMatch[1] || '';

    const link =
      block.match(/<a[^>]+href=["']([^"']+)["'][^>]*>/i)?.[1] ||
      block.match(/data-product-url=["']([^"']+)["']/i)?.[1];

    const title =
      block.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1] ||
      block.match(/class=["'][^"']*(?:product-title|woocommerce-loop-product__title)[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i)?.[1] ||
      block.match(/aria-label=["']([^"']+)["']/i)?.[1];

    const image =
      block.match(/<img[^>]+(?:src|data-src)=["']([^"']+)["'][^>]*>/i)?.[1];

    const price = clean(block.match(/<span[^>]*class=["'][^"']*\bprice\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1]);

    addProduct({
      title,
      link,
      image,
      price,
    });
  }

  // Strategy 3: Generic product links with image/title.
  const genericLinkPattern = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]{0,2500}?)<\/a>/gi;
  let genericMatch: RegExpExecArray | null;
  while ((genericMatch = genericLinkPattern.exec(html)) !== null) {
    const link = genericMatch[1] || '';
    if (!link || isExcludedProductLink(link)) continue;
    if (!hasProductPathHint(link)) continue;

    const block = genericMatch[2] || '';
    const title =
      block.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1] ||
      block.match(/<span[^>]*class=["'][^"']*(?:title|name)[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] ||
      block;

    const image = block.match(/<img[^>]+(?:src|data-src)=["']([^"']+)["'][^>]*>/i)?.[1];
    const price = clean(block.match(/<span[^>]*class=["'][^"']*\bprice\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1]);

    addProduct({
      title,
      link,
      image,
      price,
    });
  }

  return products.slice(0, 50);
}

function extractImagesFromHtml(html: string, baseUrl: string): ScrapeResult['images'] {
  const imagePattern = /<img\b[^>]*>/gi;
  const images: NonNullable<ScrapeResult['images']> = [];
  let match: RegExpExecArray | null;

  while ((match = imagePattern.exec(html)) !== null) {
    const tag = match[0];
    const src = extractAttribute(tag, 'src') || extractAttribute(tag, 'data-src');
    if (!src) continue;
    images.push({
      url: upgradeToHighQuality(resolveUrl(src, baseUrl)),
      alt: extractAttribute(tag, 'alt'),
      width: Number(extractAttribute(tag, 'width')) || undefined,
      height: Number(extractAttribute(tag, 'height')) || undefined,
    });
  }

  const filtered = filterImages(images);
  return deduplicateImages(filtered).slice(0, 400);
}

function extractTextFromHtml(html: string): ScrapeResult['text'] {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const metaMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["'][^>]*>/i);

  const headings = [
    ...extractTextContent(html, 'h1'),
    ...extractTextContent(html, 'h2'),
    ...extractTextContent(html, 'h3'),
  ];

  const paragraphs = extractTextContent(html, 'p');

  return {
    title: decodeHtmlEntities(stripHtml(titleMatch?.[1] || '')),
    meta: decodeHtmlEntities(stripHtml(metaMatch?.[1] || '')),
    headings,
    paragraphs,
  };
}

async function scrapeWithoutBrowser(
  url: string,
  modules: string[],
  crawlDepth?: number
): Promise<ScrapeResult> {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch page for fallback scraping (${response.status})`);
  }

  const html = await response.text();
  const result: ScrapeResult = {};

  if (modules.includes('images')) {
    result.images = extractImagesFromHtml(html, url);
  }

  if (modules.includes('videos')) {
    result.videos = await scrapeVideosWithoutBrowser(url);
  }

  if (modules.includes('text')) {
    result.text = extractTextFromHtml(html);
  }

  if (modules.includes('contacts')) {
    result.contacts = extractContactsFromHtml(html);
  }

  if (modules.includes('assets')) {
    result.assets = extractAssetsFromHtml(html, url);
  }

  if (modules.includes('crawl')) {
    const links = extractLinksFromHtml(html, url);
    if (crawlDepth && crawlDepth > 1) {
      result.crawl = links.slice(0, 500);
    } else {
      result.crawl = links.slice(0, 300);
    }
  }

  if (modules.includes('products')) {
    result.products = extractProductsFromHtml(html, url);
  }

  return result;
}

async function scrapeVideosWithoutBrowser(url: string): Promise<VideoData[]> {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });

  if (!response.ok) {
    throw new Error(`Unable to fetch page for video extraction (${response.status})`);
  }

  const html = await response.text();
  const directCandidates = collectMediaUrlsFromHtml(html).map((value) => resolveUrl(value, url));
  const embeddedCandidates = collectEmbeddedPlayerUrlsFromHtml(html).map((value) => resolveUrl(value, url));

  const seen = new Set<string>();
  const videos: VideoData[] = [];

  for (const candidate of directCandidates) {
    if (!DIRECT_VIDEO_PATTERN.test(candidate)) continue;
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    const directVideo: VideoData = {
      url: candidate,
      provider: inferVideoProvider(candidate),
      mimeType: candidate.includes('.m3u8')
        ? 'application/vnd.apple.mpegurl'
        : candidate.includes('.mpd')
          ? 'application/dash+xml'
          : undefined,
      isEmbedded: false,
    };
    if (!isValidVideoCandidate(directVideo)) continue;
    videos.push(directVideo);
  }

  for (const candidate of embeddedCandidates) {
    const provider = inferVideoProvider(candidate);
    if (!isProviderVideoUrl(candidate, provider) && !looksLikeKnownEmbedUrl(candidate)) continue;
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    const embeddedVideo: VideoData = {
      url: candidate,
      provider,
      isEmbedded: true,
    };
    if (!isValidVideoCandidate(embeddedVideo)) continue;
    videos.push(embeddedVideo);
  }

  const enriched = await enrichVideoEntries(videos, url);
  return enriched
    .filter((video) => isValidVideoCandidate(video))
    .sort((a, b) => {
    const aEmbedded = a.isEmbedded ? 1 : 0;
    const bEmbedded = b.isEmbedded ? 1 : 0;
    return aEmbedded - bEmbedded;
  });
}

async function enrichVideoEntries(videos: VideoData[], pageUrl: string): Promise<VideoData[]> {
  if (!videos || videos.length === 0) return videos;

  const enriched: VideoData[] = [...videos];
  const seen = new Set(videos.map((video) => video.url));

  for (const video of videos) {
    // Only expand embedded/player pages; direct media URLs are already usable.
    if (!video.url || DIRECT_VIDEO_PATTERN.test(video.url)) continue;
    if (!video.isEmbedded && !(video.provider === 'youtube' || video.provider === 'vimeo' || video.provider === 'dailymotion')) {
      continue;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(video.url, {
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Referer': pageUrl,
        },
      });
      clearTimeout(timeoutId);
      if (!response.ok) continue;

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html') && !contentType.includes('application/json')) {
        continue;
      }

      const html = await response.text();
      const mediaUrls = collectMediaUrlsFromHtml(html);

      for (const mediaUrl of mediaUrls) {
        const absoluteMediaUrl = resolveUrl(mediaUrl, video.url);
        if (!DIRECT_VIDEO_PATTERN.test(absoluteMediaUrl)) continue;
        if (seen.has(absoluteMediaUrl)) continue;
        seen.add(absoluteMediaUrl);

        enriched.push({
          url: absoluteMediaUrl,
          title: video.title,
          poster: video.poster,
          width: video.width,
          height: video.height,
          provider: video.provider,
          mimeType: absoluteMediaUrl.includes('.m3u8')
            ? 'application/vnd.apple.mpegurl'
            : absoluteMediaUrl.includes('.mpd')
              ? 'application/dash+xml'
              : undefined,
          isEmbedded: false,
        });
      }
    } catch {
      // Ignore failed expansion and keep base extracted URL.
    }
  }

  return enriched;
}

export async function scrapeWithModules(
  url: string,
  modules: string[],
  authConfig?: AuthConfig,
  crawlDepth?: number
): Promise<ScrapeResult> {
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;

  try {
    // Launch browser with Vercel-safe fallback.
    try {
      browser = await launchScraperBrowser();
    } catch (launchError) {
      return await scrapeWithoutBrowser(url, modules, crawlDepth);
    }

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

          case 'videos':
            // Scroll page to trigger lazy loading for dynamic/embedded video blocks
            await ensureLazyContentLoaded();
            const rawVideos = await extractVideos(page);
            const seenVideos = new Set<string>();
            const normalizedVideos = rawVideos
              .map((video) => ({
                ...video,
                url: resolveUrl(video.url, url),
                poster: video.poster ? resolveUrl(video.poster, url) : undefined,
              }))
              .filter((video) => {
                if (!video.url || seenVideos.has(video.url)) return false;
                seenVideos.add(video.url);
                return isValidVideoCandidate(video);
              });
            result.videos = (await enrichVideoEntries(normalizedVideos, url))
              .filter((video) => isValidVideoCandidate(video))
              .sort((a, b) => {
                const aEmbedded = a.isEmbedded ? 1 : 0;
                const bEmbedded = b.isEmbedded ? 1 : 0;
                return aEmbedded - bEmbedded;
              });
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
    if (shouldAttemptBrowserlessFallback(error)) {
      const fallbackModules = modules.filter((module) => module !== 'screenshot');
      if (fallbackModules.length > 0) {
        try {
          return await scrapeWithoutBrowser(url, fallbackModules, crawlDepth);
        } catch (fallbackError) {
          throw normalizeScraperRuntimeError(fallbackError);
        }
      }
    }
    throw normalizeScraperRuntimeError(error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Legacy function for backwards compatibility (images only)
export async function scrapeImages(url: string) {
  const result = await scrapeWithModules(url, ['images']);
  return result.images || [];
}
