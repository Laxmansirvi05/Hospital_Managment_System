import { test, expect } from '@playwright/test';

const baseURL = process.env.CAREROUTE_BASE_URL || 'http://127.0.0.1:4000';

for (const route of ['/signin/', '/signup/']) {
  test(`${route} keeps the intro video out of the initial page transfer`, async ({ page }) => {
    const videoRequests = [];
    page.on('request', (request) => {
      if (/careroute-ambulance-720p\.mp4|careroute_ambulance_4K\.mp4/.test(request.url())) videoRequests.push(request.url());
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${baseURL}${route}`, { waitUntil: 'load' });

    const initialTransferBytes = await page.evaluate(() => performance.getEntriesByType('resource')
      .reduce((total, entry) => total + (entry.transferSize || 0), 0));
    expect(initialTransferBytes).toBeLessThan(1_000_000);
    expect(videoRequests).toEqual([]);
    await expect(page.locator('.auth-video')).toHaveAttribute('preload', 'none');
    await expect(page.locator('.auth-video')).toHaveAttribute('poster', '/assets/careroute-ambulance-poster.webp');
  });
}
