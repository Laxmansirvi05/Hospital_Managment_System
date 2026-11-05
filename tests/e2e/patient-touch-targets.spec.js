import { test, expect } from '@playwright/test';

const baseURL = process.env.CAREROUTE_BASE_URL || 'http://127.0.0.1:4403';

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

test('audit patient touch target sizes across public and signed-in phone screens', async ({ page }) => {
  test.setTimeout(90000);
  await page.route('https://**/*', (route) => route.abort());
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `10.93.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200) + 1}` });
  await page.goto(`${baseURL}/signup/`);
  await page.locator('input[autocomplete="name"]').fill('Touch Target Patient');
  await page.locator('input[autocomplete="email"]').fill(`touch-target-${Date.now()}@example.test`);
  await page.locator('input[autocomplete="new-password"]').fill('touch-target-password-123');
  await page.getByRole('checkbox', { name: /agree to the terms/i }).check();
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL(/medical-id/);

  const collections = await Promise.all([
    api(page, '/hospitals?limit=1'), api(page, '/doctors?limit=1'), api(page, '/medicines?limit=1'),
    api(page, '/pharmacies?limit=1'), api(page, '/diagnostic-centres?limit=1'),
  ]);
  const paths = ['/', '/dashboard/', '/assistant/', '/search/hospitals/', '/search/doctors/', '/search/medicines/',
    '/search/diagnostics/', '/explore/', '/appointments/', '/reminders/', '/medical-id/', '/documents/',
    '/settings/', '/account/', '/sos/', '/privacy/', '/terms/'];
  const [hospitals, doctors, medicines, pharmacies, diagnostics] = collections.map((r) => r.body);
  if (hospitals.hospitals[0]) paths.push(`/hospital/?id=${hospitals.hospitals[0].id}`);
  if (doctors.doctors[0]) paths.push(`/doctor/?id=${doctors.doctors[0].id}`);
  if (medicines.medicines[0]) paths.push(`/medicine/?id=${medicines.medicines[0].id}`);
  if (pharmacies.pharmacies[0]) paths.push(`/pharmacy/?id=${pharmacies.pharmacies[0].id}`);
  if (diagnostics.diagnosticCentres[0]) paths.push(`/diagnostic/?id=${diagnostics.diagnosticCentres[0].id}`);
  const emergency = await api(page, '/emergencies', 'POST', {
    emergencyType: 'other', forSelf: true, conscious: true, patientCount: 1, ambulanceType: 'BLS', notes: '',
    location: { lat: 17.4435, lng: 78.4676 }, address: 'Touch target demo location',
  });
  if (emergency.status === 201) paths.push(`/emergency/?id=${emergency.body.emergency.id}`);
  const guest = await api(page, '/emergencies', 'POST', {
    emergencyType: 'other', forSelf: true, conscious: null, patientCount: 1, ambulanceType: 'BLS', notes: '',
    location: { lat: 1, lng: 1 }, address: '', guestPhone: `9${String(Date.now()).slice(-9)}`,
  });
  if (guest.status === 201 && guest.body.trackingToken) paths.push(`/track/?token=${encodeURIComponent(guest.body.trackingToken)}`);

  const small = [];
  for (const path of paths) {
    await page.goto(`${baseURL}${path}`);
    await page.waitForTimeout(80);
    const found = await page.locator('a,button,input,select,textarea,[role="button"],[role="radio"],[role="tab"]').evaluateAll((elements) =>
      elements.filter((el) => {
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const isAction = el.matches('button,input,select,textarea,[role="button"],[role="radio"],[role="tab"],a.btn,a.card-link,a.rmap-pin,a.icon-btn,.topbar a,.tabbar a,.nav a,.legal-nav a,.emergency-header a,.emergency-call');
        return isAction && !el.classList.contains('visually-hidden') && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0 && rect.width > 0 && rect.height > 0
          && Math.min(rect.width, rect.height) < 44;
      }).map((el) => {
        const rect = el.getBoundingClientRect();
        return { text: (el.getAttribute('aria-label') || el.innerText || el.getAttribute('placeholder') || el.tagName).trim().slice(0, 70),
          width: Math.round(rect.width), height: Math.round(rect.height) };
      }));
    if (found.length) small.push({ path, controls: found });
  }
  console.log(`SMALL_TOUCH_TARGET_SUMMARY ${JSON.stringify(small.map(({ path, controls }) => ({ path, count: controls.length, controls: controls.slice(0, 5) })))}`);
  expect(paths.length, 'The sweep covers public, patient, detail and emergency screens').toBeGreaterThanOrEqual(20);
});
