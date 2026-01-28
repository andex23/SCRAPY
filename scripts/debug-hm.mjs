#!/usr/bin/env node

/**
 * Debug script specifically for H&M product pages
 * This will show what the scraper sees on the page
 */

const url = process.argv[2] || 'https://www2.hm.com/en_us/men/sale/view-all.html';
const API_URL = process.env.API_URL || 'http://localhost:3000';

async function debugHM() {
  console.log(`\n🔍 Debugging H&M page: ${url}\n`);

  try {
    const response = await fetch(`${API_URL}/api/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        modules: ['products', 'images'],
      }),
    });

    const data = await response.json();

    console.log('Response status:', response.status);
    console.log('Success:', data.success);
    
    if (data.error) {
      console.log('❌ Error:', data.error);
    }

    const results = data.data || {};
    
    console.log('\n📊 Results:');
    console.log('Products:', results.products?.length || 0);
    console.log('Images:', results.images?.length || 0);
    
    if (results.products && results.products.length > 0) {
      console.log('\n✅ Sample products:');
      results.products.slice(0, 3).forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.title?.substring(0, 50)}`);
        console.log(`     Price: ${p.price || 'N/A'}`);
        console.log(`     Link: ${p.link?.substring(0, 60) || 'N/A'}`);
        console.log(`     Image: ${p.image ? 'Yes' : 'No'}`);
      });
    } else {
      console.log('\n⚠️  No products found!');
      console.log('\nPossible reasons:');
      console.log('1. Page requires JavaScript that hasn\'t loaded');
      console.log('2. Products are loaded via API calls (check Network tab)');
      console.log('3. Page structure doesn\'t match our selectors');
      console.log('4. Geo-block or bot detection');
      console.log('\nCheck the server console for debug logs.');
    }

    console.log('\n');
  } catch (error) {
    console.error('❌ Network error:', error.message);
    console.error('\nMake sure the dev server is running: npm run dev');
    process.exit(1);
  }
}

debugHM();
