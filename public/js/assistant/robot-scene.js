// The assistant robot's picture (D-64): the owner's 3D model drawn with Three.js, with a live face on
// its visor. The gestures live in robot.js; this layer only draws.
//
// Movement follows the robot in the owner's student management system: the whole robot leans
// towards the cursor (it is one piece, so no gap can open at the neck), the face slides across the
// visor the same way, it floats slowly, and it blinks. Expressions show what is happening: happy
// when the cursor is over it, surprised while it is carried, attentive while the panel is open, and
// looking up in thought while it waits for an answer.
import * as THREE from '/vendor/three/three.module.min.js';
import { GLTFLoader } from '/vendor/three/GLTFLoader.js';

const MODEL_URL = '/assistant/robot.glb';
// How far the robot leans towards the cursor, in radians.
const MAX_YAW = 0.42;
const MAX_PITCH = 0.16;
// Distance in pixels at which the lean and the eyes reach their limit.
const REACH_PX = 360;
const GLOW = '#7ef7ff';
// One float cycle, as in the student system robot (6 s, about 10 px at 120 px).
const FLOAT_SECONDS = 6;

/** Paints the face for one moment. `look` is -1 to 1 on each axis. */
function drawFace(g, w, h, { mood, look, blink }) {
  g.clearRect(0, 0, w, h);
  g.fillStyle = GLOW;
  g.strokeStyle = GLOW;
  g.shadowColor = GLOW;
  g.shadowBlur = h * 0.08;
  g.lineCap = 'round';
  const ox = look.x * w * 0.07;
  const oy = look.y * h * 0.08;
  const eyeY = h * 0.42 + oy;
  const r = h * (mood === 'dragging' ? 0.21 : mood === 'open' ? 0.19 : 0.18);
  for (const ex of [0.3, 0.7]) {
    const x = w * ex + ox;
    if (blink > 0.5 && mood !== 'happy') {
      // Closed: a short glowing line.
      g.lineWidth = h * 0.055;
      g.beginPath();
      g.moveTo(x - r * 0.9, eyeY);
      g.lineTo(x + r * 0.9, eyeY);
      g.stroke();
    } else if (mood === 'happy') {
      // Smiling eyes: upward arcs.
      g.lineWidth = h * 0.06;
      g.beginPath();
      g.arc(x, eyeY + r * 0.35, r * 0.75, Math.PI * 1.1, Math.PI * 1.9);
      g.stroke();
    } else {
      g.beginPath();
      g.ellipse(x, eyeY, r, r * (1 - blink * 0.85), 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  const mx = w * 0.5 + ox;
  const my = h * 0.64 + oy;
  g.lineWidth = h * 0.05;
  g.beginPath();
  if (mood === 'thinking') {
    // Thinking: a short straight mouth, slightly to one side.
    g.moveTo(mx - h * 0.05, my + h * 0.02);
    g.lineTo(mx + h * 0.09, my);
    g.stroke();
  } else if (mood === 'dragging') {
    // Surprised: a small round mouth.
    g.ellipse(mx, my + h * 0.03, h * 0.055, h * 0.07, 0, 0, Math.PI * 2);
    g.stroke();
  } else {
    const wide = mood === 'happy' ? 0.15 : mood === 'open' ? 0.1 : 0.09;
    g.arc(mx, my - h * wide * 0.6, h * wide, Math.PI * 0.18, Math.PI * 0.82);
    g.stroke();
  }
}

/**
 * Draws the robot into `canvas`. `pointer()` returns the latest cursor position in page pixels, or
 * null. Resolves to { setMood, setReducedMotion, destroy } once the model is drawn.
 */
export async function mountRobotScene(canvas, { pointer, reducedMotion: startReduced }) {
  let reducedMotion = startReduced;
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 1, 1000);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9aa7b3, 2.2));
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(60, 120, 160);
  const rim = new THREE.DirectionalLight(0xdff2ff, 1.2);
  rim.position.set(-120, 80, -80);
  scene.add(key, rim);

  const gltf = await new GLTFLoader().loadAsync(MODEL_URL);
  const robot = gltf.scene;
  const faceMesh = robot.getObjectByName('face');
  if (!robot.getObjectByName('body') || !faceMesh) throw new Error('robot model has no body or face');

  // The face is a canvas painted on the visor surface the converter fitted.
  const faceCanvas = document.createElement('canvas');
  faceCanvas.width = 512;
  faceCanvas.height = Math.round(512 / (faceMesh.userData.aspect || 1.94));
  const faceCtx = faceCanvas.getContext('2d');
  const faceTexture = new THREE.CanvasTexture(faceCanvas);
  faceTexture.colorSpace = THREE.SRGBColorSpace;
  faceTexture.anisotropy = 4;
  faceMesh.material = new THREE.MeshBasicMaterial({ map: faceTexture, transparent: true, toneMapped: false, depthWrite: false });
  faceMesh.renderOrder = 1;

  const holder = new THREE.Group();
  holder.add(robot);
  scene.add(holder);

  // Frame the model: centre it and fit its height with a little room to lean and float.
  const box = new THREE.Box3().setFromObject(robot.getObjectByName('body'));
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  robot.position.sub(centre);
  const distance = (size.y * 0.56) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  camera.position.set(0, size.y * 0.03, distance);
  camera.lookAt(0, 0, 0);

  function resize() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  let mood = 'idle';
  const look = { x: 0, y: 0 };
  let blinkStart = -1;
  let nextBlink = 2 + Math.random() * 3;
  let painted = '';
  const clock = new THREE.Clock();
  let raf = 0;
  let stopped = false;

  function paintFace(blink) {
    // Repaint only when something visible changed.
    const keyNow = `${mood}|${look.x.toFixed(2)}|${look.y.toFixed(2)}|${blink.toFixed(1)}`;
    if (keyNow === painted) return;
    painted = keyNow;
    drawFace(faceCtx, faceCanvas.width, faceCanvas.height, { mood, look, blink });
    faceTexture.needsUpdate = true;
  }

  function target() {
    // While it waits for an answer it looks up and to the side, as people do when they think.
    if (mood === 'thinking' && !reducedMotion) return { x: 0.55, y: -0.75 };
    const p = pointer();
    if (!p || reducedMotion) return { x: 0, y: 0 };
    const r = canvas.getBoundingClientRect();
    const dx = p.x - (r.left + r.width / 2);
    const dy = p.y - (r.top + r.height * 0.35);
    const d = Math.hypot(dx, dy) || 1;
    const reach = Math.min(1, d / REACH_PX);
    return { x: (dx / d) * reach, y: (dy / d) * reach };
  }

  function blinkAmount(t) {
    if (reducedMotion || mood === 'dragging') return 0;
    if (blinkStart < 0 && t >= nextBlink) blinkStart = t;
    if (blinkStart < 0) return 0;
    const k = (t - blinkStart) / 0.16;
    if (k >= 1) {
      blinkStart = -1;
      nextBlink = t + 3 + Math.random() * 3.5;
      return 0;
    }
    return 1 - Math.abs(k * 2 - 1);
  }

  function frame() {
    const t = clock.getElapsedTime();
    const want = target();
    // Ease towards the cursor so it turns like it is paying attention, not snapping.
    look.x += (want.x - look.x) * 0.1;
    look.y += (want.y - look.y) * 0.1;
    holder.rotation.y = look.x * MAX_YAW;
    holder.rotation.x = look.y * MAX_PITCH;
    holder.rotation.z = mood === 'dragging' ? Math.sin(t * 6) * 0.07 : -look.x * 0.04;
    holder.position.y = Math.sin((t / FLOAT_SECONDS) * Math.PI * 2) * size.y * 0.04;
    paintFace(blinkAmount(t));
    renderer.render(scene, camera);
    if (!stopped && !reducedMotion) raf = requestAnimationFrame(frame);
  }

  function start() {
    if (stopped || raf || reducedMotion) return;
    raf = requestAnimationFrame(frame);
  }
  function pause() {
    cancelAnimationFrame(raf);
    raf = 0;
  }
  function still() {
    pause();
    look.x = 0;
    look.y = 0;
    holder.rotation.set(0, 0, 0);
    holder.position.y = 0;
    paintFace(0);
    renderer.render(scene, camera);
  }

  // Nothing moves on its own for someone who asked for reduced motion: one still frame per change.
  if (reducedMotion) still();
  else start();
  const onVisibility = () => (document.hidden ? pause() : start());
  document.addEventListener('visibilitychange', onVisibility);

  return {
    setReducedMotion(next) {
      reducedMotion = next;
      if (reducedMotion) still();
      else start();
    },
    setMood(next) {
      mood = next;
      if (reducedMotion) still();
    },
    destroy() {
      stopped = true;
      pause();
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      faceTexture.dispose();
      renderer.dispose();
    },
  };
}
