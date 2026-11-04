// Settings (D-61). These choices belong to this device and browser, so they are kept in the
// browser, not on the server. Account security stays on the Account and privacy page.
// Layout (2026-11-04): sections pack into columns like iOS Settings groups, so no column is left
// with a gap under a short section.
import { h, icon, toast } from '../h.js';
import { shell, TEXT_LARGE_KEY, REDUCE_MOTION_KEY, ROBOT_HIDDEN_KEY } from '../shell.js';
import { pageHead, confirmDialog } from '../ui.js';
import { DEFAULT_ORIGIN, resetOrigin, locationBar } from '../location.js';
import { iconTile } from '../art3d.js';
import { api } from '../api.js';
import { notificationState, askForNotifications } from '../notify.js';

const { main } = await shell({ nav: 'settings', title: 'Settings' });

const section = ({ art, title, sub, id }, ...rows) => h('section', { class: 'card settings-card', 'aria-labelledby': `${id}-h` },
  h('div', { class: 'settings-head' },
    iconTile(art, 44),
    h('div', { class: 'stack-4' }, h('h2', { class: 't-title-3', id: `${id}-h` }, title), sub ? h('p', { class: 't-footnote muted' }, sub) : null)),
  h('div', {}, rows));

const row = (label, hint, control, id) => h('div', { class: 'setting-row' },
  h('div', { class: 'stack-4' }, h('span', { class: 't-headline', id }, label), hint ? h('span', { class: 't-footnote muted', id: id ? `${id}-hint` : undefined }, hint) : null),
  control);

const linkRow = (label, hint, href, iconName) => h('a', { class: 'setting-row setting-link', href },
  iconName ? h('span', { class: 'setting-glyph', 'aria-hidden': 'true' }, icon(iconName, 18)) : null,
  h('div', { class: 'stack-4 setting-grow' }, h('span', { class: 't-headline' }, label), hint ? h('span', { class: 't-footnote muted' }, hint) : null),
  icon('chevron', 18));

const saved = (key) => {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    // Blocked storage: the setting is off.
    return false;
  }
};

/** An iOS style switch for a setting kept in this browser. `apply` runs on every change. */
function storedSwitch({ key, id, apply }) {
  let on = saved(key);
  const sw = h('button', { class: 'switch', type: 'button', role: 'switch', 'aria-checked': String(on), 'aria-labelledby': id, 'aria-describedby': `${id}-hint` });
  sw.addEventListener('click', () => {
    on = !on;
    sw.setAttribute('aria-checked', String(on));
    apply?.(on);
    try {
      if (on) localStorage.setItem(key, '1'); else localStorage.removeItem(key);
    } catch {
      toast('This browser blocks saved settings, so this lasts until you leave this page.');
    }
  });
  return sw;
}

function displaySection() {
  return section({ art: 'settings', title: 'Display', sub: 'Saved in this browser.', id: 'display' },
    row('Larger text', 'Makes text about 12 percent bigger on every signed-in page.',
      storedSwitch({ key: TEXT_LARGE_KEY, id: 'larger-text', apply: (on) => document.documentElement.classList.toggle('text-large', on) }), 'larger-text'),
    row('Reduce motion', 'Stops the moving icons and keeps the assistant robot still. Your device setting does the same.',
      storedSwitch({ key: REDUCE_MOTION_KEY, id: 'reduce-motion', apply: (on) => document.documentElement.classList.toggle('reduce-motion', on) }), 'reduce-motion'));
}

function locationSection() {
  const reset = h('button', { class: 'btn btn-text btn-sm', type: 'button' }, icon('back', 16), `Reset to ${DEFAULT_ORIGIN.label}`);
  reset.addEventListener('click', () => {
    resetOrigin();
    toast(`Distances now start from ${DEFAULT_ORIGIN.label}.`);
  });
  return section({ art: 'pin', title: 'Location', sub: 'Sorts results by distance and shows you on maps. It stays in this browser tab, goes to CareRoute only with a search, and is never stored or sent to other services.', id: 'location' },
    h('div', { class: 'stack-8 settings-loc' }, locationBar(), reset));
}

