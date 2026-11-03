import { test, expect } from '@playwright/test';

const baseURL = process.env.CAREROUTE_BASE_URL || 'http://127.0.0.1:4000';

// The assistant robot (D-64). Runs against the dev server; the model is drawn with SwiftShader in headless Chromium.
test.use({ launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } });

async function signUp(page) {
  await page.goto(`${baseURL}/signup/`);
  await page.locator('input[autocomplete="name"]').fill('Robot Test');
  await page.locator('input[autocomplete="email"]').fill(`robot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.test`);
  await page.locator('input[autocomplete="new-password"]').fill('long enough password');
  await page.getByRole('checkbox', { name: /agree to the terms/i }).check();
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL(/medical-id/);
  await page.goto(`${baseURL}/dashboard/`);
}

test.describe('Assistant robot', () => {
  test('loads the 3D model, opens on a double click, and stays where it is dragged', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/401/.test(m.text())) errors.push(m.text()); });
    await page.setViewportSize({ width: 1440, height: 900 });
    await signUp(page);
    const robot = page.getByRole('button', { name: /CareRoute assistant/ });
    await expect(robot).toBeVisible();
    await expect(page.locator('.ast-robot.has-model')).toBeVisible({ timeout: 15000 });

    const box = await robot.boundingBox();
    await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.getByRole('dialog', { name: 'CareRoute assistant' })).toBeVisible();
    await expect(robot).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'CareRoute assistant' })).toBeHidden();

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(400, 300, { steps: 8 });
    await page.mouse.up();
    const moved = await robot.boundingBox();
    expect(Math.round(moved.x)).toBe(334);
    await page.reload();
    await expect(robot).toBeVisible();
    expect(Math.round((await robot.boundingBox()).x)).toBe(334);
    expect(errors).toEqual([]);
  });

  test('opens with the keyboard and with two taps on a phone, inside the screen', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    await signUp(page);
    const robot = page.getByRole('button', { name: /CareRoute assistant/ });
    await expect(robot).toBeVisible();
    const box = await robot.boundingBox();
    const tabbar = await page.locator('#tabbar').boundingBox();
    expect(box.y + box.height).toBeLessThanOrEqual(tabbar.y);
    // The first tap can come straight after the page loads; it must not count as a second tap.
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    const dialog = page.getByRole('dialog', { name: 'CareRoute assistant' });
    await expect(dialog).toBeVisible();
    const panel = await dialog.boundingBox();
    expect(panel.x).toBeGreaterThanOrEqual(0);
    expect(panel.x + panel.width).toBeLessThanOrEqual(375);
    await dialog.getByRole('button', { name: 'Close assistant' }).click();
    await robot.focus();
    await page.keyboard.press('Enter');
    await expect(dialog).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
    await context.close();
  });

  test('stays still and does not follow the cursor when reduced motion is asked for', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await signUp(page);
    await expect(page.locator('.ast-robot.has-model')).toBeVisible({ timeout: 15000 });
    const robot = page.locator('.ast-robot');
    const box = await robot.boundingBox();
    await page.mouse.move(20, 20);
    const first = await robot.screenshot();
    await page.mouse.move(1260, 780, { steps: 5 });
    await page.waitForTimeout(1000);
    expect((await robot.screenshot()).equals(first)).toBe(true);
    expect(await robot.boundingBox()).toEqual(box);
    await context.close();
  });
});
