#!/usr/bin/env python3
"""
Test script for scraping API (Python version)
Usage: python3 scripts/test-scrape.py <url> [modules...]
Example: python3 scripts/test-scrape.py "https://www2.hm.com/en_us/men/sale/view-all.html" products images
"""

import sys
import json
import requests
import time
from typing import List, Dict, Any

API_URL = "http://localhost:3000"

def test_scrape(url: str, modules: List[str]) -> None:
    """Test the scrape API endpoint"""
    print(f"\n🧪 Testing scrape: {url}")
    print(f"📦 Modules: {', '.join(modules)}\n")
    
    try:
        start_time = time.time()
        response = requests.post(
            f"{API_URL}/api/scrape",
            json={
                "url": url,
                "modules": modules,
            },
            headers={"Content-Type": "application/json"},
            timeout=60,
        )
        
        duration = int((time.time() - start_time) * 1000)
        
        if not response.ok:
            print(f"❌ Error: {response.status_code} {response.text[:200]}")
            sys.exit(1)
        
        data = response.json()
        
        if not data.get("success"):
            print(f"❌ Scrape failed: {data.get('error', 'Unknown error')}")
            sys.exit(1)
        
        print(f"✅ Success ({duration}ms)\n")
        
        results = data.get("data", {})
        
        # Products
        if "products" in results:
            products = results["products"]
            print(f"📦 Products: {len(products)}")
            if products:
                sample = products[0]
                print("   Sample:", {
                    "title": (sample.get("title") or "")[:50] or "N/A",
                    "price": sample.get("price") or "N/A",
                    "hasImage": bool(sample.get("image")),
                    "hasLink": bool(sample.get("link")),
                })
        
        # Images
        if "images" in results:
            print(f"🖼️  Images: {len(results['images'])}")
        
        # Contacts
        if "contacts" in results:
            contacts = results["contacts"]
            emails = contacts.get("emails", [])
            phones = contacts.get("phones", [])
            socials = contacts.get("socials", [])
            print(f"📧 Contacts: {len(emails)} emails, {len(phones)} phones, {len(socials)} socials")
        
        # Text
        if "text" in results:
            text = results["text"]
            headings = text.get("headings", [])
            paragraphs = text.get("paragraphs", [])
            print(f"📝 Text: {len(headings)} headings, {len(paragraphs)} paragraphs")
        
        # Assets
        if "assets" in results:
            print(f"📎 Assets: {len(results['assets'])}")
        
        # Crawl
        if "crawl" in results:
            print(f"🔗 Links: {len(results['crawl'])}")
        
        print("\n")
        
    except requests.exceptions.ConnectionError:
        print("❌ Connection error: Could not connect to API")
        print("\nMake sure the dev server is running: npm run dev")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 scripts/test-scrape.py <url> [modules...]")
        sys.exit(1)
    
    url = sys.argv[1]
    modules = sys.argv[2:] if len(sys.argv) > 2 else ["products"]
    
    test_scrape(url, modules)
