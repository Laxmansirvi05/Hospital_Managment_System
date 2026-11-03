// Makes the assistant panel a floating window, after the one in the owner's student management
// system: drag it by its header, resize it from the bottom-right corner (double-click the corner to
// go back to the default size), and it keeps its size in this browser. It always stays on screen.
import { h } from '../h.js';

const PAD = 12;
const MIN = { width: 300, height: 360 };
const STEP = 24;

function stored(key) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || 'null');
    return typeof v?.width === 'number' && typeof v?.height === 'number' ? v : null;
  } catch {
    // Blocked or corrupt storage: the default size is used.
    return null;
  }
}

function save(key, size) {
  try {
    localStorage.setItem(key, JSON.stringify(size));
  } catch {
    // Private browsing can refuse storage; the size still applies until the page closes.
  }
}

/**
 * `panel` is positioned with top and left; `handle` is the header that drags it. Returns
 * { placeNear(anchor), moved } where placeNear opens it beside the robot unless the patient has
 * already moved it on this page.
 */
export function makeFloating(panel, handle, { storageKey, defaultSize }) {
  let size = stored(storageKey) || { ...defaultSize };
  let pos = { top: PAD, left: PAD };
  let moved = false;
  let drag = null;
  let grow = null;

  const limits = () => ({ width: window.innerWidth - PAD * 2, height: window.innerHeight - PAD * 2 });
  function clampSize(s) {
    const max = limits();
    return {
      width: Math.round(Math.min(Math.max(s.width, Math.min(MIN.width, max.width)), max.width)),
      height: Math.round(Math.min(Math.max(s.height, Math.min(MIN.height, max.height)), max.height)),
    };
  }
  function clampPos(p) {
    return {
      top: Math.min(Math.max(p.top, PAD), Math.max(PAD, window.innerHeight - size.height - PAD)),
      left: Math.min(Math.max(p.left, PAD), Math.max(PAD, window.innerWidth - size.width - PAD)),
    };
  }
  function paint() {
    size = clampSize(size);
    pos = clampPos(pos);
    panel.style.width = `${size.width}px`;
    panel.style.height = `${size.height}px`;
    panel.style.transform = `translate3d(${pos.left}px, ${pos.top}px, 0)`;
  }

  handle.classList.add('ast-drag-handle');
  handle.addEventListener('pointerdown', (e) => {
    // A plain drag on the header itself, never on one of its buttons.
    if (e.button !== 0 || e.target.closest('button, a, input, textarea, select')) return;
    e.preventDefault();
    handle.setPointerCapture?.(e.pointerId);
    drag = { x: e.clientX, y: e.clientY, top: pos.top, left: pos.left };
    panel.classList.add('is-moving');
  });
  handle.addEventListener('pointermove', (e) => {
    if (!drag) return;
    moved = true;
    pos = { top: drag.top + e.clientY - drag.y, left: drag.left + e.clientX - drag.x };
    paint();
  });
  const endDrag = () => {
    drag = null;
    panel.classList.remove('is-moving');
  };
  handle.addEventListener('pointerup', endDrag);
  handle.addEventListener('pointercancel', endDrag);

  // The corner grip. It is a keyboard control too: arrow keys change the size.
  const grip = h('button', { class: 'ast-grip', type: 'button', 'aria-label': 'Resize the assistant. Arrow keys change the size; double-click resets it.', title: 'Drag to resize, double-click to reset' });
  grip.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    grip.setPointerCapture?.(e.pointerId);
    grow = { x: e.clientX, y: e.clientY, width: size.width, height: size.height };
    panel.classList.add('is-moving');
  });
  grip.addEventListener('pointermove', (e) => {
    if (!grow) return;
    size = { width: grow.width + e.clientX - grow.x, height: grow.height + e.clientY - grow.y };
    paint();
  });
  const endGrow = () => {
    if (!grow) return;
    grow = null;
    panel.classList.remove('is-moving');
    save(storageKey, size);
  };
  grip.addEventListener('pointerup', endGrow);
  grip.addEventListener('pointercancel', endGrow);
  grip.addEventListener('dblclick', () => {
    size = { ...defaultSize };
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // Nothing to undo: the default size already applies.
    }
    paint();
  });
  grip.addEventListener('keydown', (e) => {
    const change = { ArrowRight: [STEP, 0], ArrowLeft: [-STEP, 0], ArrowDown: [0, STEP], ArrowUp: [0, -STEP] }[e.key];
    if (!change) return;
    e.preventDefault();
    size = { width: size.width + change[0], height: size.height + change[1] };
    paint();
    save(storageKey, size);
  });
  panel.append(grip);

  window.addEventListener('resize', paint);

  return {
    /** Opens beside the robot (`anchor` is its box), on whichever side has room. */
    placeNear(anchor, { compact = false } = {}) {
      if (moved) {
        paint();
        return;
      }
      size = clampSize(size);
      const leftSide = anchor.x + anchor.size / 2 > window.innerWidth / 2;
      let left = leftSide ? anchor.x - size.width - 12 : anchor.x + anchor.size + 12;
      if (left < PAD || left + size.width > window.innerWidth - PAD) left = anchor.x + anchor.size / 2 - size.width / 2;
      const top = compact ? anchor.y - size.height - 12 : anchor.y + anchor.size - size.height;
      pos = { top, left };
      paint();
    },
  };
}
