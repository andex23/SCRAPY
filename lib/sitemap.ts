function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function extractLocEntries(xml: string): string[] {
  const results: string[] = [];
  const pattern = /<loc>([\s\S]*?)<\/loc>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(xml)) !== null) {
    const value = decodeXmlEntities(match[1] || '');
    if (value) results.push(value);
  }
  return results;
}

function parseSitemapFromRobots(robotsText: string): string[] {
  const lines = robotsText.split(/\r?\n/);
  const entries: string[] = [];
  for (const line of lines) {
    const match = line.match(/^\s*sitemap:\s*(\S+)\s*$/i);
    if (match?.[1]) {
      entries.push(match[1].trim());
    }
  }
  return entries;
}

async function fetchTextWithTimeout(url: string, timeoutMs: number): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'application/xml,text/xml,text/plain,*/*;q=0.8',
      },
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function isSameHost(url: string, expectedHost: string): boolean {
  try {
    return new URL(url).hostname.toLowerCase() === expectedHost.toLowerCase();
  } catch {
    return false;
  }
}

export async function discoverSitemapUrls(pageUrl: string, maxUrls = 300): Promise<string[]> {
  const base = new URL(pageUrl);
  const origin = base.origin;
  const host = base.hostname.toLowerCase();

  const seeds = new Set<string>([
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
    `${origin}/wp-sitemap.xml`,
  ]);

  const robots = await fetchTextWithTimeout(`${origin}/robots.txt`, 6000);
  if (robots) {
    for (const sitemapUrl of parseSitemapFromRobots(robots)) {
      if (isSameHost(sitemapUrl, host)) {
        seeds.add(sitemapUrl);
      }
    }
  }

  const visitedSitemaps = new Set<string>();
  const pendingSitemaps = Array.from(seeds);
  const discoveredUrls = new Set<string>();
  const maxNestedSitemaps = 8;

  while (pendingSitemaps.length > 0 && visitedSitemaps.size < maxNestedSitemaps) {
    const sitemapUrl = pendingSitemaps.shift() as string;
    if (visitedSitemaps.has(sitemapUrl)) continue;
    visitedSitemaps.add(sitemapUrl);

    const xml = await fetchTextWithTimeout(sitemapUrl, 9000);
    if (!xml) continue;

    const locs = extractLocEntries(xml);
    if (locs.length === 0) continue;

    const isSitemapIndex = /<sitemapindex[\s>]/i.test(xml);

    if (isSitemapIndex) {
      for (const nested of locs) {
        if (pendingSitemaps.length >= maxNestedSitemaps) break;
        if (!isSameHost(nested, host)) continue;
        if (!visitedSitemaps.has(nested)) {
          pendingSitemaps.push(nested);
        }
      }
      continue;
    }

    for (const loc of locs) {
      if (!isSameHost(loc, host)) continue;
      discoveredUrls.add(loc);
      if (discoveredUrls.size >= maxUrls) {
        return Array.from(discoveredUrls);
      }
    }
  }

  return Array.from(discoveredUrls).slice(0, maxUrls);
}
