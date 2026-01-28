import { Page } from 'playwright';
import { AssetData } from '@/types';

export async function extractAssets(page: Page): Promise<AssetData[]> {
  const assets = await page.evaluate(() => {
    const assetData: AssetData[] = [];
    const assetExtensions = ['pdf', 'zip', 'mp4', 'docx', 'doc', 'csv', 'xlsx', 'xls', 'pptx', 'ppt', 'mp3', 'wav', 'avi', 'mov'];

    document.querySelectorAll('a[href]').forEach((link) => {
      const href = link.getAttribute('href');
      if (!href) return;

      const url = href.toLowerCase();
      const extension = url.split('.').pop()?.split('?')[0];

      if (extension && assetExtensions.includes(extension)) {
        const filename = href.split('/').pop()?.split('?')[0] || 'unknown';
        
        assetData.push({
          filename,
          url: href,
          type: extension,
        });
      }
    });

    return assetData;
  });

  return assets.slice(0, 50); // Limit to 50 assets
}

