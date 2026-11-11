// The three views and how people get into them (D-84, D-87, D-88): one sign-in page for everyone with a
// Patient or Driver switch, an admin who lands in the admin portal from either switch, a driver who
// waits for approval or is turned down, and a password reset an admin hands over.
import { test, expect } from '@playwright/test';

const baseURL = process.env.CAREROUTE_BASE_URL || 'http://127.0.0.1:4402';
const stamp = () => `${Date.now()}-${Math.floor(Math.random() * 1e5)}`;
const ip = () => `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
const PASSWORD = 'long enough password';

async function fresh(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, extraHTTPHeaders: { 'x-forwarded-for': ip() } });
  const page = await context.newPage();
  await page.route('https://**/*', (route) => route.abort());
  return { context, page };
}
async function makeAdmin(page) {
  const email = `admin-${stamp()}@example.test`;
  const r = await page.request.post(`${baseURL}/api/v1/auth/register`, { headers: { 'x-careroute-csrf': '1', 'x-forwarded-for': ip() }, data: { name: 'Roles Admin', email, password: PASSWORD, role: 'admin' } });
  expect(r.status()).toBe(201);
  return email;
}
async function signIn(page, email, password, asDriver = false) {
  await page.goto(`${baseURL}/signin/`);
  if (asDriver) await page.getByRole('group', { name: 'I am a' }).getByRole('button', { name: 'Driver' }).click();
  await page.getByLabel('Email address').fill(email);
  await page.locator('.auth-mode-view.is-current #password').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

test('an admin lands in the admin portal from either switch, and a patient or driver cannot enter it', async ({ browser }) => {
  const a = await fresh(browser);
  const email = await makeAdmin(a.page);
  await a.context.clearCookies();
  for (const asDriver of [false, true]) {
    await signIn(a.page, email, PASSWORD, asDriver);
    await a.page.waitForURL(/\/admin\//);
    await expect(a.page.getByRole('heading', { name: 'Overview' })).toBeVisible();
    await a.context.clearCookies();
  }
  const p = await fresh(browser);
  const patientEmail = `patient-${stamp()}@example.test`;
  const made = await p.page.request.post(`${baseURL}/api/v1/auth/register`, { headers: { 'x-careroute-csrf': '1' }, data: { name: 'Plain Patient', email: patientEmail, password: PASSWORD } });
  expect(made.status()).toBe(201);
  await p.page.goto(`${baseURL}/admin/`);
  await expect(p.page.getByRole('heading', { name: 'This area is for admin accounts' })).toBeVisible();
  expect((await p.page.request.get(`${baseURL}/api/v1/admin/driver-requests`)).status()).toBe(403);
  await a.context.close(); await p.context.close();
});

test('a driver waits for an admin, can be turned down with a reason, and is then approved', async ({ browser }) => {
  test.setTimeout(90000);
  const d = await fresh(browser);
  const admin = await fresh(browser);
  const adminEmail = await makeAdmin(admin.page);
  const driverEmail = `driver-${stamp()}@example.test`;
  await d.page.goto(`${baseURL}/signin/`);
  await d.page.getByRole('group', { name: 'I am a' }).getByRole('button', { name: 'Driver' }).click();
  await d.page.getByRole('tab', { name: 'Create account' }).click();
  await expect(d.page.locator('.auth-mode-view')).toHaveCount(1);
  const digits = String(Math.floor(Math.random() * 9000) + 1000);
  const who = `Wanda ${digits}`;
  await d.page.getByLabel('Full name').fill(who);
  await d.page.getByLabel('Email address').fill(driverEmail);
  await d.page.getByLabel('Mobile number').fill(`98760${String(Math.floor(Math.random() * 90000) + 10000)}`);
  await d.page.getByLabel('Vehicle registration number').fill(`ts 10 ab ${digits}`);
  await d.page.locator('#password').fill(PASSWORD);
  await d.page.getByRole('checkbox', { name: /agree to the terms/i }).check();
  await d.page.getByRole('button', { name: 'Create driver account' }).click();
  await d.page.waitForURL(/\/driver\//);
  await expect(d.page.getByRole('heading', { name: 'Waiting for approval' })).toBeVisible();

  // The admin sees who and which vehicle, and a number on the Drivers entry.
  await admin.page.goto(`${baseURL}/admin/#/drivers`);
  const row = admin.page.getByRole('row', { name: new RegExp(who) });
  await expect(row).toContainText(`TS10AB${digits}`);
  await expect(row).toContainText('98760');
  await expect(admin.page.locator('#sidebar a', { hasText: 'Driver requests' }).locator('.admin-badge')).toHaveText(/^[1-9]/);
  await admin.page.screenshot({ path: 'test-results/evidence/admin-driver-requests.png' });

  await admin.page.getByRole('button', { name: `Reject ${who}` }).click();
  await admin.page.getByLabel(/Reason/).fill('Plate does not match the owner');
  await admin.page.getByRole('dialog').getByRole('button', { name: 'Reject driver' }).click();
  await expect(d.page.getByRole('heading', { name: 'Your account was not approved' })).toBeVisible({ timeout: 20000 });
  await expect(d.page.getByText('Plate does not match the owner')).toBeVisible();

  await admin.page.getByLabel('Show').selectOption('rejected');
  await admin.page.getByRole('button', { name: `Approve ${who}` }).click();
  await admin.page.getByRole('dialog').getByRole('button', { name: 'Approve driver' }).click();
  await expect(d.page.getByRole('button', { name: 'Go online' })).toBeVisible({ timeout: 20000 });
  await expect(d.page.getByRole('heading', { name: 'Waiting for approval' })).toBeHidden();
  expect(adminEmail).toBeTruthy();
  await d.context.close(); await admin.context.close();
});

