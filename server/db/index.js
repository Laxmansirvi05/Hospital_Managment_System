import { getConfig } from '../config.js';
import { createMemoryStore } from './memory.js';

let store = null;

/** Returns the store chosen by configuration: Postgres when DATABASE_URL is set, memory otherwise (P-27). */
export function getStore() {
  if (store) return store;
  throw new Error('Store not initialised. Call initStore() first.');
}

export async function initStore() {
  if (store) return store;
  const config = getConfig();
  if (config.store === 'postgres') {
    const { createPostgresStore } = await import('./postgres.js');
    store = createPostgresStore(config.databaseUrl);
  } else {
    store = createMemoryStore();
  }
  return store;
}

/** Test hook. */
export function setStoreForTests(s) {
  store = s;
}
