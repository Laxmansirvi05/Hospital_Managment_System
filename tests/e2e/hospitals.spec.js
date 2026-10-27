import { test, expect } from '@playwright/test';

const baseURL = process.env.CAREROUTE_BASE_URL || 'http://127.0.0.1:4000';

async function createAccount(page) {
  await page.goto(`${baseURL}/signup/`);
  await page.locator('input[autocomplete="name"]').fill('Directory User');
  await page.locator('input[autocomplete="email"]').fill(`user-${Date.now()}@example.test`);
  await page.locator('input[autocomplete="new-password"]').fill('long enough password');
  await page.getByRole('checkbox', { name: /agree to the terms/i }).check();
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL(/medical-id/, { timeout: 10000 });
}

test.describe('Hospitals and doctors page refinement', () => {
  let authState;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await createAccount(page);
    authState = await context.storageState();
    await context.close();
  });

  test.beforeEach(async ({ context }) => {
    await context.addCookies(authState.cookies);
  });

  test('desktop renders exactly 2 columns of spacious facility cards', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${baseURL}/search/hospitals/`);

    // Wait for cards to render
    await expect(page.locator('.results-card')).toBeVisible();
    const cards = page.locator('.facility-card');
    await expect(cards.first()).toBeVisible({ timeout: 10000 });

    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(2);

    // Verify grid template columns has exactly 2 columns
    const list = page.locator('.results-card .list');
    const gridColumns = await list.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.gridTemplateColumns.split(' ').length;
    });
    expect(gridColumns).toBe(2);

    // Verify first two cards have equal width
    const firstBox = await cards.nth(0).boundingBox();
    const secondBox = await cards.nth(1).boundingBox();
    expect(firstBox).not.toBeNull();
    expect(secondBox).not.toBeNull();
    expect(Math.abs(firstBox.width - secondBox.width)).toBeLessThanOrEqual(2);

    // Verify facility card elements: logo, name, locality, badge, distance, chevron
    const firstCard = cards.first();
    await expect(firstCard.locator('.facility-card-media')).toBeVisible();
    await expect(firstCard.locator('.facility-card-name')).toBeVisible();
    await expect(firstCard.locator('.facility-badge').first()).toBeVisible();
    await expect(firstCard.locator('.facility-card-trail')).toBeVisible();

    // Verify link and ID preservation
    const href = await firstCard.getAttribute('href');
    expect(href).toMatch(/^\/hospital\/\?id=/);

    // Verify map is visible on desktop right side
    await expect(page.locator('.map3d, .geo-map')).toBeVisible();

    // Capture desktop screenshot
    await page.screenshot({ path: 'test-results/hospitals-desktop.png', fullPage: false });
  });

  test('tablet displays 2 columns and mobile displays 1 column', async ({ page }) => {
    // Tablet viewport
    await page.setViewportSize({ width: 820, height: 1024 });
    await page.goto(`${baseURL}/search/hospitals/`);
    await expect(page.locator('.facility-card').first()).toBeVisible({ timeout: 10000 });

    const tabletColumns = await page.locator('.results-card .list').evaluate((el) => {
      return window.getComputedStyle(el).gridTemplateColumns.split(' ').length;
    });
    expect(tabletColumns).toBe(2);
    await page.screenshot({ path: 'test-results/hospitals-tablet.png', fullPage: false });

    // Mobile viewport
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);

    const mobileColumns = await page.locator('.results-card .list').evaluate((el) => {
      return window.getComputedStyle(el).gridTemplateColumns.split(' ').length;
    });
    expect(mobileColumns).toBe(1);
    await page.screenshot({ path: 'test-results/hospitals-mobile.png', fullPage: false });
  });

  test('filters, search, and tab switching continue to function correctly', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${baseURL}/search/hospitals/`);
    await expect(page.locator('.facility-card').first()).toBeVisible({ timeout: 10000 });

    // Switch to Doctors tab
    await page.getByRole('tab', { name: 'Doctors' }).click();
    await expect(page.locator('.list-row.lift').first()).toBeVisible({ timeout: 10000 });
    expect(page.url()).toContain('tab=doctors');

    // Switch back to Hospitals tab
    await page.getByRole('tab', { name: 'Hospitals' }).click();
    // Test search filter using a real hospital name from the active dataset
    const firstName = await page.locator('.facility-card-name').first().textContent();
    const searchTerm = firstName.trim().split(/[\s,]+/)[0];
    const input = page.locator('#q');
    await input.fill(searchTerm);
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.locator('.facility-card-name').first()).toContainText(searchTerm, { timeout: 10000 });
  });
});
