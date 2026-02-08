#!/usr/bin/env node

/**
 * Test script for scraping API
 * Usage: node scripts/test-scrape.mjs <url> [modules...]
 * Example: node scripts/test-scrape.mjs "https://www2.hm.com/en_us/men/sale/view-all.html" products images
 */

const url = process.argv[2];
const modules = process.argv.slice(3).length > 0 ? process.argv.slice(3) : ['products'];

if (!url) {
  console.error('Usage: node scripts/test-scrape.mjs <url> [modules...]');
  process.exit(1);
}

const API_URL = process.env.API_URL || 'http://localhost:3000';

async function testScrape() {
  console.log(`\n🧪 Testing scrape: ${url}`);
  console.log(`📦 Modules: ${modules.join(', ')}\n`);

  try {
    const startTime = Date.now();
    const response = await fetch(`${API_URL}/api/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        modules,
      }),
    });

    const duration = Date.now() - startTime;
    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Error:', data.error || response.statusText);
      process.exit(1);
    }

    if (!data.success) {
      console.error('❌ Scrape failed:', data.error);
      process.exit(1);
    }

    console.log(`✅ Success (${duration}ms)\n`);

    const results = data.data || {};

    // Products
    if (results.products) {
      console.log(`📦 Products: ${results.products.length}`);
      if (results.products.length > 0) {
        const sample = results.products[0];
        console.log('   Sample:', {
          title: sample.title?.substring(0, 50) || 'N/A',
          price: sample.price || 'N/A',
          hasImage: !!sample.image,
          hasLink: !!sample.link,
        });
      }
    }

    // Images
    if (results.images) {
      console.log(`🖼️  Images: ${results.images.length}`);
    }

    // Videos
    if (results.videos) {
      console.log(`🎬 Videos: ${results.videos.length}`);
    }

    // Contacts
    if (results.contacts) {
      const { emails, phones, socials } = results.contacts;
      console.log(`📧 Contacts: ${emails?.length || 0} emails, ${phones?.length || 0} phones, ${socials?.length || 0} socials`);
    }

    // Text
    if (results.text) {
      console.log(`📝 Text: ${results.text.headings?.length || 0} headings, ${results.text.paragraphs?.length || 0} paragraphs`);
    }

    // Assets
    if (results.assets) {
      console.log(`📎 Assets: ${results.assets.length}`);
    }

    // Crawl
    if (results.crawl) {
      console.log(`🔗 Links: ${results.crawl.length}`);
    }

    console.log('\n');
  } catch (error) {
    console.error('❌ Network error:', error.message);
    console.error('\nMake sure the dev server is running: npm run dev');
    process.exit(1);
  }
}

testScrape();
