// The patient and driver journey through the real pages, with two separate browsers signed in at once:
// a driver signs up on the sign-in page and goes online, a patient books an ambulance, the driver is
// alerted, accepts and drives the trip, and a second driver never sees the request (D-84). A new
// driver is approved by an admin in the admin portal first (D-87).
import { test, expect } from '@playwright/test';

const baseURL = process.env.CAREROUTE_BASE_URL || 'http://127.0.0.1:4402';
// Away from the sample server's simulated crews, so only the drivers created here are matched.
const HERE = { latitude: 17.58, longitude: 78.62 };
const FAR = { latitude: 17.62, longitude: 78.66 };
const stamp = () => `${Date.now()}-${Math.floor(Math.random() * 1e5)}`;
const ip = () => `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;

async function person(browser, geolocation) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['geolocation'], geolocation, extraHTTPHeaders: { 'x-forwarded-for': ip() } });
  const page = await context.newPage();
  await page.route('https://**/*', (route) => (route.request().url().includes('tile.openstreetmap.org') ? route.abort() : route.abort()));
  return { context, page };
}

async function signUpDriver(page, n) {
  await page.goto(`${baseURL}/signin/`);
  await page.getByRole('group', { name: 'I am a' }).getByRole('button', { name: 'Driver' }).click();
  await page.getByRole('tab', { name: 'Create account' }).click();
  await expect(page.locator('.auth-mode-view')).toHaveCount(1);
  await page.getByLabel('Full name').fill(`Test Driver ${n}`);
  await page.getByLabel('Email address').fill(`driver-${stamp()}@example.test`);
  await page.getByLabel('Mobile number').fill(`98760${String(Math.floor(Math.random() * 99999)).padStart(5, '0')}`);
  await page.getByLabel('Vehicle registration number').fill(`TS 09 E2E ${String(Math.floor(Math.random() * 9000) + 1000)}`);
  await page.locator('#password').fill('long enough password');
  await page.getByRole('checkbox', { name: /agree to the terms/i }).check();
  await page.getByRole('button', { name: 'Create driver account' }).click();
  await page.waitForURL(/\/driver\//);
  await expect(page.getByRole('heading', { name: 'Driver workspace' })).toBeVisible();
  // Until an admin approves, the driver can only wait.
  await expect(page.getByRole('heading', { name: 'Waiting for approval' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Go online' })).toBeHidden();
}

/** An admin account made through the API (this sample server allows it), signed in through the page. */
async function adminPage(browser) {
  const { context, page } = await person(browser, HERE);
  const email = `admin-${stamp()}@example.test`;
  const made = await page.request.post(`${baseURL}/api/v1/auth/register`, { headers: { 'x-careroute-csrf': '1' }, data: { name: 'Test Admin', email, password: 'long enough password', role: 'admin' } });
  expect(made.status()).toBe(201);
  await page.goto(`${baseURL}/admin/#/drivers`);
  await expect(page.getByRole('heading', { name: 'Driver requests' })).toBeVisible();
  return { context, page };
}

async function approve(admin, name) {
  await admin.page.reload();
  await admin.page.getByRole('button', { name: `Approve ${name}` }).click();
  await admin.page.getByRole('dialog').getByRole('button', { name: 'Approve driver' }).click();
  await expect(admin.page.getByRole('button', { name: `Approve ${name}` })).toHaveCount(0);
}

