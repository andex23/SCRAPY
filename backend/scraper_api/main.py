"""FastAPI application for scraper API"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import asyncio
import logging

from scraper_core.fetcher import Fetcher, FetchConfig
from scraper_core.extractor import (
    ProductExtractor, ContactExtractor, ImageExtractor, TextExtractor, AssetExtractor
)
from scraper_core.normalizer import Normalizer
from scraper_core.validator import Validator
from scraper_core.rate_limiter import RateLimiter

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Scraper API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ScrapeRequest(BaseModel):
    """Scrape request model"""
    url: str
    modules: List[str]
    authConfig: Optional[Dict[str, Any]] = None
    crawlDepth: Optional[int] = 1
    customSelectors: Optional[Dict[str, List[str]]] = None


class ScrapeResponse(BaseModel):
    """Scrape response model"""
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


@app.post("/api/scrape", response_model=ScrapeResponse)
async def scrape(request: ScrapeRequest):
    """
    Scrape a website with specified modules
    
    Args:
        request: Scrape request with URL, modules, and optional config
    
    Returns:
        ScrapeResponse with extracted data or error
    """
    try:
        # Validate URL
        from urllib.parse import urlparse
        parsed = urlparse(request.url)
        if not parsed.scheme:
            request.url = f"https://{request.url}"
        
        # Extract domain for rate limiting
        domain = urlparse(request.url).netloc
        
        # Rate limiting
        rate_limiter = RateLimiter(requests_per_second=2.0)
        await rate_limiter.acquire(domain)
        
        # Prepare auth config
        headers = None
        cookies = None
        if request.authConfig:
            headers = request.authConfig.get('headers')
            if request.authConfig.get('apiKey') and request.authConfig.get('apiKeyHeader'):
                if not headers:
                    headers = {}
                headers[request.authConfig['apiKeyHeader']] = request.authConfig['apiKey']
            if request.authConfig.get('cookies'):
                cookies = request.authConfig['cookies'].split(';')
        
        # Fetch page
        fetch_config = FetchConfig(
            url=request.url,
            headers=headers,
            cookies=cookies,
        )
        
        result = {}
        
        async with Fetcher(headless=True) as fetcher:
            page = await fetcher.fetch(fetch_config)
            
            # Extract based on modules
            for module in request.modules:
                try:
                    if module == 'products':
                        extractor = ProductExtractor(
                            custom_selectors=request.customSelectors
                        )
                        products = await extractor.extract(page, request.url)
                        # Normalize products
                        normalizer = Normalizer()
                        normalized = [normalizer.normalize_product(p) for p in products]
                        result['products'] = normalized
                    
                    elif module == 'images':
                        extractor = ImageExtractor()
                        images = await extractor.extract(page, request.url)
                        result['images'] = images
                    
                    elif module == 'contacts':
                        extractor = ContactExtractor()
                        contacts_list = await extractor.extract(page, request.url)
                        if contacts_list:
                            result['contacts'] = contacts_list[0]
                    
                    elif module == 'text':
                        extractor = TextExtractor()
                        text_list = await extractor.extract(page, request.url)
                        if text_list:
                            result['text'] = text_list[0]
                    
                    elif module == 'assets':
                        extractor = AssetExtractor()
                        assets = await extractor.extract(page, request.url)
                        result['assets'] = assets
                
                except Exception as e:
                    logger.error(f"Error extracting {module}: {e}")
                    # Continue with other modules
            
            await page.close()
        
        # Validate results
        validator = Validator(error_threshold=0.5)
        try:
            validated_result = validator.validate_result(result)
            return ScrapeResponse(success=True, data=validated_result)
        except ValueError as e:
            logger.warning(f"Validation warnings: {e}")
            # Return data anyway but log warnings
            return ScrapeResponse(success=True, data=result)
    
    except Exception as e:
        logger.error(f"Scraping error: {e}", exc_info=True)
        return ScrapeResponse(
            success=False,
            error=str(e)
        )


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
