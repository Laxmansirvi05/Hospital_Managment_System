import { test, expect } from '@playwright/test';

const baseURL = process.env.CAREROUTE_BASE_URL || 'http://127.0.0.1:4000';

// The assistant robot (D-64). Runs against the dev server; the model is drawn with SwiftShader in headless Chromium.
test.use({ launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } });

async function signUp(page) {
  // Each sign-up comes from its own address, so the per-address sign-up limit (10 an hour) is not
  // used up by the suite. The local server honours this header only when started with TRUST_PROXY=true.
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` });
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
    // Dropped where the cursor let go: its centre is under the cursor.
    const expectedX = Math.round(400 - box.width / 2);
    expect(Math.round(moved.x)).toBe(expectedX);
    await page.reload();
    await expect(robot).toBeVisible();
    expect(Math.round((await robot.boundingBox()).x)).toBe(expectedX);
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

  test('asks for agreement first, then shows the emergency action for a red flag even with no AI service', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signUp(page);
    const robot = page.getByRole('button', { name: /CareRoute assistant/ });
    await robot.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'CareRoute assistant' });
    await expect(dialog.getByText('Before we start')).toBeVisible();
    await expect(dialog.getByText(/never sends your name, phone, email, address/)).toBeVisible();
    await dialog.getByRole('button', { name: 'Agree and continue' }).click();
    const box = dialog.getByRole('textbox', { name: 'Message the assistant' });
    await box.fill('my father has severe chest pain and is sweating');
    await box.press('Enter');
    await expect(dialog.getByRole('link', { name: 'Call 112' })).toHaveAttribute('href', 'tel:112', { timeout: 20000 });
    await expect(dialog.getByText(/not a diagnosis/).first()).toBeVisible();
    await dialog.getByRole('button', { name: 'Saved conversations' }).click();
    await expect(dialog.getByText(/my father has severe chest pain/)).toBeVisible();
  });

  test('the panel can be moved by its header and resized from its corner, and keeps its size', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signUp(page);
    await page.getByRole('button', { name: /CareRoute assistant/ }).focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'CareRoute assistant' });
    await dialog.getByRole('button', { name: 'Agree and continue' }).click();
    const head = await dialog.locator('.ast-panel-head').boundingBox();
    await page.mouse.move(head.x + 60, head.y + 20);
    await page.mouse.down();
    await page.mouse.move(300, 120, { steps: 8 });
    await page.mouse.up();
    const moved = await dialog.boundingBox();
    expect(Math.round(moved.x)).toBe(240);
    const grip = await dialog.getByRole('button', { name: /Resize the assistant/ }).boundingBox();
    await page.mouse.move(grip.x + 20, grip.y + 20);
    await page.mouse.down();
    await page.mouse.move(grip.x + 220, grip.y + 120, { steps: 8 });
    await page.mouse.up();
    const resized = await dialog.boundingBox();
    expect(Math.round(resized.width)).toBe(Math.round(moved.width) + 200);
    await page.reload();
    await page.getByRole('button', { name: /CareRoute assistant/ }).focus();
    await page.keyboard.press('Enter');
    expect(Math.round((await dialog.boundingBox()).width)).toBe(Math.round(resized.width));
  });

  test('the AI assistant page uploads files from the device and keeps every conversation', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signUp(page);
    await page.getByRole('link', { name: 'AI assistant' }).first().click();
    await expect(page).toHaveURL(/\/assistant\/$/);
    await expect(page.locator('.ast-robot')).toHaveCount(0);
    await page.getByRole('button', { name: 'Agree and continue' }).click();
    await page.locator('.ast-panel-page input[type=file]').setInputFiles('tests/fixtures/synthetic-discharge.docx');
    await expect(page.locator('.ast-attached .ast-doc-chip')).toContainText('synthetic discharge');
    const box = page.getByRole('textbox', { name: 'Message the assistant' });
    await box.fill('Please explain this');
    await box.press('Enter');
    await expect(page.locator('.ast-thinking')).toHaveCount(0, { timeout: 20000 });
    await expect(page.locator('.ast-msg-user .ast-doc-chip')).toContainText('synthetic discharge');
    await expect(page.locator('.astp-item-title')).toHaveText(['Please explain this']);
    await page.getByRole('button', { name: 'New conversation' }).click();
    await box.fill('I have a cough');
    await box.press('Enter');
    await expect(page.locator('.astp-item-title')).toHaveCount(2, { timeout: 20000 });
    // The file is in Documents too.
    await page.goto(page.url().replace('/assistant/', '/documents/'));
    await expect(page.getByText('synthetic discharge')).toBeVisible();
  });
});
