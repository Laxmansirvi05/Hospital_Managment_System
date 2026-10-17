import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { lintStyle } from '../scripts/lint-style.js';
import { scanPublic } from '../scripts/scan-public.js';

let dir;
afterEach(async () => {
  if (dir) await rm(dir, { recursive: true, force: true });
  dir = undefined;
});

async function fixture(files) {
  dir = await mkdtemp(join(tmpdir(), 'careroute-'));
  for (const [path, text] of Object.entries(files)) {
    await mkdir(join(dir, path, '..'), { recursive: true });
    await writeFile(join(dir, path), text);
  }
  return dir;
}

describe('public file scan', () => {
  it('passes on the real public folder', async () => {
    expect(await scanPublic('public', {})).toEqual([]);
  });

  it('catches a server variable name, a secret value, a key pattern and a server import', async () => {
    const root = await fixture({
      'a.js': "const k = 'JWT_SECRET';",
      'b.js': 'const v = "super-secret-value-123";',
      'c.js': "const g = 'AIza" + 'x'.repeat(35) + "';",
      'd.js': "import { db } from '../server/db/index.js';",
    });
    const problems = await scanPublic(root, { GROQ_API_KEY: 'super-secret-value-123' });
    expect(problems.some((p) => p.includes('mentions server variable JWT_SECRET'))).toBe(true);
    expect(problems.some((p) => p.includes('contains the value of GROQ_API_KEY'))).toBe(true);
    expect(problems.some((p) => p.includes('Google API key'))).toBe(true);
    expect(problems.some((p) => p.includes('Server code reference'))).toBe(true);
    expect(problems.join('\n')).not.toContain('super-secret-value-123');
  });
});

describe('style lint', () => {
  it('passes on the repository', async () => {
    expect(await lintStyle(process.cwd())).toEqual([]);
  });

  it('catches banned patterns', async () => {
    const root = await fixture({
      'public/css/x.css': '.a{background:linear-gradient(red,blue);backdrop-filter:blur(4px);border-left:4px solid red;margin:13px;color:#fff}.b:hover{opacity:.8}',
      'public/js/x.js': 'el.innerHTML = data; window.addEventListener("mousemove", f);',
      'public/x.html': '<script>alert(1)</script><div style="x"></div><button onclick="f()">',
      'docs/x.md': `A ${String.fromCharCode(0x2014)} dash and a ${'seam' + 'less'} flow.`,
    });
    const problems = (await lintStyle(root)).join('\n');
    for (const expected of ['gradient', 'glass', 'left border', 'raw length 13px', 'raw color', 'opacity on', 'innerHTML', 'cursor-following', 'inline script', 'inline style', 'inline event', 'em dash', 'buzzword']) {
      expect(problems).toContain(expected);
    }
  });
});
