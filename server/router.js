/**
 * @typedef {'patient'|'driver'|'hospital_admin'|'dispatcher'} Role
 * @typedef {{ roles: 'public' | Role[] }} RouteOptions
 * @typedef {(ctx: RouteContext) => Promise<{ status: number, body?: unknown, headers?: Record<string, string> }>} RouteHandler
 * @typedef {{ req: import('node:http').IncomingMessage, params: Record<string, string>,
 *   query: Record<string, string>, user: { id: string, role: Role } | null, deps: any }} RouteContext
 * @typedef {{ method: string, path: string, options: RouteOptions, handler: RouteHandler,
 *   segments: string[], hasParams: boolean }} Route
 */

const ROLES = new Set(['patient', 'driver', 'hospital_admin', 'dispatcher']);
const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

/** @param {string} path */
function split(path) {
  return path.split('/').filter(Boolean);
}

/** @param {string[]} pattern @param {string[]} actual */
function matchSegments(pattern, actual) {
  if (pattern.length !== actual.length) return null;
  /** @type {Record<string, string>} */
  const params = {};
  for (let i = 0; i < pattern.length; i += 1) {
    if (pattern[i].startsWith(':')) {
      params[pattern[i].slice(1)] = decodeURIComponent(actual[i]);
    } else if (pattern[i] !== actual[i]) {
      return null;
    }
  }
  return params;
}

export class Router {
  /** @type {Route[]} */
  #routes = [];

  /**
   * @param {string} method
   * @param {string} path relative to /api/v1, for example '/emergencies/:id'
   * @param {RouteOptions} options roles are required so no route is public by accident
   * @param {RouteHandler} handler
   */
  add(method, path, options, handler) {
    if (!METHODS.has(method)) throw new Error(`Unsupported method ${method}`);
    const roles = options?.roles;
    const rolesValid = roles === 'public' || (Array.isArray(roles) && roles.length > 0 && roles.every((r) => ROLES.has(r)));
    if (!rolesValid) throw new Error(`Route ${method} ${path} must declare roles`);

    const segments = split(path);
    const hasParams = segments.some((s) => s.startsWith(':'));

    // A static path registered after a matching parameter path would never be reached,
    // for example /emergencies/mine after /emergencies/:id. Fail at startup instead.
    if (!hasParams) {
      const shadow = this.#routes.find((r) => r.method === method && r.hasParams && matchSegments(r.segments, segments));
      if (shadow) throw new Error(`Route ${method} ${path} is shadowed by ${shadow.path}. Register it first.`);
    }
    if (this.#routes.some((r) => r.method === method && r.path === path)) {
      throw new Error(`Route ${method} ${path} is registered twice`);
    }
    this.#routes.push({ method, path, options, handler, segments, hasParams });
    return this;
  }

  /**
   * @param {string} method
   * @param {string} pathname relative to /api/v1
   * @returns {{ route: Route, params: Record<string, string> } | { notAllowed: string[] } | null}
   */
  match(method, pathname) {
    const actual = split(pathname);
    const allowed = [];
    for (const route of this.#routes) {
      const params = matchSegments(route.segments, actual);
      if (!params) continue;
      if (route.method === method) return { route, params };
      allowed.push(route.method);
    }
    return allowed.length ? { notAllowed: allowed } : null;
  }

  get routes() {
    return this.#routes.map(({ method, path, options }) => ({ method, path, roles: options.roles }));
  }
}
