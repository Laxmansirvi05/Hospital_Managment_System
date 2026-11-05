// Measures the local, memory-mode red-flag API path. The fake model throws if called, which
// proves the timing covers the rule response without contacting a provider.
import { performance } from 'node:perf_hooks';
import { startApp } from '../tests/helpers.js';
import { setAiForTests } from '../server/adapters/ai.js';

const SAMPLE_COUNT = 25;
const MESSAGE = 'I have severe chest pain and sweating';

const app = await startApp({ ai: true });
let providerCalls = 0;
app.activate();
setAiForTests({ async complete() { providerCalls += 1; throw new Error('Red-flag benchmark must not call a model'); } });

try {
  const patient = await app.user();
  const durations = [];
  for (let i = 0; i < SAMPLE_COUNT; i += 1) {
    const started = performance.now();
    const response = await app.api('/assistant/triage', { token: patient.token, body: { message: MESSAGE } });
    durations.push(performance.now() - started);
    if (response.status !== 200 || response.body.urgency !== 'emergency' || !/112/.test(response.body.advice)) {
      throw new Error(`Rule path returned an unexpected response (${response.status})`);
    }
  }
  if (providerCalls !== 0) throw new Error(`Unexpected fake-provider calls: ${providerCalls}`);

  durations.sort((a, b) => a - b);
  const percentile = (p) => durations[Math.ceil(p * durations.length) - 1];
  process.stdout.write(`${JSON.stringify({ mode: 'memory', path: '/assistant/triage', samples: SAMPLE_COUNT, medianMs: +percentile(0.5).toFixed(2), p95Ms: +percentile(0.95).toFixed(2), providerCalls })}\n`);
} finally {
  setAiForTests(null);
  await app.close();
}
