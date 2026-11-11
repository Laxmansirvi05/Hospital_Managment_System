import { h, icon, brandMark } from './h.js';
import { api } from './api.js';
import { field, showErrors, busy } from './ui.js';

const main = document.getElementById('main');
let authMode = 'signin';
// Who is signing in or creating an account: a patient, or an ambulance driver (owner, 2026-11-11).
let authRole = new URLSearchParams(location.search).get('role') === 'driver' ? 'driver' : 'patient';
let modeTransitioning = false;
let modeTransitionTimer = 0;

function modeFromPath(fallback = 'signin') {
  return location.pathname.startsWith('/signup') ? 'signup' : fallback;
}

/** Where an account goes when no page asked for it: driver and admin have their own workspaces (D-29). */
const HOME = { admin: '/admin/', driver: '/driver/' };
const landing = (role) => (new URLSearchParams(location.search).get('next') ? safeNext() : HOME[role] || safeNext());

function safeNext() {
  // The landing page lives at /, so a signed-in patient lands on the dashboard by default.
  const next = new URLSearchParams(location.search).get('next') || '/dashboard/';
  try {
    const url = new URL(next, location.origin);
    const path = `${url.pathname}${url.search}${url.hash}`;
    // Checked after parsing: "/.//evil.example" becomes "//evil.example", another host to a browser.
    if (url.origin !== location.origin || url.pathname === '/' || /^\/[\/\\]/.test(path)) return '/dashboard/';
    return path;
  } catch {
    return '/dashboard/';
  }
}

function localError(form, id, message) {
  const fieldEl = form.querySelector(`[data-field="${CSS.escape(id)}"]`);
  const error = fieldEl?.querySelector('.field-error');
  const input = fieldEl?.querySelector('input, select, textarea');
  if (!fieldEl || !error || !input) return false;
  error.textContent = message;
  error.hidden = !message;
  if (message) input.setAttribute('aria-invalid', 'true');
  else input.removeAttribute('aria-invalid');
  return Boolean(message);
}

function passwordField({ id, label, autocomplete, hint }) {
  const input = h('input', { class: 'input auth-password-input', type: 'password', autocomplete, required: true });
  const wrap = field({ id, label, input, hint });
  wrap.classList.add('auth-password-field');
  const toggle = h('button', { class: 'auth-password-toggle', type: 'button', 'aria-label': `Show ${label.toLowerCase()}`, 'aria-pressed': 'false', title: 'Show or hide password' }, icon('eye', 18));
  toggle.addEventListener('click', () => {
    const visible = input.type === 'text';
    input.type = visible ? 'password' : 'text';
    toggle.setAttribute('aria-label', `${visible ? 'Show' : 'Hide'} ${label.toLowerCase()}`);
    toggle.setAttribute('aria-pressed', String(!visible));
    // A crossed eye while the password is readable, so the button shows what it will undo.
    toggle.replaceChildren(icon(visible ? 'eye' : 'eye-off', 18));
  });
  // The eye sits inside the input's own box, so a hint or error below the input cannot move it.
  const box = h('span', { class: 'auth-password-box' });
  input.replaceWith(box);
  box.append(input, toggle);
  return { input, wrap };
}

