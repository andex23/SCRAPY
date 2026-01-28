"""Rate limiting utilities"""

import asyncio
from collections import defaultdict
from time import time
from typing import Dict, Optional
import logging

logger = logging.getLogger(__name__)


class RateLimiter:
    """Per-domain rate limiter with requests-per-second control"""
    
    def __init__(self, requests_per_second: float = 1.0):
        """
        Initialize rate limiter
        
        Args:
            requests_per_second: Maximum requests per second per domain
        """
        self.rps = requests_per_second
        self.min_interval = 1.0 / requests_per_second if requests_per_second > 0 else 0
        self.last_request: Dict[str, float] = defaultdict(lambda: 0)
        self.lock = asyncio.Lock()
    
    async def acquire(self, domain: str = "default"):
        """
        Acquire permission to make a request (blocks if needed)
        
        Args:
            domain: Domain identifier for per-domain limiting
        """
        if self.min_interval == 0:
            return  # No rate limiting
        
        async with self.lock:
            now = time()
            elapsed = now - self.last_request[domain]
            
            if elapsed < self.min_interval:
                wait_time = self.min_interval - elapsed
                logger.debug(f"Rate limiting: waiting {wait_time:.2f}s for {domain}")
                await asyncio.sleep(wait_time)
            
            self.last_request[domain] = time()
    
    def reset(self, domain: Optional[str] = None):
        """
        Reset rate limiter for a domain or all domains
        
        Args:
            domain: Domain to reset, or None for all domains
        """
        if domain:
            self.last_request.pop(domain, None)
        else:
            self.last_request.clear()


class GlobalRateLimiter:
    """Global rate limiter (not per-domain)"""
    
    def __init__(self, requests_per_second: float = 1.0):
        self.rps = requests_per_second
        self.min_interval = 1.0 / requests_per_second if requests_per_second > 0 else 0
        self.last_request: float = 0
        self.lock = asyncio.Lock()
    
    async def acquire(self):
        """Acquire permission to make a request"""
        if self.min_interval == 0:
            return
        
        async with self.lock:
            now = time()
            elapsed = now - self.last_request
            
            if elapsed < self.min_interval:
                wait_time = self.min_interval - elapsed
                await asyncio.sleep(wait_time)
            
            self.last_request = time()
