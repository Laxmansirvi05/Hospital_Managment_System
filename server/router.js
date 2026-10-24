// Route table. Every route declares who may call it; a route without that is refused at
// start-up (docs/02-trd.md section 4.10). Static paths are matched before ":id" paths.
import { randomUUID } from 'node:crypto';
import { authenticate } from './auth/session.js';
import { HttpError, send, sendError, unauthorized, forbidden } from './http.js';
import { log } from './log.js';
import { routes as health } from './routes/health.js';
import { routes as auth } from './routes/auth.js';
import { routes as patients } from './routes/patients.js';
import { routes as files } from './routes/files.js';
import { routes as discovery } from './routes/discovery.js';

const PREFIX = '/api/v1';

/**
 * @typedef {object} Route
 * @property {string} method
 * @property {string} path
 * @property {'public' | string[]} roles  'public' or a list of roles
 * @property {(ctx: any) => Promise<any>} handler
 * @property {boolean} [raw] handler writes the response itself
 */

/** @param {Route[]} list */
export function buildTable(list) {
  const seen = new Set();
  const table = list.map((r) => {
    if (!r.roles || (r.roles !== 'public' && (!Array.isArray(r.roles) || r.roles.length === 0))) {
      throw new Error(`Route ${r.method} ${r.path} must declare roles`);
    }
    const key = `${r.method} ${r.path}`;
    if (seen.has(key)) throw new Error(`Duplicate route ${key}`);
    seen.add(key);
    const parts = r.path.split('/').filter(Boolean);
    return { ...r, parts, statics: parts.filter((p) => !p.startsWith(':')).length };
  });
  // More static segments first, so /emergencies/mine never reads "mine" as an id.
  return table.sort((a, b) => b.statics - a.statics || b.parts.length - a.parts.length);
}

const TABLE = buildTable([...health, ...auth, ...patients, ...files, ...discovery]);

function match(table, method, pathname) {
  const parts = pathname.split('/').filter(Boolean);
  let pathMatched = false;
  for (const r of table) {
    if (r.parts.length !== parts.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < parts.length; i++) {
      if (r.parts[i].startsWith(':')) {
        try {
          params[r.parts[i].slice(1)] = decodeURIComponent(parts[i]);
        } catch {
          ok = false;
          break;
        }
      } else if (r.parts[i] !== parts[i]) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    pathMatched = true;
    if (r.method === method) return { route: r, params };
  }
  return { route: null, pathMatched };
}

const WRITE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** CSRF for cookie-authenticated writes (D-23). */
function checkCsrf(req, viaCookie) {
  if (!WRITE.has(req.method)) return;
  const origin = req.headers.origin;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (origin) {
    let originHost = '';
    try {
      originHost = new URL(origin).host;
    } catch {
      throw forbidden('csrf_failed', 'This request came from another site.');
    }
    if (originHost !== host) throw forbidden('csrf_failed', 'This request came from another site.');
  }
  if (viaCookie && req.headers['x-careroute-csrf'] !== '1') throw forbidden('csrf_failed', 'Missing request header.');
}

export async function handle(req, res) {
  const requestId = randomUUID();
  const started = Date.now();
  const url = new URL(req.url, 'http://localhost');
  let status = 500;
  let route = null;
  try {
    if (!url.pathname.startsWith(PREFIX)) throw new HttpError(404, 'not_found', 'Not found.');
    const found = match(TABLE, req.method, url.pathname.slice(PREFIX.length) || '/');
    route = found.route;
    if (!route) throw found.pathMatched ? new HttpError(405, 'method_not_allowed', 'Method not allowed.') : new HttpError(404, 'not_found', 'Not found.');

    let session = null;
    if (route.roles !== 'public') {
      session = await authenticate(req);
      if (!session) throw unauthorized();
      if (!route.roles.includes(session.user.role)) throw forbidden('role_not_allowed', 'Your account cannot do this.');
    } else {
      // Public writes still refuse a foreign Origin, which also blocks login CSRF.
      checkCsrf(req, false);
    }
    if (session) checkCsrf(req, session.viaCookie);

    const ctx = { req, res, url, params: found.params, query: url.searchParams, user: session?.user ?? null, sessionId: session?.sessionId ?? null, requestId };
    const result = await route.handler(ctx);
    if (route.raw) {
      status = res.statusCode;
      return;
    }
    status = result?.status ?? 200;
    send(res, status, result?.body, result?.headers);
  } catch (err) {
    status = err instanceof HttpError ? err.status : 500;
    sendError(res, err, requestId);
  } finally {
    log.info('request', { requestId, method: req.method, route: route ? route.path : 'unmatched', status, ms: Date.now() - started });
    // Security events (docs/09-security.md section 11): denials and limit hits, without personal data.
    if (status === 401 || status === 403 || status === 429) log.warn('security', { requestId, route: route ? route.path : 'unmatched', status });
  }
}

export { match, TABLE };