test('the sign-in page has a Patient or Driver switch and no Google', async ({ page }) => {
  await page.route('https://**/*', (route) => route.abort());
  await page.goto(`${baseURL}/signin/`);
  const switcher = page.getByRole('group', { name: 'I am a' });
  await expect(switcher.getByRole('button', { name: 'Patient' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await switcher.getByRole('button', { name: 'Driver' }).click();
  await expect(page.getByRole('heading', { name: 'Driver sign in' })).toBeVisible();
  await page.getByRole('tab', { name: 'Create account' }).click();
  await expect(page.locator('.auth-mode-view')).toHaveCount(1);
  await expect(page.getByLabel('Vehicle registration number')).toBeVisible();
  await expect(page.getByLabel('Ambulance type')).toBeVisible();
  await switcher.getByRole('button', { name: 'Patient' }).click();
  await expect(page.getByLabel('Vehicle registration number')).toHaveCount(0);
  await expect(page.getByText(/google/i)).toHaveCount(0);
  await page.screenshot({ path: 'test-results/evidence/signin-role-switch.png' });
});

test('a driver signs up, goes online and is alerted; the patient follows the trip; another driver sees nothing', async ({ browser }) => {
  test.setTimeout(150000);
  const driver = await person(browser, HERE);
  const other = await person(browser, FAR);
  const patient = await person(browser, HERE);
  try {
    await signUpDriver(driver.page, 1);
    await signUpDriver(other.page, 2);
    const admin = await adminPage(browser);
    await approve(admin, 'Test Driver 1');
    await approve(admin, 'Test Driver 2');
    await admin.context.close();
    // The waiting pages notice the approval by themselves.
    for (const d of [driver, other]) await expect(d.page.getByRole('button', { name: 'Go online' })).toBeVisible({ timeout: 20000 });

    // Both go online. The second is a few kilometres away, so the request is offered to the first.
    for (const d of [driver, other]) {
      await d.page.getByRole('button', { name: 'Go online' }).click();
      await expect(d.page.getByText('Online', { exact: true })).toBeVisible({ timeout: 15000 });
      await expect(d.page.getByText(/Sharing your live location/)).toBeVisible();
    }
    await other.context.setGeolocation(FAR);

    // A patient signs up from the same page and books.
    await patient.page.goto(`${baseURL}/signup/`);
    await expect(patient.page.locator('.auth-mode-view')).toHaveCount(1);
    await patient.page.getByLabel('Full name').fill('Test Patient');
    await patient.page.getByLabel('Email address').fill(`patient-${stamp()}@example.test`);
    await patient.page.locator('#password').fill('long enough password');
    await patient.page.getByRole('checkbox', { name: /agree to the terms/i }).check();
    await patient.page.getByRole('button', { name: 'Create account' }).click();
    await patient.page.waitForURL(/medical-id/);
    await patient.page.goto(`${baseURL}/sos/`);
    await expect(patient.page.getByText(/Location ready/)).toBeVisible();
    await patient.page.getByLabel('Address or landmark').fill('Test Road, near the junction');
    await patient.page.getByRole('button', { name: 'Send demo request' }).click();

    // The first driver is alerted with the request, and the second is not.
    const alert = driver.page.getByRole('alert').filter({ hasText: 'New ambulance request' });
    await expect(alert).toBeVisible({ timeout: 20000 });
    // Only coarse details before accepting; the address comes with the trip.
    await expect(alert).toContainText('Distance from you');
    await expect(alert).not.toContainText('Test Road');
    await expect(driver.page).toHaveTitle(/New request/);
    await expect(other.page.getByRole('alert').filter({ hasText: 'New ambulance request' })).toHaveCount(0);
    await driver.page.screenshot({ path: 'test-results/evidence/driver-offer.png' });
    await alert.getByRole('button', { name: 'Accept' }).click();
    await expect(driver.page.getByRole('heading', { name: 'Request accepted' })).toBeVisible({ timeout: 15000 });
    await expect(driver.page.getByText('Test Road, near the junction')).toBeVisible();

    // The patient sees the crew accepted, then every step.
    await patient.page.waitForURL(/\/emergency\//, { timeout: 20000 });
    await expect(patient.page.getByText('Crew accepted').first()).toBeVisible({ timeout: 20000 });
    for (const [button, shown] of [['Start driving to the patient', 'Crew travelling'], ['I have arrived', 'Crew arrived'], ['Patient is on board', 'Patient picked up'], ['Arrived at the hospital', 'Trip at hospital'], ['Complete the trip', 'Trip complete']]) {
      await driver.page.getByRole('button', { name: button }).click();
      await expect(patient.page.getByText(shown).first()).toBeVisible({ timeout: 15000 });
    }
    await expect(other.page.getByRole('alert').filter({ hasText: 'New ambulance request' })).toHaveCount(0);
    await driver.page.getByRole('button', { name: 'Back to waiting for requests' }).click();
    await expect(driver.page.getByText('Waiting for requests')).toBeVisible();
    await patient.page.screenshot({ path: 'test-results/evidence/patient-trip-complete.png' });
  } finally {
    await Promise.all([driver.context.close(), other.context.close(), patient.context.close()]);
  }
});
