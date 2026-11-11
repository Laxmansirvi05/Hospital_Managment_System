// The page an admin-issued reset link opens (D-88): choose a new password, once.
import { h, icon, brandMark } from '../h.js';
import { api } from '../api.js';
import { field, showErrors, busy } from '../ui.js';
import { videoPanel, passwordField, primaryButton, formMessage, setMessage, localError } from '../auth-page.js';

const main = document.getElementById('main');
const token = new URLSearchParams(location.search).get('token') || '';

function body() {
  if (!token) {
    return h('div', { class: 'auth-mode-view is-current' },
      h('div', { class: 'auth-form-heading' }, h('h2', {}, 'This link is not complete'), h('p', {}, 'Open the whole link an admin gave you, or ask for a new one on the sign-in page.')),
      h('a', { class: 'auth-link', href: '/signin/' }, 'Go to sign in'));
  }
  const password = passwordField({ id: 'password', label: 'New password', autocomplete: 'new-password', hint: 'At least 8 characters.' });
  const again = passwordField({ id: 'again', label: 'Type it again', autocomplete: 'new-password' });
  const message = formMessage();
  const submit = primaryButton('Save new password');
  const form = h('form', { class: 'auth-form', novalidate: true }, message, password.wrap, again.wrap, submit);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setMessage(message, '');
    let invalid = localError(form, 'password', password.input.value.length >= 8 ? '' : 'Use at least 8 characters.');
    invalid = localError(form, 'again', again.input.value === password.input.value ? '' : 'The two passwords are different.') || invalid;
    if (invalid) return;
    const restore = busy(submit, 'Saving');
    try {
      await api('/auth/reset', { body: { token, password: password.input.value } });
      form.replaceWith(h('div', { class: 'stack-12', role: 'status' }, h('p', {}, icon('check', 18), ' Your password is changed. You were signed out everywhere.'), h('a', { class: 'auth-liquid-button', href: '/signin/' }, h('span', { class: 'auth-liquid-button-content' }, 'Go to sign in'))));
    } catch (err) {
      restore();
      showErrors(form, err, message);
    }
  });
  return h('div', { class: 'auth-mode-view is-current' },
    h('div', { class: 'auth-form-heading' }, h('h2', {}, 'Choose a new password'), h('p', {}, 'This link works once.')),
    form);
}

main.replaceChildren(h('section', { class: 'auth-screen' }, videoPanel(),
  h('section', { class: 'auth-panel', 'aria-label': 'Choose a new password' }, h('div', { class: 'auth-panel-inner' }, h('div', { class: 'auth-panel-brand' }, brandMark()), h('div', { class: 'auth-mode-stage' }, body())))));
