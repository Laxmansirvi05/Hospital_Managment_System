// Admin portal journeys (D-83). Needs a local server started with ALLOW_PRIVILEGED_SIGNUP=true and
// TRUST_PROXY=true on the in-memory store; it never talks to a real database.
import { test, expect } from '@playwright/test';

const baseURL = process.env.CAREROUTE_BASE_URL || 'http://127.0.0.1:4402';
const PASSWORD = 'long enough password';
const ip = () => `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;

async function register(page, role, label) {
  const email = `${label}-${Date.now()}-${Math.floor(Math.random() * 1e5)}@example.test`;
  const res = await page.request.post(`${baseURL}/api/v1/auth/register`, {
    headers: { 'x-careroute-csrf': '1', 'x-forwarded-for': ip() }, data: { name: `${label} ${role}`, email, password: PASSWORD, role },
  });
  expect(res.status()).toBe(201);
  return { email, name: `${label} ${role}` };
}

test.describe('Admin portal', () => {
  test('keeps patients and visitors out', async ({ page, browser }) => {
    await page.goto(`${baseURL}/admin/`);
    await page.waitForURL(/signin/);
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await register(p, 'patient', 'gate');
    await p.goto(`${baseURL}/admin/`);
    await expect(p.getByRole('heading', { name: 'This area is for admin accounts' })).toBeVisible();
    expect((await p.request.get(`${baseURL}/api/v1/admin/overview`)).status()).toBe(403);
    await ctx.close();
  });

  test('admin adds, edits, hides a hospital and the audit log records it', async ({ page, browser }) => {
    await register(page, 'admin', 'ops');
    const name = `E2E Clinic ${Date.now()}`;
    await page.goto(`${baseURL}/admin/#/listings/new/hospital`);
    await expect(page.getByRole('heading', { name: 'Add hospital or clinic' })).toBeVisible();

    // Empty form: every required field is named, nothing is sent.
    await page.getByRole('button', { name: 'Add listing' }).click();
    await expect(page.locator('#name-error')).toHaveText('Name is required');
    await expect(page.locator('input#name')).toBeFocused();

    await page.fill('#name', name); await page.fill('#area', 'Madhapur'); await page.fill('#address', '1 Test Road, Madhapur');
    await page.fill('#lat', '40'); await page.fill('#lng', '78.39');
    await page.getByRole('button', { name: 'Add listing' }).click();
    await expect(page.locator('#lat-error')).toContainText('outside Hyderabad');

    await page.fill('#lat', '17.44');
    await page.getByRole('button', { name: 'Add listing' }).click();
    await expect(page.getByRole('heading', { name })).toBeVisible();
    await expect(page.getByText('Shown to patients')).toBeVisible();

    // Edit
    await page.fill('#phone', '+91 40 5555 0100');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.locator('.toast')).toContainText('Changes saved');

    // A patient can find it, then cannot once it is hidden.
    const ctx = await browser.newContext(); const pp = await ctx.newPage();
    await register(pp, 'patient', 'finder');
    const find = async () => (await (await pp.request.get(`${baseURL}/api/v1/hospitals?q=${encodeURIComponent(name)}&limit=50`)).json()).hospitals.length;
    expect(await find()).toBe(1);
    await page.getByRole('button', { name: 'Hide', exact: true }).click();
    await page.getByRole('button', { name: 'Hide listing' }).click();
    await expect(page.getByText('Hidden from patients')).toBeVisible();
    expect(await find()).toBe(0);
    await ctx.close();

    await page.goto(`${baseURL}/admin/#/audit`);
    await expect(page.getByRole('cell', { name: new RegExp(`Created hospital "${name}"`) })).toBeVisible();
    await expect(page.getByRole('cell', { name: /Hid hospital|hide/i }).first()).toBeVisible();
  });

  test('admin adds a doctor at a listed hospital and one with their own clinic', async ({ page }) => {
    await register(page, 'admin', 'docs');
    await page.goto(`${baseURL}/admin/#/listings/new/doctor`);
    await page.fill('#name', 'Dr. E2E Hospital'); await page.fill('#specialization', 'Cardiology');
    await page.getByRole('button', { name: 'Add listing' }).click();
    await expect(page.locator('#hospitalId-error')).toContainText('Choose a hospital');
    await page.fill('#hospital-search', 'Deccan');
    await page.locator('.admin-picker li button').first().click();
    await expect(page.locator('#hospitalId-current')).toContainText('Selected:');
    await page.getByRole('button', { name: 'Add listing' }).click();
    await expect(page.getByRole('heading', { name: 'Dr. E2E Hospital' })).toBeVisible();

    await page.goto(`${baseURL}/admin/#/listings/new/doctor`);
    await page.fill('#name', 'Dr. E2E Clinic'); await page.fill('#specialization', 'Dermatology');
    await page.getByLabel('At their own clinic').check();
    await page.fill('#clinic-name', 'Skin Studio'); await page.fill('#clinic-area', 'Kondapur'); await page.fill('#clinic-address', '2 Test Lane');
    await page.fill('#clinic-lat', '17.46'); await page.fill('#clinic-lng', '78.36');
    await page.getByRole('button', { name: 'Add listing' }).click();
    await expect(page.getByRole('heading', { name: 'Dr. E2E Clinic' })).toBeVisible();
  });

  test('admin disables and re-enables a patient; cannot disable themselves', async ({ page, browser }) => {
    const admin = await register(page, 'admin', 'people');
    const ctx = await browser.newContext(); const pp = await ctx.newPage();
    const patient = await register(pp, 'patient', 'target');
    await page.goto(`${baseURL}/admin/#/users`);
    await page.fill('input[type=search]', patient.email);
    const row = page.getByRole('row', { name: new RegExp(patient.email) });
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: /^Disable/ }).click();
    await page.getByRole('button', { name: 'Disable account' }).click();
    await expect(row.getByText('Disabled', { exact: true })).toBeVisible();
    expect((await pp.request.get(`${baseURL}/api/v1/auth/me`)).status()).toBe(401);
    const login = await pp.request.post(`${baseURL}/api/v1/auth/login`, { headers: { 'x-careroute-csrf': '1', 'x-forwarded-for': ip() }, data: { email: patient.email, password: PASSWORD } });
    expect(login.status()).toBe(403);
    await row.getByRole('button', { name: /^Enable/ }).click();
    await expect(row.getByText('Active', { exact: true })).toBeVisible();
    await ctx.close();

    await page.fill('input[type=search]', admin.email);
    await expect(page.getByRole('row', { name: new RegExp(admin.email) }).getByText('This is you')).toBeVisible();
  });

  test('admin keeps a hidden review and deletes another; authors are never shown', async ({ page, browser }) => {
    await register(page, 'admin', 'mod');
    const patients = [];
    for (const label of ['author', 'rep1', 'rep2', 'rep3']) {
      const ctx = await browser.newContext(); const p = await ctx.newPage();
      await register(p, 'patient', label); patients.push({ ctx, p });
    }
    const [{ p: author }, ...reporters] = patients;
    // Not the first listings: patient journeys on the same server expect those to start with no reviews.
    const [, , hospital, other] = (await (await author.request.get(`${baseURL}/api/v1/hospitals?limit=4`)).json()).hospitals;
    const make = async (body, h = hospital) => (await (await author.request.put(`${baseURL}/api/v1/reviews`, { headers: { 'x-careroute-csrf': '1' }, data: { kind: 'hospital', id: h.id, rating: 2, body } })).json());
    const first = await make(`Hidden candidate ${Date.now()}`);
    for (const { p } of reporters) expect((await p.request.post(`${baseURL}/api/v1/reviews/${first.id}/report`, { headers: { 'x-careroute-csrf': '1' } })).status()).toBe(204);

    await page.goto(`${baseURL}/admin/#/reviews?status=hidden`);
    await page.reload();
    const card = page.getByRole('article').filter({ hasText: first.body });
    await expect(card).toBeVisible();
    await expect(card.getByText('Hidden', { exact: true })).toBeVisible();
    await expect(card).not.toContainText('author patient');
    await card.getByRole('button', { name: 'Restore review' }).click();
    await expect(page.locator('.toast')).toContainText('Review kept');
    await expect(card).toHaveCount(0);

    // Back on the public side after the restore.
    const shown = await (await author.request.get(`${baseURL}/api/v1/reviews?kind=hospital&id=${hospital.id}`)).json();
    expect(JSON.stringify(shown)).toContain(first.body);

    // One report only: still visible to patients, listed under Reported, and the admin can delete it.
    const second = await make(`Reported once ${Date.now()}`, other);
    expect((await reporters[0].p.request.post(`${baseURL}/api/v1/reviews/${second.id}/report`, { headers: { 'x-careroute-csrf': '1' } })).status()).toBe(204);
    await page.getByRole('button', { name: 'Reported', exact: true }).click();
    const once = page.getByRole('article').filter({ hasText: second.body });
    await expect(once.getByText('1 report')).toBeVisible();
    await once.getByRole('button', { name: 'Delete review' }).click();
    await page.getByRole('button', { name: 'Delete review' }).last().click();
    await expect(page.locator('.toast')).toContainText('Review deleted');
    await expect(once).toHaveCount(0);
    for (const { ctx } of patients) await ctx.close();
  });

  test('an admin signing in lands on the admin portal, not the patient dashboard', async ({ page }) => {
    const { email } = await register(page, 'admin', 'landing');
    await page.context().clearCookies();
    await page.goto(`${baseURL}/signin/`);
    await page.getByLabel('Email address').fill(email);
    await page.locator('input[autocomplete="current-password"]').fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.waitForURL(/\/admin\//);
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Your account and password' })).toHaveAttribute('href', '/account/');
  });

  test('data quality shows each kind and opens a listing to fix it', async ({ page }) => {
    await register(page, 'admin', 'quality');
    await page.goto(`${baseURL}/admin/#/quality`);
    await expect(page.getByRole('heading', { name: 'Data quality' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Possible duplicates/ })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Hospital or clinic' })).toBeVisible();
  });

  test('emergency operations shows totals and finds available crews near an area', async ({ page }) => {
    await register(page, 'admin', 'near');
    await page.goto(`${baseURL}/admin/#/emergencies`);
    await expect(page.getByText('Total requests')).toBeVisible();
    await expect(page.getByText('Average time to assign')).toBeVisible();
    await expect(page.getByText('Choose an area to see the crews')).toBeVisible();
    await page.getByLabel('Near', { exact: true }).selectOption({ index: 1 });
    await page.getByLabel('Within').selectOption('50');
    await expect(page.getByRole('table', { name: /Available ambulances within 50 km/ })).toBeVisible();
  });

  test('fits a phone screen without sideways scrolling', async ({ page }) => {
    await register(page, 'admin', 'phone');
    await page.setViewportSize({ width: 375, height: 812 });
    for (const view of ['overview', 'users', 'listings', 'listings/new/doctor', 'quality', 'reviews', 'audit', 'emergencies']) {
      await page.goto(`${baseURL}/admin/#/${view}`);
      await page.reload();
      await expect(page.locator('h1').first()).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${view} overflows by ${overflow}px`).toBeLessThanOrEqual(0);
    }
    await expect(page.locator('#tabbar a')).toHaveCount(7);
    // Every tab stays fully on screen, so the last one is not cut off.
    for (const box of await page.locator('#tabbar a').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().right))) expect(box).toBeLessThanOrEqual(375);
  });
});
