// The floating assistant robot on signed-in patient pages (D-64), after the robot in the owner's
// student management system. Drag it anywhere and it stays there in this browser; a double tap, or
// Enter or A on the keyboard, opens the assistant panel (chat.js).
import { h, icon } from '../h.js';
import { createChat } from './chat.js';

const STORAGE_KEY = 'careroute.robot.position';
const EDGE = 12;
const DRAG_THRESHOLD_PX = 6;
const DOUBLE_TAP_MS = 400;
const SIZE = 152;
// On a phone the robot sits over content and the tab bar, so it is smaller there.
const SIZE_COMPACT = 97;
// Below 1024 px the tab bar is on screen, so the smaller robot sits above it.
const COMPACT = window.matchMedia('(max-width: 1023px)');
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)');
const LOAD_TIMEOUT_MS = 10000;

let mounted = false;

function storedPosition() {
  try {
    const p = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return typeof p?.x === 'number' && typeof p?.y === 'number' ? p : null;
  } catch {
    // Blocked or corrupt storage: the robot starts in its default corner.
    return null;
  }
}

function webglAvailable() {
  const probe = document.createElement('canvas');
  return Boolean(probe.getContext('webgl2') || probe.getContext('webgl'));
}

/** Puts the robot on the page. Safe to call more than once. */
export function mountRobot() {
  if (mounted) return;
  mounted = true;

  let size = COMPACT.matches ? SIZE_COMPACT : SIZE;
  const defaultPosition = () => ({ x: window.innerWidth - size - 24, y: window.innerHeight - size - (COMPACT.matches ? 96 : 32) });
  const clamp = (p) => ({
    x: Math.min(Math.max(p.x, EDGE), Math.max(EDGE, window.innerWidth - size - EDGE)),
    y: Math.min(Math.max(p.y, EDGE), Math.max(EDGE, window.innerHeight - size - EDGE)),
  });
  let position = clamp(storedPosition() || defaultPosition());
  let drag = null;
  // No earlier tap yet: a tap in the first moments after the page loads must not count as a second one.
  let lastTap = -Infinity;
  let open = false;
  let scene = null;
  let cursor = null;
  let hovered = false;
  let dragging = false;
  let thinking = false;

  const badge = h('span', { class: 'ast-badge', 'aria-hidden': 'true' }, icon('assistant', 24));
  const hint = h('span', { class: 'visually-hidden', id: 'ast-hint' }, 'Press Enter to open, or double-tap. Arrow keys or dragging move it.');
  const shadow = h('span', { class: 'ast-shadow', 'aria-hidden': 'true' });
  const stage = h('span', { class: 'ast-stage' }, badge);
  const robot = h('div', {
    class: 'ast-robot',
    role: 'button',
    tabindex: '0',
    'aria-label': 'CareRoute assistant',
    'aria-describedby': 'ast-hint',
    'aria-haspopup': 'dialog',
    'aria-expanded': 'false',
  }, shadow, stage, hint);

  // One place decides the expression: carried beats open, open beats hover.
  function paintMood() {
    robot.classList.toggle('is-dragging', dragging);
    robot.classList.toggle('is-hovered', hovered && !dragging);
    robot.classList.toggle('is-open', open);
    scene?.setMood(dragging ? 'dragging' : thinking ? 'thinking' : open ? 'open' : hovered ? 'happy' : 'idle');
  }
  function pulse() {
    const ring = h('span', { class: 'ast-ring', 'aria-hidden': 'true' });
    stage.append(ring);
    setTimeout(() => ring.remove(), 700);
  }

  const place = (p) => { robot.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`; };
  const paintSize = () => { robot.style.setProperty('--ast-size', `${size}px`); };
  function commit(next) {
    position = clamp(next);
    place(position);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
    } catch {
      // Private browsing can refuse storage; the robot still moves, it just forgets on reload.
    }
    placePanel();
  }

  const chat = createChat({
    onClose: () => setOpen(false),
    setMood: (m) => {
      thinking = m === 'thinking';
      paintMood();
    },
  });
  const { panel } = chat;

  // The panel opens on whichever side of the robot has room, and never off screen.
  function placePanel() {
    if (!open) return;
    const pw = Math.min(400, window.innerWidth - EDGE * 2);
    // The width changes how the text wraps, so it is set before the height is measured.
    panel.style.width = `${pw}px`;
    const ph = panel.offsetHeight || 420;
    const leftSide = position.x + size / 2 > window.innerWidth / 2;
    let x = leftSide ? position.x - pw - 12 : position.x + size + 12;
    if (x < EDGE || x + pw > window.innerWidth - EDGE) x = Math.min(Math.max(position.x + size / 2 - pw / 2, EDGE), window.innerWidth - pw - EDGE);
    let y = position.y + size - ph;
    if (COMPACT.matches) y = position.y - ph - 12;
    y = Math.min(Math.max(y, EDGE), window.innerHeight - ph - EDGE);
    panel.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }

  function setOpen(next) {
    open = next;
    panel.hidden = !open;
    robot.setAttribute('aria-expanded', String(open));
    paintMood();
    if (open) pulse();
    if (open) {
      placePanel();
      chat.opened();
    } else {
      robot.focus();
    }
  }

  robot.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: position.x, oy: position.y, moved: false, latest: position, frame: 0 };
    robot.setPointerCapture?.(e.pointerId);
  });
  robot.addEventListener('pointermove', (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    const dx = e.clientX - drag.sx;
    const dy = e.clientY - drag.sy;
    if (!drag.moved) {
      if (Math.hypot(dx, dy) <= DRAG_THRESHOLD_PX) return;
      drag.moved = true;
      dragging = true;
      paintMood();
    }
    drag.latest = clamp({ x: drag.ox + dx, y: drag.oy + dy });
    if (!drag.frame) {
      drag.frame = requestAnimationFrame(() => {
        if (!drag) return;
        place(drag.latest);
        drag.frame = 0;
      });
    }
  });
  function endDrag(e, cancelled) {
    if (!drag || drag.id !== e.pointerId) return;
    if (drag.frame) cancelAnimationFrame(drag.frame);
    if (cancelled) {
      place(position);
    } else if (drag.moved) {
      commit(drag.latest);
    } else {
      // A tap is a press and release that never crossed the drag threshold; two close together open the panel.
      const now = performance.now();
      if (now - lastTap <= DOUBLE_TAP_MS) {
        lastTap = -Infinity;
        setOpen(!open);
      } else {
        lastTap = now;
      }
    }
    drag = null;
    dragging = false;
    paintMood();
  }
  robot.addEventListener('pointerup', (e) => endDrag(e, false));
  robot.addEventListener('pointercancel', (e) => endDrag(e, true));
  robot.addEventListener('pointerenter', () => { hovered = true; paintMood(); });
  robot.addEventListener('pointerleave', () => { hovered = false; paintMood(); });
  // Screen readers (VoiceOver, TalkBack) activate with one synthetic click, which has no pointer taps.
  robot.addEventListener('click', (e) => {
    if (e.detail === 0) setOpen(!open);
  });
  // A double click must not select page text under the robot.
  robot.addEventListener('dblclick', (e) => e.preventDefault());
  robot.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'a' || e.key === 'A') {
      e.preventDefault();
      setOpen(!open);
    }
    // Arrow keys move it, so a keyboard user can get it out of the way too.
    const step = e.shiftKey ? 48 : 16;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) {
      e.preventDefault();
      commit({ x: position.x + moves[e.key][0], y: position.y + moves[e.key][1] });
    }
  });

  COMPACT.addEventListener('change', () => {
    size = COMPACT.matches ? SIZE_COMPACT : SIZE;
    paintSize();
    commit(position);
  });
  window.addEventListener('resize', () => {
    position = clamp(position);
    place(position);
    placePanel();
  });

  paintSize();
  place(position);
  document.body.append(robot, panel);

  // The 3D model waits for a quiet moment after the page loads, or for the first reach towards the
  // robot, so it never slows the page itself. The badge stands in until then, and for good without WebGL.
  let started = false;
  async function startScene() {
    if (started || !webglAvailable()) return;
    started = true;
    // Only this robot follows the cursor (D-64); everything else on the page stays still.
    window.addEventListener('pointermove', (e) => {
      if (!REDUCED.matches) cursor = { x: e.clientX, y: e.clientY };
    }, { passive: true });
    REDUCED.addEventListener('change', () => {
      cursor = null;
      scene?.setReducedMotion(REDUCED.matches);
    });
    const canvas = h('canvas', { class: 'ast-canvas' });
    stage.append(canvas);
    const timer = setTimeout(() => {
      if (!scene) canvas.remove();
    }, LOAD_TIMEOUT_MS);
    try {
      const { mountRobotScene } = await import('./robot-scene.js');
      scene = await mountRobotScene(canvas, { pointer: () => cursor, reducedMotion: REDUCED.matches });
      clearTimeout(timer);
      if (!canvas.isConnected) {
        scene.destroy();
        scene = null;
        return;
      }
      robot.classList.add('has-model');
      paintMood();
    } catch (err) {
      clearTimeout(timer);
      canvas.remove();
      console.error('The assistant robot model could not load; the badge stays.', err);
    }
  }
  for (const type of ['pointerenter', 'pointerdown', 'focus']) robot.addEventListener(type, startScene, { once: true });
  const idle = () => ('requestIdleCallback' in window ? requestIdleCallback(startScene, { timeout: 3000 }) : setTimeout(startScene, 1500));
  if (document.readyState === 'complete') idle();
  else window.addEventListener('load', idle, { once: true });
}
