export interface ImageData {
  url: string;
  alt?: string;
  width?: number;
  height?: number;
}

export interface VideoData {
  url: string;
  title?: string;
  poster?: string;
  durationSeconds?: number;
  width?: number;
  height?: number;
  provider?: string;
  mimeType?: string;
  isEmbedded?: boolean;
}

export interface ProductData {
  title: string;
  price?: string;
  image?: string;
  link?: string;
  description?: string;
}

export interface ContactData {
  emails: string[];
  phones: string[];
  socials: string[];
}

export interface AssetData {
  filename: string;
  url: string;
  type: string;
  size?: string;
}

export interface TextData {
  title: string;
  meta: string;
  headings: string[];
  paragraphs: string[];
}

export interface ScreenshotData {
  url: string;
  fullPage?: string; // base64
  viewport?: string; // base64
  timestamp: number;
}

export interface AuthConfig {
  apiKey?: string;
  apiKeyHeader?: string;
  cookies?: string;
  headers?: Record<string, string>;
  proxy?: {
    server: string;
    username?: string;
    password?: string;
  };
  locale?: string;
  timezone?: string;
}

export interface ScrapeResult {
  images?: ImageData[];
  videos?: VideoData[];
  products?: ProductData[];
  contacts?: ContactData;
  assets?: AssetData[];
  crawl?: string[];
  text?: TextData;
  screenshot?: ScreenshotData;
}

export interface ModularScrapeResponse {
  success: boolean;
  data: ScrapeResult;
  error?: string;
}

export interface ScrapeResponse {
  success: boolean;
  images: ImageData[];
  error?: string;
  count?: number;
}
