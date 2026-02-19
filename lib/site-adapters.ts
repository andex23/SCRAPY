const TRACKING_QUERY_KEYS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'gclid',
  'fbclid',
  'msclkid',
  'mc_cid',
  'mc_eid',
  'ref',
  'source',
  'tracking_source',
]);

const MODULE_ORDER = ['images', 'videos', 'products', 'text', 'contacts', 'assets', 'crawl', 'screenshot'];

type SiteAdapter = {
  id: string;
  matches: (hostname: string) => boolean;
  transformModules: (modules: string[]) => string[];
  allowSitemapFallback: boolean;
};

const adapters: SiteAdapter[] = [
  {
    id: 'behance',
    matches: (hostname) => hostname === 'behance.net' || hostname.endsWith('.behance.net'),
    transformModules: (modules) => uniqueOrderedModules(modules),
    allowSitemapFallback: false,
  },
  {
    id: 'woocommerce-like',
    matches: (hostname) =>
      hostname.includes('shop') || hostname.includes('store') || hostname.includes('woocommerce'),
    transformModules: (modules) => uniqueOrderedModules(modules),
    allowSitemapFallback: true,
  },
  {
    id: 'generic',
    matches: () => true,
    transformModules: (modules) => uniqueOrderedModules(modules),
    allowSitemapFallback: true,
  },
];

function uniqueOrderedModules(modules: string[]): string[] {
  const unique = Array.from(new Set(modules));
  return unique.sort((a, b) => {
    const ai = MODULE_ORDER.indexOf(a);
    const bi = MODULE_ORDER.indexOf(b);
    const aRank = ai === -1 ? MODULE_ORDER.length + 1 : ai;
    const bRank = bi === -1 ? MODULE_ORDER.length + 1 : bi;
    return aRank - bRank;
  });
}

function removeTrackingParams(url: URL): URL {
  const cleaned = new URL(url.toString());

  for (const key of Array.from(cleaned.searchParams.keys())) {
    const lower = key.toLowerCase();
    if (TRACKING_QUERY_KEYS.has(lower) || lower.startsWith('utm_')) {
      cleaned.searchParams.delete(key);
    }
  }

  return cleaned;
}

export type AdaptedSiteConfig = {
  adapterId: string;
  normalizedUrl: string;
  modules: string[];
  allowSitemapFallback: boolean;
};

export function adaptSiteConfig(rawUrl: string, rawModules: string[]): AdaptedSiteConfig {
  const parsed = new URL(rawUrl);
  const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
  const adapter = adapters.find((entry) => entry.matches(hostname)) || adapters[adapters.length - 1];

  const normalizedUrl = removeTrackingParams(parsed).toString();
  const modules = adapter.transformModules(rawModules);

  return {
    adapterId: adapter.id,
    normalizedUrl,
    modules,
    allowSitemapFallback: adapter.allowSitemapFallback,
  };
}
