// The only serverless entry point (P-01). Everything under /api/v1 goes through the router.
import { getConfig } from '../../server/config.js';
import { initStore } from '../../server/db/index.js';
import { handle } from '../../server/router.js';
import { prewarm } from '../../server/auth/crypto.js';

const warm = prewarm();

/**
 * The vercel.json rewrite copies the matched path into the query string as `path`. The router
 * reads the path from the URL itself, and the strict query schemas would reject the extra key.
 */
export function dropRewriteParam(url) {
  const q = url.indexOf('?');
  if (q === -1) return url;
  const params = new URLSearchParams(url.slice(q + 1));
  if (!params.has('path')) return url;
  params.delete('path');
  const rest = params.toString();
  return url.slice(0, q) + (rest ? `?${rest}` : '');
}

export default async function handler(req, res) {
  getConfig();
  await initStore();
  await warm;
  req.url = dropRewriteParam(req.url);
  return handle(req, res);
}
