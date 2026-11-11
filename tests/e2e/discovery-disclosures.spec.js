import { test, expect } from '@playwright/test';

const baseURL = process.env.CAREROUTE_BASE_URL || 'http://127.0.0.1:4403';
const IDs = {
  hospital: '0b9c1d2e-0000-4000-8000-000000000001',
  doctor: '1c8d2e3f-0000-4000-8000-000000000001',
  medicine: '4f705162-0000-4000-8000-000000000001',
  pharmacy: '2d7e3f40-0000-4000-8000-000000000001',
  diagnostic: '3e6f4051-0000-4000-8000-000000000001',
};

async function createAccount(page) {
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `10.94.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200) + 1}` });
  await page.goto(`${baseURL}/signup/`);
  await page.locator('input[autocomplete="name"]').fill('Discovery Browser Patient');
  await page.getByLabel('Email address').fill(`discovery-${Date.now()}@example.test`);
  await page.locator('input[autocomplete="new-password"]').fill('discovery-browser-password-123');
  await page.getByRole('checkbox', { name: /agree to the terms/i }).check();
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL(/medical-id/);
}

async function expectSafeOutboundLinks(page) {
  const links = page.locator('a[target="_blank"]');
  const count = await links.count();
  for (let i = 0; i < count; i += 1) {
    const link = links.nth(i);
    const href = await link.getAttribute('href');
    const rel = (await link.getAttribute('rel') || '').split(/\s+/);
    expect(href).toMatch(/^https?:\/\//i);
    expect(rel).toContain('noopener');
    expect(rel).toContain('noreferrer');
  }
  return count;
}

test.describe('Discovery source and provider disclosures', () => {
  let authState;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.route('https://**/*', (route) => route.abort());
    await createAccount(page);
    authState = await context.storageState();
    await context.close();
  });

  test.beforeEach(async ({ context }) => {
    await context.route('https://**/*', (route) => route.abort());
    await context.addCookies(authState.cookies);
  });

  test('facility, doctor and medicine details disclose sources and safe outbound links', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const cases = [
      { path: `/hospital/?id=${IDs.hospital}`, source: true, screenshot: 'discovery-provider-hospital-desktop.png' },
      { path: `/doctor/?id=${IDs.doctor}`, source: true },
      { path: `/pharmacy/?id=${IDs.pharmacy}`, source: true },
      { path: `/diagnostic/?id=${IDs.diagnostic}`, source: true },
      { path: `/medicine/?id=${IDs.medicine}`, source: false, screenshot: 'discovery-provider-medicine-desktop.png' },
    ];
    let outboundCount = 0;

    for (const item of cases) {
      await page.goto(`${baseURL}${item.path}`);
      await expect(page.locator('main .page')).toBeVisible();
      await expect(page.getByText(/Links open the provider’s own website/).first()).toBeVisible();
      if (item.source) await expect(page.getByText(/Source: .*\. Checked on /).first()).toBeVisible();
      else await expect(page.getByText(/Listed price, checked /).first()).toBeVisible();
      outboundCount += await expectSafeOutboundLinks(page);
      if (item.screenshot) await page.screenshot({ path: `test-results/evidence/${item.screenshot}`, fullPage: true });
    }

    expect(outboundCount).toBeGreaterThan(0);
  });

  test('a place without a phone number still offers directions', async ({ page }) => {
    await page.route(`**/api/v1/hospitals/${IDs.hospital}`, async (route) => {
      const response = await route.fetch();
      const hospital = await response.json();
      await route.fulfill({ response, json: { ...hospital, phone: null, website: null } });
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${baseURL}/hospital/?id=${IDs.hospital}`);
    await expect(page.getByText(/No phone number is listed for this place/)).toBeVisible();
    await expect(page.getByRole('link', { name: /Directions to .*Google Maps/ })).toBeVisible();
    await expect(page.locator('a[href^="tel:"]')).toHaveCount(0);
    expect(await page.locator('main').innerText()).not.toMatch(/(^|\n)null(\n|$)/i);
    await page.screenshot({ path: 'test-results/evidence/discovery-no-phone-fallback-mobile.png', fullPage: true });
  });
});
