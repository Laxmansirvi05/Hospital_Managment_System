import { test, expect } from '@playwright/test';

const baseURL = process.env.CAREROUTE_BASE_URL || 'http://127.0.0.1:4403';
const pdf = Buffer.from('%PDF-1.4 synthetic private report\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF');

async function createAccount(page) {
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `10.95.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200) + 1}` });
  await page.goto(`${baseURL}/signup/`);
  await page.locator('input[autocomplete="name"]').fill('Private Document Patient');
  await page.getByLabel('Email address').fill(`private-document-${Date.now()}@example.test`);
  await page.locator('input[autocomplete="new-password"]').fill('private-document-password-123');
  await page.getByRole('checkbox', { name: /agree to the terms/i }).check();
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL(/medical-id/);
}

test('patient can upload, open the short-lived private download and delete a report', async ({ page }) => {
  test.setTimeout(60000);
  await page.route('https://**/*', (route) => route.abort());
  await page.setViewportSize({ width: 390, height: 844 });
  await createAccount(page);
  await page.goto(`${baseURL}/documents/`);
  await page.locator('#doc-file').setInputFiles({ name: 'synthetic-report.pdf', mimeType: 'application/pdf', buffer: pdf });
  await page.getByLabel('Title').fill('Private synthetic report');
  await page.getByLabel('Type').selectOption('lab');
  await page.getByRole('button', { name: 'Upload' }).click();
  await expect(page.getByText('Private synthetic report')).toBeVisible();
  await expect(page.getByText(/Files open with short-lived links and are never public/)).toBeVisible();
  await page.screenshot({ path: 'docs/audit/evidence-codex-2026-11-06/documents-private-mobile.png', fullPage: true });

  await page.evaluate(() => {
    window.__carerouteOpenedFile = null;
    window.open = (url) => { window.__carerouteOpenedFile = String(url); return null; };
  });
  await page.getByRole('button', { name: 'Open Private synthetic report' }).click();
  await page.waitForFunction(() => Boolean(window.__carerouteOpenedFile));
  const downloadUrl = await page.evaluate(() => window.__carerouteOpenedFile);
  expect(downloadUrl).toMatch(/^\/api\/v1\/files\//);

  const downloaded = await page.evaluate(async (url) => {
    const response = await fetch(url, { credentials: 'same-origin' });
    return {
      status: response.status,
      type: response.headers.get('content-type'),
      disposition: response.headers.get('content-disposition'),
      policy: response.headers.get('content-security-policy'),
      nosniff: response.headers.get('x-content-type-options'),
      bytes: Array.from(new Uint8Array(await response.arrayBuffer())),
    };
  }, downloadUrl);
  expect(downloaded).toMatchObject({
    status: 200,
    type: 'application/pdf',
    disposition: 'attachment',
    policy: "default-src 'none'; sandbox",
    nosniff: 'nosniff',
    bytes: Array.from(pdf),
  });

  await page.getByRole('button', { name: 'Delete Private synthetic report' }).click();
  await page.getByRole('dialog').getByRole('button', { name: /delete/i }).click();
  await expect(page.getByText('Private synthetic report')).toHaveCount(0);
  await expect(page.getByText('No documents yet')).toBeVisible();
  await page.screenshot({ path: 'docs/audit/evidence-codex-2026-11-06/documents-empty-after-delete-mobile.png', fullPage: true });
});