function videoPanel() {
  const poster = '/assets/careroute-ambulance-poster.webp';
  const video = h('video', {
    class: 'auth-video',
    muted: true,
    loop: true,
    playsinline: true,
    preload: 'none',
    poster,
    'aria-label': 'CareRoute ambulance travelling through Hyderabad',
  }, h('source', { type: 'video/mp4' }));
  // Boolean attributes do not reliably update media properties in every browser.
  video.muted = true;
  video.defaultMuted = true;
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const saveData = navigator.connection?.saveData === true;
  const smallScreen = window.matchMedia?.('(max-width: 720px)').matches;
  const source = video.querySelector('source');
  let mediaReady = false;
  const loadVideo = ({ userInitiated = false } = {}) => {
    if (mediaReady || reducedMotion || smallScreen || (saveData && !userInitiated)) return;
    mediaReady = true;
    source.src = '/assets/careroute_ambulance_4K.mp4';
    video.load();
    video.play().catch(() => panel.classList.add('is-video-fallback'));
  };
  if (!reducedMotion && !saveData && !smallScreen) {
    const schedule = window.requestIdleCallback || ((callback) => window.setTimeout(callback, 1800));
    schedule(() => loadVideo(), { timeout: 3000 });
  }

  const panel = h('section', { class: 'auth-video-panel', 'aria-label': 'CareRoute introduction' });
  video.addEventListener('error', () => panel.classList.add('is-video-fallback'));
  video.addEventListener('loadedmetadata', () => { video.loop = true; });

  let soundOn = false;
  const soundToggle = h('button', {
    class: 'auth-sound-toggle',
    type: 'button',
    'aria-pressed': 'false',
    'aria-label': 'Play video sound',
    title: 'Play video sound',
  });
  const updateSoundToggle = () => {
    soundToggle.classList.toggle('is-unmuted', soundOn);
    soundToggle.setAttribute('aria-pressed', String(soundOn));
    soundToggle.setAttribute('aria-label', soundOn ? 'Mute video sound' : 'Play video sound');
    soundToggle.title = soundOn ? 'Mute video sound' : 'Play video sound';
    soundToggle.replaceChildren(icon(soundOn ? 'volume-on' : 'volume-off', 18), h('span', {}, soundOn ? 'Sound on' : 'Sound off'));
  };
  updateSoundToggle();
  soundToggle.addEventListener('click', async () => {
    soundOn = !soundOn;
    video.muted = !soundOn;
    updateSoundToggle();
    if (soundOn) {
      try {
        loadVideo({ userInitiated: true });
        await video.play();
      } catch {
        soundOn = false;
        video.muted = true;
        updateSoundToggle();
      }
    }
  });

  panel.append(
    video,
    h('div', { class: 'auth-video-overlay', 'aria-hidden': 'true' }),
    h('div', { class: 'auth-video-branding' },
      h('div', { class: 'auth-video-brand' }, brandMark({ light: true })),
      h('p', { class: 'auth-video-tagline' }, 'Healthcare, closer to you.')),
    h('div', { class: 'auth-video-copy' },
      h('h1', {},
        h('span', {}, 'Every second matters.'),
        h('span', {}, 'Every route counts.')),
      h('p', {}, 'Connecting people to the healthcare they need, when they need it.')),
    h('div', { class: 'auth-video-fallback', 'aria-hidden': 'true' },
      h('img', { src: poster, alt: '' }),
      h('span', {}, 'CareRoute')),
  );
  return h('div', { class: 'auth-video-layer' }, panel, soundToggle);
}

function modeTab(mode, current, onClick) {
  const button = h('button', {
    class: `auth-mode-tab${mode === current ? ' is-active' : ''}`,
    'data-mode': mode,
    type: 'button',
    role: 'tab',
    'aria-selected': String(mode === current),
  }, mode === 'signin' ? 'Sign in' : 'Create account');
  button.addEventListener('click', () => onClick(mode));
  return button;
}

function modeView(mode, onModeChange) {
  const formContent = mode === 'signup' ? signUpForm() : signInForm();
  return h('div', { class: `auth-mode-view auth-mode-view-${mode} is-current`, 'data-mode': mode },
    h('div', { class: 'auth-form-heading' }, h('h2', {}, formContent.heading), h('p', {}, formContent.subheading)),
    formContent.form,
    h('p', { class: 'auth-switch-copy' },
      mode === 'signup' ? 'Already have an account? ' : 'New to CareRoute? ',
      h('button', {
        class: 'auth-link',
        type: 'button',
        onclick: () => onModeChange(mode === 'signup' ? 'signin' : 'signup'),
      }, mode === 'signup' ? 'Sign in' : 'Create an account')),
    mode === 'signup' || authRole === 'driver' ? null : h('p', { class: 'auth-emergency' }, icon('ambulance', 18), h('span', {}, 'In an emergency, call ', h('a', { href: 'tel:112', class: 'strong' }, '112'), '. You do not need to sign in.')),
    mode === 'signup' || authRole === 'driver' ? null : h('p', { class: 'auth-footnote' }, 'Your account keeps your care journey organized. Medical details remain private and are only shared when you choose.'));
}

function updateModeTabs(switcher, mode) {
  switcher.classList.toggle('is-signup', mode === 'signup');
  switcher.querySelectorAll('.auth-mode-tab').forEach((tab) => {
    const active = tab.dataset.mode === mode;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
  });
}

function animateModeChange(stage, switcher, nextMode, onModeChange) {
  if (modeTransitioning || nextMode === authMode) return;
  const outgoing = stage.querySelector('.auth-mode-view.is-current');
  if (!outgoing) return;
  modeTransitioning = true;
  authMode = nextMode;
  updateModeTabs(switcher, nextMode);
  stage.closest('.auth-panel')?.setAttribute('aria-label', nextMode === 'signup' ? 'Create account' : 'Sign in');

  const direction = nextMode === 'signup' ? 'forward' : 'backward';
  const incoming = modeView(nextMode, onModeChange);
  incoming.classList.remove('is-current');
  incoming.classList.add(`is-entering-${direction}`);
  stage.style.height = `${outgoing.scrollHeight}px`;
  stage.append(incoming);
  // Force the incoming view to be measured before starting the height transition.
  incoming.offsetHeight;
  const nextHeight = incoming.scrollHeight;

  requestAnimationFrame(() => {
    outgoing.classList.remove('is-current');
    outgoing.classList.add(`is-leaving-${direction}`);
    incoming.classList.remove(`is-entering-${direction}`);
    incoming.classList.add('is-current');
    stage.style.height = `${nextHeight}px`;
  });

  window.clearTimeout(modeTransitionTimer);
  const transitionDuration = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 440;
  modeTransitionTimer = window.setTimeout(() => {
    outgoing.remove();
    incoming.classList.remove('is-current');
    incoming.classList.add('is-current');
    stage.style.height = '';
    modeTransitioning = false;
  }, transitionDuration);
}

