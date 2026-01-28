export interface SelectorConfig {
  field: string;
  selectors: string[];
  fallback?: string[];
}

export function testSelector(selector: string, html: string): { found: boolean; count: number; sample?: string } {
  // This would ideally use a real DOM parser, but for now we'll do basic regex matching
  // In a real implementation, this would use Playwright to test on the actual page
  
  try {
    // Basic check if selector looks valid
    if (!selector || selector.trim() === '') {
      return { found: false, count: 0 };
    }

    // For class/id selectors, check if they exist in HTML
    if (selector.startsWith('.')) {
      const className = selector.slice(1).split(' ')[0];
      const regex = new RegExp(`class=["'][^"']*${className}[^"']*["']`, 'gi');
      const matches = html.match(regex);
      return {
        found: matches ? matches.length > 0 : false,
        count: matches ? matches.length : 0,
      };
    }

    if (selector.startsWith('#')) {
      const id = selector.slice(1).split(' ')[0];
      const regex = new RegExp(`id=["']${id}["']`, 'gi');
      const matches = html.match(regex);
      return {
        found: matches ? matches.length > 0 : false,
        count: matches ? matches.length : 0,
      };
    }

    // For tag selectors
    if (/^[a-z]+$/i.test(selector.split(' ')[0])) {
      const tag = selector.split(' ')[0];
      const regex = new RegExp(`<${tag}[\\s>]`, 'gi');
      const matches = html.match(regex);
      return {
        found: matches ? matches.length > 0 : false,
        count: matches ? matches.length : 0,
      };
    }

    // For attribute selectors
    if (selector.includes('[')) {
      const attrMatch = selector.match(/\[([^\]]+)\]/);
      if (attrMatch) {
        const attr = attrMatch[1];
        const regex = new RegExp(attr, 'gi');
        const matches = html.match(regex);
        return {
          found: matches ? matches.length > 0 : false,
          count: matches ? matches.length : 0,
        };
      }
    }

    return { found: false, count: 0 };
  } catch {
    return { found: false, count: 0 };
  }
}

export function validateSelector(selector: string): { valid: boolean; error?: string } {
  if (!selector || selector.trim() === '') {
    return { valid: false, error: 'Selector cannot be empty' };
  }

  // Basic CSS selector validation
  const invalidChars = /[<>{}]/;
  if (invalidChars.test(selector)) {
    return { valid: false, error: 'Selector contains invalid characters' };
  }

  return { valid: true };
}

export function suggestSelectors(html: string, field: string): string[] {
  const suggestions: string[] = [];

  // Common patterns for different fields
  const patterns: Record<string, RegExp[]> = {
    title: [
      /<h1[^>]*>([^<]+)<\/h1>/gi,
      /class=["'][^"']*title[^"']*["']/gi,
      /id=["'][^"']*title[^"']*["']/gi,
    ],
    price: [
      /class=["'][^"']*price[^"']*["']/gi,
      /data-price/gi,
      /class=["'][^"']*cost[^"']*["']/gi,
    ],
    image: [
      /<img[^>]*class=["'][^"']*product[^"']*["']/gi,
      /<img[^>]*class=["'][^"']*image[^"']*["']/gi,
    ],
    description: [
      /class=["'][^"']*description[^"']*["']/gi,
      /class=["'][^"']*content[^"']*["']/gi,
    ],
  };

  const fieldPatterns = patterns[field.toLowerCase()] || [];
  
  fieldPatterns.forEach(pattern => {
    const matches = html.match(pattern);
    if (matches && matches.length > 0) {
      // Try to extract selector from match
      const match = matches[0];
      if (match.includes('class=')) {
        const classMatch = match.match(/class=["']([^"']+)["']/);
        if (classMatch) {
          const classes = classMatch[1].split(' ')[0];
          suggestions.push(`.${classes}`);
        }
      }
      if (match.includes('id=')) {
        const idMatch = match.match(/id=["']([^"']+)["']/);
        if (idMatch) {
          suggestions.push(`#${idMatch[1]}`);
        }
      }
    }
  });

  return [...new Set(suggestions)].slice(0, 5);
}
