import { h, icon, toast } from '../h.js';
import { api } from '../api.js';
import { shell } from '../shell.js';
import { pageHead, field, showErrors, busy, confirmDialog } from '../ui.js';

const { main, user } = await shell({ nav: 'account', title: 'Account and privacy' });

function passwordCard() {
  const current = h('input', { class: 'input', type: 'password', autocomplete: 'current-password' });
  const next = h('input', { class: 'input', type: 'password', autocomplete: 'new-password', minlength: 8 });
  const message = h('p', { class: 'form-error', role: 'alert', hidden: true });
  const save = h('button', { class: 'btn btn-primary', type: 'submit' }, 'Change password');
  const form = h('form', { class: 'card form-section', novalidate: true },
    h('div', { class: 'stack-4' }, h('h2', { class: 't-title-2' }, 'Password'), h('p', { class: 't-subhead muted' }, 'Changing it signs you out on every other device.')),
    message,
    h('div', { class: 'form-grid' },
      field({ id: 'currentPassword', label: 'Current password', input: current }),
      field({ id: 'newPassword', label: 'New password', input: next, hint: 'At least 8 characters.' })),
    h('div', { class: 'row' }, save));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const restore = busy(save);
    try {
      await api('/auth/password', { body: { currentPassword: current.value, newPassword: next.value } });
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
    h('h2', { class: 't-title-3' }, 'Devices'),
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
      h('h2', { class: 't-title-2' }, 'Delete account'),
      h('p', { class: 't-subhead muted' }, 'This permanently deletes your account and everything in it: medical ID, photo, contacts, reminders, appointments, documents and reviews. It cannot be undone.')),
    message,
    h('div', { class: 'form-grid' },
      field({ id: 'password', label: 'Your password', input: password }),
      field({ id: 'confirm', label: 'Type DELETE to confirm', input: confirmText })),
    h('div', { class: 'row' }, go));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!(await confirmDialog({ title: 'Delete your account for good?', text: 'All your data will be removed now. You can create a new account later, but nothing will come back.', confirm: 'Delete everything' }))) return;
    const restore = busy(go, 'Deleting');
    try {
      await api('/patients/me/delete-account', { body: { password: password.value, confirm: confirmText.value.trim() } });
      location.replace('/signin/');
    } catch (err) {
      restore();
      showErrors(form, err, message);
    }
  });
  return form;
}

main.replaceChildren(h('div', { class: 'page', style: 'max-width:880px' },
  pageHead({ title: 'Account and privacy', sub: `Signed in as ${user.email}.` }),
  passwordCard(),
  devicesCard(),
  h('section', { class: 'card stack-12' },
    h('h2', { class: 't-title-3' }, 'Your data'),
    h('p', { class: 't-subhead muted' }, 'Your medical ID, documents and reminders are private to you. The ambulance crew sees your medical ID only if you turn on sharing, and your documents only once a booking is confirmed.'),
    h('div', { class: 'row-8' }, h('a', { class: 'btn btn-secondary btn-sm', href: '/medical-id/#sharing' }, 'Sharing settings'), h('a', { class: 'btn btn-secondary btn-sm', href: '/documents/' }, 'Your documents'))),
  user.role === 'patient' ? deleteCard() : null));
