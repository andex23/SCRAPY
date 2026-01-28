"""Base extractor and entity-specific extractors"""

from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from playwright.async_api import Page
import json
import re
import logging

logger = logging.getLogger(__name__)


class BaseExtractor(ABC):
    """Abstract base class for data extractors"""
    
    @abstractmethod
    async def extract(self, page: Page, base_url: str) -> List[Dict[str, Any]]:
        """Extract data from page"""
        pass
    
    @abstractmethod
    def validate(self, record: Dict[str, Any]) -> bool:
        """Validate extracted record"""
        pass


class ProductExtractor(BaseExtractor):
    """Extract product information from pages"""
    
    def __init__(self, custom_selectors: Optional[Dict[str, List[str]]] = None):
        self.custom_selectors = custom_selectors or {}
    
    async def extract(self, page: Page, base_url: str) -> List[Dict[str, Any]]:
        """Extract products using JSON-LD and DOM fallback"""
        products = []
        
        # Try JSON-LD first (most reliable)
        json_ld_products = await self._extract_json_ld(page, base_url)
        products.extend(json_ld_products)
        
        # Fallback to DOM extraction
        if not products:
            dom_products = await self._extract_from_dom(page, base_url)
            products.extend(dom_products)
        
        # Validate and return
        validated = [p for p in products if self.validate(p)]
        return validated[:50]  # Limit to 50 products
    
    async def _extract_json_ld(self, page: Page, base_url: str) -> List[Dict[str, Any]]:
        """Extract products from JSON-LD structured data"""
        products = []
        
        try:
            json_ld_data = await page.evaluate("""
                () => {
                    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
                    const products = [];
                    scripts.forEach(script => {
                        try {
                            const data = JSON.parse(script.textContent);
                            if (data['@type'] === 'Product') {
                                products.push(data);
                            } else if (data['@type'] === 'ItemList' && data.itemListElement) {
                                data.itemListElement.forEach(item => {
                                    if (item.item && item.item['@type'] === 'Product') {
                                        products.push(item.item);
                                    }
                                });
                            }
                        } catch(e) {}
                    });
                    return products;
                }
            """)
            
            for product_data in json_ld_data:
                product_url = product_data.get("url", "")
                product = {
                    "title": product_data.get("name", ""),
                    "price": self._extract_price(product_data),
                    "image": self._resolve_url(self._extract_image(product_data), base_url) if self._extract_image(product_data) else "",
                    "link": self._resolve_url(product_url, base_url) if product_url else base_url,
                    "description": product_data.get("description", ""),
                }
                products.append(product)
        except Exception as e:
            logger.warning(f"JSON-LD extraction failed: {e}")
        
        return products
    
    async def _extract_from_dom(self, page: Page, base_url: str) -> List[Dict[str, Any]]:
        """Extract products from DOM using selectors"""
        products = []
        
        # Get selectors (custom or default)
        title_selectors = self.custom_selectors.get("title", [
            "h1.product-title",
            ".product-name",
            "[data-product-title]",
            "h1",
        ])
        price_selectors = self.custom_selectors.get("price", [
            ".price",
            "[data-price]",
            ".product-price",
        ])
        image_selectors = self.custom_selectors.get("image", [
            ".product-image img",
            "img.product-photo",
            "[data-product-image]",
        ])
        desc_selectors = self.custom_selectors.get("description", [
            ".description",
            ".product-details",
        ])
        
        try:
            # Try to find product containers
            product_elements = await page.evaluate("""
                () => {
                    const containers = document.querySelectorAll(
                        '.product, [data-product], .product-item, .product-card'
                    );
                    return Array.from(containers).map((el, idx) => ({
                        index: idx,
                        html: el.outerHTML
                    }));
                }
            """)
            
            if not product_elements:
                # Single product page - extract directly
                product = await self._extract_single_product(
                    page, title_selectors, price_selectors, image_selectors, desc_selectors, base_url
                )
                if product:
                    products.append(product)
            else:
                # Multiple products - extract from each container
                for elem in product_elements[:50]:  # Limit
                    try:
                        container = await page.query_selector(
                            f".product:nth-of-type({elem['index'] + 1}), "
                            f"[data-product]:nth-of-type({elem['index'] + 1})"
                        )
                        if container:
                            product = await self._extract_from_element(
                                container, title_selectors, price_selectors,
                                image_selectors, desc_selectors, base_url
                            )
                            if product:
                                products.append(product)
                    except Exception as e:
                        logger.debug(f"Failed to extract product {elem['index']}: {e}")
                        continue
        except Exception as e:
            logger.warning(f"DOM extraction failed: {e}")
        
        return products
    
    async def _extract_single_product(
        self, page: Page, title_sel: List[str], price_sel: List[str],
        image_sel: List[str], desc_sel: List[str], base_url: str
    ) -> Optional[Dict[str, Any]]:
        """Extract single product from page"""
        product = {}
        
        # Title
        for selector in title_sel:
            try:
                element = await page.query_selector(selector)
                if element:
                    product["title"] = await element.inner_text()
                    break
            except:
                continue
        
        # Price
        for selector in price_sel:
            try:
                element = await page.query_selector(selector)
                if element:
                    product["price"] = await element.inner_text()
                    break
            except:
                continue
        
        # Image
        for selector in image_sel:
            try:
                element = await page.query_selector(selector)
                if element:
                    src = await element.get_attribute("src")
                    if src:
                        product["image"] = self._resolve_url(src, base_url)
                        break
            except:
                continue
        
        # Description
        for selector in desc_sel:
            try:
                element = await page.query_selector(selector)
                if element:
                    product["description"] = await element.inner_text()
                    break
            except:
                continue
        
        product["link"] = base_url
        
        return product if product.get("title") else None
    
    async def _extract_from_element(
        self, element, title_sel: List[str], price_sel: List[str],
        image_sel: List[str], desc_sel: List[str], base_url: str
    ) -> Optional[Dict[str, Any]]:
        """Extract product from a container element"""
        product = {}
        
        # Similar to _extract_single_product but scoped to element
        for selector in title_sel:
            try:
                sub_elem = await element.query_selector(selector)
                if sub_elem:
                    product["title"] = await sub_elem.inner_text()
                    break
            except:
                continue
        
        for selector in price_sel:
            try:
                sub_elem = await element.query_selector(selector)
                if sub_elem:
                    product["price"] = await sub_elem.inner_text()
                    break
            except:
                continue
        
        for selector in image_sel:
            try:
                sub_elem = await element.query_selector(selector)
                if sub_elem:
                    src = await sub_elem.get_attribute("src")
                    if src:
                        product["image"] = self._resolve_url(src, base_url)
                        break
            except:
                continue
        
        for selector in desc_sel:
            try:
                sub_elem = await element.query_selector(selector)
                if sub_elem:
                    product["description"] = await sub_elem.inner_text()
                    break
            except:
                continue
        
        # Extract product link from anchor tag
        try:
            link_elem = await element.query_selector("a[href]")
            if link_elem:
                href = await link_elem.get_attribute("href")
                if href:
                    product["link"] = self._resolve_url(href, base_url)
        except:
            pass
        
        # Fallback to base_url if no link found
        if not product.get("link"):
            product["link"] = base_url
        
        return product if product.get("title") else None
    
    def _extract_price(self, product_data: Dict[str, Any]) -> str:
        """Extract price from product data"""
        offers = product_data.get("offers", {})
        if isinstance(offers, dict):
            return offers.get("price", "")
        return ""
    
    def _extract_image(self, product_data: Dict[str, Any]) -> str:
        """Extract image URL from product data"""
        image = product_data.get("image", "")
        if isinstance(image, list) and image:
            return image[0] if isinstance(image[0], str) else image[0].get("url", "")
        if isinstance(image, dict):
            return image.get("url", "")
        return image if isinstance(image, str) else ""
    
    def _resolve_url(self, url: str, base_url: str) -> str:
        """Resolve relative URL to absolute"""
        from urllib.parse import urljoin
        return urljoin(base_url, url)
    
    def validate(self, record: Dict[str, Any]) -> bool:
        """Validate product record"""
        return bool(record.get("title"))


