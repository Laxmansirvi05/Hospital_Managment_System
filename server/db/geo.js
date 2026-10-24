/** Great-circle distance in km. PostGIS does this in the database; the memory store uses this. */
export function distanceKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Doses due on a date for a set of reminders, merged with what was recorded. */
export function dosesFor(reminders, logs, date) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  const out = [];
  for (const r of reminders) {
    if (!r.active) continue;
    if (date < r.startDate) continue;
    if (r.endDate && date > r.endDate) continue;
    if (!r.daysOfWeek.includes(day)) continue;
    for (const time of r.times) {
      const log = logs.find((l) => l.reminderId === r.id && l.date === date && l.time === time);
      out.push({ reminderId: r.id, medicineName: r.medicineName, dose: r.dose, instructions: r.instructions, date, time, status: log ? log.status : 'due' });
    }
  }
  return out.sort((a, b) => a.time.localeCompare(b.time));
}
