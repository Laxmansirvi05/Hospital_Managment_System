// Searches for the banned patterns in docs/11-design-system.md section 9 that a search can find,
// plus the copy rules in docs/12-ux-and-content.md. Characters are written as escapes so this
// file does not trip its own checks.
import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

const EM_DASH = '\u2014';
const EN_DASH = '\u2013';
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}]/u;
const SKIP_DIRS = new Set(['node_modules', '.git', 'postman', 'coverage', '.vercel', 'vendor']);
const TEXT_EXT = new Set(['.md', '.html', '.css', '.js', '.json', '.sql', '.toml']);

// Files that must name banned words in order to ban them.
const BUZZWORD_EXEMPT = new Set(['docs/12-ux-and-content.md', '.claude/agents/design-review-agent.md', '.claude/skills/write-copy/SKILL.md', 'scripts/lint-style.js']);
const BUZZWORDS = /\b(seamless(?:ly)?|cutting-edge|revolutionary|state-of-the-art|next-generation|game-changing|supercharge|world-class|best-in-class|effortless(?:ly)?|reimagine)\b/i;

const CSS_RULES = [
  { name: 'gradient (banned patterns 1 and 2)', pattern: /\b(?:linear|radial|conic)-gradient\(/ },
  { name: 'gradient text (banned pattern 2)', pattern: /background-clip:\s*text|text-fill-color:\s*transparent/ },
  { name: 'glass effect (banned pattern 6)', pattern: /backdrop-filter|filter:\s*blur/ },
  { name: 'colored left border (banned pattern 5)', pattern: /border-left(?:-color)?:|border-inline-start(?:-color)?:/ },
  { name: 'banned font (banned patterns 4 and 19)', pattern: /\bInter\b|Space Grotesk|Instrument Serif/ },
  { name: 'scroll-driven animation (banned pattern 12)', pattern: /animation-timeline/ },
  { name: 'noise texture (banned pattern 20)', pattern: /feTurbulence|noise\.(?:png|svg|webp)/i },
  { name: 'italic accent (banned pattern 18)', pattern: /font-style:\s*italic/ },
];

const JS_RULES = [
  { name: 'innerHTML family (XSS rule)', pattern: /\.(?:innerHTML|outerHTML)\s*=|insertAdjacentHTML\(/ },
  { name: 'cursor-following listener (banned pattern 13)', pattern: /addEventListener\(\s*['"](?:mousemove|pointermove)['"]/ },
  { name: 'Lucide icons (banned pattern 10)', pattern: /lucide/i },
  { name: 'scroll reveal (banned pattern 12)', pattern: /IntersectionObserver/ },
  { name: 'eval family', pattern: /\beval\(|new Function\(/ },
];

const HTML_RULES = [
  { name: 'inline script (CSP)', pattern: /<script(?![^>]*\bsrc=)[^>]*>/i },
  { name: 'inline event handler (CSP)', pattern: /\son[a-z]+\s*=\s*["']/i },
  { name: 'inline style attribute (CSP)', pattern: /\sstyle\s*=\s*["']/i },
  { name: 'Lucide icons (banned pattern 10)', pattern: /lucide/i },
];

/** Opacity changes inside :hover or :active rules (banned pattern 14). */
function opacityOnInteraction(css) {
  const problems = [];
  for (const match of css.matchAll(/([^{}]*:(?:hover|active)[^{}]*)\{([^}]*)\}/g)) {
    if (/\bopacity\s*:/.test(match[2]) || /transition[^;]*opacity/.test(match[2])) problems.push(match[1].trim());
  }
  return problems;
}

/** Raw lengths and colors outside tokens.css (banned pattern 15 and the token rule). */
function rawValues(css) {
  const problems = [];
  const lines = css.replace(/\/\*[\s\S]*?\*\//g, '').split('\n');
  lines.forEach((line, index) => {
    if (/@media|@container/.test(line)) return;
    if (/#[0-9a-fA-F]{3,8}\b/.test(line)) problems.push(`line ${index + 1}: raw color`);
    for (const m of line.matchAll(/(?<![\w-])(\d*\.?\d+)(px|rem|em)\b/g)) {
      const allowed = m[2] === 'px' && ['0', '1', '2'].includes(m[1]);
      if (!allowed) problems.push(`line ${index + 1}: raw length ${m[0]}`);
    }
  });
  return problems;
}

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (TEXT_EXT.has(extname(entry.name))) yield path;
  }
}

/** @param {string} root @returns {Promise<string[]>} */
export async function lintStyle(root) {
  const problems = [];
  for await (const file of walk(root)) {
    const where = relative(root, file).split('\\').join('/');
    if (where === 'pnpm-lock.yaml' || where === 'package.json') continue;
    const text = await readFile(file, 'utf8');
    const add = (rule) => problems.push(`${where}: ${rule}`);

    if (text.includes(EM_DASH)) add('em dash character');
    if (text.includes(EN_DASH)) add('en dash character');
    if (EMOJI.test(text)) add('emoji');
    if (!BUZZWORD_EXEMPT.has(where) && BUZZWORDS.test(text)) add(`buzzword "${text.match(BUZZWORDS)[0]}"`);

    const inPublic = where.startsWith('public/');
    const ext = extname(file);
    if (inPublic && ext === '.css') {
      for (const { name, pattern } of CSS_RULES) if (pattern.test(text)) add(name);
      for (const selector of opacityOnInteraction(text)) add(`opacity on ${selector} (banned pattern 14)`);
      if (!where.endsWith('css/tokens.css')) for (const p of rawValues(text)) add(p);
    }
    if (inPublic && ext === '.js') for (const { name, pattern } of JS_RULES) if (pattern.test(text)) add(name);
    if (inPublic && ext === '.html') for (const { name, pattern } of HTML_RULES) if (pattern.test(text)) add(name);
  }
  return problems;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const problems = await lintStyle(process.cwd());
  if (problems.length) {
    process.stdout.write(`Style lint failed:\n${problems.map((p) => `  ${p}`).join('\n')}\n`);
    process.exit(1);
  }
  process.stdout.write('Style lint passed.\n');
}
