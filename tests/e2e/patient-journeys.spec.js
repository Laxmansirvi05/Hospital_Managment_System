import { mkdirSync } from 'node:fs';
import { test, expect } from '@playwright/test';

const baseURL = process.env.CAREROUTE_BASE_URL || 'http://127.0.0.1:4000';
const widths = [390, 820, 1440];

async function api(page, path, method = 'GET', body) {
  return page.evaluate(async ({ path, method, body }) => {
    const response = await fetch(`/api/v1${path}`, {
      method,
      credentials: 'same-origin',
      headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(method === 'GET' ? {} : { 'x-careroute-csrf': '1' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    let value = null;
    try { value = text ? JSON.parse(text) : null; } catch { value = text; }
    return { status: response.status, body: value };
  }, { path, method, body });
}

test('patient account and care records work in sample mode at phone, tablet and desktop widths', async ({ page }) => {
  test.setTimeout(180000);
  await page.route('https://**/*', (route) => route.abort());
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `10.80.0.${Math.floor(Math.random() * 200) + 1}` });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseURL}/signup/`);
  await page.locator('input[autocomplete="name"]').fill('Journey Patient');
  const email = `journey-${Date.now()}@example.test`;
  await page.locator('input[autocomplete="email"]').fill(email);
  await page.locator('input[autocomplete="new-password"]').fill('journey-password-123');
  await page.getByRole('checkbox', { name: /agree to the terms/i }).check();
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL(/medical-id/);
  await expect(page.getByText(/Sample data mode/)).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${baseURL}/search/medicines/`);
  await expect(page.locator('#mode-banner')).toContainText('Listings and prices are examples only, not current provider information.');
  mkdirSync('docs/audit/evidence-codex-2026-11-06', { recursive: true });
  await page.screenshot({ path: 'docs/audit/evidence-codex-2026-11-06/sample-price-warning-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseURL}/medical-id/`);

  await page.getByLabel('Full name').fill('Journey Patient');
  await page.getByLabel('Preferred language').fill('English');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Medical ID saved')).toBeVisible({ timeout: 10000 });

  await page.getByLabel('Name', { exact: true }).fill('Journey Contact');
  await page.getByLabel('Mobile number').fill('9876543210');
  await page.getByLabel('Relation').selectOption({ label: 'Friend' });
  await page.getByRole('button', { name: 'Add contact' }).click();
  await expect(page.getByText('Journey Contact')).toBeVisible();
  await page.getByRole('button', { name: 'Remove Journey Contact' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByRole('button', { name: 'Remove Journey Contact' })).toHaveCount(0);
  expect((await api(page, '/patients/me/contacts')).body.contacts).toHaveLength(0);

  const today = new Date().toISOString().slice(0, 10);
  await page.goto(`${baseURL}/reminders/`);
  await page.getByRole('button', { name: 'Add reminder' }).click();
  await page.getByLabel('Medicine').fill('Sample vitamin');
  await page.getByLabel('Dose').fill('1 tablet');
  await page.getByLabel('Start date').fill(today);
  await page.getByRole('button', { name: 'Add reminder', exact: true }).last().click();
  await expect(page.getByText('Sample vitamin')).toBeVisible();
  const reminder = await api(page, '/patients/me/reminders');
  expect(reminder.status).toBe(200);
  const reminderId = reminder.body.reminders.find((r) => r.medicineName === 'Sample vitamin').id;
  const dose = await api(page, `/patients/me/reminders/${reminderId}/doses`, 'POST', { date: today, time: '08:00', status: 'taken' });
  expect(dose.status).toBe(200);
  await page.goto(`${baseURL}/dashboard/`);
  await expect(page.getByText('Taken', { exact: true })).toBeVisible();
  await page.goto(`${baseURL}/reminders/`);
  await page.getByRole('button', { name: 'Edit' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText('Sample vitamin')).toHaveCount(0);
  expect((await api(page, '/patients/me/reminders')).body.reminders).toHaveLength(0);

  await page.goto(`${baseURL}/appointments/#new`);
  await page.getByLabel('Doctor').fill('Journey Doctor');
  await page.getByLabel('Hospital or clinic').fill('Journey Clinic');
  await page.getByLabel('Date').fill(today);
  await page.getByLabel('Time').fill('10:30');
  await page.locator('#new').getByRole('button', { name: 'Log appointment' }).click();
  await expect(page.getByText('Journey Doctor')).toBeVisible();

  const hospitals = await api(page, '/hospitals?limit=1');
  expect(hospitals.status).toBe(200);
  expect(hospitals.body.hospitals.length).toBeGreaterThan(0);
  const hospital = hospitals.body.hospitals[0];
  await expect((await api(page, '/reviews?kind=hospital&id=' + hospital.id)).status).toBe(200);
  const posted = await api(page, '/reviews', 'PUT', { kind: 'hospital', id: hospital.id, rating: 4, body: 'Journey review v1' });
  expect(posted.status).toBe(200);
  const edited = await api(page, '/reviews', 'PUT', { kind: 'hospital', id: hospital.id, rating: 5, body: 'Journey review edited' });
  expect(edited.body.body).toBe('Journey review edited');
  const removed = await api(page, `/reviews/${edited.body.id}`, 'DELETE');
  expect(removed.status).toBe(204);
  expect((await api(page, `/reviews?kind=hospital&id=${hospital.id}`)).body.reviews).toHaveLength(0);

  await page.goto(`${baseURL}/documents/`);
  await page.locator('#doc-file').setInputFiles({ name: 'journey.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 synthetic sample') });
  await page.getByLabel('Title').fill('Journey report');
  await page.getByRole('button', { name: 'Upload' }).click();
  await expect(page.getByText('Journey report')).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: 'Delete Journey report' }).click();
  await page.getByRole('dialog').getByRole('button', { name: /delete/i }).click();
  await expect(page.getByText('Journey report')).toHaveCount(0);
  expect((await api(page, '/patients/me/reports')).body.reports).toHaveLength(0);

  await page.goto(`${baseURL}/settings/`);
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await page.getByRole('switch', { name: /Larger text/ }).click();
  await expect(page.locator('html')).toHaveClass(/text-large/);
  await page.goto(`${baseURL}/account/`);
  await expect(page.getByRole('heading', { name: 'Account and privacy' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Devices' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out other devices' }).click();
  await expect(page.getByText(/Signed out on all other devices/)).toBeVisible();

  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['/dashboard/', '/medical-id/', '/reminders/', '/appointments/', '/documents/', '/settings/', '/account/']) {
      await page.goto(`${baseURL}${path}`);
      await expect(page.locator('main')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      if (width === 1440) {
        mkdirSync('docs/audit/evidence-codex-2026-11-06', { recursive: true });
        await page.screenshot({ path: `docs/audit/evidence-codex-2026-11-06/${path.slice(1, -1)}-desktop.png`, fullPage: true });
      }
    }
  }

  await page.goto(`${baseURL}/account/`);
  await page.getByLabel('Current password').fill('journey-password-123');
  await page.getByLabel('New password').fill('journey-password-456');
  await page.getByRole('button', { name: 'Change password' }).click();
  await expect(page.getByText(/Password changed/)).toBeVisible();

  await page.getByLabel('Your password').fill('journey-password-456');
  await page.getByLabel('Type DELETE to confirm').fill('DELETE');
  await page.getByRole('button', { name: 'Delete my account' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete everything' }).click();
  await page.waitForURL(/\/signin\//);
  const afterDelete = await api(page, '/auth/me');
  expect(afterDelete.status).toBe(401);
  await page.goto(`${baseURL}/signup/`);
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});
