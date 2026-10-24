// The only serverless entry point (P-01). Everything under /api/v1 goes through the router.
import { getConfig } from '../../server/config.js';
import { initStore } from '../../server/db/index.js';
import { handle } from '../../server/router.js';

export default async function handler(req, res) {
  getConfig();
  await initStore();
  return handle(req, res);
}