class ContactExtractor(BaseExtractor):
    """Extract contact information (emails, phones, socials)"""
    
    async def extract(self, page: Page, base_url: str) -> List[Dict[str, Any]]:
        """Extract contacts from page"""
        contacts = {
            "emails": [],
            "phones": [],
            "socials": [],
        }
        
        try:
            # Extract emails
            emails = await page.evaluate("""
                () => {
                    const emails = new Set();
                    // From mailto links
                    document.querySelectorAll('a[href^="mailto:"]').forEach(link => {
                        const email = link.href.replace('mailto:', '').split('?')[0];
                        if (email) emails.add(email);
                    });
                    // From text content (regex)
                    const text = document.body.innerText;
                    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}/g;
                    const matches = text.match(emailRegex);
                    if (matches) matches.forEach(e => emails.add(e));
                    return Array.from(emails);
                }
            """)
            contacts["emails"] = list(set(emails))[:20]  # Limit
            
            # Extract phones
            phones = await page.evaluate("""
                () => {
                    const phones = new Set();
                    // From tel links
                    document.querySelectorAll('a[href^="tel:"]').forEach(link => {
                        const phone = link.href.replace('tel:', '').replace(/[^0-9+]/g, '');
                        if (phone) phones.add(phone);
                    });
                    // From text content
                    const text = document.body.innerText;
                    const phoneRegex = /(\\+?1[-.]?)?\\(?([0-9]{3})\\)?[-.]?([0-9]{3})[-.]?([0-9]{4})/g;
                    const matches = text.match(phoneRegex);
                    if (matches) matches.forEach(p => phones.add(p));
                    return Array.from(phones);
                }
            """)
            contacts["phones"] = list(set(phones))[:20]  # Limit
            
            # Extract social media links
            socials = await page.evaluate("""
                () => {
                    const socials = [];
                    const patterns = [
                        'linkedin.com', 'instagram.com', 'twitter.com', 'x.com',
                        'facebook.com', 'youtube.com', 'github.com', 'tiktok.com'
                    ];
                    document.querySelectorAll('a[href]').forEach(link => {
                        const href = link.href.toLowerCase();
                        patterns.forEach(pattern => {
                            if (href.includes(pattern)) {
                                socials.push(link.href);
                            }
                        });
                    });
                    return [...new Set(socials)];
                }
            """)
            contacts["socials"] = list(set(socials))[:20]  # Limit
            
        except Exception as e:
            logger.warning(f"Contact extraction failed: {e}")
        
        return [contacts]  # Return as list for consistency
    
    def validate(self, record: Dict[str, Any]) -> bool:
        """Validate contact record"""
        return bool(
            record.get("emails") or
            record.get("phones") or
            record.get("socials")
        )


