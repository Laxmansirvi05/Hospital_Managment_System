// Settings (D-61). These choices belong to this device and browser, so they are kept in the
// browser, not on the server. Account security stays on the Account and privacy page.
import { h, icon, toast } from '../h.js';
import { shell, TEXT_LARGE_KEY } from '../shell.js';
import { pageHead, getOrigin, locateMe, DEFAULT_ORIGIN } from '../ui.js';
import { notificationState, askForNotifications } from '../notify.js';

const { main } = await shell({ nav: 'settings', title: 'Settings' });

const section = (title, sub, ...rows) => h('section', { class: 'card stack-8' },
  h('div', { class: 'stack-4' }, h('h2', { class: 't-title-3' }, title), sub ? h('p', { class: 't-footnote muted' }, sub) : null),
  h('div', {}, rows));

const row = (label, hint, control, id) => h('div', { class: 'setting-row' },
  h('div', { class: 'stack-4' }, h('span', { class: 't-headline', id }, label), hint ? h('span', { class: 't-footnote muted', id: id ? `${id}-hint` : undefined }, hint) : null),
  control);

const linkRow = (label, hint, href) => h('a', { class: 'setting-row setting-link', href },
  h('div', { class: 'stack-4' }, h('span', { class: 't-headline' }, label), hint ? h('span', { class: 't-footnote muted' }, hint) : null),
  icon('chevron', 18));

function textSizeSwitch() {
  let on = document.documentElement.classList.contains('text-large');
  const sw = h('button', { class: 'switch', type: 'button', role: 'switch', 'aria-checked': String(on), 'aria-labelledby': 'larger-text', 'aria-describedby': 'larger-text-hint' });
  sw.addEventListener('click', () => {
    on = !on;
    sw.setAttribute('aria-checked', String(on));
    document.documentElement.classList.toggle('text-large', on);
    try {
      if (on) localStorage.setItem(TEXT_LARGE_KEY, '1'); else localStorage.removeItem(TEXT_LARGE_KEY);
    } catch {
      toast('This browser blocks saved settings, so larger text lasts until you leave this page.');
    }
  });
  return sw;
}

function locationControls() {
  const label = h('span', { class: 't-footnote muted' });
  const draw = () => { label.textContent = `Distances are measured from ${getOrigin().label || 'your location'}.`; };
  draw();
  const use = h('button', { class: 'btn btn-secondary', type: 'button' }, icon('locate', 16), 'Use my location');
  use.addEventListener('click', async () => {
    try {
      await locateMe();
      draw();
      toast('Distances now start from your location.');
    } catch (err) {
      toast(err.message);
    }
  });
  const reset = h('button', { class: 'btn btn-text', type: 'button' }, `Reset to ${DEFAULT_ORIGIN.label}`);
  reset.addEventListener('click', () => {
    try {
      sessionStorage.removeItem('careroute.origin');
    } catch {
      toast('This browser blocks saved settings.');
    }
    draw();
  });
  return { label, control: h('div', { class: 'row-8' }, use, reset) };
}

function notificationControl() {
  const state = notificationState();
  const words = {
    granted: 'On. Reminders appear while CareRoute is open in this browser.',
    denied: 'Blocked in this browser. Allow notifications for this site in the browser settings to turn them on.',
    default: 'Off. Turn on to get a notice when a dose is due.',
    unsupported: 'This browser cannot show notifications. Due doses still appear on the dashboard.',
  };
  const hint = h('span', { class: 't-footnote muted' }, words[state] || words.default);
  const btn = state === 'default' ? h('button', { class: 'btn btn-primary', type: 'button' }, 'Turn on') : null;
  btn?.addEventListener('click', async () => {
    const result = await askForNotifications();
    hint.textContent = words[result] || words.default;
    btn.hidden = result !== 'default';
  });
  return { hint, btn };
}

const loc = locationControls();
const note = notificationControl();

main.replaceChildren(h('div', { class: 'page' },
  pageHead({ art: 'settings', title: 'Settings', sub: 'Choices for this device. Your account, password and data are on the Account and privacy page.' }),
  h('div', { class: 'settings-grid' },
    section('Display', 'Saved in this browser.',
      row('Larger text', 'Makes text about 12 percent bigger on every signed-in page.', textSizeSwitch(), 'larger-text')),
    section('Location', 'Used only to sort results by distance. It is not stored on our servers.',
      h('div', { class: 'setting-row' }, h('div', { class: 'stack-4' }, h('span', { class: 't-headline' }, 'Starting point'), loc.label), loc.control)),
    section('Medicine reminders', null,
      h('div', { class: 'setting-row' }, h('div', { class: 'stack-4' }, h('span', { class: 't-headline' }, 'Browser notifications'), note.hint), note.btn)),
    section('Account', null,
      linkRow('Account and privacy', 'Password, signed-in devices, delete account', '/account/'),
      linkRow('Medical ID sharing', 'Choose whether an ambulance crew can see your medical ID', '/medical-id/#sharing')),
    section('About CareRoute', null,
      linkRow('Privacy policy', 'What we collect and how to delete it', '/privacy/'),
      linkRow('Terms of use', 'What CareRoute is and is not', '/terms/'),
      linkRow('Where the data comes from', 'Sources and counts on the Explore page', '/explore/')))));
