import { getConfig } from '../config.js';
import { getStore } from '../db/index.js';
import { HttpError } from '../http.js';

export const routes = [
  {
    method: 'GET', path: '/health', roles: 'public',
    async handler() {
      const store = getStore();
      try {
        if (store.ping) await store.ping();
      } catch {
        throw new HttpError(503, 'database_unavailable', 'The database is not reachable.');
      }
      return { body: { status: 'ok' } };
    },
  },
  {
    // Allow-listed public values only (P-13, docs/09-security.md section 3.1).
    method: 'GET', path: '/config', roles: 'public',
    async handler() {
      const cfg = getConfig();
      return { body: { ...cfg.publicValues, dataMode: cfg.store === 'memory' ? 'sample' : 'live' } };
    },
  },
];