class ImageExtractor(BaseExtractor):
    """Extract images from page"""

    async def extract(self, page: Page, base_url: str) -> List[Dict[str, Any]]:
        """Extract images from img tags, srcset, and CSS backgrounds"""
        images = []

        try:
            # Scroll down the page to trigger lazy loading
            await self._scroll_page(page)

            # Wait a bit for images to load after scrolling
            await page.wait_for_timeout(2000)

            image_data = await page.evaluate("""
                (base) => {
                    const images = [];
                    const seen = new Set();

                    // Helper to add image if valid
                    const addImage = (url, alt = '', width = 0, height = 0) => {
                        if (url && !url.startsWith('data:') && !seen.has(url)) {
                            seen.add(url);
                            images.push({ url, alt, width, height });
                        }
                    };

                    // From img tags - check multiple attributes for lazy loading
                    document.querySelectorAll('img').forEach(img => {
                        const srcset = img.srcset || img.getAttribute('srcset') || img.getAttribute('data-srcset');
                        if (srcset) {
                            const sources = srcset.split(',').map(s => s.trim());
                            let highestRes = { url: '', width: 0 };
                            for (const source of sources) {
                                const parts = source.split(/\\s+/);
                                const url = parts[0];
                                const descriptor = parts[1] || '1x';
                                let width = 0;
                                if (descriptor.endsWith('w')) {
                                    width = parseInt(descriptor);
                                } else if (descriptor.endsWith('x')) {
                                    width = parseFloat(descriptor) * 1000;
                                }
                                if (width > highestRes.width) {
                                    highestRes = { url, width };
                                }
                            }
                            if (highestRes.url) {
                                addImage(highestRes.url, img.alt, img.naturalWidth, img.naturalHeight);
                            }
                        }

                        // Check multiple possible source attributes for lazy loading
                        const srcAttrs = [
                            'src', 'data-src', 'data-lazy-src', 'data-original',
                            'data-image', 'data-lazy', 'data-url', 'data-img-src',
                            'data-full-src', 'data-zoom-image', 'data-large-src'
                        ];
                        for (const attr of srcAttrs) {
                            const src = img.getAttribute(attr);
                            if (src && !src.startsWith('data:')) {
                                addImage(src, img.alt, img.naturalWidth, img.naturalHeight);
                            }
                        }
                    });

                    // From picture/source elements
                    document.querySelectorAll('picture source').forEach(source => {
                        const srcset = source.srcset || source.getAttribute('data-srcset');
                        if (srcset) {
                            const sources = srcset.split(',').map(s => s.trim());
                            for (const src of sources) {
                                const url = src.split(/\\s+/)[0];
                                if (url) addImage(url);
                            }
                        }
                    });

                    // From CSS background images
                    document.querySelectorAll('[style*="background"]').forEach(el => {
                        const style = el.getAttribute('style') || '';
                        const match = style.match(/url\\(['"]*([^'"\\)]+)['"]*\\)/);
                        if (match && match[1]) {
                            addImage(match[1]);
                        }
                    });

                    // From data attributes on divs/articles (common in e-commerce)
                    document.querySelectorAll('[data-image], [data-src], [data-background]').forEach(el => {
                        const attrs = ['data-image', 'data-src', 'data-background', 'data-bg'];
                        for (const attr of attrs) {
                            const url = el.getAttribute(attr);
                            if (url && !url.startsWith('data:')) {
                                addImage(url);
                            }
                        }
                    });

                    // From anchor tags with image links (product links often have image data)
                    document.querySelectorAll('a[data-image], a[data-src]').forEach(a => {
                        const url = a.getAttribute('data-image') || a.getAttribute('data-src');
                        if (url) addImage(url);
                    });

                    return images;
                }
            """, base_url)

            # Resolve relative URLs and filter out invalid ones
            from urllib.parse import urljoin
            valid_images = []
            for img in image_data:
                resolved_url = urljoin(base_url, img["url"])
                # Filter out tiny images, icons, and tracking pixels
                if (resolved_url and
                    not any(x in resolved_url.lower() for x in ['pixel', 'tracking', 'beacon', '1x1', 'spacer']) and
                    not resolved_url.endswith('.gif')):
                    img["url"] = resolved_url
                    valid_images.append(img)

            images = valid_images[:100]  # Limit to 100

        except Exception as e:
            logger.warning(f"Image extraction failed: {e}")

        return images

    async def _scroll_page(self, page: Page):
        """Scroll through the page to trigger lazy loading"""
        try:
            # Get page height
            total_height = await page.evaluate("document.body.scrollHeight")
            viewport_height = await page.evaluate("window.innerHeight")

            # Scroll in increments
            current_position = 0
            scroll_step = viewport_height // 2

            while current_position < total_height:
                await page.evaluate(f"window.scrollTo(0, {current_position})")
                await page.wait_for_timeout(300)  # Wait for lazy images to load
                current_position += scroll_step
                # Update total height as page may load more content
                total_height = await page.evaluate("document.body.scrollHeight")

            # Scroll back to top
            await page.evaluate("window.scrollTo(0, 0)")
        except Exception as e:
            logger.debug(f"Scroll failed: {e}")
    
    def validate(self, record: Dict[str, Any]) -> bool:
        """Validate image record"""
        return bool(record.get("url"))


