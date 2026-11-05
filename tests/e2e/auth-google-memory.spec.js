import { mkdirSync } from 'node:fs';
import { chromium, test, expect } from '@playwright/test';

const baseURL = process.env.CAREROUTE_BASE_URL || 'http://127.0.0.1:4403';

test('Google sign-in completes with a local fake provider in memory mode', async () => {
  test.setTimeout(60000);
  // DNS fallback is disabled for Google so a routing mistake cannot reach a real endpoint.
  const browser = await chromium.launch({ args: ['--host-resolver-rules=MAP accounts.google.com ~NOTFOUND'] });
  const context = await browser.newContext({ serviceWorkers: 'block' });
  try {
    await context.route('**/*', (route) => {
      const requestUrl = new URL(route.request().url());
      if (requestUrl.origin === baseURL) return route.continue();
      return route.abort();
    });
    // Rewrite the local server's 302 before a browser request can leave for Google's host.
    await context.route(`${baseURL}/api/v1/auth/google/start**`, async (route) => {
      const response = await route.fetch({ maxRedirects: 0 });
      const authorization = new URL(response.headers().location);
      if (authorization.origin !== 'https://accounts.google.com' || authorization.pathname !== '/o/oauth2/v2/auth') {
        throw new Error('Unexpected OAuth authorization destination');
      }
      const callback = new URL(authorization.searchParams.get('redirect_uri'));
      callback.searchParams.set('code', `careroute-e2e.${authorization.searchParams.get('nonce')}`);
      callback.searchParams.set('state', authorization.searchParams.get('state'));
      return route.fulfill({ response, headers: { ...response.headers(), location: callback.toString() } });
    });

    const page = await context.newPage();
    await page.goto(`${baseURL}/signin/`);
    const googleButton = page.getByRole('button', { name: 'Continue with Google' });
    await expect(googleButton).toBeEnabled();
    await googleButton.click();
    await page.waitForURL(/\/(?:medical-id|signin)\//, { timeout: 15000 });
    await expect(page).toHaveURL(/\/medical-id\/\?welcome=1$/);
    await expect(page.getByText(/Sample data mode/)).toBeVisible();
    await expect(page.getByText('Browser Google Patient')).toBeVisible();

    mkdirSync('docs/audit/evidence-codex-2026-11-06', { recursive: true });
    await page.screenshot({ path: 'docs/audit/evidence-codex-2026-11-06/google-signin-memory.png', fullPage: true });
  } finally {
    await browser.close();
  }
});
