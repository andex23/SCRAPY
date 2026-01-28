"""Compliance checking utilities"""

import re
from typing import Dict, Any, Optional, List
from urllib.parse import urlparse, urljoin
import logging

logger = logging.getLogger(__name__)


class ComplianceChecker:
    """Check scraping compliance (robots.txt, public pages, etc.)"""
    
    def __init__(self, enforce: bool = False):
        """
        Initialize compliance checker
        
        Args:
            enforce: If True, fail on violations. If False, only warn.
        """
        self.enforce = enforce
        self.violations: List[str] = []
    
    async def check_robots_txt(self, url: str, user_agent: str = "*") -> Dict[str, Any]:
        """
        Check robots.txt for URL
        
        Args:
            url: URL to check
            user_agent: User agent string
        
        Returns:
            Dict with 'allowed', 'disallowed', and 'crawl_delay'
        """
        try:
            from urllib.robotparser import RobotFileParser
            from urllib.parse import urljoin
            
            parsed = urlparse(url)
            robots_url = urljoin(f"{parsed.scheme}://{parsed.netloc}", "/robots.txt")
            
            rp = RobotFileParser()
            rp.set_url(robots_url)
            rp.read()
            
            can_fetch = rp.can_fetch(user_agent, url)
            crawl_delay = rp.crawl_delay(user_agent)
            
            result = {
                "allowed": can_fetch,
                "disallowed": not can_fetch,
                "crawl_delay": crawl_delay,
                "robots_url": robots_url,
            }
            
            if not can_fetch:
                msg = f"URL disallowed by robots.txt: {url}"
                self.violations.append(msg)
                if self.enforce:
                    raise ValueError(msg)
                logger.warning(msg)
            
            return result
        
        except Exception as e:
            logger.warning(f"Failed to check robots.txt: {e}")
            return {
                "allowed": True,  # Default to allowed if check fails
                "disallowed": False,
                "crawl_delay": None,
                "error": str(e),
            }
    
    def check_public_only(self, url: str, requires_auth: bool = False) -> bool:
        """
        Check if URL is public (no authentication required)
        
        Args:
            url: URL to check
            requires_auth: Whether page requires authentication
        
        Returns:
            True if public, False otherwise
        """
        if requires_auth:
            msg = f"URL requires authentication: {url}"
            self.violations.append(msg)
            if self.enforce:
                raise ValueError(msg)
            logger.warning(msg)
            return False
        return True
    
    def check_rate_limit(self, requests_made: int, limit: int) -> bool:
        """
        Check if rate limit is exceeded
        
        Args:
            requests_made: Number of requests made
            limit: Maximum allowed requests
        
        Returns:
            True if within limit, False otherwise
        """
        if requests_made > limit:
            msg = f"Rate limit exceeded: {requests_made} > {limit}"
            self.violations.append(msg)
            if self.enforce:
                raise ValueError(msg)
            logger.warning(msg)
            return False
        return True
    
    def get_violations(self) -> List[str]:
        """Get list of compliance violations"""
        return self.violations
    
    def clear_violations(self):
        """Clear violation list"""
        self.violations = []
