import { Page } from 'playwright';

export interface TextData {
  title: string;
  meta: string;
  headings: string[];
  paragraphs: string[];
}

export async function extractText(page: Page): Promise<TextData> {
  const content = await page.evaluate(() => {
    // Remove non-content elements
    const elementsToRemove = [
      'nav', 'header', 'footer', 'script', 'style', 
      'noscript', 'aside', 'form', 'iframe'
    ];
    
    // Clone the document to avoid modifying the original
    const docClone = document.cloneNode(true) as Document;
    
    elementsToRemove.forEach(tag => {
      docClone.querySelectorAll(tag).forEach(el => el.remove());
    });

    // Extract title
    const title = document.title || '';

    // Extract meta description
    const metaEl = document.querySelector('meta[name="description"]') || 
                   document.querySelector('meta[property="og:description"]');
    const meta = metaEl?.getAttribute('content') || '';

    // Extract headings (h1, h2, h3)
    const headings = Array.from(docClone.querySelectorAll('h1, h2, h3'))
      .map(h => h.textContent?.trim() || '')
      .filter(Boolean);

    // Extract paragraphs (longer than 30 chars)
    const paragraphs = Array.from(docClone.querySelectorAll('p'))
      .map(p => p.textContent?.trim() || '')
      .filter(p => p.length > 30);

    return { title, meta, headings, paragraphs };
  });

  // Clean whitespace
  function clean(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }

  return {
    title: clean(content.title),
    meta: clean(content.meta),
    headings: content.headings.map(clean).slice(0, 50), // Limit to 50 headings
    paragraphs: content.paragraphs.map(clean).slice(0, 100), // Limit to 100 paragraphs
  };
}

