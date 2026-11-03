// The assistant robot's picture (D-64): the owner's 3D model drawn with Three.js. The gestures live in
// robot.js; this layer only draws. The model was split at the neck by scripts/convert-robot.mjs, so
// the head can turn towards the cursor while the body floats.
import * as THREE from '/vendor/three/three.module.min.js';
import { GLTFLoader } from '/vendor/three/GLTFLoader.js';

const MODEL_URL = '/assistant/robot.glb';
// How far the head may turn, in radians: enough to read as looking, not enough to show the back.
const MAX_YAW = 0.7;
const MAX_PITCH = 0.32;
// Distance in pixels at which the head reaches its full turn.
const REACH_PX = 420;

/**
 * Draws the robot into `canvas`. `pointer()` returns the latest cursor position in page pixels, or
 * null when there is none. Resolves to { setMood, destroy } once the model is drawn.
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
  const rim = new THREE.DirectionalLight(0xcfe9ff, 1.4);
  rim.position.set(-120, 80, -80);
  scene.add(key, rim);

  const gltf = await new GLTFLoader().loadAsync(MODEL_URL);
  const robot = gltf.scene;
  const head = robot.getObjectByName('head');
  const body = robot.getObjectByName('body');
  if (!head || !body) throw new Error('robot model has no head and body parts');
  for (const mesh of [head, body]) {
    // The texture is the whole look; flat lighting from the texture reads as clay, so add a soft sheen.
    mesh.material.roughness = 0.55;
    mesh.material.metalness = 0.05;
  }
  const holder = new THREE.Group();
  holder.add(robot);
  scene.add(holder);

  // Frame the model: centre it and fit its height in the view with a little room to turn and float.
  const box = new THREE.Box3().setFromObject(robot);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  robot.position.sub(centre);
  const distance = (size.y * 0.55) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  camera.position.set(0, size.y * 0.04, distance);
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
  const look = { yaw: 0, pitch: 0 };
  const clock = new THREE.Clock();
  let raf = 0;
  let stopped = false;

  function targetLook() {
    const p = pointer();
    if (!p || mood === 'dragging') return { yaw: 0, pitch: 0 };
    const r = canvas.getBoundingClientRect();
    const dx = p.x - (r.left + r.width / 2);
    const dy = p.y - (r.top + r.height * 0.35);
    const clampUnit = (v) => Math.max(-1, Math.min(1, v));
    return { yaw: clampUnit(dx / REACH_PX) * MAX_YAW, pitch: clampUnit(dy / REACH_PX) * MAX_PITCH };
  }

  function frame() {
    const t = clock.getElapsedTime();
    const want = targetLook();
    // Ease towards the target so the head turns like it is paying attention, not snapping.
    look.yaw += (want.yaw - look.yaw) * 0.12;
    look.pitch += (want.pitch - look.pitch) * 0.12;
    head.rotation.set(look.pitch, look.yaw, -look.yaw * 0.12);
    body.rotation.y = look.yaw * 0.25;
    // A slow float, quicker and higher while it is being carried or listening.
    const lift = mood === 'dragging' ? 0.06 : mood === 'open' ? 0.035 : 0.025;
    holder.position.y = Math.sin(t * (mood === 'dragging' ? 4 : 1.6)) * size.y * lift;
    holder.rotation.z = mood === 'dragging' ? Math.sin(t * 5) * 0.06 : Math.sin(t * 0.8) * 0.02;
    renderer.render(scene, camera);
    if (!stopped) raf = requestAnimationFrame(frame);
  }

  function start() {
    if (stopped || raf) return;
    raf = requestAnimationFrame(frame);
  }
  function pause() {
    cancelAnimationFrame(raf);
    raf = 0;
  }
  // Nothing moves on its own for someone who asked for reduced motion: one still frame.
  if (reducedMotion) renderer.render(scene, camera);
  else start();
  const onVisibility = () => (document.hidden || reducedMotion ? pause() : start());
  document.addEventListener('visibilitychange', onVisibility);

  return {
    /** Follows the visitor's setting if it changes while the page is open. */
    setReducedMotion(next) {
      reducedMotion = next;
      if (reducedMotion) {
        pause();
        head.rotation.set(0, 0, 0);
        body.rotation.set(0, 0, 0);
        holder.position.y = 0;
        holder.rotation.z = 0;
        renderer.render(scene, camera);
      } else {
        start();
      }
    },
    setMood(next) {
      mood = next;
      if (reducedMotion) renderer.render(scene, camera);
    },
    destroy() {
      stopped = true;
      pause();
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      renderer.dispose();
    },
  };
}
