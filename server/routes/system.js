import { ConfigError } from '../config.js';
import { HttpError } from '../http.js';

/** @param {import('../router.js').Router} router */
export function registerSystemRoutes(router) {
  // Collection folder 0: ok only when the API and the database are reachable.
  router.add('GET', '/health', { roles: 'public' }, async ({ deps }) => {
    try {
      await deps.db.ping();
    } catch (error) {
      // Missing configuration is a different fault from an unreachable database. Let it surface as 500.
      if (error instanceof ConfigError) throw error;
      deps.log.error('health_db_unreachable', { error });
      throw new HttpError(503, 'unavailable', 'The database is not reachable.');
    }
    return { status: 200, body: { status: 'ok' } };
  });

  // The browser has no build step, so it reads its public values here. Only the
  // allow-listed names are returned. docs/09-security.md section 3.1.
  router.add('GET', '/config', { roles: 'public' }, async ({ deps }) => {
    const env = deps.getConfig('publicConfig');
    return {
      status: 200,
      body: {
        supabaseUrl: env.PUBLIC_SUPABASE_URL,
        supabaseAnonKey: env.PUBLIC_SUPABASE_ANON_KEY,
        maptilerKey: env.PUBLIC_MAPTILER_KEY,
      },
      headers: { 'cache-control': 'public, max-age=300' },
    };
  });
}
