import { h, icon, toast } from '../h.js';
import { api } from '../api.js';
import { shell } from '../shell.js';
import { pageHead, field, showErrors, busy, confirmDialog } from '../ui.js';
import { iconTile } from '../art3d.js';
import { initials } from '../format.js';
import { notificationState } from '../notify.js';

const { main, user } = await shell({ nav: 'account', title: 'Account and privacy' });

// A Google account without a password proves itself with a recent Google sign-in instead (D-63).
const viaGoogleOnly = user.google && !user.hasPassword;

function passwordCard() {
  const current = h('input', { class: 'input', type: 'password', autocomplete: 'current-password' });
  const next = h('input', { class: 'input', type: 'password', autocomplete: 'new-password', minlength: 8 });
  const message = h('p', { class: 'form-error', role: 'alert', hidden: true });
  const save = h('button', { class: 'btn btn-primary', type: 'submit' }, viaGoogleOnly ? 'Set password' : 'Change password');
  const show = h('button', { class: 'btn btn-text btn-sm', type: 'button', 'aria-pressed': 'false' }, icon('eye', 16), 'Show passwords');
  show.addEventListener('click', () => {
    const on = current.type === 'password';
    current.type = on ? 'text' : 'password';
    next.type = on ? 'text' : 'password';
    show.setAttribute('aria-pressed', String(on));
    show.replaceChildren(icon(on ? 'eye-off' : 'eye', 16), on ? 'Hide passwords' : 'Show passwords');
  });
  // A rough guide only: length matters most, then a mix of kinds of character.
  const bar = h('span', { class: 'pw-meter-bar' });
  const verdict = h('span', { class: 't-footnote muted', 'aria-live': 'polite' });
  const meter = h('div', { class: 'pw-meter', hidden: true }, h('span', { class: 'pw-meter-track' }, bar), verdict);
  next.addEventListener('input', () => {
    const v = next.value;
    const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(v)).length;
    const score = v.length < 8 ? 0 : Math.min(3, (v.length >= 12 ? 2 : 1) + (kinds >= 3 ? 1 : 0));
    meter.hidden = !v;
    meter.dataset.score = String(score);
    verdict.textContent = ['Too short', 'Fair', 'Good', 'Strong'][score];
  });
  const form = h('form', { class: 'card form-section', novalidate: true },
    h('div', { class: 'stack-4' }, h('div', { class: 'settings-head' }, iconTile('shield', 44), h('h2', { class: 't-title-2' }, 'Password')), h('p', { class: 't-subhead muted' }, viaGoogleOnly
      ? 'You sign in with Google. Set a password to also sign in with your email. For your safety this works within 15 minutes of signing in with Google.'
      : 'Changing it signs you out on every other device.')),
    message,
    h('div', { class: 'form-grid' },
      viaGoogleOnly ? null : field({ id: 'currentPassword', label: 'Current password', input: current }),
      field({ id: 'newPassword', label: 'New password', input: next, hint: 'At least 8 characters. A longer phrase is stronger than a short mix.' })),
    meter,
    h('div', { class: 'row-8' }, save, show));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const restore = busy(save);
    try {
      await api('/auth/password', { body: viaGoogleOnly ? { newPassword: next.value } : { currentPassword: current.value, newPassword: next.value } });
      form.reset();
      message.hidden = true;
      toast('Password changed. Other devices are signed out.');
    } catch (err) {
      showErrors(form, err, message);
    } finally {
      restore();
    }
  });
  return form;
}

function devicesCard() {
  return h('section', { class: 'card stack-12' },
    h('div', { class: 'settings-head' }, iconTile('settings', 44), h('h2', { class: 't-title-3' }, 'Devices')),
    h('p', { class: 't-subhead muted' }, 'Lost a phone or used a shared computer? Sign out everywhere except here.'),
    h('div', { class: 'row' }, h('button', {
      class: 'btn btn-secondary', type: 'button',
      onclick: async () => {
        try {
          await api('/auth/sessions/revoke-others', { method: 'POST' });
          toast('Signed out on all other devices');
        } catch (err) {
          toast(err.message);
        }
      },
    }, icon('logout', 18), 'Sign out other devices')));
}

function deleteCard() {
  const password = h('input', { class: 'input', type: 'password', autocomplete: 'current-password' });
  const confirmText = h('input', { class: 'input', autocomplete: 'off', placeholder: 'DELETE' });
  const message = h('p', { class: 'form-error', role: 'alert', hidden: true });
  const go = h('button', { class: 'btn btn-danger', type: 'submit' }, icon('trash', 18), 'Delete my account');
  const form = h('form', { class: 'card form-section danger-zone', novalidate: true },
    h('div', { class: 'stack-4' },
      h('div', { class: 'settings-head' }, iconTile('document', 44), h('h2', { class: 't-title-2' }, 'Delete account')),
      h('p', { class: 't-subhead muted' }, 'This permanently deletes your account and everything in it: medical ID, photo, contacts, reminders, appointments, documents and reviews. It cannot be undone.'),
      viaGoogleOnly ? h('p', { class: 't-subhead muted' }, 'You sign in with Google, so this works within 15 minutes of signing in with Google.') : null),
    message,
    h('div', { class: 'form-grid' },
      viaGoogleOnly ? null : field({ id: 'password', label: 'Your password', input: password }),
      field({ id: 'confirm', label: 'Type DELETE to confirm', input: confirmText })),
    h('div', { class: 'row' }, go));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!(await confirmDialog({ title: 'Delete your account for good?', text: 'All your data will be removed now. You can create a new account later, but nothing will come back.', confirm: 'Delete everything' }))) return;
    const restore = busy(go, 'Deleting');
    try {
      await api('/patients/me/delete-account', { body: viaGoogleOnly ? { confirm: confirmText.value.trim() } : { password: password.value, confirm: confirmText.value.trim() } });
      location.replace('/signin/');
    } catch (err) {
      restore();
      showErrors(form, err, message);
    }
  });
  return form;
}

