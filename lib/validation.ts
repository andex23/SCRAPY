import { ScrapeResult } from '@/types';

export interface ValidationResult {
  isValid: boolean;
  warnings: string[];
  errors: string[];
  stats: {
    images: number;
    products: number;
    contacts: { emails: number; phones: number; socials: number };
    assets: number;
    crawl: number;
    text: { headings: number; paragraphs: number };
  };
}

export function validateScrapeResult(result: ScrapeResult): ValidationResult {
  const validation: ValidationResult = {
    isValid: true,
    warnings: [],
    errors: [],
    stats: {
      images: 0,
      products: 0,
      contacts: { emails: 0, phones: 0, socials: 0 },
      assets: 0,
      crawl: 0,
      text: { headings: 0, paragraphs: 0 },
    },
  };

  // Validate images
  if (result.images) {
    validation.stats.images = result.images.length;
    const invalidImages = result.images.filter(
      (img) => !img.url || !img.url.startsWith('http')
    );
    if (invalidImages.length > 0) {
      validation.warnings.push(`${invalidImages.length} images have invalid URLs`);
    }
  }

  // Validate products
  if (result.products) {
    validation.stats.products = result.products.length;
    const incompleteProducts = result.products.filter((p) => !p.title);
    if (incompleteProducts.length > 0) {
      validation.warnings.push(`${incompleteProducts.length} products missing titles`);
    }
  }

  // Validate contacts
  if (result.contacts) {
    validation.stats.contacts.emails = result.contacts.emails.length;
    validation.stats.contacts.phones = result.contacts.phones.length;
    validation.stats.contacts.socials = result.contacts.socials.length;

    const invalidEmails = result.contacts.emails.filter(
      (email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    );
    if (invalidEmails.length > 0) {
      validation.warnings.push(`${invalidEmails.length} invalid email addresses`);
    }
  }

  // Validate assets
  if (result.assets) {
    validation.stats.assets = result.assets.length;
    const invalidAssets = result.assets.filter(
      (asset) => !asset.url || !asset.filename
    );
    if (invalidAssets.length > 0) {
      validation.warnings.push(`${invalidAssets.length} assets missing URLs or filenames`);
    }
  }

  // Validate crawl
  if (result.crawl) {
    validation.stats.crawl = result.crawl.length;
    const invalidUrls = result.crawl.filter((url) => {
      try {
        new URL(url);
        return false;
      } catch {
        return true;
      }
    });
    if (invalidUrls.length > 0) {
      validation.warnings.push(`${invalidUrls.length} invalid crawl URLs`);
    }
  }

  // Validate text
  if (result.text) {
    validation.stats.text.headings = result.text.headings.length;
    validation.stats.text.paragraphs = result.text.paragraphs.length;
    if (!result.text.title && result.text.headings.length === 0) {
      validation.warnings.push('No title or headings found');
    }
  }

  // Check if any data exists
  const hasData = Object.keys(result).some((key) => {
    const value = result[key as keyof ScrapeResult];
    return Array.isArray(value) ? value.length > 0 : (value && Object.keys(value).length > 0);
  });

  if (!hasData) {
    validation.errors.push('No data found in scrape result');
    validation.isValid = false;
  }

  return validation;
}
