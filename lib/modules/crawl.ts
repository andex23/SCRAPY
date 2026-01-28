import { Page, BrowserContext } from 'playwright';

export async function extractLinks(page: Page, baseUrl: string): Promise<string[]> {
  const links = await page.evaluate((base) => {
    const foundLinks: string[] = [];
    const baseDomain = new URL(base).hostname;

    document.querySelectorAll('a[href]').forEach((link) => {
      const href = link.getAttribute('href');
      if (!href) return;

      try {
        // Resolve relative URLs
        const absolute = new URL(href, base).href;
        const linkDomain = new URL(absolute).hostname;

        // Only include internal links (same domain)
        if (linkDomain === baseDomain && !foundLinks.includes(absolute)) {
          foundLinks.push(absolute);
        }
      } catch (e) {
        // Invalid URL, skip
      }
    });

    return foundLinks;
  }, baseUrl);

  return links.slice(0, 50); // Limit to 50 URLs per page
}

export async function extractLinksRecursive(
  context: BrowserContext,
  startUrl: string,
  depth: number,
  maxUrls: number = 200
): Promise<string[]> {
  const visited = new Set<string>();
  const toVisit: Array<{ url: string; currentDepth: number }> = [{ url: startUrl, currentDepth: 0 }];
  const allLinks: string[] = [];
  const baseDomain = new URL(startUrl).hostname;

  while (toVisit.length > 0 && allLinks.length < maxUrls) {
    const { url, currentDepth } = toVisit.shift()!;

    if (visited.has(url) || currentDepth > depth) continue;
    visited.add(url);

    try {
      const page = await context.newPage();
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      
      const links = await extractLinks(page, url);
      
      for (const link of links) {
        if (!visited.has(link) && allLinks.length < maxUrls) {
          allLinks.push(link);
          if (currentDepth < depth) {
            toVisit.push({ url: link, currentDepth: currentDepth + 1 });
          }
        }
      }

      await page.close();
    } catch (error) {
      console.error(`Error crawling ${url}:`, error);
      // Continue with other URLs
    }
  }

  return allLinks.slice(0, maxUrls);
}

