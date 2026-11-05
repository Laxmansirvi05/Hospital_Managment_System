// Opt-in local fake for the signed-in assistant browser journey. Only the Groq-shaped fake
// endpoint is accepted; all other server-side fetches are rejected without touching the network.
if (process.env.CAREROUTE_FAKE_AI !== '1') {
  throw new Error('This test adapter requires CAREROUTE_FAKE_AI=1');
}

const BODY = {
  reply: 'A doctor can help you decide what to do next.',
  urgency: 'routine',
  suggestedSpecialty: 'General Medicine',
  search: { kind: 'none' },
};

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (url.origin !== 'https://api.groq.com' || url.pathname !== '/openai/v1/chat/completions' || init.method !== 'POST') {
    throw new Error('External fetch blocked by the fake AI test adapter');
  }
  return Response.json({ choices: [{ message: { content: JSON.stringify(BODY) } }] });
};