function emergencySection() {
  return section({ art: 'ambulance', title: 'Emergency', sub: 'What a crew can see, and who to call.', id: 'emergency' },
    h('a', { class: 'setting-row setting-link setting-sos', href: 'tel:112' },
      h('span', { class: 'setting-glyph setting-glyph-danger', 'aria-hidden': 'true' }, icon('phone', 18)),
      h('div', { class: 'stack-4 setting-grow' }, h('span', { class: 't-headline' }, 'Call 112'), h('span', { class: 't-footnote muted' }, 'National emergency number. Works from any phone.')),
      icon('chevron', 18)),
    linkRow('Medical ID sharing', 'Whether an ambulance crew can see your medical ID', '/medical-id/#share', 'shield'),
    linkRow('Emergency contacts', 'People to tell when you ask for an ambulance', '/medical-id/#contacts', 'users'));
}

function remindersSection() {
  const words = {
    granted: 'On. Reminders appear while CareRoute is open in this browser.',
    denied: 'Blocked in this browser. Allow notifications for this site in the browser settings to turn them on.',
    default: 'Off. Turn on to get a notice when a dose is due.',
    unsupported: 'This browser cannot show notifications. Due doses still appear on the dashboard.',
  };
  const hint = h('span', { class: 't-footnote muted' }, '');
  const turnOn = h('button', { class: 'btn btn-primary btn-sm', type: 'button' }, 'Turn on');
  const test = h('button', { class: 'btn btn-secondary btn-sm', type: 'button' }, icon('bell', 16), 'Send a test');
  const paint = (state) => {
    hint.textContent = words[state] || words.default;
    turnOn.hidden = state !== 'default';
    test.hidden = state !== 'granted';
  };
  turnOn.addEventListener('click', async () => paint(await askForNotifications()));
  test.addEventListener('click', () => {
    // A real notice, so the patient sees how a reminder will look on this device.
    try {
      new Notification('Medicine reminder', { body: 'This is how a due dose will look on this device.', tag: 'careroute-test' });
    } catch (err) {
      toast(`This browser did not show the notice: ${err.message}`);
    }
  });
  paint(notificationState());
  return section({ art: 'pill', title: 'Medicine reminders', id: 'reminders' },
    h('div', { class: 'setting-row' }, h('div', { class: 'stack-4' }, h('span', { class: 't-headline' }, 'Browser notifications'), hint), h('div', { class: 'row-8' }, turnOn, test)),
    linkRow('Your reminders', 'Add medicines and the times you take them', '/reminders/', 'clock'));
}

