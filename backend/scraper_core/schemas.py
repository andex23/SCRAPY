"""Pydantic schemas for data validation"""

from pydantic import BaseModel, validator
from typing import Optional, List


class ProductSchema(BaseModel):
    """Product data schema"""
    title: str
    price: Optional[str] = None
    image: Optional[str] = None
    link: Optional[str] = None
    description: Optional[str] = None
    
    @validator('title')
    def title_must_exist(cls, v):
        if not v or len(v.strip()) == 0:
            raise ValueError('Title is required')
        if len(v) > 500:
            raise ValueError('Title too long (max 500 characters)')
        return v.strip()
    
    @validator('price')
    def validate_price(cls, v):
        if v:
            # Basic price validation - must contain numbers
            import re
            if not re.search(r'\d', v):
                raise ValueError('Price must contain numbers')
        return v
    
    class Config:
        extra = 'allow'  # Allow additional fields


class ImageSchema(BaseModel):
    """Image data schema"""
    url: str
    alt: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None
    
    @validator('url')
    def url_must_be_valid(cls, v):
        if not v or not v.startswith('http'):
            raise ValueError('URL must be a valid HTTP/HTTPS URL')
        return v


class ContactSchema(BaseModel):
    """Contact data schema"""
    emails: List[str] = []
    phones: List[str] = []
    socials: List[str] = []
    
    @validator('emails', each_item=True)
    def validate_email(cls, v):
        import re
        if not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', v):
            raise ValueError(f'Invalid email format: {v}')
        return v


class TextSchema(BaseModel):
    """Text data schema"""
    title: str = ""
    meta: str = ""
    headings: List[str] = []
    paragraphs: List[str] = []
    
    @validator('headings', 'paragraphs')
    def limit_items(cls, v):
        return v[:100]  # Limit to 100 items


class AssetSchema(BaseModel):
    """Asset data schema"""
    filename: str
    url: str
    type: str
    size: Optional[str] = None
    
    @validator('url')
    def url_must_be_valid(cls, v):
        if not v or not v.startswith('http'):
            raise ValueError('URL must be a valid HTTP/HTTPS URL')
        return v


class ScrapeResultSchema(BaseModel):
    """Complete scrape result schema"""
    images: Optional[List[ImageSchema]] = None
    products: Optional[List[ProductSchema]] = None
    contacts: Optional[ContactSchema] = None
    assets: Optional[List[AssetSchema]] = None
    crawl: Optional[List[str]] = None
    text: Optional[TextSchema] = None
    
    class Config:
        extra = 'allow'
