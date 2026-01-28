# Scrape Anything

A modular web scraping dashboard that extracts images, text, products, contacts, assets, and crawls pages — all with a retro-terminal aesthetic.

## Features

- 🔍 **Modular Extraction**: Choose what to scrape with 6 modules
  - **Images**: High-quality images from `<img>`, CSS backgrounds, srcset
  - **Text**: Clean readable content (title, meta, headings, paragraphs)
  - **Products**: JSON-LD structured data + DOM fallback
  - **Contacts**: Emails, phone numbers, social media links
  - **Assets**: PDFs, ZIPs, videos, documents
  - **Crawl**: Internal links for site mapping

- 🎨 **Retro-Terminal Aesthetic**: Minimal milk-colored design with IBM Plex Mono
- 📦 **Batch Downloads**: ZIP all images or export JSON results
- 🚀 **Deep Scraping**: Playwright handles JavaScript-rendered sites
- 💾 **JSON Export**: Download all scraped data as structured JSON

## Tech Stack

- **Frontend**: Next.js 15 with React 19
- **Styling**: Tailwind CSS 4 with custom retro-terminal theme
- **Scraping**: Playwright (Chromium) with multi-module architecture
- **Downloads**: Archiver for ZIP generation
- **Language**: TypeScript

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Install Playwright browsers:

```bash
npx playwright install chromium
```

### Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
npm run build
npm start
```

## Usage

1. **Enter URL**: Type any website URL in the input field
2. **Select Modules**: Check which data you want to extract
   - ✓ images
   - ☐ text
   - ☐ products
   - ☐ contacts
   - ☐ assets
   - ☐ crawl
3. **Click "scrape"**: Wait for extraction to complete
4. **View Results**: Data displayed in organized sections
5. **Export**: Download all images as ZIP or export JSON

## Module Details

### Images Module
- Extracts from `<img>` tags, srcset, CSS backgrounds
- Selects highest resolution from srcset
- Upgrades CDN URLs to max quality (Squarespace, Shopify, Cloudinary, etc.)
- Filters out tracking pixels (<20x20px)
- Limit: 100 images per scrape

### Text Module
- Removes non-content elements (nav, header, footer, scripts)
- Extracts: page title, meta description, h1-h3 headings, paragraphs
- Cleans whitespace and normalizes text
- Download as formatted .txt file
- Limit: 50 headings, 100 paragraphs

### Products Module
- Parses JSON-LD schema.org/Product structured data
- Fallback: DOM selectors for common eCommerce patterns
- Extracts: title, price, image, product link
- Limit: 50 products per scrape

### Contacts Module
- **Emails**: Regex + mailto: links
- **Phones**: Regex + tel: links  
- **Socials**: LinkedIn, Instagram, Twitter/X, TikTok, Facebook, YouTube, GitHub
- Limit: 20 per category

### Assets Module
- Finds downloadable files: PDF, ZIP, MP4, DOCX, CSV, XLSX, PPT, MP3, etc.
- Extracts filename, URL, and file type
- Limit: 50 assets per scrape

### Crawl Module
- Discovers all internal links (same domain)
- Depth: 1 (no recursive crawling)
- Limit: 50 URLs per scrape

## Design Philosophy

**Aesthetic**: Retro-terminal meets clean minimalism

- **Typography**: Inter Tight (headings) + IBM Plex Mono (UI)
- **Color Palette**: 
  - Background: #f9f8f4 (soft milk)
  - Text: #222 (grounded black)
  - Accent: #444 (minimalist edge)
  - Hover: #e1dfdb (subtle tactile)
  - Error: #d46b6b (muted red)
- **Interactions**: Blinking cursor, smooth hover states, quiet precision

## Project Structure

```
/app
  /page.tsx                    # Main dashboard UI
  /layout.tsx                  # Root layout with fonts
  /globals.css                 # Custom theme + animations
  /api
    /scrape/route.ts           # Modular scraping endpoint
    /download/route.ts         # ZIP download endpoint
/components
  /ModuleSelector.tsx          # Checkbox module picker
  /ResultsSection.tsx          # Dynamic results renderer
  /ImageGrid.tsx               # Image grid display
  /ImageCard.tsx               # Individual image card
  /ImageModal.tsx              # Full-size preview modal
/lib
  /scraper.ts                  # Module orchestration
  /modules
    /images.ts                 # Image extraction
    /text.ts                   # Text content extraction
    /products.ts               # Product extraction
    /contacts.ts               # Contact extraction
    /assets.ts                 # Asset extraction
    /crawl.ts                  # Link crawling
  /utils.ts                    # URL helpers + CDN upgrades
  /exportJson.ts               # JSON download utility
/types
  /index.ts                    # TypeScript interfaces
```

## Safety & Performance

- 45-second timeout with fallback loading strategies
- Networkidle → domcontentloaded → load
- Graceful degradation if modules fail
- Rate limits: 100 images, 50 headings/products/assets/links, 100 paragraphs, 20 contacts
- No recursive crawling (depth 1 only)

## Testing Suggestions

- **Products**: Shopify/WooCommerce stores
- **Contacts**: Company about pages
- **Assets**: Documentation sites with PDFs
- **Crawl**: Blog or news sites
- **All modules**: eCommerce product pages

## Future Enhancements

(Commented placeholders for future development)

- AI-powered text summarization (GPT/LangChain integration)
- Keyword extraction and auto-tagging
- Screenshot capture module
- CSV/Google Sheets export
- Bulk URL scraping
- Rate limiting system

## Footer

> built with quiet precision — sch1xo tools

## License

MIT
