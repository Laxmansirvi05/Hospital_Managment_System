// Copies the Three.js files the assistant robot needs (D-64) into public/vendor/three, so the
// browser loads them from this site. Addon imports of 'three' become a relative path, since the
// CSP allows no import map. Run after changing the three version: node scripts/vendor-three.js
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';

const SRC = 'node_modules/three';
const OUT = 'public/vendor/three';
const ADDONS = ['loaders/GLTFLoader.js', 'utils/BufferGeometryUtils.js'];

await mkdir(OUT, { recursive: true });
await copyFile(`${SRC}/build/three.module.min.js`, `${OUT}/three.module.min.js`);
await copyFile(`${SRC}/LICENSE`, `${OUT}/LICENSE`);
for (const file of ADDONS) {
  const code = (await readFile(`${SRC}/examples/jsm/${file}`, 'utf8'))
    .replace(/from\s+['"]three['"]/g, "from './three.module.min.js'")
    .replace(/from\s+['"]\.\.\/utils\/BufferGeometryUtils\.js['"]/g, "from './BufferGeometryUtils.js'");
  await writeFile(`${OUT}/${file.split('/').pop()}`, code);
}
console.log(`three ${JSON.parse(await readFile(`${SRC}/package.json`, 'utf8')).version} copied to ${OUT}`);
