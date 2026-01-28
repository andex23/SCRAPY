"""Playwright-based page fetcher with retry logic and network interception"""

import asyncio
from typing import Optional, Dict, List, Any
from dataclasses import dataclass
from playwright.async_api import async_playwright, Browser, BrowserContext, Page
import logging

logger = logging.getLogger(__name__)


@dataclass
class FetchConfig:
    """Configuration for page fetching"""
    url: str
    timeout: int = 30000
    wait_until: str = "networkidle"
    headers: Optional[Dict[str, str]] = None
    cookies: Optional[List[Dict[str, Any]]] = None
    viewport: Optional[Dict[str, int]] = None
    user_agent: Optional[str] = None


class Fetcher:
    """Async Playwright-based page fetcher with retry logic"""
    
    def __init__(self, headless: bool = True):
        self.headless = headless
        self.browser: Optional[Browser] = None
        self.playwright = None
    
    async def __aenter__(self):
        """Async context manager entry"""
        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.launch(headless=self.headless)
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()
    
    async def fetch(
        self,
        config: FetchConfig,
        max_retries: int = 3,
        retry_delay: float = 1.0
    ) -> Page:
        """
        Fetch a page with retry logic and exponential backoff
        
        Args:
            config: Fetch configuration
            max_retries: Maximum number of retry attempts
            retry_delay: Initial delay between retries (exponential backoff)
        
        Returns:
            Playwright Page object
        
        Raises:
            Exception: If all retry attempts fail
        """
        if not self.browser:
            raise RuntimeError("Fetcher not initialized. Use as async context manager.")
        
        context_options: Dict[str, Any] = {
            "viewport": config.viewport or {"width": 1920, "height": 1080},
            "user_agent": config.user_agent or (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            ),
        }
        
        if config.headers:
            context_options["extra_http_headers"] = config.headers
        
        context = await self.browser.new_context(**context_options)
        
        if config.cookies:
            try:
                # Parse cookies if they're strings
                parsed_cookies = []
                for cookie in config.cookies:
                    if isinstance(cookie, str):
                        # Parse cookie string format: "name=value; domain=example.com"
                        parts = cookie.split(';')
                        cookie_dict = {}
                        for part in parts:
                            if '=' in part:
                                key, value = part.split('=', 1)
                                cookie_dict[key.strip()] = value.strip()
                        if 'name' in cookie_dict and 'value' in cookie_dict:
                            parsed_cookies.append({
                                "name": cookie_dict['name'],
                                "value": cookie_dict['value'],
                                "domain": cookie_dict.get('domain', ''),
                                "path": cookie_dict.get('path', '/'),
                            })
                    else:
                        parsed_cookies.append(cookie)
                
                if parsed_cookies:
                    await context.add_cookies(parsed_cookies)
            except Exception as e:
                logger.warning(f"Failed to parse cookies: {e}")
        
        page = await context.new_page()
        page.set_default_timeout(config.timeout)
        
        # Retry logic with exponential backoff
        last_error = None
        for attempt in range(max_retries):
            try:
                # Try different wait strategies
                wait_strategies = [
                    config.wait_until,
                    "domcontentloaded",
                    "load",
                ]
                
                for wait_strategy in wait_strategies:
                    try:
                        await page.goto(
                            config.url,
                            wait_until=wait_strategy,
                            timeout=config.timeout,
                        )
                        # If successful, return the page
                        return page
                    except Exception as e:
                        if wait_strategy == wait_strategies[-1]:
                            # Last strategy failed, raise
                            raise
                        logger.debug(f"Wait strategy {wait_strategy} failed, trying next")
                        continue
                
            except Exception as e:
                last_error = e
                if attempt < max_retries - 1:
                    delay = retry_delay * (2 ** attempt)  # Exponential backoff
                    logger.warning(
                        f"Fetch attempt {attempt + 1} failed: {e}. "
                        f"Retrying in {delay}s..."
                    )
                    await asyncio.sleep(delay)
                else:
                    await page.close()
                    raise last_error
        
        await page.close()
        raise last_error or Exception("Failed to fetch page")
    
    async def fetch_with_interception(
        self,
        config: FetchConfig,
        intercept_patterns: Optional[List[str]] = None
    ) -> tuple[Page, List[Dict[str, Any]]]:
        """
        Fetch page and intercept network requests
        
        Args:
            config: Fetch configuration
            intercept_patterns: URL patterns to intercept (e.g., ['*api*', '*json*'])
        
        Returns:
            Tuple of (Page, intercepted_requests)
        """
        page = await self.fetch(config)
        intercepted: List[Dict[str, Any]] = []
        
        if intercept_patterns:
            async def handle_route(route):
                request = route.request
                url = request.url
                
                # Check if URL matches any pattern
                should_intercept = any(
                    pattern.replace('*', '') in url for pattern in intercept_patterns
                )
                
                if should_intercept:
                    try:
                        response = await route.fetch()
                        body = await response.body()
                        intercepted.append({
                            "url": url,
                            "method": request.method,
                            "headers": request.headers,
                            "body": body.decode('utf-8', errors='ignore'),
                            "status": response.status,
                        })
                    except Exception as e:
                        logger.warning(f"Failed to intercept {url}: {e}")
                
                await route.continue_()
            
            await page.route("**/*", handle_route)
            # Reload to capture requests
            await page.reload(wait_until=config.wait_until, timeout=config.timeout)
        
        return page, intercepted