const since = user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : null;

/** Who is signed in, how they sign in, and how ready their medical ID is. */
function profileCard(d, photoUrl) {
  const p = d?.patient;
  const pct = p ? p.completeness : null;
  const method = (on, label) => h('span', { class: `tag ${on ? 'tag-success' : ''}` }, icon(on ? 'check' : 'minus', 14), label);
  return h('section', { class: 'card account-hero', 'aria-label': 'Your account' },
    h('span', { class: 'avatar avatar-xl', 'aria-hidden': 'true' }, photoUrl ? h('img', { src: photoUrl, alt: '' }) : initials(user.name)),
    h('div', { class: 'stack-8 account-who' },
      h('h2', { class: 't-title-2' }, user.name),
      h('p', { class: 't-subhead muted' }, [user.email, since ? `Member since ${since}` : null].filter(Boolean).join(' · ')),
      h('div', { class: 'row-8' }, method(user.hasPassword, 'Email and password'), method(user.google, 'Google'))),
    pct !== null ? h('a', { class: 'account-ready card-link', href: '/medical-id/' },
      h('span', { class: 't-footnote muted' }, 'Medical ID'),
      h('span', { class: 't-title-2 num' }, `${pct}%`),
      h('span', { class: 'meter', role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-label': 'Medical ID complete' }, h('span', { style: `width:${pct}%` })),
      h('span', { class: 't-footnote strong' }, pct < 100 ? 'Complete it' : 'Review it', icon('chevron', 14))) : null);
}

/** Every privacy choice in one place, each with what it is set to now and where to change it. */
function privacyCard(d, assistant) {
  const p = d?.patient;
  const notes = { granted: 'On in this browser', denied: 'Blocked in this browser', default: 'Off', unsupported: 'Not available in this browser' };
  const item = (art, label, state, on, href) => h('a', { class: 'setting-row setting-link', href },
    iconTile(art, 40),
    h('div', { class: 'stack-4 setting-grow' }, h('span', { class: 't-headline' }, label), h('span', { class: `status ${on ? 'status-ok' : 'status-idle'}` }, state)),
    icon('chevron', 18));
  return h('section', { class: 'card stack-8' },
    h('div', { class: 'stack-4' }, h('h2', { class: 't-title-3' }, 'Privacy at a glance'), h('p', { class: 't-footnote muted' }, 'What is shared, with whom, and where to change it.')),
    h('div', {},
      p ? item('ambulance', 'Ambulance crew', p.shareWithCrew ? 'Can see your medical ID in an emergency' : 'Cannot see your medical ID', p.shareWithCrew, '/medical-id/#share') : null,
      p ? item('pin', 'Emergency contacts', p.contactCount ? `${p.contactCount} ${p.contactCount === 1 ? 'person' : 'people'} told when you ask for an ambulance` : 'None added', p.contactCount > 0, '/medical-id/#contacts') : null,
      assistant ? item('assistant', 'AI assistant', assistant.consent.agreedAt ? `Agreed on ${new Date(assistant.consent.agreedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}; never sent your name or contact details` : 'Nothing is sent to an AI service', Boolean(assistant.consent.agreedAt), '/settings/') : null,
      item('pin', 'Location', 'Stays in this browser tab; never stored', true, '/settings/'),
      item('pill', 'Reminder notifications', notes[notificationState()] || notes.default, notificationState() === 'granted', '/settings/')));
}

/** What the account holds, each one a way in. */
function dataCard(d, assistant) {
  const c = d?.counts;
  const p = d?.patient;
  const tile = (art, n, label, href) => h('a', { class: 'account-stat card-link', href }, iconTile(art, 40), h('span', { class: 't-title-2 num' }, String(n ?? 0)), h('span', { class: 't-footnote muted' }, label));
  return h('section', { class: 'card stack-12' },
    h('div', { class: 'stack-4' }, h('h2', { class: 't-title-3' }, 'Your data'), h('p', { class: 't-footnote muted' }, 'Private to you. The ambulance crew sees your medical ID only if you turn on sharing, and your documents only once a booking is confirmed.')),
    h('div', { class: 'account-stats' },
      tile('pill', c?.reminders, 'Active reminders', '/reminders/'),
      tile('calendar', c?.appointments, 'Upcoming appointments', '/appointments/'),
      tile('document', c?.documents, 'Documents', '/documents/'),
      tile('idcard', p?.contactCount, 'Emergency contacts', '/medical-id/#contacts'),
      tile('assistant', assistant?.conversations.length, 'Assistant conversations', '/assistant/')));
}

// The cards that need the patient's data wait for it; a failure leaves them out, not the page.
const isPatient = user.role === 'patient';
const [dash, assistant] = isPatient
  ? await Promise.all([api('/patients/me/dashboard').catch(() => null), api('/patients/me/assistant').catch(() => null)])
  : [null, null];
const photoUrl = dash?.patient.hasPhoto ? (await api('/patients/me/photo').catch(() => null))?.url ?? null : null;

main.replaceChildren(h('div', { class: 'page' },
  pageHead({ art: 'shield', title: 'Account and privacy', sub: 'Who you are signed in as, what you share, and how to keep your account safe.' }),
  profileCard(dash, photoUrl),
  // Packed columns like Settings, so wide screens are not two empty margins around one column.
  h('div', { class: 'settings-grid' },
    isPatient ? privacyCard(dash, assistant) : null,
    isPatient ? dataCard(dash, assistant) : null,
    passwordCard(),
    devicesCard(),
    isPatient ? deleteCard() : null)));
