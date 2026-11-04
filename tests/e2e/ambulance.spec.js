import { test, expect } from '@playwright/test';

const baseURL = process.env.CAREROUTE_BASE_URL || 'http://127.0.0.1:4402';

async function api(page, path, method = 'GET', body) {
  return page.evaluate(async ({ path, method, body }) => {
    const response = await fetch(`/api/v1${path}`, {
      method,
      credentials: 'same-origin',
      headers: {
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(method === 'GET' ? {} : { 'x-careroute-csrf': '1' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  }, { path, method, body });
}

async function createPatientWithContact(page) {
  await page.goto(`${baseURL}/sos/`);
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const registered = await api(page, '/auth/register', 'POST', {
    name: 'Demo Patient', email: `demo-${stamp}@example.test`, phone: '9876543210', password: 'sample-password-123',
  });
  expect(registered.status).toBe(201);
  const contact = await api(page, '/patients/me/contacts', 'POST', {
    name: 'Demo Contact', phone: '9876543211', relation: 'Friend',
  });
  expect(contact.status).toBe(201);
}

async function submitPatientSOS(page) {
  await page.goto(`${baseURL}/sos/`);
  await page.getByLabel('Address or landmark').fill('Sample landmark');
  const response = page.waitForResponse((r) => r.url().includes('/api/v1/emergencies') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Send demo request' }).click();
  const result = await (await response).json();
  expect(result.emergency.id).toBeTruthy();
  return result.emergency.id;
}

function demoWillDecline(id) {
  let value = 5381;
  for (const character of id) value = (Math.imul(value, 33) + character.charCodeAt(0)) >>> 0;
  return value % 5 === 0;
}

test('patient saved contact receives only a fake sample-mode SMS event', async ({ page }) => {
  test.setTimeout(30_000);
  await createPatientWithContact(page);
  const id = await submitPatientSOS(page);
  await page.waitForURL(/\/emergency\//, { timeout: 10_000 });
  await expect(page.getByText('Demo: no real ambulance is sent.')).toBeVisible();
  const result = await api(page, `/emergencies/${id}`);
  expect(result.status).toBe(200);
  expect(result.body.emergency.timeline.map((event) => event.kind)).toContain('sms_sent');
  expect(JSON.stringify(result.body)).not.toContain('9876543211');
});

test('patient can undo SOS before SMS and cancel within five seconds', async ({ page }) => {
  test.setTimeout(20_000);
  await createPatientWithContact(page);
  const id = await submitPatientSOS(page);
  await expect(page.getByRole('button', { name: 'Cancel request' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel request' }).click();
  await expect(page.getByText('Demo request cancelled. No contact message was sent.')).toBeVisible();
  const result = await api(page, `/emergencies/${id}`);
  expect(result.body.emergency.status).toBe('cancelled');
  expect(result.body.emergency.timeline.map((event) => event.kind)).not.toContain('sms_sent');
  expect(result.body.emergency.timeline.map((event) => event.kind)).not.toContain('sms_failed');
});

test('guest demo request advances through acceptance, en route and completion', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto(`${baseURL}/sos/`);
  let created;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await page.setExtraHTTPHeaders({ 'x-forwarded-for': `192.0.2.${40 + attempt}` });
    created = await api(page, '/emergencies', 'POST', {
      emergencyType: 'other', forSelf: true, conscious: null, patientCount: 1, ambulanceType: 'BLS', notes: '',
      location: { lat: 17.4435, lng: 78.4676 }, address: 'Demo pickup', guestPhone: `98765432${String(15 + attempt).padStart(2, '0')}`,
    });
    expect(created.status).toBe(201);
    if (!demoWillDecline(created.body.emergency.id)) break;
    const cancelled = await api(page, `/track/${created.body.trackingToken}/cancel`, 'POST', {});
    expect(cancelled.body.status).toBe('cancelled');
    created = null;
  }
  expect(created, 'a deterministic demo seed that accepts').toBeTruthy();
  await page.goto(`${baseURL}/track/?token=${encodeURIComponent(created.body.trackingToken)}`);
  const observed = new Set();
  const deadline = Date.now() + 75_000;
  while (Date.now() < deadline && !observed.has('completed')) {
    const result = await api(page, `/track/${created.body.trackingToken}`);
    expect(result.status).toBe(200);
    observed.add(result.body.status);
    if (result.body.status === 'no_match') break;
    if (result.body.status !== 'completed') await page.waitForTimeout(900);
  }
  expect([...observed].some((status) => ['assigned', 'en_route'].includes(status))).toBe(true);
  expect([...observed]).toContain('en_route');
  expect([...observed]).toContain('completed');
  await expect(page.getByRole('status')).toContainText('Demo trip complete');
  expect([...observed]).not.toContain('no_match');
});

test('guest SOS offers keyboard undo; tracking stays within the public field allowlist at all target widths', async ({ page }) => {
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': '192.0.2.80' });
  const cspViolations = [];
  page.on('console', (message) => { if (message.type() === 'error' && message.text().includes('Content Security Policy')) cspViolations.push(message.text()); });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseURL}/sos/`);
  await expect(page.getByRole('link', { name: /Call 112/ }).first()).toBeVisible();
  await expect(page.getByText('Demo: no real ambulance is sent.')).toBeVisible();
  const controls = page.locator('a[href^="tel:"], button, input, select, textarea');
  for (let index = 0; index < await controls.count(); index += 1) {
    const box = await controls.nth(index).boundingBox();
    if (box) expect(Math.min(box.width, box.height), `target ${index} is under 44px`).toBeGreaterThanOrEqual(44);
  }
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toHaveAttribute('href', '#main');
  await page.getByLabel('Your phone number').fill('9876543212');
  await page.getByLabel('Address or landmark').fill('Accessible demo location');
  const response = page.waitForResponse((r) => r.url().includes('/api/v1/emergencies') && r.request().method() === 'POST');
  for (let step = 0; step < 24 && await page.evaluate(() => document.activeElement?.id !== 'send-request'); step += 1) await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toHaveAttribute('id', 'send-request');
  await page.keyboard.press('Enter');
  const created = await (await response).json();
  await expect(page.locator('#undo-panel')).toHaveAttribute('aria-live', 'assertive');
  await expect(page.locator('#undo-message')).toContainText(/Cancel available for [1-5] seconds\./);
  await page.getByRole('button', { name: 'Cancel request' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Demo request cancelled. No contact message was sent.')).toBeVisible();

  const noMatch = await api(page, '/emergencies', 'POST', {
    emergencyType: 'other', forSelf: true, conscious: null, patientCount: 1, ambulanceType: 'BLS', notes: '',
    location: { lat: 1, lng: 1 }, address: '', guestPhone: '9876543213',
  });
  expect(noMatch.status).toBe(201);
  await page.goto(`${baseURL}/track/?token=${encodeURIComponent(noMatch.body.trackingToken)}`);
  await expect(page.getByRole('status')).toContainText('No demo crew accepted');
  await expect(page.getByText('Demo: no real ambulance is sent.')).toBeVisible();
  const publicResult = await api(page, `/track/${noMatch.body.trackingToken}`);
  expect(Object.keys(publicResult.body).sort()).toEqual(['ambulance', 'demo', 'etaIsEstimate', 'etaSeconds', 'status']);
  expect(publicResult.body).toMatchObject({ status: 'no_match', ambulance: null, demo: true });
  const rendered = await page.locator('main').innerText();
  for (const forbidden of [created.emergency.id, noMatch.body.trackingToken, '9876543213', 'Accessible demo location']) expect(rendered).not.toContain(forbidden);
  await expect(page.locator('main')).not.toContainText(/patient count|phone number|address|medical id/i);

  for (const width of [390, 820, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator('main')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
  expect(cspViolations).toEqual([]);
});
