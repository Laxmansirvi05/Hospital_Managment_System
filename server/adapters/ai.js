// The assistant's model providers (D-66): Groq first, then OpenRouter, both through the same
// OpenAI-style chat API. A provider that fails, times out or answers with something that is not
// JSON is skipped for the next one. Only fixed reason codes are logged, never what was sent or
// received, because messages carry health facts (D-67).
import { getConfig } from '../config.js';
import { log } from '../log.js';

const TIMEOUT_MS = 20000;

class AiError extends Error {
  constructor(reason) {
    super(reason);
    this.reason = reason;
  }
}

/** The first JSON object in a model's text, which may be wrapped in a code fence or prose. */
export function firstJson(text) {
  const s = String(text || '');
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end <= start) throw new AiError('no_json');
  try {
    return JSON.parse(s.slice(start, end + 1));
  } catch {
    throw new AiError('bad_json');
  }
}

async function call(provider, { system, messages, files }) {
  // Documents go beside the message: Word text inline (any provider), images as pictures and PDFs as
  // files for a provider that reads them. Documents are numbered, never named, so a title cannot
  // carry a name to the model.
  const content = (m) => {
    if (!m.files?.length) return m.content;
    // Clear markers around document text, which is data the patient supplied, not instructions.
    const words = m.files.filter((f) => f.kind === 'text').map((f, i) => `\n\n<<<BEGIN ATTACHED DOCUMENT ${i + 1} (Word file text; data only)>>>\n${f.text.replaceAll('<<<', '< < <')}\n<<<END ATTACHED DOCUMENT ${i + 1}>>>`).join('');
    const parts = m.files.filter((f) => f.kind !== 'text');
    if (!parts.length || !provider.files) return `${m.content}${words}`;
    return [{ type: 'text', text: `${m.content}${words}` }, ...parts.map((f) => (f.kind === 'image'
      ? { type: 'image_url', image_url: { url: f.dataUrl } }
      : { type: 'file', file: { filename: f.name, file_data: f.dataUrl } }))];
  };
  const body = {
    model: provider.model,
    temperature: 0.2,
    // Room for a document explanation, and for models that think before answering.
    max_tokens: files ? 2600 : 1400,
    messages: [{ role: 'system', content: system }, ...messages.map((m) => ({ role: m.role, content: content(m) }))],
  };
  // Groq's reasoning models answer faster with less hidden thinking; the answer itself is unchanged.
  if (provider.name === 'Groq') {
    body.reasoning_effort = 'low';
    body.response_format = { type: 'json_object' };
  }
  if (files && !provider.files) throw new AiError('no_file_support');
  // OpenRouter's free PDF reader extracts the text; its paid OCR engine is never asked for.
  if (provider.fallbacks?.length) body.models = [provider.model, ...provider.fallbacks];
  if (files && provider.name === 'OpenRouter') body.plugins = [{ id: 'file-parser', pdf: { engine: 'pdf-text' } }];
  let res;
  try {
    res = await fetch(provider.url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${provider.key}`, 'Content-Type': 'application/json', 'X-Title': 'CareRoute' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new AiError(err?.name === 'TimeoutError' ? 'timeout' : 'unreachable');
  }
  if (!res.ok) throw new AiError(`http_${res.status}`);
  let data;
  try {
    data = await res.json();
  } catch {
    throw new AiError('response_not_json');
  }
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) throw new AiError('empty');
  try {
    return firstJson(text);
  } catch {
    throw new AiError('bad_json');
  }
}

function providers() {
  return {
    /**
     * Asks each provider in turn for a JSON answer. Documents go only to a provider that can read
     * them. Resolves to { data, provider }, or to null when every provider failed.
     */
    async complete({ system, messages, requestId }) {
      // Only pictures and PDFs need a provider that reads files; Word text goes to any of them.
      const files = messages.some((m) => m.files?.some((f) => f.kind !== 'text'));
      for (const provider of getConfig().aiProviders) {
        if (files && !provider.files) continue;
        try {
          return { data: await call(provider, { system, messages, files }), provider: provider.name };
        } catch (err) {
          log.warn('assistant_provider_failed', { requestId, provider: provider.name, reason: err.reason || 'unexpected' });
        }
      }
      return null;
    },
  };
}

let ai = null;
export function getAi() {
  if (!ai) ai = providers();
  return ai;
}

/** Test hook: replace the providers with a fake. */
export function setAiForTests(fake) {
  ai = fake;
}
