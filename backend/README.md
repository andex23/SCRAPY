# Scraper Backend

Industry-grade Python backend for web scraping with FastAPI, Playwright, and Pydantic validation.

## Features

- **Async Playwright-based fetching** with retry logic and exponential backoff
- **Modular extractors** for products, images, contacts, text, and assets
- **Data normalization** (prices, phones, text cleaning)
- **Rate limiting** per domain
- **Schema validation** with Pydantic
- **Deduplication** and change tracking
- **CSV/JSON export** with Shopify-ready formats
- **Compliance checking** (robots.txt, public-only)
- **Structured logging** (JSON format)
- **CLI runner** for scheduled/automated jobs
- **YAML job configurations**

## Installation

1. Install Python 3.10+

2. Install dependencies:

```bash
cd backend
pip install -r requirements.txt
playwright install chromium
```

3. Set up environment variables (optional):

```bash
cp .env.example .env
# Edit .env with your settings
```

## Usage

### FastAPI Server

Start the API server:

```bash
cd backend
python -m scraper_api.main
# Or with uvicorn:
uvicorn scraper_api.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`

### CLI Runner

Run a scraping job:

```bash
cd backend
python -m backend.cli run shopify_product
```

List available jobs:

```bash
python -m backend.cli list
```

Validate a job configuration:

```bash
python -m backend.cli validate shopify_product
```

### API Endpoints

#### POST `/api/scrape`

Scrape a website with specified modules.

**Request:**
```json
{
  "url": "https://example.com",
  "modules": ["products", "images"],
  "authConfig": {
    "apiKey": "key",
    "apiKeyHeader": "X-API-Key",
    "cookies": "session=abc123",
    "headers": {"User-Agent": "Custom"}
  },
  "crawlDepth": 1,
  "customSelectors": {
    "title": [".product-title"],
    "price": [".price"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "products": [...],
    "images": [...]
  }
}
```

#### GET `/health`

Health check endpoint.

## Project Structure

```
backend/
├── scraper_core/          # Core scraping functionality
│   ├── fetcher.py         # Playwright page fetcher
│   ├── extractor.py       # Data extractors
│   ├── normalizer.py      # Data normalization
│   ├── rate_limiter.py    # Rate limiting
│   ├── validator.py       # Schema validation
│   ├── schemas.py         # Pydantic schemas
│   ├── deduplicator.py    # Deduplication
│   ├── changes.py         # Change tracking
│   ├── output.py          # CSV/JSON writers
│   ├── logger.py          # Structured logging
│   └── compliance.py      # Compliance checking
├── scraper_api/           # FastAPI application
│   └── main.py            # API server
├── config/                # Configuration
│   └── loader.py          # YAML config loader
├── cli.py                 # CLI runner
├── requirements.txt       # Python dependencies
└── pyproject.toml         # Project metadata

scraper_jobs/              # Job configurations
├── shopify_product/
│   └── config.yaml
├── restaurant_menu/
│   └── config.yaml
└── real_estate/
    └── config.yaml
```

## Job Configuration

Create a job configuration in `scraper_jobs/{job_name}/config.yaml`:

```yaml
name: my_job
description: Scrape products
url: https://example.com

modules:
  - products
  - images

extractors:
  products:
    type: product
    selectors:
      title:
        - h1.product-title
        - .product-name
      price:
        - .price

rate_limits:
  requests_per_second: 2
  per_domain: true

compliance:
  robots_txt: true
  public_only: true
  enforce: false

output:
  format: csv
  shopify_format: false
```

## Integration with Next.js

The Next.js frontend automatically routes complex jobs to the Python backend:

- Bulk URLs (multiple URLs)
- Recursive crawl depth > 1
- Multiple modules (3+)
- Custom selectors provided

Set environment variables in Next.js:

```bash
PYTHON_API_URL=http://localhost:8000
ENABLE_PYTHON_BACKEND=true
```

## Development

Run tests (when implemented):

```bash
pytest
```

Format code:

```bash
black .
isort .
```

## License

MIT
