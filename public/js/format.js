const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DAY_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
export const DAY_NAMES = DAYS;

/** Today in India as YYYY-MM-DD, matching the server. */
export function todayIst(now = new Date()) {
  return new Date(now.getTime() + 330 * 60000).toISOString().slice(0, 10);
}

export function nowTimeIst(now = new Date()) {
  return new Date(now.getTime() + 330 * 60000).toISOString().slice(11, 16);
}

/** "25 Oct 2026" */
export function dateLong(iso) {
  if (!iso) return '';
  // Timestamps are shown on the India calendar day; plain dates are already local.
  const day = String(iso).includes('T') ? todayIst(new Date(iso)) : String(iso).slice(0, 10);
  const [y, m, d] = day.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function monthShort(iso) {
  return MONTHS[Number(iso.slice(5, 7)) - 1];
}

export function dayOfMonth(iso) {
  return String(Number(iso.slice(8, 10)));
}

export function weekday(iso) {
  return DAYS[new Date(`${iso}T00:00:00Z`).getUTCDay()];
}

/** "09:30" stays 24 hour, as Indian forms and prescriptions commonly use. */
export function time(t) {
  return t;
}

export function relativeDay(iso, today = todayIst()) {
  const diff = Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff > 1 && diff < 7) return weekday(iso);
  return dateLong(iso);
}

/** Whole rupees, for fees that are never fractional. */
export function inr(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

export function rupees(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(value);
}

export function bytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function km(d) {
  return d === undefined || d === null ? '' : `${d < 10 ? d.toFixed(1) : Math.round(d)} km`;
}

export function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || '?';
}

export function greeting(now = new Date()) {
  const h = Number(nowTimeIst(now).slice(0, 2));
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
