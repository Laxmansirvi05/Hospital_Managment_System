import { test, expect } from '@playwright/test';

const baseURL = process.env.CAREROUTE_BASE_URL || 'http://127.0.0.1:4000';

// Live location (2026-11-04), with a simulated device position: Kukatpally, then a move.
test.use({ permissions: ['geolocation'], geolocation: { latitude: 17.4933, longitude: 78.3996 }, viewport: { width: 1440, height: 900 } });

async function signUp(page) {
  // Each sign-up comes from its own address, so the per-address sign-up limit (10 an hour) is not
  // used up by the suite. The local server honours this header only when started with TRUST_PROXY=true.
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` });
  await page.goto(`${baseURL}/signup/`);
  await page.locator('input[autocomplete="name"]').fill('Location Test');
  await page.locator('input[autocomplete="email"]').fill(`loc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.test`);
  await page.locator('input[autocomplete="new-password"]').fill('long enough password');
  await page.getByRole('checkbox', { name: /agree to the terms/i }).check();
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL(/medical-id/);
}

test('live location sorts results, follows a move, carries across pages and shows on real maps', async ({ page, context }) => {
  await signUp(page);
  await page.goto(`${baseURL}/dashboard/`);
  await page.getByRole('button', { name: 'Use my live location' }).first().click();
  await expect(page.locator('.loc-text').first()).toHaveText(/live location, near Kukatpally/);
  await expect(page.locator('.near-card .near-main').first()).toContainText('km');

  await page.goto(`${baseURL}/search/diagnostics/`);
  // The choice carries over: no new click, still live.
  await expect(page.locator('.loc-text')).toHaveText(/live location, near Kukatpally/);
  await expect(page.locator('.loc-live')).toBeVisible();
  await expect(page.locator('.rmap .rmap-you')).toBeVisible();
  // OpenStreetMap answers a tile request without a Referer with a 403 "Access blocked" tile
  // (seen on 2026-11-04), so map tiles must keep the site's referrer policy.
  await expect(page.locator('img.rmap-tile').first()).toHaveAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
  await expect(page.locator('.results-card .list a').first()).toContainText('Kukatpally');

  await context.setGeolocation({ latitude: 17.4126, longitude: 78.4392 });
  await expect(page.locator('.loc-text')).not.toHaveText(/Kukatpally/, { timeout: 70000 });
  await expect(page.locator('.results-card .list a').first()).not.toContainText('Kukatpally');

  await page.locator('.results-card .list a').first().click();
  await expect(page.locator('.hero-detail .rmap')).toBeVisible();
  await expect(page.getByText(/in a straight line from your live location/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Nearby diagnostic centres' })).toBeVisible();

  await page.goto(`${baseURL}/explore/`);
  await expect(page.locator('.geo-origin')).toBeVisible({ timeout: 15000 });
});

test('choosing an area replaces live location, and stopping returns to the default', async ({ page }) => {
  await signUp(page);
  await page.goto(`${baseURL}/search/hospitals/`);
  const firstRow = page.locator('.results-card .list a').first();
  await expect(firstRow).toBeVisible();
  const before = await firstRow.textContent();
  await page.getByRole('combobox', { name: 'Choose an area' }).selectOption('Gachibowli');
  await expect(page.locator('.loc-text')).toHaveText('Distances from Gachibowli');
  // Re-sorted from Gachibowli: the nearest place is no longer the one nearest Begumpet.
  await expect(firstRow).not.toHaveText(before);
  await page.goto(`${baseURL}/settings/`);
  await page.getByRole('button', { name: /Reset to Begumpet/ }).click();
  await expect(page.locator('.loc-text')).toHaveText('Distances from Begumpet (default)');
});
