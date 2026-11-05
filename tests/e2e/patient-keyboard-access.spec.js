import { test, expect } from '@playwright/test';

const baseURL = process.env.CAREROUTE_BASE_URL || 'http://127.0.0.1:4000';

async function signup(page) {
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': '10.82.0.11' });
  await page.goto(`${baseURL}/signup/`);
  await page.locator('input[autocomplete="name"]').fill('Keyboard Audit Patient');
  await page.locator('input[autocomplete="email"]').fill(`keyboard-audit-${Date.now()}@example.test`);
  await page.locator('input[autocomplete="new-password"]').fill('keyboard-audit-password-123');
  await page.getByRole('checkbox', { name: /agree to the terms/i }).check();
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL(/medical-id/);
}

async function api(page, path, method = 'GET', body) {
  return page.evaluate(async ({ path, method, body }) => {
    const response = await fetch(`/api/v1${path}`, {
      method,
      credentials: 'same-origin',
      headers: { ...(body === undefined ? {} : { 'content-type': 'application/json', 'x-careroute-csrf': '1' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  }, { path, method, body });
}

test('patient pages expose a keyboard skip path and labelled form fields in memory mode', async ({ page }) => {
  await page.route('https://**/*', (route) => route.abort());
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${baseURL}/signin/`);

  await page.keyboard.press('Tab');
  await expect(page.locator('a.visually-hidden[href="#main"]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main#main')).toBeFocused();
  await page.goto(`${baseURL}/signup/`);
  await page.keyboard.press('Tab');
  await expect(page.locator('a.visually-hidden[href="#main"]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main#main')).toBeFocused();

  await signup(page);
  const hospitals = await api(page, '/hospitals?limit=1');
  const doctors = await api(page, '/doctors?limit=1');
  const medicines = await api(page, '/medicines?limit=1');
  const pharmacies = await api(page, '/pharmacies?limit=1');
  const diagnostics = await api(page, '/diagnostic-centres?limit=1');
  const patientEmergency = await api(page, '/emergencies', 'POST', {
    emergencyType: 'other', forSelf: true, conscious: true, patientCount: 1, ambulanceType: 'BLS', notes: '',
    location: { lat: 17.4435, lng: 78.4676 }, address: 'Keyboard audit demo',
  });
  const guestEmergency = await page.evaluate(async () => {
    const response = await fetch('/api/v1/emergencies', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ emergencyType: 'other', forSelf: true, conscious: null, patientCount: 1, ambulanceType: 'BLS', notes: '',
        location: { lat: 17.4435, lng: 78.4676 }, address: 'Keyboard audit guest demo', guestPhone: '9876543218' }) });
    return response.json();
  });

  const paths = ['/', '/dashboard/', '/assistant/', '/search/hospitals/', '/search/doctors/', '/search/medicines/', '/search/diagnostics/',
    '/explore/', '/appointments/', '/reminders/', '/medical-id/', '/documents/', '/settings/', '/account/', '/sos/', '/privacy/', '/terms/'];
  if (hospitals.body.hospitals[0]) paths.push(`/hospital/?id=${hospitals.body.hospitals[0].id}`);
  if (doctors.body.doctors[0]) paths.push(`/doctor/?id=${doctors.body.doctors[0].id}`);
  if (medicines.body.medicines[0]) paths.push(`/medicine/?id=${medicines.body.medicines[0].id}`);
  if (pharmacies.body.pharmacies[0]) paths.push(`/pharmacy/?id=${pharmacies.body.pharmacies[0].id}`);
  if (diagnostics.body.diagnosticCentres[0]) paths.push(`/diagnostic/?id=${diagnostics.body.diagnosticCentres[0].id}`);
  if (patientEmergency.status === 201) paths.push(`/emergency/?id=${patientEmergency.body.emergency.id}`);
  if (guestEmergency.trackingToken) paths.push(`/track/?token=${encodeURIComponent(guestEmergency.trackingToken)}`);

  for (const path of paths.slice(1)) {
    await page.goto(`${baseURL}${path}`);
    await expect(page.locator('a.visually-hidden[href="#main"]'), `${path} has a skip link`).toBeAttached();
    if (path === '/assistant/') {
      // The first page view is an explicit consent gate and intentionally receives initial focus.
      await expect(page.getByText('Before we start'), 'assistant consent gate gets initial focus').toBeFocused();
    } else {
    await page.keyboard.press('Tab');
    await expect(page.locator('a.visually-hidden[href="#main"]'), `${path} focuses its skip link first`).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('main, #main').first(), `${path} focuses main after activating the skip link`).toBeFocused();
    }
    const unlabeled = await page.locator('input:not([type="hidden"]):not([aria-hidden="true"]), select:not([aria-hidden="true"]), textarea:not([aria-hidden="true"])').evaluateAll((fields) =>
      fields.filter((field) => !field.labels?.length && !field.getAttribute('aria-label') && !field.getAttribute('aria-labelledby'))
        .map((field) => `${field.tagName.toLowerCase()}#${field.id || '(no id)'}`));
    expect(unlabeled, `${path} has unlabeled form fields`).toEqual([]);
  }
});