test('someone who forgot a password asks, an admin issues a link, and the link works once', async ({ browser }) => {
  test.setTimeout(90000);
  const admin = await fresh(browser);
  await makeAdmin(admin.page);
  const person = await fresh(browser);
  const email = `forgot-${stamp()}@example.test`;
  const made = await person.page.request.post(`${baseURL}/api/v1/auth/register`, { headers: { 'x-careroute-csrf': '1' }, data: { name: 'Forgetful Person', email, password: PASSWORD } });
  expect(made.status()).toBe(201);
  await person.context.clearCookies();

  await person.page.goto(`${baseURL}/signin/`);
  await person.page.getByRole('button', { name: 'Forgot password?' }).click();
  await person.page.getByLabel('Your account email').fill(email);
  await person.page.getByRole('button', { name: 'Ask an admin for a reset link' }).click();
  await expect(person.page.getByText(/Request sent/)).toBeVisible();

  await admin.page.goto(`${baseURL}/admin/#/users`);
  const request = admin.page.getByRole('row', { name: /Forgetful Person/ }).first();
  await expect(request).toBeVisible();
  await admin.page.getByRole('button', { name: 'Create a reset link for Forgetful Person' }).first().click();
  const link = await admin.page.getByRole('dialog').getByLabel('Reset link').inputValue();
  expect(link).toMatch(/\/reset\/\?token=/);
  await admin.page.getByRole('dialog').getByRole('button', { name: 'Done' }).click();

  await person.page.goto(link);
  await person.page.locator('#password').fill('a brand new phrase');
  await person.page.locator('#again').fill('a brand new phrase');
  await person.page.getByRole('button', { name: 'Save new password' }).click();
  await expect(person.page.getByText(/Your password is changed/)).toBeVisible();
  await signIn(person.page, email, 'a brand new phrase');
  await person.page.waitForURL(/\/(dashboard|medical-id)\//);

  await person.page.goto(link);
  await person.page.locator('#password').fill('yet another phrase');
  await person.page.locator('#again').fill('yet another phrase');
  await person.page.getByRole('button', { name: 'Save new password' }).click();
  await expect(person.page.getByText(/expired or was already used/)).toBeVisible();
  await person.context.close(); await admin.context.close();
});
