import { test, expect } from '@playwright/test';

const baseURL = process.env.CAREROUTE_BASE_URL || 'http://127.0.0.1:4000';

async function signUp(page) {
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `10.91.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200) + 1}` });
  await page.goto(`${baseURL}/signup/`);
  await page.locator('input[autocomplete="name"]').fill('Assistant Accessibility Patient');
  await page.locator('input[autocomplete="email"]').fill(`assistant-a11y-${Date.now()}@example.test`);
  await page.locator('input[autocomplete="new-password"]').fill('assistant-accessibility-password');
  await page.getByRole('checkbox', { name: /agree to the terms/i }).check();
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL(/medical-id/);
  await page.goto(`${baseURL}/dashboard/`);
}

test('the assistant badge stays keyboard-operable without WebGL', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (/^webgl2?$/.test(String(type))) return null;
      return original.call(this, type, ...args);
    };
  });
  await signUp(page);
  const robot = page.getByRole('button', { name: /CareRoute assistant/ });
  await expect(robot).toBeVisible();
  await expect(page.locator('.ast-robot.has-model')).toHaveCount(0);
  await robot.focus();
  await page.keyboard.press('A');
  const dialog = page.getByRole('dialog', { name: 'CareRoute assistant' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Before we start')).toBeVisible();
  await expect(dialog.locator('.ast-view-title')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(robot).toBeFocused();
  await context.close();
});

test('keyboard chat announces the reply and withdrawal restores the consent gate without a provider key', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await signUp(page);
  const robot = page.getByRole('button', { name: /CareRoute assistant/ });
  await robot.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'CareRoute assistant' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Agree and continue' }).click();
  const input = dialog.getByRole('textbox', { name: 'Message the assistant' });
  await expect(input).toBeFocused();
  await input.fill('Mild headache for one day');
  await page.keyboard.press('Enter');
  const log = dialog.getByRole('log', { name: 'Conversation' });
  await expect(log).toHaveAttribute('aria-live', 'polite');
  await expect(log.getByText(/cannot reach the assistant service/i)).toBeVisible({ timeout: 10000 });
  await expect(log.getByText(/not a diagnosis/i)).toBeVisible();

  await page.goto(`${baseURL}/settings/`);
  await page.getByRole('button', { name: 'Withdraw agreement' }).click();
  await expect(page.getByText(/Nothing is sent to an AI service/)).toBeVisible();
  await page.goto(`${baseURL}/dashboard/`);
  await robot.focus();
  await page.keyboard.press('Enter');
  await expect(dialog.getByText('Before we start')).toBeVisible();
  await expect(input).toBeHidden();
});
