// Sign in with Google (D-63): OpenID Connect authorisation code flow with PKCE, run by the server.
// The browser only follows redirects; the code, client secret and ID token never reach it.
// Errors send the patient back to the sign-in page with a short reason code and nothing else.
import { createHash, timingSafeEqual } from 'node:crypto';
import { getConfig } from '../config.js';
import { getStore } from '../db/index.js';
import { cookie, parseCookies } from '../http.js';
import { limit, clientIp } from '../limits.js';
import { signJwt, verifyJwt, randomToken } from '../auth/crypto.js';
import { startSession } from '../auth/session.js';
import { getGoogle } from '../adapters/google.js';
import { log } from '../log.js';

const FLOW_COOKIE = 'cr_google';
const FLOW_PATH = '/api/v1/auth/google';
const FLOW_TTL = 10 * 60;
const AUTHORIZE = 'https://accounts.google.com/o/oauth2/v2/auth';

/** Same-site paths only, so the flow cannot be used to bounce someone to another site. */
export function safeNext(next) {
  if (typeof next !== 'string' || !next.startsWith('/') || next.length > 300) return null;
  let url;
  try {
    url = new URL(next, 'http://x');
  } catch {
    return null;
  }
  // Checked after parsing: "/.//evil.example" normalises to "//evil.example", which a browser reads as another host.
  const path = `${url.pathname}${url.search}`;
  return url.host === 'x' && url.pathname !== '/' && !/^\/[\/\\]/.test(path) ? path : null;
}

function origin(req) {
  const { trustProxy, env } = getConfig();
  const proto = trustProxy && req.headers['x-forwarded-proto'] === 'https' ? 'https' : env === 'production' ? 'https' : 'http';
  const host = (trustProxy && req.headers['x-forwarded-host']) || req.headers.host;
  return `${proto}://${host}`;
}

const secure = (req) => getConfig().env === 'production' || req.headers['x-forwarded-proto'] === 'https';
const flowCookie = (req, value, maxAge) => cookie({ name: FLOW_COOKIE, value, maxAge, path: FLOW_PATH, secure: secure(req) });
const redirect = (location, cookies = []) => ({ status: 302, headers: { Location: location, 'Set-Cookie': cookies } });
const back = (req, reason) => redirect(`/signin/?google=${reason}`, [flowCookie(req, '', 0)]);

function sameText(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

/** The signed-in account for a Google identity: found by Google id, linked by email, or new. */
async function accountFor(identity) {
  const users = getStore().users;
  const known = await users.byGoogleSub(identity.sub);
  if (known) return known;
  const byEmail = await users.byEmail(identity.email);
  if (byEmail) {
    // Google sign-in is for patients. Driver and admin accounts keep their password sign-in only.
    if (byEmail.role !== 'patient') return { refused: 'not_patient' };
    if (byEmail.disabledAt) return { refused: 'disabled' };
    return (await users.linkGoogle(byEmail.id, identity.sub)) || { refused: 'linked_elsewhere' };
  }
  const name = identity.name.replace(/\s+/g, ' ').trim().slice(0, 100) || identity.email.split('@')[0].slice(0, 100);
  const created = await users.create({ name, email: identity.email, googleSub: identity.sub, role: 'patient' });
  return created ? { ...created, isNew: true } : { refused: 'try_again' };
}

export const routes = [
  {
    method: 'GET', path: '/auth/google/start', roles: 'public',
    async handler({ req, query }) {
      const cfg = getConfig();
      if (!cfg.google) return back(req, 'unavailable');
      await limit('google-start', clientIp(req), 30, 900);
      const state = randomToken();
      const verifier = randomToken(48);
      const nonce = randomToken();
      const flow = signJwt({ typ: 'google-flow', state, verifier, nonce, next: safeNext(query.get('next')) }, cfg.jwtSecret, FLOW_TTL);
      const url = new URL(AUTHORIZE);
      url.search = new URLSearchParams({
        client_id: cfg.google.clientId,
        redirect_uri: `${origin(req)}${FLOW_PATH}/callback`,
        response_type: 'code',
        scope: 'openid email profile',
        state,
        nonce,
        code_challenge: createHash('sha256').update(verifier).digest('base64url'),
        code_challenge_method: 'S256',
        prompt: 'select_account',
      }).toString();
      return redirect(url.toString(), [flowCookie(req, flow, FLOW_TTL)]);
    },
  },
  {
    method: 'GET', path: '/auth/google/callback', roles: 'public',
    async handler({ req, query, requestId }) {
      const cfg = getConfig();
      if (!cfg.google) return back(req, 'unavailable');
      if (query.get('error')) return back(req, 'cancelled');
      const flow = verifyJwt(parseCookies(req.headers.cookie)[FLOW_COOKIE], cfg.jwtSecret);
      // A missing or old flow cookie, or a state that does not match, is a forged or replayed return.
      if (!flow.ok || flow.claims.typ !== 'google-flow' || !sameText(flow.claims.state, query.get('state') || '')) return back(req, 'expired');
      const code = query.get('code');
      if (!code || code.length > 2048) return back(req, 'failed');
      await limit('google-callback', clientIp(req), 30, 900);

      let identity;
      try {
        identity = await getGoogle().identity({ code, verifier: flow.claims.verifier, nonce: flow.claims.nonce, redirectUri: `${origin(req)}${FLOW_PATH}/callback` });
      } catch (err) {
        // The reason only; Google's answer can hold the code or the person's details.
        log.warn('google_sign_in_failed', { requestId, reason: err.reason || 'unexpected' });
        return back(req, 'failed');
      }
      const account = await accountFor(identity);
      if (account.refused) {
        log.warn('google_sign_in_refused', { requestId, reason: account.refused });
        return back(req, account.refused);
      }
      if (account.disabledAt) return back(req, 'disabled');
      const { cookies } = await startSession(req, account);
      const next = account.isNew ? '/medical-id/?welcome=1' : flow.claims.next || '/dashboard/';
      return redirect(next, [flowCookie(req, '', 0), ...cookies]);
    },
  },
];