class TextExtractor(BaseExtractor):
    """Extract text content from page"""
    
    async def extract(self, page: Page, base_url: str) -> List[Dict[str, Any]]:
        """Extract text content (title, meta, headings, paragraphs)"""
        try:
            text_data = await page.evaluate("""
                () => {
                    // Remove non-content elements
                    const toRemove = document.querySelectorAll(
                        'nav, header, footer, script, style, aside, .ad, .advertisement'
                    );
                    toRemove.forEach(el => el.remove());
                    
                    const title = document.title || '';
                    const meta = document.querySelector('meta[name="description"]')?.content || '';
                    
                    const headings = [];
                    document.querySelectorAll('h1, h2, h3').forEach(h => {
                        const text = h.innerText.trim();
                        if (text) headings.push(text);
                    });
                    
                    const paragraphs = [];
                    document.querySelectorAll('p').forEach(p => {
                        const text = p.innerText.trim();
                        if (text && text.length > 20) paragraphs.push(text);
                    });
                    
                    return {
                        title,
                        meta,
                        headings: headings.slice(0, 50),
                        paragraphs: paragraphs.slice(0, 100),
                    };
                }
            """)
            
            return [text_data]
            
        except Exception as e:
            logger.warning(f"Text extraction failed: {e}")
            return []
    
    def validate(self, record: Dict[str, Any]) -> bool:
        """Validate text record"""
        return bool(
            record.get("title") or
            record.get("headings") or
            record.get("paragraphs")
        )


class AssetExtractor(BaseExtractor):
    """Extract downloadable assets (PDFs, ZIPs, etc.)"""
    
    async def extract(self, page: Page, base_url: str) -> List[Dict[str, Any]]:
        """Extract asset links"""
        assets = []
        
        try:
            asset_data = await page.evaluate("""
                (base) => {
                    const assets = [];
                    const extensions = ['pdf', 'zip', 'mp4', 'docx', 'csv', 'xlsx', 'ppt', 'mp3'];
                    document.querySelectorAll('a[href]').forEach(link => {
                        const href = link.href.toLowerCase();
                        const filename = href.split('/').pop() || '';
                        const ext = filename.split('.').pop();
                        if (extensions.includes(ext)) {
                            assets.push({
                                filename,
                                url: link.href,
                                type: ext.toUpperCase(),
                            });
                        }
                    });
                    return assets;
                }
            """, base_url)
            
            assets = asset_data[:50]  # Limit to 50
            
        except Exception as e:
            logger.warning(f"Asset extraction failed: {e}")
        
        return assets
    
    def validate(self, record: Dict[str, Any]) -> bool:
        """Validate asset record"""
        return bool(record.get("url") and record.get("filename"))
