import { distanceKm } from '../db/geo.js';

const DEFAULT_TIMING = Object.freeze({ acceptMinMs: 5_000, acceptRangeMs: 15_000, enRoutePauseMs: 2_000, arrivedPauseMs: 2_000, pickedUpPauseMs: 2_000, atHospitalPauseMs: 2_000, releasePauseMs: 2_000 });
const STEPS = [
  ['assigned', 'en_route', 'enRouteAt', 'enRoutePauseMs'], ['en_route', 'arrived', 'arrivedAt', 'arrivedPauseMs'],
  ['arrived', 'picked_up', 'pickedUpAt', 'pickedUpPauseMs'], ['picked_up', 'at_hospital', 'atHospitalAt', 'atHospitalPauseMs'],
  ['at_hospital', 'completed', 'completedAt', 'atHospitalPauseMs'],
];
const DEMO_STARTS = Object.freeze({
  'DEMO-0001': { lat: 17.4435, lng: 78.4676 }, 'DEMO-0002': { lat: 17.4399, lng: 78.4983 }, 'DEMO-0003': { lat: 17.4156, lng: 78.4347 },
  'DEMO-0004': { lat: 17.4326, lng: 78.4071 }, 'DEMO-0005': { lat: 17.4435, lng: 78.3772 }, 'DEMO-0006': { lat: 17.4401, lng: 78.3489 },
  'DEMO-0007': { lat: 17.4948, lng: 78.3996 }, 'DEMO-0008': { lat: 17.4375, lng: 78.4482 }, 'DEMO-0009': { lat: 17.3688, lng: 78.5247 },
  'DEMO-0010': { lat: 17.3457, lng: 78.5522 }, 'DEMO-0011': { lat: 17.3616, lng: 78.4747 }, 'DEMO-0012': { lat: 17.4058, lng: 78.5591 },
});
const seed = (id) => [...id].reduce((n, c) => (n * 33 + c.charCodeAt(0)) >>> 0, 5381);

export function demoOfferDelayMs(emergencyId, timing = DEFAULT_TIMING) {
  return timing.acceptMinMs + (seed(emergencyId) % Math.max(timing.acceptRangeMs, 1));
}

export function demoDeclines(emergencyId) {
  return seed(emergencyId) % 5 === 0;
}

function positionAt(start, target, progress) {
  const t = Math.min(1, Math.max(0, progress));
  return { lat: start.lat + (target.lat - start.lat) * t, lng: start.lng + (target.lng - start.lng) * t,
    heading: (Math.atan2(target.lng - start.lng, target.lat - start.lat) * 180 / Math.PI + 360) % 360 };
}

/** Lazily advances synthetic demo crews. It never mutates a non-demo ambulance. */
export async function runDemoCrew(store, { now = () => new Date(), timing = DEFAULT_TIMING } = {}) {
  const db = store.emergencies;
  let acted = 0;
  for (const emergency of await db.listAdmin({ limit: 1000 })) {
    if (emergency.status === 'matching') {
      const [offer] = (await db.offersForEmergency(emergency.id)).filter((candidate) => candidate.state === 'open');
      if (!offer || +now() < +offer.offeredAt + demoOfferDelayMs(emergency.id, timing)) continue;
      const ambulance = (await db.listAmbulances()).find((candidate) => candidate.id === offer.ambulanceId);
      if (!ambulance?.isDemo) continue;
      if (demoDeclines(emergency.id)) await db.declineOffer(emergency.id, ambulance.id);
      else await db.acceptEmergency(emergency.id, ambulance.id);
      acted += 1;
    }
    const current = await db.getById(emergency.id);
    if (!current?.ambulanceId || !['assigned', 'en_route', 'arrived', 'picked_up', 'at_hospital', 'completed'].includes(current.status)) continue;
    const ambulance = (await db.listAmbulances()).find((candidate) => candidate.id === current.ambulanceId);
    if (!ambulance?.isDemo) continue;
    if (current.status === 'completed') {
      if (current.completedAt && +now() - +current.completedAt >= timing.releasePauseMs) { await db.releaseAmbulance(ambulance.id); acted += 1; }
      continue;
    }
    const start = { ...(DEMO_STARTS[ambulance.registrationNumber] ?? { lat: ambulance.lat, lng: ambulance.lng }), at: current.assignedAt };
    const distance = distanceKm(start, current.location);
    const travelMs = distance / 40 * 3_600_000;
    const since = +now() - +start.at;
    const moving = positionAt(start, current.location, travelMs ? since / travelMs : 1);
    await db.updateAmbulanceLocation(ambulance.id, { ...moving, speed: since < travelMs ? 40 : 0 });
    const step = STEPS.find(([from]) => from === current.status);
    if (step) {
      const [from, to, timestampKey, pauseKey] = step;
      const entered = current[timestampKey] ?? current.assignedAt;
      const waitMs = to === 'en_route' ? 0 : (timing[pauseKey] ?? 2_000);
      if (to === 'en_route' || (+now() - +entered >= Math.max(travelMs, waitMs))) {
        await db.advanceEmergency(current.id, ambulance.id, to); acted += 1;
      }
    }
  }
  return acted;
}

export const DEMO_CREW_TIMING = DEFAULT_TIMING;
