// Converts the owner's FBX robot (D-64) into one GLB for the site, using three's own FBXLoader and
// GLTFExporter inside headless Chromium. Along the way it:
// - whitens the texture's cream areas to pure white (owner, 2026-11-03),
// - paints out the face printed on the visor, which the site draws live instead (eyes that look and
//   blink), and adds a thin curved "face" surface fitted to the visor for it,
// - keeps the robot in one piece, so turning it never opens a gap at the neck.
// Run: node scripts/convert-robot.mjs "<folder with medical_robot_3d_model.fbx>" [--preview <dir>]
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { chromium } from '@playwright/test';

const source = resolve(process.argv[2] || '.');
const previewAt = process.argv.includes('--preview') ? resolve(process.argv[process.argv.indexOf('--preview') + 1]) : null;
const THREE_ROOT = resolve('node_modules/three');
const OUT = 'public/assistant/robot.glb';
const TYPES = { '.js': 'text/javascript', '.fbx': 'application/octet-stream', '.jpg': 'image/jpeg', '.png': 'image/png', '.html': 'text/html' };

const PAGE = `<!doctype html><script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>
<script type="module">
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// The neck is the narrowest height of the model (measured: 54 of 100); the visor is above it.
const NECK_Y = 55;
const VISOR_NAVY = [11, 21, 34];

function cleanTexture(image) {
  const c = document.createElement('canvas');
  c.width = image.naturalWidth;
  c.height = image.naturalHeight;
  const g = c.getContext('2d');
  g.drawImage(image, 0, 0);
  const img = g.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  let whitened = 0;
  let erased = 0;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], gr = d[i + 1], b = d[i + 2];
    const max = Math.max(r, gr, b), min = Math.min(r, gr, b);
    // The painted face glow (cyan, blue at least as strong as green, red low) and its dark blue halo
    // on the visor. Charcoal parts such as the wheel have blue barely above red, so they stay.
    if ((b > 90 && b >= gr - 12 && b - r > 55) || (max < 125 && b - r >= 14 && b >= gr)) {
      d[i] = VISOR_NAVY[0]; d[i + 1] = VISOR_NAVY[1]; d[i + 2] = VISOR_NAVY[2];
      erased++;
      continue;
    }
    // Cream and off-white: light and nearly grey. Pulled most of the way to pure white.
    if (min > 165 && max - min < 34) {
      d[i] = 255 - (255 - r) * 0.15;
      d[i + 1] = 255 - (255 - gr) * 0.15;
      d[i + 2] = 255 - (255 - b) * 0.15;
      whitened++;
    }
  }
  g.putImageData(img, 0, 0);
  return { canvas: c, ctx: g, whitened, erased };
}

window.run = async ({ preview }) => {
  const root = await new FBXLoader().setResourcePath('/model/').loadAsync('/model/medical_robot_3d_model.fbx');
  const mesh = root.getObjectByProperty('isMesh', true);
  const map = [].concat(mesh.material)[0].map;
  // FBXLoader fetches the texture after the model resolves; the cleanup needs its pixels.
  for (let i = 0; i < 100 && !(map?.image?.complete && map.image.naturalWidth); i++) await new Promise((r) => setTimeout(r, 100));
  if (!map?.image?.naturalWidth) throw new Error('texture did not load');
  const tex = cleanTexture(map.image);

  mesh.updateMatrixWorld(true);
  // The model's own smooth normals are kept; recomputing them per face made it look faceted.
  const geo = (mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()).applyMatrix4(mesh.matrixWorld);

  // The visor: front-facing head vertices whose texture is near black.
  const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
  const px = tex.ctx.getImageData(0, 0, tex.canvas.width, tex.canvas.height).data;
  const W = tex.canvas.width, H = tex.canvas.height;
  const pts = [];
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) < NECK_Y + 4 || nor.getZ(i) < 0.4) continue;
    const x = Math.min(W - 1, Math.max(0, Math.floor(uv.getX(i) * W)));
    const y = Math.min(H - 1, Math.max(0, Math.floor((1 - uv.getY(i)) * H)));
    const k = (y * W + x) * 4;
    if (px[k] + px[k + 1] + px[k + 2] < 120) pts.push([pos.getX(i), pos.getY(i), pos.getZ(i)]);
  }
  if (pts.length < 30) throw new Error('visor not found');
  // Trim stray points: keep the central 96 percent on each axis.
  const q = (arr, f) => { const s = [...arr].sort((a, b) => a - b); return s[Math.floor(f * (s.length - 1))]; };
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), zs = pts.map((p) => p[2]);
  const x0 = q(xs, 0.02), x1 = q(xs, 0.98), y0 = q(ys, 0.02), y1 = q(ys, 0.98);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const halfW = (x1 - x0) / 2;
  const zFront = q(pts.filter((p) => Math.abs(p[0] - cx) < halfW * 0.25).map((p) => p[2]), 0.9);
  const zEdge = q(pts.filter((p) => Math.abs(p[0] - cx) > halfW * 0.8).map((p) => p[2]), 0.5);
  // A circle through the visor's front and its side edges gives the curve of the screen.
  const sag = Math.max(0.5, zFront - zEdge);
  const radius = (halfW * halfW + sag * sag) / (2 * sag);
  const half = Math.asin(Math.min(1, (halfW * 0.92) / radius));
  const faceH = (y1 - y0) * 0.82;
  const faceGeo = new THREE.CylinderGeometry(radius + 1.1, radius + 1.1, faceH, 48, 1, true, -half, half * 2);
  const face = new THREE.Mesh(faceGeo, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0 }));
  face.name = 'face';
  face.position.set(cx, cy, zFront - radius);
  face.userData = { aspect: (2 * half * radius) / faceH };

  map.image = tex.canvas;
  map.needsUpdate = true;
  // A JPEG keeps the photo-like texture at a fraction of the PNG size the exporter defaults to.
  map.userData.mimeType = 'image/jpeg';
  const body = new THREE.Mesh(mergeVertices(geo, 1e-4), mesh.material);
  body.name = 'body';
  const robot = new THREE.Group();
  robot.name = 'robot';
  robot.add(body, face);

  const info = { whitened: tex.whitened, erased: tex.erased, visorPoints: pts.length, visor: { cx, cy, halfW, zFront, zEdge, radius, faceH, aspect: face.userData.aspect } };

  let shots = [];
  if (preview) {
    // Test pattern on the face so its placement can be checked in the renders.
    const fc = document.createElement('canvas'); fc.width = 512; fc.height = Math.round(512 / face.userData.aspect);
    const fg = fc.getContext('2d'); fg.fillStyle = '#7ef7ff'; fg.shadowColor = '#7ef7ff'; fg.shadowBlur = 18;
    for (const ex of [0.3, 0.7]) { fg.beginPath(); fg.arc(fc.width * ex, fc.height * 0.42, fc.height * 0.2, 0, Math.PI * 2); fg.fill(); }
    fg.lineWidth = fc.height * 0.06; fg.strokeStyle = '#7ef7ff'; fg.lineCap = 'round';
    fg.beginPath(); fg.arc(fc.width * 0.5, fc.height * 0.55, fc.height * 0.16, 0.2 * Math.PI, 0.8 * Math.PI); fg.stroke();
    const shownFace = face.clone(); shownFace.material = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(fc), transparent: true, toneMapped: false });
    const show = new THREE.Group(); show.add(body.clone(), shownFace);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(520, 560); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x303236);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x9aa7b3, 2.2));
    const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(60, 120, 160); scene.add(key);
    scene.add(show);
    const cam = new THREE.PerspectiveCamera(30, 520 / 560, 1, 2000);
    for (const yaw of [0, 0.45, -0.45, 0.9]) {
      show.rotation.y = yaw;
      cam.position.set(0, 52, 230); cam.lookAt(0, 50, 0);
      renderer.render(scene, cam);
      shots.push(renderer.domElement.toDataURL('image/png').split(',')[1]);
    }
  }

  const glb = await new GLTFExporter().parseAsync(robot, { binary: true, onlyVisible: false, maxTextureSize: 1024 });
  let s = ''; const b = new Uint8Array(glb); for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return { info, glb: btoa(s), shots };
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
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(() => window.ready === true);
  const result = await page.evaluate((x) => window.run(x), { preview: Boolean(previewAt) });
  await mkdir('public/assistant', { recursive: true });
  const glb = Buffer.from(result.glb, 'base64');
  await writeFile(OUT, glb);
  console.log(JSON.stringify(result.info));
  console.log(`wrote ${OUT}: ${Math.round(glb.length / 1024)} KB`);
  if (previewAt) {
    await mkdir(previewAt, { recursive: true });
    for (const [i, shot] of result.shots.entries()) await writeFile(join(previewAt, `robot-view-${i}.png`), Buffer.from(shot, 'base64'));
    console.log(`previews in ${previewAt}`);
  }
} finally {
  await browser.close();
  server.close();
}
