import { mkdirSync } from 'node:fs';
import { test, expect } from '@playwright/test';

const baseURL = process.env.CAREROUTE_BASE_URL || 'http://127.0.0.1:4000';

test('the dedicated doctors search route opens the doctor tab in memory mode', async ({ page }) => {
  await page.route('https://**/*', (route) => route.abort());
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `10.81.0.${Math.floor(Math.random() * 200) + 1}` });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${baseURL}/signup/`);
  await page.locator('input[autocomplete="name"]').fill('Doctor Route Patient');
  await page.locator('input[autocomplete="email"]').fill(`doctor-route-${Date.now()}@example.test`);
  await page.locator('input[autocomplete="new-password"]').fill('doctor-route-password-123');
  await page.getByRole('checkbox', { name: /agree to the terms/i }).check();
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL(/medical-id/);

  const response = await page.goto(`${baseURL}/search/doctors/`);
  expect(response?.status()).toBe(200);
  await expect(page.locator('[data-search-tab="doctors"]').first()).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Doctors' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: 'Hospitals and doctors' })).toBeVisible();

  mkdirSync('test-results/evidence', { recursive: true });
  await page.screenshot({ path: 'test-results/evidence/doctors-search-desktop.png', fullPage: true });
});
