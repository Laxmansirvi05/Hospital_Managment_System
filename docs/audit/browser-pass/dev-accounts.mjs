import { chromium } from '@playwright/test';
import { randomBytes } from 'node:crypto';

const base = process.env.CAREROUTE_DEV_URL || 'http://127.0.0.1:4001';
const suffix = `${Date.now()}`;
const password = `${randomBytes(24).toString('base64url')}A1!`;
const users = [
  { name: 'CareRoute Audit One', email: `audit.one.${suffix}@example.test`, password },
  { name: 'CareRoute Audit Two', email: `audit.two.${suffix}@example.test`, password },
];
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const [index, user] of users.entries()) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    let created = false;
    try {
      await page.goto(`${base}/signup/`, { waitUntil: 'domcontentloaded' });
      await page.getByLabel('Full name').fill(user.name);
      await page.getByLabel('Email address').fill(user.email);
      await page.getByRole('textbox', { name: 'Password' }).fill(user.password);
      await page.getByLabel(/I agree to the/).check();
      await page.getByRole('button', { name: 'Create account', exact: true }).click();
      await page.waitForURL('**/medical-id/?welcome=1', { timeout: 15000 });
      created = true;
      await page.goto(`${base}/dashboard/`, { waitUntil: 'domcontentloaded' });
      await page.locator('.ast-robot').waitFor({ state: 'attached', timeout: 10000 });
      const robotOnPatientPage = await page.locator('.ast-robot').count() === 1;
      await page.screenshot({ path: `docs/audit/browser-pass/signed-in-dashboard-${user.name.endsWith('One') ? 'one' : 'two'}.png`, fullPage: true }).catch(() => {});
      await page.goto(`${base}/sos/`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(250);
      const robotOnSosPage = await page.locator('.ast-robot').count() > 0;
      if (index === 0) await page.screenshot({ path: 'docs/audit/browser-pass/signed-in-sos-one.png', fullPage: true }).catch(() => {});
      await page.goto(`${base}/account/`, { waitUntil: 'domcontentloaded' });
      await page.getByLabel('Your password').fill(user.password);
      await page.getByLabel('Type DELETE to confirm').fill('DELETE');
      await page.getByRole('button', { name: 'Delete my account' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Delete everything' }).click();
      await page.waitForURL('**/signin/', { timeout: 15000 });
      results.push({ account: index + 1, created, robotOnPatientPage, robotOnSosPage, deletedThroughAccountUI: true });
    } catch (error) {
      results.push({ account: index + 1, created, deletedThroughAccountUI: false, error: String(error) });
      if (created) {
        // Keep the browser on the app for manual recovery; no direct database deletion is attempted.
        await page.screenshot({ path: `docs/audit/browser-pass/cleanup-needed-${user.name.endsWith('One') ? 'one' : 'two'}.png`, fullPage: true }).catch(() => {});
      }
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify({ base, results }, null, 2));
if (results.some(x => !x.deletedThroughAccountUI)) process.exitCode = 1;
