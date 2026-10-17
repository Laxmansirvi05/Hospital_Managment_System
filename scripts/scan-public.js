// Fails if anything under public/ could leak a secret. docs/09-security.md section 3.2 rule 6.
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { SERVER_SECRET_NAMES } from '../server/config.js';

const KEY_PATTERNS = [
  { name: 'Google API key', pattern: /AIza[0-9A-Za-z_-]{35}/ },
  { name: 'Mapbox secret token', pattern: /\bsk\.eyJ[0-9A-Za-z._-]+/ },
  { name: 'Groq key', pattern: /\bgsk_[0-9A-Za-z]{20,}/ },
  { name: 'OpenRouter key', pattern: /\bsk-or-[0-9A-Za-z-]{20,}/ },
  { name: 'Twilio key SID', pattern: /\bSK[0-9a-fA-F]{32}\b/ },
  { name: 'Private key', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'Postgres URL with password', pattern: /postgres(?:ql)?:\/\/[^\s:'"]+:[^\s@'"]+@/ },
  { name: 'Supabase service role reference', pattern: /service_role/ },
  { name: 'Server code reference', pattern: /(?:from\s+|import\s*\(\s*)['"][./]*server\// },
];

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else yield path;
  }
}

/**
 * @param {string} root
 * @param {Record<string, string | undefined>} env
 * @returns {Promise<string[]>} problems, each naming a file and a rule, never a value
 */
export async function scanPublic(root, env = process.env) {
  const secretValues = SERVER_SECRET_NAMES
    .map((name) => [name, env[name]])
    .filter(([, value]) => typeof value === 'string' && value.length >= 8 && value !== 'replace-me');
  const problems = [];

  for await (const file of walk(root)) {
    const text = await readFile(file, 'utf8').catch(() => '');
    const where = relative(process.cwd(), file);
    for (const name of SERVER_SECRET_NAMES) {
      if (text.includes(name)) problems.push(`${where}: mentions server variable ${name}`);
    }
    for (const [name, value] of secretValues) {
      if (text.includes(value)) problems.push(`${where}: contains the value of ${name}`);
    }
    for (const { name, pattern } of KEY_PATTERNS) {
      if (pattern.test(text)) problems.push(`${where}: matches ${name}`);
    }
  }
  return problems;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const problems = await scanPublic('public');
  if (problems.length) {
    process.stdout.write(`Public file scan failed:\n${problems.map((p) => `  ${p}`).join('\n')}\n`);
    process.exit(1);
  }
  process.stdout.write('Public file scan passed.\n');
}
