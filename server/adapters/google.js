// Google's OAuth token endpoint (D-63). The only outbound call Google sign-in makes.
import { getConfig } from '../config.js';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);

/** A failure with a fixed reason code, the only part that is logged (never Google's reply). */
class GoogleError extends Error {
  constructor(reason) {
    super(reason);
    this.reason = reason;
  }
}

/** Reads the claims of a JWT without checking its signature. */
function claimsOf(idToken) {
  const part = String(idToken || '').split('.')[1];
  if (!part) throw new GoogleError('no_id_token');
  try {
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
  } catch {
    throw new GoogleError('bad_id_token');
  }
}

/**
 * Checks the ID token claims. The signature is not checked: the token came straight from
 * Google's token endpoint over TLS in exchange for our client secret, which OpenID Connect
 * Core 1.0 section 3.1.3.7 rule 6 accepts in place of a signature check.
 */
export function checkClaims(claims, { clientId, nonce, now = Date.now() }) {
  if (!ISSUERS.has(claims.iss)) throw new GoogleError('wrong issuer');
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.includes(clientId)) throw new GoogleError('wrong audience');
  if (typeof claims.exp !== 'number' || claims.exp * 1000 <= now) throw new GoogleError('expired');
  if (!nonce || claims.nonce !== nonce) throw new GoogleError('nonce mismatch');
  if (typeof claims.sub !== 'string' || !/^[0-9A-Za-z_-]{1,255}$/.test(claims.sub)) throw new GoogleError('bad subject');
  // Only an address Google has verified may sign in to, or link with, a CareRoute account.
  if (claims.email_verified !== true || typeof claims.email !== 'string') throw new GoogleError('email not verified');
  return { sub: claims.sub, email: claims.email.trim().toLowerCase(), name: typeof claims.name === 'string' ? claims.name : '' };
}

function googleTokens() {
  return {
    /** Swaps an authorisation code for the user's verified identity. */
    async identity({ code, verifier, redirectUri, nonce }) {
      const { clientId, clientSecret } = getConfig().google;
      let res;
      try {
        res = await fetch(TOKEN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri,
            grant_type: 'authorization_code', code_verifier: verifier,
          }),
          signal: AbortSignal.timeout(10000),
        });
      } catch {
        throw new GoogleError('token_endpoint_unreachable');
      }
      if (!res.ok) throw new GoogleError(`token_endpoint_${res.status}`);
      let body;
      try {
        body = await res.json();
      } catch {
        throw new GoogleError('token_response_not_json');
      }
      return checkClaims(claimsOf(body.id_token), { clientId, nonce });
    },
  };
}

let google = null;
export function getGoogle() {
  if (!google) google = googleTokens();
  return google;
}

/** Test hook: replace the token exchange with a fake. */
export function setGoogleForTests(g) {
  google = g;
}
