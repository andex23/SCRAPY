# Testing the Scraper

## Quick Test Scripts

### Node.js Test Script
```bash
npm run test-scrape "https://www2.hm.com/en_us/men/sale/view-all.html" products images
# Video scraping example:
npm run test-scrape "https://example.com" videos
```

Or directly:
```bash
node scripts/test-scrape.mjs "https://example.com" products images
```

### Python Test Script
```bash
python3 scripts/test-scrape.py "https://www2.hm.com/en_us/men/sale/view-all.html" products images
```

## Geo-Block & Proxy Configuration

### Environment Variables
Set these in your `.env.local` file or export them:

```bash
# Proxy configuration (optional)
PROXY_SERVER=http://proxy.example.com:8080
PROXY_USERNAME=your_username
PROXY_PASSWORD=your_password

# Or via authConfig in the API request
```

### Using Proxy in API Request
```json
{
  "url": "https://example.com",
  "modules": ["products"],
  "authConfig": {
    "proxy": {
      "server": "http://proxy.example.com:8080",
      "username": "user",
      "password": "pass"
    },
    "locale": "en-US",
    "timezone": "America/New_York"
  }
}
```

## Features Added for Geo-Block Avoidance

1. **Realistic Browser Headers**
   - Proper Accept-Language, Accept-Encoding
   - Security headers (Sec-Fetch-*, DNT)
   - Realistic viewport and screen dimensions

2. **Auto-Consent Banner Handling**
   - Automatically dismisses common cookie/consent banners
   - Supports OneTrust, common cookie consent patterns

3. **Better Page Loading**
   - Extended wait times for lazy-loaded content
   - Auto-scrolling for product listing pages
   - Multiple fallback strategies

4. **Proxy Support**
   - Environment variable or API-based proxy configuration
   - Supports authenticated proxies

5. **Locale/Timezone Configuration**
   - Set browser locale and timezone
   - Helps with region-specific content

## Testing H&M Product Page

The scraper now includes:
- Auto-scrolling for product grids
- Better product detection (H&M-specific patterns)
- Extended wait times for lazy-loaded content

Try it:
```bash
npm run test-scrape "https://www2.hm.com/en_us/men/sale/view-all.html" products
```
