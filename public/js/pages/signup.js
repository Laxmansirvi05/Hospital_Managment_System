import { h, icon, brandMark } from '../h.js';
import { api } from '../api.js';
import { field, showErrors, busy } from '../ui.js';

const main = document.getElementById('main');
api('/auth/me').then(() => location.replace('/')).catch(() => render());

function render() {
  const name = h('input', { class: 'input', autocomplete: 'name', required: true, maxlength: 100 });
  const email = h('input', { class: 'input', type: 'email', autocomplete: 'email', required: true });
  const phone = h('input', { class: 'input', type: 'tel', autocomplete: 'tel', inputmode: 'tel', required: true, placeholder: '98765 43210' });
  const password = h('input', { class: 'input', type: 'password', autocomplete: 'new-password', required: true, minlength: 8 });
  const message = h('p', { class: 'form-error', role: 'alert', hidden: true });
  const submit = h('button', { class: 'btn btn-primary btn-l btn-block', type: 'submit' }, 'Create account');

  const form = h('form', { class: 'stack-16', novalidate: true },
    message,
    field({ id: 'name', label: 'Full name', input: name }),
    field({ id: 'email', label: 'Email', input: email }),
    field({ id: 'phone', label: 'Mobile number', input: phone, hint: 'A 10 digit Indian number, or include the country code.' }),
    field({ id: 'password', label: 'Password', input: password, hint: 'At least 8 characters.' }),
    submit);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const restore = busy(submit, 'Creating account');
    try {
      await api('/auth/register', { body: { name: name.value, email: email.value, phone: phone.value, password: password.value } });
      location.replace('/medical-id/?welcome=1');
    } catch (err) {
      restore();
      showErrors(form, err, message);
    }
  });

  main.replaceChildren(h('div', { class: 'auth-card' },
    h('div', { class: 'auth-head' },
      brandMark(),
      h('h1', { class: 't-title-1' }, 'Create your account'),
      h('p', { class: 't-subhead muted' }, 'For patients and families in Hyderabad.')),
    form,
    h('p', { class: 't-footnote muted' }, 'Your medical details stay private. Only you can see them, and the ambulance crew only if you turn on sharing.'),
    h('p', { class: 't-subhead', style: 'text-align:center' }, 'Already have an account? ', h('a', { href: `/signin/${location.search}`, class: 'strong' }, 'Sign in')),
    h('p', { class: 'notice notice-danger' }, icon('phone', 18), h('span', {}, 'In an emergency, call ', h('a', { href: 'tel:112', class: 'strong' }, '112'), '.'))));
  name.focus();
}
