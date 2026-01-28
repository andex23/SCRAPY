"""Schema validation layer"""

from typing import List, Dict, Any, Optional
from scraper_core.schemas import (
    ProductSchema, ImageSchema, ContactSchema, TextSchema, AssetSchema, ScrapeResultSchema
)
import logging

logger = logging.getLogger(__name__)


class Validator:
    """Validate extracted records against schemas"""
    
    def __init__(self, error_threshold: float = 0.5):
        """
        Initialize validator
        
        Args:
            error_threshold: Maximum ratio of invalid records before failing (0.0-1.0)
        """
        self.error_threshold = error_threshold
        self.errors: List[Dict[str, Any]] = []
    
    def validate_products(self, products: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Validate product records"""
        validated = []
        for idx, product in enumerate(products):
            try:
                validated_product = ProductSchema(**product)
                validated.append(validated_product.dict())
            except Exception as e:
                self.errors.append({
                    'type': 'product',
                    'index': idx,
                    'error': str(e),
                    'data': product,
                })
                logger.warning(f"Invalid product {idx}: {e}")
        
        return validated
    
    def validate_images(self, images: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Validate image records"""
        validated = []
        for idx, image in enumerate(images):
            try:
                validated_image = ImageSchema(**image)
                validated.append(validated_image.dict())
            except Exception as e:
                self.errors.append({
                    'type': 'image',
                    'index': idx,
                    'error': str(e),
                    'data': image,
                })
                logger.warning(f"Invalid image {idx}: {e}")
        
        return validated
    
    def validate_contacts(self, contacts: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Validate contact records"""
        try:
            validated_contacts = ContactSchema(**contacts)
            return validated_contacts.dict()
        except Exception as e:
            self.errors.append({
                'type': 'contact',
                'error': str(e),
                'data': contacts,
            })
            logger.warning(f"Invalid contacts: {e}")
            return None
    
    def validate_text(self, text: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Validate text records"""
        try:
            validated_text = TextSchema(**text)
            return validated_text.dict()
        except Exception as e:
            self.errors.append({
                'type': 'text',
                'error': str(e),
                'data': text,
            })
            logger.warning(f"Invalid text: {e}")
            return None
    
    def validate_assets(self, assets: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Validate asset records"""
        validated = []
        for idx, asset in enumerate(assets):
            try:
                validated_asset = AssetSchema(**asset)
                validated.append(validated_asset.dict())
            except Exception as e:
                self.errors.append({
                    'type': 'asset',
                    'index': idx,
                    'error': str(e),
                    'data': asset,
                })
                logger.warning(f"Invalid asset {idx}: {e}")
        
        return validated
    
    def validate_result(self, result: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate complete scrape result
        
        Args:
            result: Scrape result dictionary
        
        Returns:
            Validated result dictionary
        
        Raises:
            ValueError: If error threshold exceeded
        """
        validated = {}
        total_records = 0
        invalid_records = len(self.errors)
        
        if 'products' in result and result['products']:
            validated['products'] = self.validate_products(result['products'])
            total_records += len(result['products'])
        
        if 'images' in result and result['images']:
            validated['images'] = self.validate_images(result['images'])
            total_records += len(result['images'])
        
        if 'contacts' in result and result['contacts']:
            contacts = self.validate_contacts(result['contacts'])
            if contacts:
                validated['contacts'] = contacts
                total_records += 1
        
        if 'text' in result and result['text']:
            text = self.validate_text(result['text'])
            if text:
                validated['text'] = text
                total_records += 1
        
        if 'assets' in result and result['assets']:
            validated['assets'] = self.validate_assets(result['assets'])
            total_records += len(result['assets'])
        
        if 'crawl' in result:
            validated['crawl'] = result['crawl']  # URLs don't need schema validation
        
        # Check error threshold
        if total_records > 0:
            error_ratio = invalid_records / total_records
            if error_ratio > self.error_threshold:
                raise ValueError(
                    f"Error threshold exceeded: {error_ratio:.2%} errors "
                    f"({invalid_records}/{total_records})"
                )
        
        return validated
    
    def get_errors(self) -> List[Dict[str, Any]]:
        """Get validation errors"""
        return self.errors
    
    def clear_errors(self):
        """Clear validation errors"""
        self.errors = []
