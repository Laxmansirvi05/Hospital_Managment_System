import { randomUUID } from 'node:crypto';
import { authenticate as defaultAuthenticate } from './auth/index.js';
import { ConfigError, getConfig } from './config.js';
import { db } from './db/index.js';
import { HttpError, errorBody, sendJson } from './http.js';
import { log as defaultLog } from './log.js';
import { Router } from './router.js';
import { registerSystemRoutes } from './routes/system.js';

const PREFIX = '/api/v1';

export function buildRouter() {
  const router = new Router();
  registerSystemRoutes(router);
  return router;
}

/**
 * @param {{ router?: Router, deps?: object, authenticate?: typeof defaultAuthenticate,
 *   log?: ReturnType<typeof import('./log.js').createLogger> }} [options]
 */
export function createApp({ router = buildRouter(), deps, authenticate = defaultAuthenticate, log = defaultLog } = {}) {
  const context = { db, getConfig, log, ...deps };

  /** @param {import('node:http').IncomingMessage} req @param {import('node:http').ServerResponse} res */
  return async function handle(req, res) {
    const started = performance.now();
    const requestId = randomUUID();
    const headers = { 'x-request-id': requestId };
    let routePath = 'unmatched';
    let status = 500;
    let role;

    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      if (!url.pathname.startsWith(`${PREFIX}/`) && url.pathname !== PREFIX) {
        throw new HttpError(404, 'not_found', 'No such endpoint.');
      }
      const found = router.match(req.method ?? 'GET', url.pathname.slice(PREFIX.length));
      if (!found) throw new HttpError(404, 'not_found', 'No such endpoint.');
      if ('notAllowed' in found) {
        headers.allow = found.notAllowed.join(', ');
        throw new HttpError(405, 'method_not_allowed', 'This method is not allowed here.');
      }

      const { route, params } = found;
      routePath = route.path;

      let user = null;
      if (route.options.roles !== 'public') {
        user = await authenticate(req);
        role = user.role;
        if (!route.options.roles.includes(user.role)) {
          throw new HttpError(403, 'forbidden', 'Your role cannot do this.');
        }
      }

      const result = await route.handler({
        req,
        params,
        query: Object.fromEntries(url.searchParams),
        user,
        deps: context,
      });
      status = result.status;
      sendJson(res, status, result.body, { ...headers, ...result.headers });
    } catch (error) {
      if (error instanceof HttpError) {
        status = error.status;
        sendJson(res, status, errorBody(error), headers);
      } else if (error instanceof ConfigError) {
        status = 500;
        log.error('config_invalid', { group: error.group, problems: error.problems, requestId });
        sendJson(res, status, errorBody(new HttpError(500, 'server_misconfigured', 'The server is not configured.')), headers);
      } else {
        status = 500;
        log.error('unhandled_error', { error, requestId });
        sendJson(res, status, errorBody(new HttpError(500, 'internal_error', 'Something went wrong.')), headers);
      }
    } finally {
      // Route pattern, never the raw URL, so query tokens cannot reach the logs.
      log.info('request', {
        requestId,
        method: req.method,
        route: routePath,
        status,
        durationMs: Math.round(performance.now() - started),
        role,
      });
    }
  };
}
