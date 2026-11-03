import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const base = process.env.CAREROUTE_BASE_URL || 'http://127.0.0.1:4002';
const out = path.join(process.cwd(), 'docs/audit/browser-pass');
const routes = [
  '/', '/signin/', '/signup/', '/dashboard/', '/search/hospitals/', '/search/doctors/',
  '/search/medicines/', '/search/diagnostics/', '/pharmacy/', '/hospital/', '/doctor/',
  '/medicine/', '/diagnostic/', '/explore/', '/appointments/', '/reminders/', '/medical-id/',
  '/documents/', '/account/', '/settings/', '/sos/', '/privacy/', '/terms/', '/not-a-real-route',
];
const viewports = [{ name: 'mobile', width: 390, height: 844 }, { name: 'tablet', width: 820, height: 1180 }, { name: 'desktop', width: 1440, height: 900 }];
const browser = await chromium.launch({ headless: true });
const rows = [];
for (const viewport of viewports) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, reducedMotion: 'reduce' });
  for (const route of routes) {
    const page = await context.newPage();
    const consoleErrors = [];
    const failedRequests = [];
    const csp = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('requestfailed', req => failedRequests.push({ url: req.url(), error: req.failure()?.errorText || 'unknown' }));
    page.on('console', msg => { if (/content security policy|CSP/i.test(msg.text())) csp.push(msg.text()); });
    let status = null;
    let finalUrl = '';
    try {
      const response = await page.goto(base + route, { waitUntil: 'domcontentloaded', timeout: 15000 });
      status = response?.status() ?? null;
      await page.waitForTimeout(250);
      finalUrl = page.url();
      const metrics = await page.evaluate(() => {
        const text = [...document.querySelectorAll('body *')].filter(e => e.children.length === 0 && e.textContent?.trim());
        const sizes = text.map(e => parseFloat(getComputedStyle(e).fontSize)).filter(Number.isFinite);
        const buttons = [...document.querySelectorAll('button,a,[role="button"],input,select,textarea')];
        const small = buttons.filter(e => { const r=e.getBoundingClientRect(); return r.width < 44 || r.height < 44; }).length;
        return {
          title: document.title,
          h1: [...document.querySelectorAll('h1')].map(e=>e.innerText.trim()).slice(0,3),
          horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          viewportWidth: document.documentElement.clientWidth,
          documentWidth: document.documentElement.scrollWidth,
          minTextPx: sizes.length ? Math.min(...sizes) : null,
          smallTouchTargets: small,
          totalTouchTargets: buttons.length,
          missingAlt: [...document.querySelectorAll('img:not([alt])')].length,
          robotCanvas: !!document.querySelector('canvas'),
          video: [...document.querySelectorAll('video')].map(v => ({src: v.currentSrc || v.querySelector('source')?.src || '', preload: v.preload, autoplay: v.autoplay, muted: v.muted})),
          links: [...document.querySelectorAll('a[href]')].map(a=>a.href).filter(h=>h.startsWith(location.origin)),
          scripts: [...document.scripts].map(s=>s.src).filter(Boolean),
        };
      });
      if (viewport.name === 'mobile') await page.screenshot({ path: path.join(out, `${route.replaceAll('/', '_') || 'home'}-mobile.png`), fullPage: true, animations: 'disabled' }).catch(()=>{});
      rows.push({ viewport: viewport.name, route, status, finalUrl, metrics, consoleErrors: consoleErrors.slice(0,10), failedRequests: failedRequests.slice(0,10), csp: csp.slice(0,10) });
    } catch (error) {
      rows.push({ viewport: viewport.name, route, status, finalUrl, error: String(error), consoleErrors: consoleErrors.slice(0,10), failedRequests: failedRequests.slice(0,10), csp: csp.slice(0,10) });
    }
    await page.close();
  }
  await context.close();
}
await browser.close();
await fs.writeFile(path.join(out, 'browser-results.json'), JSON.stringify({ base, generatedAt: new Date().toISOString(), rows }, null, 2));
console.log(JSON.stringify({ output: out, base, count: rows.length, statuses: rows.reduce((a,r)=>(a[r.status ?? 'error']=(a[r.status ?? 'error']||0)+1,a),{}), overflow: rows.filter(r=>r.metrics?.horizontalOverflow).map(r=>[r.viewport,r.route]), errors: rows.filter(r=>r.consoleErrors?.length || r.failedRequests?.length).map(r=>({viewport:r.viewport,route:r.route,console:r.consoleErrors.length,failed:r.failedRequests.length})).slice(0,30) }, null, 2));
