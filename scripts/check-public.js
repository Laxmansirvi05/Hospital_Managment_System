// Fails if anything under public/ could leak a secret or write HTML from data
// (docs/09-security.md section 3.2, docs/02-trd.md section 8.7). Run: pnpm check
import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const SECRET_NAMES = ['DATABASE_URL', 'JWT_SECRET', 'TRACKING_TOKEN_PEPPER', 'SUPABASE_SERVICE_ROLE_KEY', 'GEMINI_API_KEY', 'GROQ_API_KEY', 'OPENROUTER_API_KEY', 'MAPBOX_SECRET_TOKEN', 'TWILIO_ACCOUNT_SID', 'TWILIO_API_KEY_SID', 'TWILIO_API_KEY_SECRET'];
const RULES = [
  [/server\//, 'references server code'],
  [/\binnerHTML\b|\bouterHTML\b|insertAdjacentHTML/, 'writes HTML from a string'],
  [/\beval\(|new Function\(/, 'evaluates code from a string'],
  [/\u2014/, 'contains an em dash'],
  [/\bstyle\s*=\s*["']/, 'inline style attribute, blocked by the CSP'],
  [/setAttribute\(\s*["']style["']/, 'runtime style attribute write, blocked by the CSP'],
  [/\.cssText\b/, 'runtime cssText write, blocked by the CSP'],
  [/\bstyle\s*=(?=["'`]|\$\{)/, 'style attribute in a template string, blocked by the CSP'],
];
const TEXT_EXTENSIONS = new Set(['.html', '.css', '.js', '.json', '.svg', '.webmanifest', '.txt', '.xml']);

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

const secretValues = SECRET_NAMES.map((n) => process.env[n]).filter((v) => v && v.length >= 12 && !v.startsWith('replace-'));
const problems = [];
const publicFiles = await walk('public');
for (const required of ['public/favicon.svg', 'public/robots.txt', 'public/sitemap.xml', 'public/search/doctors/index.html']) {
  if (!publicFiles.includes(required)) problems.push(`${required}: required public route or metadata file is missing`);
}
for (const file of publicFiles) {
  // Images and video are served as opaque binary assets. Decoding them as UTF-8 can
  // produce false positives for text-only policy rules (for example an em-dash byte
  // sequence inside an MP4). Security scanning applies to source/text assets.
  if (!TEXT_EXTENSIONS.has(extname(file).toLowerCase())) continue;
  const text = await readFile(file, 'utf8');
  for (const name of SECRET_NAMES) if (text.includes(name)) problems.push(`${file}: names the server secret ${name}`);
  for (const value of secretValues) if (text.includes(value)) problems.push(`${file}: contains the value of a server secret`);
  for (const [re, why] of RULES) if (re.test(text)) problems.push(`${file}: ${why}`);
}

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log('public/ check passed');
