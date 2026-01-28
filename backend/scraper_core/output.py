"""Output writers for CSV and JSON formats"""

import csv
import json
from pathlib import Path
from typing import List, Dict, Any
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class OutputWriter:
    """Write scrape results to various formats"""
    
    @staticmethod
    def write_csv(
        data: Dict[str, Any],
        output_path: Path,
        job_id: str,
        format_type: str = "standard"
    ):
        """
        Write data to CSV file
        
        Args:
            data: Scrape result data
            output_path: Output file path
            job_id: Job identifier
            format_type: Format type ('standard' or 'shopify')
        """
        if format_type == "shopify":
            OutputWriter._write_shopify_csv(data, output_path, job_id)
        else:
            OutputWriter._write_standard_csv(data, output_path, job_id)
    
    @staticmethod
    def _write_standard_csv(data: Dict[str, Any], output_path: Path, job_id: str):
        """Write standard CSV format"""
        rows: List[List[str]] = []
        
        # Products
        if data.get("products"):
            rows.append(["=== PRODUCTS ==="])
            rows.append(["Title", "Price", "Image URL", "Link", "Description"])
            for product in data["products"]:
                rows.append([
                    product.get("title", ""),
                    product.get("price", ""),
                    product.get("image", ""),
                    product.get("link", ""),
                    product.get("description", ""),
                ])
            rows.append([])
        
        # Images
        if data.get("images"):
            rows.append(["=== IMAGES ==="])
            rows.append(["URL", "Alt Text", "Width", "Height"])
            for image in data["images"]:
                rows.append([
                    image.get("url", ""),
                    image.get("alt", ""),
                    str(image.get("width", "")),
                    str(image.get("height", "")),
                ])
            rows.append([])
        
        # Contacts
        if data.get("contacts"):
            rows.append(["=== CONTACTS ==="])
            rows.append(["Type", "Value"])
            contacts = data["contacts"]
            for email in contacts.get("emails", []):
                rows.append(["Email", email])
            for phone in contacts.get("phones", []):
                rows.append(["Phone", phone])
            for social in contacts.get("socials", []):
                rows.append(["Social", social])
            rows.append([])
        
        # Assets
        if data.get("assets"):
            rows.append(["=== ASSETS ==="])
            rows.append(["Filename", "URL", "Type", "Size"])
            for asset in data["assets"]:
                rows.append([
                    asset.get("filename", ""),
                    asset.get("url", ""),
                    asset.get("type", ""),
                    asset.get("size", ""),
                ])
            rows.append([])
        
        # Crawl URLs
        if data.get("crawl"):
            rows.append(["=== CRAWL LINKS ==="])
            rows.append(["URL"])
            for url in data["crawl"]:
                rows.append([url])
        
        # Write to file
        with open(output_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerows(rows)
    
    @staticmethod
    def _write_shopify_csv(data: Dict[str, Any], output_path: Path, job_id: str):
        """Write Shopify-ready CSV format"""
        if not data.get("products"):
            logger.warning("No products to export in Shopify format")
            return
        
        fieldnames = [
            "Handle", "Title", "Body (HTML)", "Vendor", "Type", "Tags",
            "Published", "Option1 Name", "Option1 Value", "Option2 Name",
            "Option2 Value", "Option3 Name", "Option3 Value", "Variant SKU",
            "Variant Grams", "Variant Inventory Tracker", "Variant Inventory Qty",
            "Variant Inventory Policy", "Variant Fulfillment Service",
            "Variant Price", "Variant Compare At Price", "Variant Requires Shipping",
            "Variant Taxable", "Variant Barcode", "Image Src", "Image Position",
            "Image Alt Text", "Gift Card", "SEO Title", "SEO Description",
            "Google Shopping / Google Product Category",
            "Google Shopping / Gender", "Google Shopping / Age Group",
            "Google Shopping / MPN", "Google Shopping / AdWords Grouping",
            "Google Shopping / AdWords Labels", "Google Shopping / Condition",
            "Google Shopping / Custom Product", "Google Shopping / Custom Label 0",
            "Google Shopping / Custom Label 1", "Google Shopping / Custom Label 2",
            "Google Shopping / Custom Label 3", "Google Shopping / Custom Label 4",
            "Variant Image", "Variant Weight Unit", "Variant Tax Code",
            "Cost per item", "Status"
        ]
        
        with open(output_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            
            for product in data["products"]:
                # Generate handle from title
                handle = product.get("title", "").lower().replace(" ", "-")[:100]
                
                row = {
                    "Handle": handle,
                    "Title": product.get("title", ""),
                    "Body (HTML)": product.get("description", ""),
                    "Variant Price": product.get("price", ""),
                    "Image Src": product.get("image", ""),
                    "Status": "active",
                }
                writer.writerow(row)
    
    @staticmethod
    def write_json(
        data: Dict[str, Any],
        output_path: Path,
        job_id: str,
        source_url: Optional[str] = None
    ):
        """
        Write data to JSON file with metadata
        
        Args:
            data: Scrape result data
            output_path: Output file path
            job_id: Job identifier
            source_url: Source URL
        """
        output = {
            "job_id": job_id,
            "timestamp": datetime.utcnow().isoformat(),
            "source_url": source_url,
            "data": data,
        }
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(output, f, indent=2, ensure_ascii=False)
    
    @staticmethod
    def generate_filename(
        job_name: str,
        format_type: str = "json",
        timestamp: Optional[datetime] = None
    ) -> str:
        """
        Generate deterministic filename
        
        Args:
            job_name: Job name
            format_type: File format ('json', 'csv', 'shopify')
            timestamp: Timestamp (defaults to now)
        
        Returns:
            Filename string
        """
        if timestamp is None:
            timestamp = datetime.utcnow()
        
        timestamp_str = timestamp.strftime("%Y%m%d_%H%M%S")
        ext = "csv" if format_type in ("csv", "shopify") else "json"
        return f"{job_name}_{timestamp_str}.{ext}"
