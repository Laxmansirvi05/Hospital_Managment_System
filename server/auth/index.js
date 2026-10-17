import { HttpError } from '../http.js';

/**
 * Authentication is built in WP-1. Until then every protected route fails closed with 401,
 * so nothing can be reached by mistake before real checks exist.
 * @param {import('node:http').IncomingMessage} _req
 * @returns {Promise<{ id: string, role: import('../router.js').Role }>}
 */
export async function authenticate(_req) {
  throw new HttpError(401, 'unauthenticated', 'Sign in to continue.');
}
