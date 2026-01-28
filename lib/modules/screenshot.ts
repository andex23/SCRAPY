import { Page } from 'playwright';
import { ScreenshotData } from '@/types';

export async function extractScreenshot(
  page: Page,
  url: string,
  options: { fullPage?: boolean; viewport?: boolean } = { fullPage: true, viewport: true }
): Promise<ScreenshotData> {
  const screenshots: ScreenshotData = {
    url,
    timestamp: Date.now(),
  };

  try {
    if (options.fullPage) {
      const fullPageBuffer = await page.screenshot({
        fullPage: true,
        type: 'png',
      });
      screenshots.fullPage = fullPageBuffer.toString('base64');
    }

    if (options.viewport) {
      const viewportBuffer = await page.screenshot({
        fullPage: false,
        type: 'png',
      });
      screenshots.viewport = viewportBuffer.toString('base64');
    }
  } catch (error) {
    console.error('Screenshot error:', error);
    throw error;
  }

  return screenshots;
}
