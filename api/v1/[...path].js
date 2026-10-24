// The only serverless entry point (P-01). Everything under /api/v1 goes through the router.
import { getConfig } from '../../server/config.js';
import { initStore } from '../../server/db/index.js';
import { handle } from '../../server/router.js';
import { prewarm } from '../../server/auth/crypto.js';

const warm = prewarm();

export default async function handler(req, res) {
  getConfig();
  await initStore();
  await warm;
  return handle(req, res);
}
