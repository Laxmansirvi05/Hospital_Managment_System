import { test, expect } from '@playwright/test';

const baseURL = process.env.CAREROUTE_BASE_URL || 'http://127.0.0.1:4000';

async function createAccount(page) {
  await page.goto(`${baseURL}/signup/`);
  await page.locator('input[autocomplete="name"]').fill('Explore Browser Test');
  await page.locator('input[autocomplete="email"]').fill(`explore-${Date.now()}@example.test`);
  await page.locator('input[autocomplete="tel"]').fill('9876500013');
  await page.locator('input[autocomplete="new-password"]').fill('long enough');
  await page.getByRole('checkbox', { name: /agree to the terms/i }).check();
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL(/medical-id/);
}

test.describe('Explore Hyderabad map interactions', () => {
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

  test('supports map navigation, filters, selection, and safe facility actions', async ({ page }) => {
    const errors = [];
    let monitoring = false;
    page.on('console', (message) => { if (monitoring && message.type() === 'error') errors.push(`console: ${message.text()}`); });
    page.on('pageerror', (error) => { if (monitoring) errors.push(`pageerror: ${error.message}${error.stack ? `\n${error.stack}` : ''}`); });
    page.on('requestfailed', (request) => { if (monitoring) errors.push(`request: ${request.url()} ${request.failure()?.errorText || ''}`); });

    await page.goto(`${baseURL}/explore/`);
    monitoring = true;
    await expect(page.locator('.geo-map')).toBeVisible();
    await expect(page.locator('.geo-map-attribution')).toContainText('OpenStreetMap');
    await expect(page.locator('.geo-map-count')).toContainText('19 mapped locations');

    const initialTile = await page.locator('.geo-map-tile-base').first().getAttribute('src');
    await page.getByRole('button', { name: 'Zoom in' }).click();
    await page.waitForTimeout(350);
    const zoomedTile = await page.locator('.geo-map-tile-base').first().getAttribute('src');
    expect(zoomedTile).not.toBe(initialTile);
    await page.getByRole('button', { name: 'Zoom out' }).click();
    await page.waitForTimeout(350);
    await page.getByRole('button', { name: 'Reset' }).click();
    await page.waitForTimeout(150);
    expect(await page.locator('.geo-map-tile-base').first().getAttribute('src')).toContain('/10/');

    await page.context().grantPermissions(['geolocation'], { origin: baseURL });
    await page.context().setGeolocation({ latitude: 17.4065, longitude: 78.4772 });
    await page.getByRole('button', { name: 'Use current location' }).click();
    await expect(page.locator('.geo-origin')).toBeVisible();

    for (let i = 0; i < 4; i += 1) {
      await page.getByRole('button', { name: 'Zoom out' }).click();
      await page.waitForTimeout(120);
    }
    await expect(page.locator('.geo-cluster').first()).toBeVisible();
    const clusterTile = await page.locator('.geo-map-tile-base').first().getAttribute('src');
    await page.locator('.geo-cluster').first().click();
    await page.waitForTimeout(350);
    expect(await page.locator('.geo-map-tile-base').first().getAttribute('src')).not.toBe(clusterTile);
    await page.getByRole('button', { name: 'Reset' }).click();

    const hospitalFilter = page.locator('.geo-filter-blue');
    await hospitalFilter.click();
    await expect(hospitalFilter).toHaveAttribute('aria-pressed', 'false');
    expect(await page.locator('.geo-map-count').textContent()).not.toBe('19 mapped locations');
    await hospitalFilter.click();
    await expect(hospitalFilter).toHaveAttribute('aria-pressed', 'true');
    expect(await page.locator('.geo-marker, .geo-cluster').count()).toBeGreaterThan(0);

    await page.getByRole('button', { name: 'Satellite' }).click();
    await expect(page.locator('.geo-map-tile-base').first()).toHaveAttribute('src', /World_Imagery/);
    await page.getByRole('button', { name: 'Hybrid' }).click();
    await expect(page.locator('.geo-map-tile-places').first()).toHaveAttribute('src', /World_Boundaries_and_Places/);
    await page.getByRole('button', { name: 'Map' }).click();

    const viewport = page.locator('.geo-map-viewport');
    const beforeWheel = await page.locator('.geo-map-tile-base').first().getAttribute('src');
    await viewport.evaluate((node) => node.dispatchEvent(new WheelEvent('wheel', { deltaY: 12, clientX: 300, clientY: 220, bubbles: true, cancelable: true })));
    await page.waitForTimeout(220);
    const afterSmallWheel = await page.locator('.geo-map-tile-base').first().getAttribute('src');
    expect(afterSmallWheel).not.toBe(beforeWheel);

    const fullscreen = page.getByRole('button', { name: 'Full screen' });
    await fullscreen.click();
    await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false);

    const search = page.getByRole('searchbox', { name: 'Search facilities or Hyderabad localities' });
    await search.fill('Lakeview');
    await page.getByRole('button', { name: /Lakeview Multispeciality Hospital/ }).click();
    await expect(page.getByRole('dialog', { name: /Lakeview Multispeciality Hospital details/ })).toBeVisible();
    await expect(page.getByRole('dialog')).toContainText('Begumpet');
    await expect(page.getByRole('dialog').getByRole('link', { name: 'Call' })).toHaveAttribute('href', 'tel:+914040001201');
    await expect(page.getByRole('dialog').getByRole('link', { name: /Directions/ })).toHaveAttribute('href', 'https://www.google.com/maps/dir/?api=1&destination=17.457031,78.4504');
    await expect(page.getByRole('dialog').getByRole('link', { name: 'View details' })).toHaveAttribute('href', /\/hospital\/\?id=0b9c1d2e-0000-4000-8000-000000000001/);
    await expect(page.getByRole('dialog').getByRole('link', { name: 'Website' })).toHaveCount(0);
    await page.screenshot({ path: 'test-results/explore-map-desktop.png', fullPage: true });

    await page.route('https://www.google.com/maps/**', (route) => route.abort());
    const navigationPopup = page.waitForEvent('popup');
    await page.getByRole('dialog').getByRole('link', { name: /Directions/ }).click();
    const popup = await navigationPopup;
    expect(popup.url()).toBe('https://www.google.com/maps/dir/?api=1&destination=17.457031,78.4504');
    await popup.close();

    await page.getByRole('button', { name: 'Close location details' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await search.fill('Lakeview');
    await page.getByRole('button', { name: /Lakeview Multispeciality Hospital/ }).click();
    await page.getByRole('dialog').getByRole('link', { name: 'View details' }).click();
    await expect(page).toHaveURL(/\/hospital\/\?id=0b9c1d2e-0000-4000-8000-000000000001/);
    await expect(page.getByRole('heading', { name: 'Lakeview Multispeciality Hospital' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('keeps the facility panel accessible on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${baseURL}/explore/`);
    await expect(page.locator('.geo-map')).toBeVisible();
    await page.getByRole('searchbox', { name: 'Search facilities or Hyderabad localities' }).fill('Lakeview');
    await page.getByRole('button', { name: /Lakeview Multispeciality Hospital/ }).click();
    const panel = page.getByRole('dialog', { name: /Lakeview Multispeciality Hospital details/ });
    await expect(panel).toBeVisible();
    const bounds = await panel.boundingBox();
    expect(bounds).not.toBeNull();
    const mapBounds = await page.locator('.geo-map-viewport').boundingBox();
    expect(mapBounds).not.toBeNull();
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(mapBounds.y + mapBounds.height - 88);
    await expect(panel.getByRole('link', { name: 'View details' })).toBeVisible();
    await page.screenshot({ path: 'test-results/explore-map-mobile.png', fullPage: true });
  });

  test('opens pharmacy and diagnostic marker details', async ({ page }) => {
    await page.goto(`${baseURL}/explore/`);
    await expect(page.locator('.geo-map')).toBeVisible();
    const search = page.getByRole('searchbox', { name: 'Search facilities or Hyderabad localities' });

    await search.fill('Wellcare');
    await page.getByRole('button', { name: /Wellcare Pharmacy/ }).click();
    await expect(page.getByRole('dialog', { name: /Wellcare Pharmacy details/ })).toBeVisible();
    await expect(page.getByRole('dialog').getByRole('link', { name: 'View details' })).toHaveAttribute('href', /\/pharmacy\/\?id=/);
    await page.getByRole('button', { name: 'Close location details' }).click();

    await search.fill('Clearpath');
    await page.getByRole('button', { name: /Clearpath Diagnostics/ }).click();
    await expect(page.getByRole('dialog', { name: /Clearpath Diagnostics details/ })).toBeVisible();
    await expect(page.getByRole('dialog').getByRole('link', { name: 'View details' })).toHaveAttribute('href', /\/diagnostic\/\?id=/);
  });

  test('shows a localized message when location permission is denied', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'geolocation', {
        configurable: true,
        value: { getCurrentPosition: (_success, failure) => failure({ code: 1, message: 'denied' }) },
      });
    });
    await page.goto(`${baseURL}/explore/`);
    await expect(page.locator('.geo-map')).toBeVisible();
    await page.getByRole('button', { name: 'Use current location' }).click();
    await expect(page.locator('.geo-map-message')).toContainText('Location permission was not granted.');
  });
});
