import { test, expect } from '@playwright/test';

const baseURL = process.env.CAREROUTE_BASE_URL || 'http://127.0.0.1:4000';

test('public pages have no CSP violations while their scripts render', async ({ page }) => {
  const violations = [];
  page.on('console', (message) => {
    if (/content security policy|refused to apply inline style/i.test(message.text())) violations.push(message.text());
  });
  for (const route of ['/', '/signin/', '/signup/', '/privacy/', '/terms/']) {
    await page.goto(`${baseURL}${route}`);
    await expect(page.locator('body')).toBeVisible();
  }
  expect(violations).toEqual([]);
});

test('signed-in dashboard has no runtime style CSP violation', async ({ page }) => {
  const violations = [];
  page.setDefaultTimeout(10_000);
  page.on('console', (message) => {
    if (/content security policy|refused to apply inline style/i.test(message.text())) violations.push(message.text());
  });
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `10.81.0.${Math.floor(Math.random() * 200) + 1}` });
  await page.goto(`${baseURL}/signup/`);
  await page.locator('input[autocomplete="name"]').fill('CSP Sample Patient');
  await page.locator('input[autocomplete="email"]').fill(`csp-${Date.now()}@example.test`);
  await page.locator('input[autocomplete="new-password"]').fill('csp-sample-password-123');
  await page.getByRole('checkbox', { name: /agree to the terms/i }).check();
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL(/medical-id/);
  await page.goto(`${baseURL}/dashboard/`);
  await expect(page.locator('main')).toBeVisible();
  expect(violations).toEqual([]);
});
