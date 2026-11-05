import { test, expect } from '@playwright/test';

const baseURL = process.env.CAREROUTE_BASE_URL || 'http://127.0.0.1:4000';
const uuid = '00000000-0000-4000-8000-000000000001';
const pages = [
  { path: '/dashboard/', target: '/patients/me/dashboard' },
  { path: '/medical-id/', target: '/patients/me/medical-id' },
  { path: '/reminders/', target: '/patients/me/reminders' },
  { path: '/appointments/', target: '/patients/me/appointments' },
  { path: '/documents/', target: '/patients/me/reports' },
  { path: '/assistant/', target: '/patients/me/assistant', assistant: true },
  { path: '/explore/', target: '/insights' },
  { path: '/search/hospitals/', target: '/hospitals', search: true },
  { path: '/search/medicines/', target: '/medicines', search: true },
  { path: '/search/diagnostics/', target: '/diagnostic-centres', search: true },
  { path: `/hospital/?id=${uuid}`, target: `/hospitals/${uuid}`, notFoundLink: 'Search hospitals' },
  { path: `/doctor/?id=${uuid}`, target: `/doctors/${uuid}`, notFoundLink: 'Search doctors' },
  { path: `/pharmacy/?id=${uuid}`, target: `/pharmacies/${uuid}`, notFoundLink: 'Search pharmacies' },
  { path: `/medicine/?id=${uuid}`, target: `/medicines/${uuid}`, notFoundLink: 'Search medicines' },
  { path: `/diagnostic/?id=${uuid}`, target: `/diagnostic-centres/${uuid}`, notFoundLink: 'Search diagnostic centres' },
];

async function signUp(page) {
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `10.90.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200) + 1}` });
  await page.goto(`${baseURL}/signup/`);
  await page.locator('input[autocomplete="name"]').fill('Error State Patient');
  await page.locator('input[autocomplete="email"]').fill(`errors-${Date.now()}@example.test`);
  await page.locator('input[autocomplete="new-password"]').fill('error-state-password');
  await page.getByRole('checkbox', { name: /agree to the terms/i }).check();
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL(/medical-id/);
}

async function mockEndpoint(page, target, mode) {
  await page.unrouteAll({ behavior: 'wait' });
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const matches = path === `/api/v1${target}` || (target.startsWith('/hospitals/') && path === `/api/v1${target}/doctors`);
    if (!matches) return route.continue();
    if (mode === 'network') return route.abort('failed');
    const status = mode;
    const code = { 401: 'unauthorized', 403: 'role_not_allowed', 404: 'not_found', 422: 'invalid_input', 500: 'internal_error' }[status];
    return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ error: { code, message: 'This service could not complete the request. Try again.' } }) });
  });
}

test('patient pages show a clear recovery path for empty, auth, HTTP and network states', async ({ page }) => {
  test.setTimeout(240000);
  // Keep this sweep strictly local; discovery pages may otherwise request map tiles.
  await page.route('https://**/*', (route) => route.abort());
  await page.setViewportSize({ width: 1280, height: 900 });
  await signUp(page);

  // Empty collections render instructions or search guidance instead of a blank page.
  const emptyCases = [
    ['/reminders/', '/patients/me/reminders', { reminders: [] }, 'No reminders yet'],
    ['/appointments/', '/patients/me/appointments', { appointments: [] }, 'No upcoming appointments'],
    ['/documents/', '/patients/me/reports', { reports: [] }, 'No documents yet'],
    ['/assistant/', '/patients/me/assistant', { consent: { agreedAt: null, providers: [] }, conversations: [], disclaimer: 'Not a diagnosis.' }, 'Your conversations are saved here.'],
    ['/search/hospitals/', '/hospitals', { hospitals: [], total: 0 }, 'No hospitals found'],
    ['/search/medicines/', '/medicines', { medicines: [], total: 0 }, 'No medicines found'],
    ['/search/diagnostics/', '/diagnostic-centres', { diagnosticCentres: [], total: 0 }, 'No centres found'],
  ];
  for (const [path, target, payload, message] of emptyCases) {
    await page.unrouteAll({ behavior: 'wait' });
    await page.route(`**/api/v1${target}**`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) }));
    await page.goto(`${baseURL}${path}`);
    await expect(page.getByText(message, { exact: false })).toBeVisible();
    expect((await page.locator('main').innerText()).trim().length).toBeGreaterThan(10);
  }

  for (const entry of pages) {
    for (const status of [401, 403, 404, 422, 500, 'network']) {
      await mockEndpoint(page, entry.target, status);
      await page.goto(`${baseURL}${entry.path}`);
      if (status === 404 && entry.notFoundLink) {
        await expect(page.getByRole('heading', { name: 'Not found' })).toBeVisible();
        await expect(page.getByRole('link', { name: entry.notFoundLink })).toBeVisible();
      } else if (entry.search) {
        await expect(page.getByText('Search did not work', { exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
        await expect(page.locator('main').getByText(/This service could not complete|offline|connection/i)).toBeVisible();
        if (entry.path === '/search/hospitals/' && status === 500) {
          await page.screenshot({ path: 'docs/audit/evidence-codex-2026-11-06/patient-search-error-desktop.png', fullPage: true });
        }
      } else if (entry.assistant) {
        await expect(page.locator('main').getByText(/This service could not complete|offline|connection/i).last()).toBeVisible();
        await expect(page.getByRole('button', { name: 'New conversation' })).toBeVisible();
      } else {
        await expect(page.getByText('This page could not load', { exact: true }), `${entry.path} with ${status}`).toBeVisible();
        await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
        await expect(page.locator('main').getByText(/This service could not complete|offline|connection/i)).toBeVisible();
      }
      await expect(page.locator('pre')).toHaveCount(0);
      expect((await page.locator('main').innerText()).trim().length).toBeGreaterThan(10);
    }
  }
});
