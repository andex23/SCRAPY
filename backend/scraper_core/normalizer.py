"""Data normalization utilities"""

import re
from typing import Optional, Dict, Any
from decimal import Decimal


class Normalizer:
    """Normalize extracted data to consistent formats"""
    
    @staticmethod
    def normalize_price(price_str: str) -> Optional[Dict[str, Any]]:
        """
        Extract numeric value and currency from price string
        
        Args:
            price_str: Price string (e.g., "$19.99", "€15,50", "£10.00")
        
        Returns:
            Dict with 'value', 'currency', and 'original' or None if invalid
        """
        if not price_str:
            return None
        
        # Remove currency symbols and extract number
        cleaned = re.sub(r'[^\d.,]', '', str(price_str))
        
        # Handle European format (comma as decimal separator)
        if ',' in cleaned and '.' in cleaned:
            # Determine which is decimal separator
            if cleaned.rindex(',') > cleaned.rindex('.'):
                # Comma is decimal (e.g., "1.234,56")
                cleaned = cleaned.replace('.', '').replace(',', '.')
            else:
                # Dot is decimal (e.g., "1,234.56")
                cleaned = cleaned.replace(',', '')
        elif ',' in cleaned:
            # Check if comma is thousands or decimal separator
            parts = cleaned.split(',')
            if len(parts) == 2 and len(parts[1]) <= 2:
                # Likely decimal separator
                cleaned = cleaned.replace(',', '.')
            else:
                # Likely thousands separator
                cleaned = cleaned.replace(',', '')
        
        try:
            value = float(cleaned)
            
            # Extract currency symbol
            currency_match = re.search(r'[£$€¥₹]', str(price_str))
            currency = currency_match.group(0) if currency_match else 'USD'
            
            # Map symbols to codes
            currency_map = {
                '$': 'USD',
                '€': 'EUR',
                '£': 'GBP',
                '¥': 'JPY',
                '₹': 'INR',
            }
            currency_code = currency_map.get(currency, currency)
            
            return {
                'value': value,
                'currency': currency_code,
                'original': price_str,
            }
        except (ValueError, TypeError):
            return None
    
    @staticmethod
    def normalize_phone(phone: str) -> Optional[str]:
        """
        Normalize phone number to E.164 format
        
        Args:
            phone: Phone number string
        
        Returns:
            Normalized phone number or None if invalid
        """
        if not phone:
            return None
        
        # Remove all non-digits except +
        digits = re.sub(r'[^\d+]', '', phone)
        
        # Remove leading + if present for processing
        has_plus = digits.startswith('+')
        digits_only = digits.lstrip('+')
        
        # Basic validation
        if len(digits_only) < 10:
            return None
        
        # Add country code if missing (assume US for 10-digit)
        if len(digits_only) == 10 and not has_plus:
            digits_only = '1' + digits_only
        
        return f"+{digits_only}" if not has_plus else digits
    
    @staticmethod
    def clean_text(text: str) -> str:
        """
        Remove HTML entities and normalize whitespace
        
        Args:
            text: Text string with potential HTML entities
        
        Returns:
            Cleaned text
        """
        if not text:
            return ""
        
        # Common HTML entities
        entities = {
            '&nbsp;': ' ',
            '&amp;': '&',
            '&lt;': '<',
            '&gt;': '>',
            '&quot;': '"',
            '&apos;': "'",
            '&#39;': "'",
            '&hellip;': '...',
            '&mdash;': '—',
            '&ndash;': '–',
        }
        
        for entity, replacement in entities.items():
            text = text.replace(entity, replacement)
        
        # Remove other HTML entities (&#123; format)
        text = re.sub(r'&#\d+;', '', text)
        text = re.sub(r'&\w+;', '', text)
        
        # Normalize whitespace
        text = ' '.join(text.split())
        
        return text.strip()
    
    @staticmethod
    def resolve_url(url: str, base_url: str) -> str:
        """
        Resolve relative URL to absolute
        
        Args:
            url: Relative or absolute URL
            base_url: Base URL for resolution
        
        Returns:
            Absolute URL
        """
        from urllib.parse import urljoin, urlparse
        
        # If already absolute, return as is
        parsed = urlparse(url)
        if parsed.scheme:
            return url
        
        return urljoin(base_url, url)
    
    @staticmethod
    def normalize_product(product: Dict[str, Any]) -> Dict[str, Any]:
        """
        Normalize a product record
        
        Args:
            product: Product dictionary
        
        Returns:
            Normalized product dictionary
        """
        normalized = product.copy()
        
        # Clean text fields
        if 'title' in normalized:
            normalized['title'] = Normalizer.clean_text(str(normalized['title']))
        if 'description' in normalized:
            normalized['description'] = Normalizer.clean_text(str(normalized.get('description', '')))
        
        # Normalize price
        if 'price' in normalized and normalized['price']:
            price_info = Normalizer.normalize_price(str(normalized['price']))
            if price_info:
                normalized['price_value'] = price_info['value']
                normalized['price_currency'] = price_info['currency']
                normalized['price'] = f"{price_info['currency']}{price_info['value']:.2f}"
        
        # Resolve image URL
        if 'image' in normalized and normalized['image']:
            # Assuming base_url is available in context
            # This would need to be passed in a real implementation
            pass
        
        return normalized