function formMessage() {
  return h('p', { class: 'form-error auth-form-message', role: 'alert', hidden: true });
}

/** The provided LiquidButton is React/TypeScript-only; this keeps its glass
 * layers usable in the existing dependency-free vanilla app. */
function primaryButton(label) {
  return h('button', { class: 'auth-liquid-button', type: 'submit' }, h('span', { class: 'auth-liquid-button-content' }, label));
}

function setMessage(messageEl, message, kind = 'error') {
  messageEl.className = `form-error auth-form-message${kind === 'info' ? ' auth-form-message-info' : ''}`;
  messageEl.hidden = !message;
  messageEl.replaceChildren(icon(kind === 'info' ? 'info' : 'alert', 18), h('span', {}, message || ''));
}

function termsField() {
  const checkbox = h('input', { type: 'checkbox', required: true });
  const error = h('span', { class: 'field-error', id: 'terms-error', hidden: true });
  return {
    checkbox,
    wrap: h('div', { class: 'field auth-consent-field', 'data-field': 'terms' },
      h('label', { class: 'auth-consent' }, checkbox,
        h('span', {}, 'I agree to the ', h('a', { href: '/terms/' }, 'Terms'), ' and ', h('a', { href: '/privacy/' }, 'Privacy Policy'), '.')),
      error),
  };
}

function validateEmail(form, id) {
  const input = form.querySelector(`#${CSS.escape(id)}`);
  if (!input?.value.trim()) return localError(form, id, 'Enter your email address.');
  if (!input.validity.valid) return localError(form, id, 'Enter a valid email address.');
  return localError(form, id, '');
}

function signInForm() {
  const email = h('input', { class: 'input', type: 'email', autocomplete: 'email', required: true, inputmode: 'email' });
  const password = passwordField({ id: 'password', label: 'Password', autocomplete: 'current-password' });
  const message = formMessage();
  const forgot = h('button', { class: 'auth-link', type: 'button' }, 'Forgot password?');
  const submit = primaryButton('Sign in');
  const form = h('form', { class: 'auth-form', novalidate: true },
    message,
    field({ id: 'email', label: 'Email address', input: email }),
    password.wrap,
    h('div', { class: 'auth-form-row' }, forgot),
    submit);

  forgot.addEventListener('click', () => setMessage(message, 'Password reset is not configured for this deployment. After signing in, you can change your password from Account and privacy.', 'info'));
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setMessage(message, '');
    const invalid = validateEmail(form, 'email') || localError(form, 'password', password.input.value ? '' : 'Enter your password.');
    if (invalid) return;
    const restore = busy(submit, 'Signing in');
    try {
      const signedIn = await api('/auth/login', { body: { email: email.value.trim(), password: password.input.value } });
      location.replace(landing(signedIn?.user?.role ?? signedIn?.role));
    } catch (err) {
      restore();
      showErrors(form, err, message);
    }
  });
  return authRole === 'driver'
    ? { heading: 'Driver sign in', subheading: 'Sign in to receive ambulance requests.', form }
    : { heading: 'Welcome back', subheading: 'Sign in to continue with CareRoute.', form };
}

