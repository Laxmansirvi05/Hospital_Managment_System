// Medicine reminders in the browser (D-38). While any CareRoute page is open, doses due today
// raise an in-app message and, if the patient allowed it, a browser notification.
// Browsers do not run this while the tab is closed or the phone sleeps; the reminders page says so.
import { api } from './api.js';
import { toast } from './h.js';
import { todayIst, nowTimeIst } from './format.js';

const SEEN_KEY = 'careroute.notified';
let timers = [];

function seen() {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

function markSeen(key) {
  try {
    const s = seen();
    s.add(key);
    // Keep only today's keys so the list stays small.
    const today = todayIst();
    localStorage.setItem(SEEN_KEY, JSON.stringify([...s].filter((k) => k.startsWith(today))));
  } catch {
    // Storage can be blocked in private windows; the reminder still shows, it may just repeat.
  }
}

function minutesUntil(time, now = new Date()) {
  const [h, m] = time.split(':').map(Number);
  const [nh, nm] = nowTimeIst(now).split(':').map(Number);
  return h * 60 + m - (nh * 60 + nm);
}

function fire(dose) {
  const key = `${dose.date}|${dose.reminderId}|${dose.time}`;
  if (seen().has(key)) return;
  markSeen(key);
  const text = `${dose.medicineName}, ${dose.dose}${dose.instructions ? `, ${dose.instructions.toLowerCase()}` : ''}`;
  toast(`Time for ${text}`);
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification('Medicine reminder', { body: `${dose.time} · ${text}`, tag: key });
    } catch {
      // Some mobile browsers only allow notifications from a service worker; the in-app message above still shows.
    }
  }
}

export async function startReminderWatch() {
  timers.forEach(clearTimeout);
  timers = [];
  let data;
  try {
    data = await api('/patients/me/reminders/today');
  } catch {
    return; // Reminders are a convenience here; a failed fetch must not break the page.
  }
  for (const dose of data.doses) {
    if (dose.status !== 'due') continue;
    const mins = minutesUntil(dose.time);
    if (mins < -30) continue; // Older than 30 minutes: shown on the dashboard, not announced.
    timers.push(setTimeout(() => fire(dose), Math.max(0, mins) * 60000));
  }
}

export function notificationState() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export async function askForNotifications() {
  if (!('Notification' in window)) return 'unsupported';
  const result = await Notification.requestPermission();
  if (result === 'granted') startReminderWatch();
  return result;
}
