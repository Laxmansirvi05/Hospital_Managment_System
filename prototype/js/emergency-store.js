// Simulated emergency for the prototype. The real flow is server driven with
// Supabase Realtime (docs/06-emergency-lifecycle.md); here a timer walks the same states.
import { AMBULANCE, ROUTE_TO_PATIENT, ROUTE_TO_HOSPITAL } from './data.js';
import { along } from './map3d.js';

const TICK_MS = 1500;
const ETA_TO_PATIENT_S = 480;
const ETA_TO_HOSPITAL_S = 180;

export const ORDER = ['matching', 'assigned', 'en_route', 'arrived', 'picked_up', 'at_hospital', 'completed'];

/** @type {any} */
export const em = {
  id: 'em_2124',
  status: 'idle',
  etaSeconds: null,
  progress: 0,
  ambulance: { x: AMBULANCE.start.x, y: AMBULANCE.start.y },
  updatedAt: Date.now(),
  createdAt: null,
  form: null,
  ticksInState: 0,
  cancelReason: null,
};

const listeners = new Set();
let timer = 0;

function emit() {
  em.updatedAt = Date.now();
  for (const fn of listeners) fn(em);
}

function setStatus(status) {
  em.status = status;
  em.ticksInState = 0;
  if (status === 'assigned') em.etaSeconds = ETA_TO_PATIENT_S;
  if (status === 'en_route') em.progress = 0;
  if (status === 'arrived') { em.etaSeconds = 0; em.progress = 1; const p = along(ROUTE_TO_PATIENT, 1); em.ambulance = p; }
  if (status === 'picked_up') { em.progress = 0; em.etaSeconds = ETA_TO_HOSPITAL_S; }
  if (status === 'at_hospital') { em.etaSeconds = 0; em.ambulance = along(ROUTE_TO_HOSPITAL, 1); }
  if (status === 'completed' || status === 'cancelled') stop();
}

function tick() {
  em.ticksInState += 1;
  switch (em.status) {
    case 'matching':
      if (em.ticksInState >= 3) setStatus('assigned');
      break;
    case 'assigned':
      if (em.ticksInState >= 2) setStatus('en_route');
      break;
    case 'en_route':
      em.progress = Math.min(1, em.progress + 0.07);
      em.ambulance = along(ROUTE_TO_PATIENT, em.progress);
      em.etaSeconds = Math.round((1 - em.progress) * ETA_TO_PATIENT_S);
      if (em.progress >= 1) setStatus('arrived');
      break;
    case 'arrived':
      if (em.ticksInState >= 4) setStatus('picked_up');
      break;
    case 'picked_up':
      em.progress = Math.min(1, em.progress + 0.12);
      em.ambulance = along(ROUTE_TO_HOSPITAL, em.progress);
      em.etaSeconds = Math.round((1 - em.progress) * ETA_TO_HOSPITAL_S);
      if (em.progress >= 1) setStatus('at_hospital');
      break;
    case 'at_hospital':
      if (em.ticksInState >= 4) setStatus('completed');
      break;
    default:
      break;
  }
  emit();
}

function stop() {
  window.clearInterval(timer);
  timer = 0;
}

export function startEmergency(form) {
  stop();
  Object.assign(em, {
    status: 'matching', etaSeconds: null, progress: 0, ticksInState: 0, cancelReason: null,
    ambulance: { x: AMBULANCE.start.x, y: AMBULANCE.start.y }, createdAt: Date.now(), form,
  });
  timer = window.setInterval(tick, TICK_MS);
  emit();
}

/** Prototype control: jump to the next state. */
export function advance() {
  const i = ORDER.indexOf(em.status);
  if (i < 0 || i >= ORDER.length - 1) return;
  const next = ORDER[i + 1];
  if (next === 'arrived') em.ambulance = along(ROUTE_TO_PATIENT, 1);
  setStatus(next);
  if (!timer && next !== 'completed') timer = window.setInterval(tick, TICK_MS);
  emit();
}

export function cancelEmergency(reason) {
  em.cancelReason = reason;
  setStatus('cancelled');
  emit();
}

export function subscribe(fn) {
  listeners.add(fn);
  fn(em);
  return () => listeners.delete(fn);
}

export function canCancel() {
  return ['matching', 'assigned', 'en_route', 'arrived'].includes(em.status);
}

export function etaMinutes() {
  if (em.etaSeconds === null) return null;
  return Math.max(em.etaSeconds > 0 ? 1 : 0, Math.ceil(em.etaSeconds / 60));
}
