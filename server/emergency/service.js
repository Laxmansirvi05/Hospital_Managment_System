import { runDemoCrew, DEMO_CREW_TIMING } from './demo-crew.js';

/** Coordinates application workflows while leaving lifecycle decisions in the data adapter. */
export function createEmergencyService({ store, eta = async (point, candidates) => candidates.map((c) => ({ ...c, etaSeconds: Math.ceil(c.distanceKm * 1.4 / 30 * 3600), etaIsEstimate: true })), sms = null, now = () => new Date(), timing = DEMO_CREW_TIMING }) {
  const db = store.emergencies;
  const tick = () => runDemoCrew(store, { now, timing });
  return {
    async create(input) {
      const emergency = await db.createEmergency(input);
      const nearby = await db.nearbyAmbulances({ point: input.location, type: input.ambulanceType ?? 'BLS', radiusKm: 10, maxAgeSeconds: 90, limit: 24 });
      const ambulanceRows = await db.listAmbulances();
      const candidatesWithPosition = nearby.map((candidate) => ({ ...candidate, ...ambulanceRows.find((ambulance) => ambulance.id === candidate.id) }));
      const ranked = await eta(input.location, candidatesWithPosition);
      const candidates = ranked.slice().sort((a, b) => (a.etaSeconds + (a.type === (input.ambulanceType ?? 'BLS') ? 0 : 180)) - (b.etaSeconds + (b.type === (input.ambulanceType ?? 'BLS') ? 0 : 180))).slice(0, 5);
      const matched = await db.createOffers(emergency.id, candidates.map(({ id, ambulanceId, etaSeconds }) => ({ ambulanceId: ambulanceId ?? id, etaSeconds })), ranked.length > 0 && ranked.every((x) => x.etaIsEstimate));
      if (sms && input.contacts?.length) {
        const contacts = input.contacts.map((contact) => ({ phone: contact.phone }));
        const timer = setTimeout(async () => {
          if ((await db.getById(emergency.id))?.status === 'cancelled') return;
          for (const contact of contacts) {
            try { await sms.sendTracking({ to: contact.phone, emergencyId: emergency.id, trackingUrl: input.trackingUrl }); await db.insertEvent(emergency.id, 'sms_sent', 'system'); }
            catch { await db.insertEvent(emergency.id, 'sms_failed', 'system'); }
          }
        }, 5_000);
        timer.unref?.();
      }
      return matched;
    },
    async read(id) { await tick(); return db.getById(id); },
    async readTracking(hash) { await tick(); return db.getByTokenHash(hash); },
    async activeForPatient(userId) { await tick(); return db.activeForPatient(userId); },
    async history(userId, paging) { await tick(); return db.history(userId, paging); },
    async driverOffers(driverUserId) {
      await tick();
      const ambulance = await db.ambulanceByDriver(driverUserId);
      if (!ambulance) return { ambulance: null, offer: null };
      return { ambulance, offer: await db.openOfferForAmbulance(ambulance.id) };
    },
    async adminList(filters) { await tick(); return db.listAdmin(filters); },
    tick,
  };
}

export { runDemoCrew };
