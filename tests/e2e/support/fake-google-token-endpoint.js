// Opt-in test adapter for scripts/dev.js. It accepts only CareRoute's synthetic OAuth code and
// blocks every external server-side fetch, so a browser OAuth test cannot contact Google.
if (process.env.CAREROUTE_FAKE_GOOGLE !== '1') {
  throw new Error('This test adapter requires CAREROUTE_FAKE_GOOGLE=1');
}

const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (url.origin !== 'https://oauth2.googleapis.com' || url.pathname !== '/token' || init.method !== 'POST') {
    throw new Error('External fetch blocked by the fake Google test adapter');
  }

  const form = new URLSearchParams(init.body);
  const match = /^careroute-e2e\.([A-Za-z0-9_-]+)$/.exec(form.get('code') || '');
  if (!match || form.get('client_id') !== process.env.GOOGLE_CLIENT_ID) {
    return Response.json({ error: 'invalid_grant' }, { status: 400 });
  }

  const claims = {
    iss: 'https://accounts.google.com',
    aud: form.get('client_id'),
    exp: Math.floor(Date.now() / 1000) + 60,
    nonce: match[1],
    sub: 'careroute-e2e-google-user',
    email: 'browser-google@example.test',
    email_verified: true,
    name: 'Browser Google Patient',
  };
  const idToken = `e30.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.test-signature`;
  return Response.json({ id_token: idToken, token_type: 'Bearer' });
};

process.on('exit', () => { globalThis.fetch = realFetch; });
