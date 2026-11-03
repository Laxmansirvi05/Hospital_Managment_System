// Converts the owner's FBX robot (D-64) into one GLB with its texture embedded, using three's own
// FBXLoader and GLTFExporter inside headless Chromium, so the site loads a single small file.
// Run: node scripts/convert-robot.mjs "<folder with medical_robot_3d_model.fbx>" [--inspect]
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { chromium } from '@playwright/test';

const source = resolve(process.argv[2] || '.');
const inspectOnly = process.argv.includes('--inspect');
const THREE_ROOT = resolve('node_modules/three');
const OUT = 'public/assistant/robot.glb';
const TYPES = { '.js': 'text/javascript', '.fbx': 'application/octet-stream', '.jpg': 'image/jpeg', '.png': 'image/png', '.html': 'text/html' };

const PAGE = `<!doctype html><script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>
<script type="module">
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
const NECK_Y = 55;
window.run = async (exportIt) => {
  const root = await new FBXLoader().setResourcePath('/model/').loadAsync('/model/medical_robot_3d_model.fbx');
  const parts = [];
  root.traverse((o) => {
    if (!o.isMesh && !o.isGroup && !o.isObject3D) return;
    const box = new THREE.Box3().setFromObject(o);
    parts.push({ name: o.name, type: o.type, mesh: !!o.isMesh, children: o.children.length,
      verts: o.geometry?.attributes?.position?.count ?? 0, mat: o.material ? [].concat(o.material).map((m) => m.name + (m.map ? ' [map]' : '')).join(',') : '',
      min: box.min.toArray().map((v) => +v.toFixed(2)), max: box.max.toArray().map((v) => +v.toFixed(2)) });
  });
  // Width of the model at each height, to find the neck between the head and the body.
  const mesh = root.getObjectByProperty('isMesh', true);
  const pos = mesh.geometry.attributes.position;
  mesh.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  const bins = {};
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
    const k = Math.floor(v.y / 2) * 2;
    const b = bins[k] || (bins[k] = { min: Infinity, max: -Infinity, zmin: Infinity, zmax: -Infinity, n: 0 });
    b.min = Math.min(b.min, v.x); b.max = Math.max(b.max, v.x); b.zmin = Math.min(b.zmin, v.z); b.zmax = Math.max(b.zmax, v.z); b.n++;
  }
  const widths = Object.entries(bins).map(([y, b]) => [+y, +(b.max - b.min).toFixed(1), +(b.zmax - b.zmin).toFixed(1), b.n]).sort((a, b) => a[0] - b[0]);
  if (!exportIt) return { parts, animations: root.animations.length, widths };
  // FBXLoader fetches the texture after the model resolves; the exporter needs its pixels.
  const map = [].concat(mesh.material)[0].map;
  for (let i = 0; i < 100 && !(map?.image?.complete && map.image.naturalWidth); i++) await new Promise((r) => setTimeout(r, 100));
  if (!map?.image?.naturalWidth) throw new Error('texture did not load');
  // Split the single mesh at the neck (the narrowest height, measured with --inspect) so the head can
  // turn on its own. Each triangle goes to the head or the body by the height of its centre.
  const flat = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
  flat.applyMatrix4(mesh.matrixWorld);
  const names = Object.keys(flat.attributes);
  const out = { head: Object.fromEntries(names.map((n) => [n, []])), body: Object.fromEntries(names.map((n) => [n, []])) };
  const p = flat.attributes.position;
  for (let t = 0; t < p.count; t += 3) {
    const cy = (p.getY(t) + p.getY(t + 1) + p.getY(t + 2)) / 3;
    const part = cy > NECK_Y ? out.head : out.body;
    for (const n of names) {
      const a = flat.attributes[n];
      for (let k = 0; k < 3; k++) for (let c = 0; c < a.itemSize; c++) part[n].push(a.array[(t + k) * a.itemSize + c]);
    }
  }
  const build = (data, name, pivot) => {
    const g = new THREE.BufferGeometry();
    for (const n of names) g.setAttribute(n, new THREE.Float32BufferAttribute(data[n], flat.attributes[n].itemSize));
    g.translate(-pivot.x, -pivot.y, -pivot.z);
    // Shared corners are stored once; the FBX repeats every corner for every triangle.
    const m = new THREE.Mesh(mergeVertices(g, 1e-4), mesh.material);
    m.name = name;
    m.position.copy(pivot);
    return m;
  };
  // A JPEG keeps the photo-like texture at a fraction of the PNG size the exporter defaults to.
  map.userData.mimeType = 'image/jpeg';
  const robot = new THREE.Group();
  robot.name = 'robot';
  robot.add(build(out.body, 'body', new THREE.Vector3(0, 0, 0)), build(out.head, 'head', new THREE.Vector3(0, NECK_Y, 0)));
  const glb = await new GLTFExporter().parseAsync(robot, { binary: true, onlyVisible: true, maxTextureSize: 1024 });
  let s = ''; const b = new Uint8Array(glb); for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return { parts: parts.length, glb: btoa(s) };
};
window.ready = true;
</script>`;

const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  try {
    if (path === '/') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(PAGE); }
    const file = path.startsWith('/three/') ? join(THREE_ROOT, path.slice(7)) : path.startsWith('/model/') ? join(source, path.slice(7)) : null;
    if (!file || !(file.startsWith(THREE_ROOT) || file.startsWith(source))) throw new Error('outside');
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    if (path !== '/favicon.ico') console.error('not found:', path);
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(() => window.ready === true);
  const result = await page.evaluate((x) => window.run(x), !inspectOnly);
  if (inspectOnly) {
    console.log(JSON.stringify(result, null, 1));
  } else {
    await mkdir('public/assistant', { recursive: true });
    await writeFile(OUT, Buffer.from(result.glb, 'base64'));
    console.log(`wrote ${OUT}: ${Math.round(Buffer.from(result.glb, 'base64').length / 1024)} KB from ${result.parts} parts`);
  }
} finally {
  await browser.close();
  server.close();
}
