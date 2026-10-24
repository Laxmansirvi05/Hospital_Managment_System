import { h, icon, brandMark } from '../h.js';
import { api } from '../api.js';
import { field, showErrors, busy } from '../ui.js';

const main = document.getElementById('main');

// Already signed in: go straight to the app.
api('/auth/me').then(() => location.replace(safeNext())).catch(() => render());

function safeNext() {
  const next = new URLSearchParams(location.search).get('next') || '/';
  // Only same-site paths, never a full URL, so the link cannot send someone elsewhere.
  return next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

function render() {
  const email = h('input', { class: 'input', type: 'email', autocomplete: 'email', required: true });
  const password = h('input', { class: 'input', type: 'password', autocomplete: 'current-password', required: true });
  const message = h('p', { class: 'form-error', role: 'alert', hidden: true });
  const submit = h('button', { class: 'btn btn-primary btn-l btn-block', type: 'submit' }, 'Sign in');

  const form = h('form', { class: 'stack-16', novalidate: true },
    message,
    field({ id: 'email', label: 'Email', input: email }),
    field({ id: 'password', label: 'Password', input: password }),
    submit);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const restore = busy(submit, 'Signing in');
    try {
      await api('/auth/login', { body: { email: email.value, password: password.value } });
      location.replace(safeNext());
    } catch (err) {
      restore();
      showErrors(form, err, message);
    }
  });

  main.replaceChildren(h('div', { class: 'auth-card' },
    h('div', { class: 'auth-head' },
      brandMark(),
      h('h1', { class: 't-title-1' }, 'Sign in to CareRoute'),
      h('p', { class: 't-subhead muted' }, 'Find care in Hyderabad, keep your medical ID and never miss a dose.')),
    form,
    h('p', { class: 't-subhead', style: 'text-align:center' }, 'New here? ', h('a', { href: `/signup/${location.search}`, class: 'strong' }, 'Create an account')),
    h('p', { class: 'notice notice-danger' }, icon('phone', 18), h('span', {}, 'In an emergency, call ', h('a', { href: 'tel:112', class: 'strong' }, '112'), '. You do not need to sign in.'))));
  email.focus();
}