/** D-67, D-68: the assistant agreement and saved conversations, changeable at any time. */
function assistantSection() {
  const status = h('span', { class: 't-footnote muted' }, 'Loading');
  const withdraw = h('button', { class: 'btn btn-secondary btn-sm', type: 'button', hidden: true }, 'Withdraw agreement');
  const clear = h('button', { class: 'btn btn-text btn-sm', type: 'button' }, 'Delete all conversations');
  const describe = (info) => {
    status.textContent = info.consent.agreedAt
      ? `You agreed on ${new Date(info.consent.agreedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} that your messages, health facts and attached reports may be sent to ${info.consent.providers.join(' and ') || 'the AI service'}. You have ${info.conversations.length} saved conversation${info.conversations.length === 1 ? '' : 's'}.`
      : `Nothing is sent to an AI service. You have ${info.conversations.length} saved conversation${info.conversations.length === 1 ? '' : 's'}.`;
    withdraw.hidden = !info.consent.agreedAt;
  };
  const load = () => api('/patients/me/assistant').then(describe).catch((err) => { status.textContent = err.message; });
  withdraw.addEventListener('click', async () => {
    try {
      await api('/patients/me/assistant/consent', { method: 'PUT', body: { agree: false } });
      toast('Agreement withdrawn. The assistant will ask again before sending anything.');
      load();
    } catch (err) {
      toast(err.message);
    }
  });
  clear.addEventListener('click', async () => {
    if (!(await confirmDialog({ title: 'Delete all assistant conversations?', text: 'They are removed from your account for good.', confirm: 'Delete all' }))) return;
    try {
      await api('/assistant/conversations', { method: 'DELETE' });
      toast('Conversations deleted');
      load();
    } catch (err) {
      toast(err.message);
    }
  });
  load();
  // The switch is "Show", so on means the robot is there; the stored key records hiding it.
  let shown = !saved(ROBOT_HIDDEN_KEY);
  const robotSwitch = h('button', { class: 'switch', type: 'button', role: 'switch', 'aria-checked': String(shown), 'aria-labelledby': 'show-robot', 'aria-describedby': 'show-robot-hint' });
  robotSwitch.addEventListener('click', () => {
    shown = !shown;
    robotSwitch.setAttribute('aria-checked', String(shown));
    try {
      if (shown) localStorage.removeItem(ROBOT_HIDDEN_KEY); else localStorage.setItem(ROBOT_HIDDEN_KEY, '1');
    } catch {
      toast('This browser blocks saved settings, so this lasts until you leave this page.');
    }
    // Hide it on this page at once; turning it back on brings it from the next page.
    for (const el of document.querySelectorAll('.ast-robot, .ast-panel')) el.style.display = shown ? '' : 'none';
  });
  return section({ art: 'assistant', title: 'Assistant', sub: 'Guidance, not a diagnosis.', id: 'assistant' },
    row('Show the robot on pages', 'Double-tap it, or select it and press Enter, to ask a question. The AI assistant page in the sidebar stays either way.', robotSwitch, 'show-robot'),
    h('div', { class: 'setting-row setting-row-wrap' }, h('div', { class: 'stack-4' }, h('span', { class: 't-headline' }, 'AI service'), status), h('div', { class: 'row-8' }, withdraw, clear)),
    linkRow('Open the AI assistant', 'Every saved conversation, at full size', '/assistant/', 'assistant'));
}

/** What this browser keeps for CareRoute, and a way to clear it. */
function browserSection() {
  const KEYS = [TEXT_LARGE_KEY, REDUCE_MOTION_KEY, ROBOT_HIDDEN_KEY, 'careroute.robot.position', 'careroute.assistant.size'];
  const reset = h('button', { class: 'btn btn-secondary btn-sm', type: 'button' }, 'Reset');
  reset.addEventListener('click', async () => {
    if (!(await confirmDialog({ title: 'Reset this browser’s settings?', text: 'Text size, motion, the robot’s place and the assistant’s size go back to normal. Your account and data are not touched.', confirm: 'Reset', danger: false }))) return;
    try {
      for (const k of KEYS) localStorage.removeItem(k);
    } catch (err) {
      toast(`Could not reset: ${err.message}`);
      return;
    }
    resetOrigin();
    window.location.reload();
  });
  return section({ art: 'shield', title: 'This browser', sub: 'Kept on this device only. Nothing here is sent to CareRoute.', id: 'browser' },
    row('Reset settings in this browser', 'Text size, motion, the robot’s place and size, and the location for this tab.', reset));
}

main.replaceChildren(h('div', { class: 'page' },
  pageHead({ art: 'settings', title: 'Settings', sub: 'Choices for this device. Your account, password and data are on the Account and privacy page.' }),
  h('div', { class: 'settings-grid' },
    displaySection(),
    locationSection(),
    emergencySection(),
    remindersSection(),
    assistantSection(),
    browserSection(),
    section({ art: 'idcard', title: 'Account', id: 'account' },
      linkRow('Account and privacy', 'Password, signed-in devices, delete your account', '/account/', 'user'),
      linkRow('Medical ID', 'Your health details for an emergency', '/medical-id/', 'idcard')),
    section({ art: 'document', title: 'About CareRoute', id: 'about' },
      linkRow('Privacy policy', 'What we collect and how to delete it', '/privacy/', 'shield'),
      linkRow('Terms of use', 'What CareRoute is and is not', '/terms/', 'report'),
      linkRow('Where the data comes from', 'Sources and counts on the Explore page', '/explore/', 'chart')))));
