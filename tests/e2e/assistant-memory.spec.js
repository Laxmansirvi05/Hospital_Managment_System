import { mkdirSync } from 'node:fs';
import { test, expect } from '@playwright/test';

const baseURL = process.env.CAREROUTE_BASE_URL || 'http://127.0.0.1:4403';

test('assistant consent, fake reply, rule-layer emergency and saved conversation work in memory mode', async ({ page }) => {
  test.setTimeout(45000);
  await page.route('https://**/*', (route) => route.abort());
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `10.92.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200) + 1}` });
  await page.goto(`${baseURL}/signup/`);
  await page.locator('input[autocomplete="name"]').fill('Assistant Memory Patient');
  await page.locator('input[autocomplete="email"]').fill(`assistant-memory-${Date.now()}@example.test`);
  await page.locator('input[autocomplete="new-password"]').fill('assistant-memory-password-123');
  await page.getByRole('checkbox', { name: /agree to the terms/i }).check();
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL(/medical-id/);

  await page.goto(`${baseURL}/assistant/`);
  await expect(page.getByRole('heading', { name: 'Before we start' })).toBeVisible();
  await expect(page.getByText(/sends your messages to an AI service: Groq/i)).toBeVisible();
  await page.getByRole('button', { name: 'Agree and continue' }).click();
  const input = page.getByRole('textbox', { name: 'Message the assistant' });
  await expect(input).toBeVisible();
  await input.fill('Mild headache for one day');
  await page.getByRole('button', { name: 'Send' }).click();
  const log = page.getByRole('log', { name: 'Conversation' });
  await expect(log.getByText('A doctor can help you decide what to do next.')).toBeVisible();
  await expect(log.getByText('Not urgent')).toBeVisible();
  await expect(log.getByText(/not a diagnosis or a prescription/i)).toBeVisible();
  const conversation = page.locator('.astp-item').filter({ hasText: 'Mild headache for one day' });
  await expect(conversation).toBeVisible();
  await page.screenshot({ path: 'docs/audit/evidence-codex-2026-11-06/assistant-fake-reply.png', fullPage: true });

  await input.fill('I have severe chest pain');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(log.getByRole('alert').getByRole('link', { name: /Call 112/ })).toBeVisible();
  await expect(log.getByText(/heart attack/i)).toBeVisible();
  await page.screenshot({ path: 'docs/audit/evidence-codex-2026-11-06/assistant-rule-emergency.png', fullPage: true });

  await conversation.click();
  await expect(log.getByText('I have severe chest pain')).toBeVisible();
  await expect(log.getByRole('alert').getByRole('link', { name: /Call 112/ })).toBeVisible();
  await page.locator('.astp-row').getByRole('button', { name: /Delete Mild headache for one/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText('Your conversations are saved here.')).toBeVisible();
});