function signUpForm() {
  const driver = authRole === 'driver';
  const name = h('input', { class: 'input', autocomplete: 'name', required: true, maxlength: 100 });
  const email = h('input', { class: 'input', type: 'email', autocomplete: 'email', required: true, inputmode: 'email' });
  const phone = h('input', { class: 'input', type: 'tel', autocomplete: 'tel', required: true, inputmode: 'tel', placeholder: '98765 43210' });
  const registration = h('input', { class: 'input', autocomplete: 'off', required: true, maxlength: 24, placeholder: 'TS09UB1234', style: 'text-transform:uppercase' });
  const type = h('select', { class: 'select' }, [['BLS', 'Basic life support (BLS)'], ['ALS', 'Advanced life support (ALS)'], ['ICU', 'Intensive care (ICU)']].map(([v, t]) => h('option', { value: v }, t)));
  const password = passwordField({ id: 'password', label: 'Password', autocomplete: 'new-password', hint: 'At least 8 characters.' });
  const terms = termsField();
  const message = formMessage();
  const submit = primaryButton(driver ? 'Create driver account' : 'Create account');
  const form = h('form', { class: 'auth-form', novalidate: true },
    message,
    field({ id: 'name', label: 'Full name', input: name }),
    field({ id: 'email', label: 'Email address', input: email }),
    driver ? field({ id: 'phone', label: 'Mobile number', input: phone, hint: 'Patients see your first name and this number when you accept a request.' }) : null,
    driver ? field({ id: 'registrationNumber', label: 'Vehicle registration number', input: registration }) : null,
    driver ? field({ id: 'type', label: 'Ambulance type', input: type }) : null,
    password.wrap,
    terms.wrap,
    submit);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setMessage(message, '');
    let invalid = false;
    invalid = localError(form, 'name', name.value.trim() ? '' : 'Enter your full name.') || invalid;
    invalid = validateEmail(form, 'email') || invalid;
    if (driver) {
      invalid = localError(form, 'phone', phone.value.trim() ? '' : 'Enter your mobile number.') || invalid;
      invalid = localError(form, 'registrationNumber', registration.value.trim() ? '' : 'Enter the vehicle registration number.') || invalid;
    }
    invalid = localError(form, 'password', password.input.value.length >= 8 ? '' : 'Use at least 8 characters.') || invalid;
    invalid = localError(form, 'terms', terms.checkbox.checked ? '' : 'Agree to the Terms and Privacy Policy to continue.') || invalid;
    if (invalid) return;
    const restore = busy(submit, 'Creating account');
    try {
      const body = { name: name.value.trim(), email: email.value.trim(), password: password.input.value };
      if (driver) Object.assign(body, { role: 'driver', phone: phone.value.trim(), vehicle: { registrationNumber: registration.value.trim(), type: type.value } });
      await api('/auth/register', { body });
      location.replace(driver ? '/driver/' : '/medical-id/?welcome=1');
    } catch (err) {
      restore();
      showErrors(form, err, message);
    }
  });
  return driver
    ? { heading: 'Create a driver account', subheading: 'Register your ambulance and receive requests from patients.', form }
    : { heading: 'Create your account', subheading: 'Your healthcare companion starts here.', form };
}

function render(mode) {
  authMode = mode === 'signup' ? 'signup' : 'signin';
  modeTransitioning = false;
  const setMode = (next) => animateModeChange(modeStage, modeSwitcher, next, setMode);
  const modeSwitcher = h('div', { class: `auth-mode-switch${authMode === 'signup' ? ' is-signup' : ''}`, role: 'tablist', 'aria-label': 'Authentication mode' });
  const modeStage = h('div', { class: 'auth-mode-stage' }, modeView(authMode, setMode));
  modeSwitcher.append(
    h('span', { class: 'auth-mode-indicator', 'aria-hidden': 'true' }),
    modeTab('signin', authMode, setMode),
    modeTab('signup', authMode, setMode),
  );
  // The role switch sits above everything else; changing it rebuilds the current form for that role.
  const roleSwitcher = h('div', { class: `auth-mode-switch auth-role-switch${authRole === 'driver' ? ' is-signup' : ''}`, role: 'group', 'aria-label': 'I am a' },
    h('span', { class: 'auth-mode-indicator', 'aria-hidden': 'true' }));
  for (const [role, label] of [['patient', 'Patient'], ['driver', 'Driver']]) {
    const button = h('button', { class: `auth-mode-tab${role === authRole ? ' is-active' : ''}`, type: 'button', 'aria-pressed': String(role === authRole), 'data-role': role }, label);
    button.addEventListener('click', () => {
      if (role === authRole || modeTransitioning) return;
      authRole = role;
      roleSwitcher.classList.toggle('is-signup', role === 'driver');
      roleSwitcher.querySelectorAll('.auth-mode-tab').forEach((t) => { t.classList.toggle('is-active', t.dataset.role === role); t.setAttribute('aria-pressed', String(t.dataset.role === role)); });
      modeStage.replaceChildren(modeView(authMode, setMode));
    });
    roleSwitcher.append(button);
  }
  main.replaceChildren(
    h('section', { class: 'auth-screen' },
      videoPanel(),
      h('section', { class: 'auth-panel', 'aria-label': authMode === 'signup' ? 'Create account' : 'Sign in' },
        h('div', { class: 'auth-panel-inner' },
          h('div', { class: 'auth-panel-brand' }, brandMark()),
          roleSwitcher,
          modeSwitcher,
          modeStage))));
}

export function renderAuthPage(initialMode = 'signin') {
  api('/auth/me').then((me) => location.replace(HOME[me.role] || (initialMode === 'signup' ? '/dashboard/' : safeNext()))).catch(() => render(modeFromPath(initialMode)));
}
