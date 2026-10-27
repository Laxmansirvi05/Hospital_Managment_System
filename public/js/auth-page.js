import { h, icon, brandMark } from './h.js';
import { api } from './api.js';
import { field, showErrors, busy } from './ui.js';

const main = document.getElementById('main');
let authMode = 'signin';
let modeTransitioning = false;
let modeTransitionTimer = 0;

function modeFromPath(fallback = 'signin') {
  return location.pathname.startsWith('/signup') ? 'signup' : fallback;
}

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
  const video = h('video', {
    class: 'auth-video',
    autoplay: true,
    muted: true,
    loop: true,
    playsinline: true,
    preload: 'metadata',
    poster: '/assets/careroute-ambulance.webp',
    'aria-label': 'CareRoute ambulance travelling through Hyderabad',
  }, h('source', { src: '/assets/careroute_ambulance_4K.mp4', type: 'video/mp4' }));
  // Boolean attributes do not reliably update media properties in every browser.
  video.muted = true;
  video.defaultMuted = true;
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion) {
    video.removeAttribute('autoplay');
    video.pause();
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
      h('div', { class: 'auth-video-brand' }, brandMark()),
      h('p', { class: 'auth-video-tagline' }, 'Healthcare, closer to you.')),
    h('div', { class: 'auth-video-copy' },
      h('h1', {},
        h('span', {}, 'Every second matters.'),
        h('span', {}, 'Every route counts.')),
      h('p', {}, 'Connecting people to the healthcare they need, when they need it.')),
    h('div', { class: 'auth-video-fallback', 'aria-hidden': 'true' },
      h('img', { src: '/assets/careroute-ambulance.webp', alt: '' }),
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
    mode === 'signup' ? null : h('p', { class: 'auth-emergency' }, icon('ambulance', 18), h('span', {}, 'In an emergency, call ', h('a', { href: 'tel:112', class: 'strong' }, '112'), '. You do not need to sign in.')),
    mode === 'signup' ? null : h('p', { class: 'auth-footnote' }, 'Your account keeps your care journey organized. Medical details remain private and are only shared when you choose.'));
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

// Whether this deployment has Google sign-in (D-63); asked once per page.
const googleEnabled = api('/config').then((c) => c.googleSignIn === true, () => false);

const GOOGLE_REASONS = {
  cancelled: 'Google sign-in was cancelled.',
  expired: 'That Google sign-in took too long or was opened in another tab. Try again.',
  failed: 'Google could not confirm your account just now. Try again.',
  not_patient: 'This email belongs to a staff account. Sign in with its password.',
  linked_elsewhere: 'This email is already linked to a different Google account.',
  disabled: 'This account is disabled.',
  unavailable: 'Google sign-in is not set up for this site yet.',
  try_again: 'Something went wrong. Try again.',
};

function googleAuthBlock() {
  const status = h('p', { class: 'auth-provider-status', id: 'google-auth-status' }, 'Google sign-in is unavailable until an OAuth provider is configured for this deployment.');
  const button = h('button', {
    class: 'auth-google-button',
    type: 'button',
    disabled: true,
    'aria-describedby': 'google-auth-status',
    title: 'Google sign-in is not configured',
  }, h('span', { class: 'google-mark', 'aria-hidden': 'true' }, 'G'), 'Continue with Google');
  googleEnabled.then((on) => {
    if (!on) return;
    button.disabled = false;
    button.removeAttribute('title');
    button.removeAttribute('aria-describedby');
    status.hidden = true;
  });
  // A full-page visit: the server sends the browser on to Google and back again.
  button.addEventListener('click', () => {
    const next = new URLSearchParams(location.search).get('next');
    location.assign(`/api/v1/auth/google/start${next ? `?next=${encodeURIComponent(safeNext())}` : ''}`);
  });
  return h('div', { class: 'auth-google-block' },
    h('div', { class: 'auth-divider', 'aria-hidden': 'true' }, h('span', {}, 'OR')),
    button,
    status);
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
    submit,
    googleAuthBlock());

  const reason = GOOGLE_REASONS[new URLSearchParams(location.search).get('google')];
  if (reason) setMessage(message, reason);
  forgot.addEventListener('click', () => setMessage(message, 'Password reset is not configured for this deployment. After signing in, you can change your password from Account and privacy.', 'info'));
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setMessage(message, '');
    const invalid = validateEmail(form, 'email') || localError(form, 'password', password.input.value ? '' : 'Enter your password.');
    if (invalid) return;
    const restore = busy(submit, 'Signing in');
    try {
      await api('/auth/login', { body: { email: email.value.trim(), password: password.input.value } });
      location.replace(safeNext());
    } catch (err) {
      restore();
      showErrors(form, err, message);
    }
  });
  return { heading: 'Welcome back', subheading: 'Sign in to continue with CareRoute.', form };
}

function signUpForm() {
  const name = h('input', { class: 'input', autocomplete: 'name', required: true, maxlength: 100 });
  const email = h('input', { class: 'input', type: 'email', autocomplete: 'email', required: true, inputmode: 'email' });
  const password = passwordField({ id: 'password', label: 'Password', autocomplete: 'new-password', hint: 'At least 8 characters.' });
  const terms = termsField();
  const message = formMessage();
  const submit = primaryButton('Create account');
  const form = h('form', { class: 'auth-form', novalidate: true },
    message,
    field({ id: 'name', label: 'Full name', input: name }),
    field({ id: 'email', label: 'Email address', input: email }),
    password.wrap,
    terms.wrap,
    submit,
    googleAuthBlock());

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setMessage(message, '');
    let invalid = false;
    invalid = localError(form, 'name', name.value.trim() ? '' : 'Enter your full name.') || invalid;
    invalid = validateEmail(form, 'email') || invalid;
    invalid = localError(form, 'password', password.input.value.length >= 8 ? '' : 'Use at least 8 characters.') || invalid;
    invalid = localError(form, 'terms', terms.checkbox.checked ? '' : 'Agree to the Terms and Privacy Policy to continue.') || invalid;
    if (invalid) return;
    const restore = busy(submit, 'Creating account');
    try {
      await api('/auth/register', { body: { name: name.value.trim(), email: email.value.trim(), password: password.input.value } });
      location.replace('/medical-id/?welcome=1');
    } catch (err) {
      restore();
      showErrors(form, err, message);
    }
  });
  return { heading: 'Create your account', subheading: 'Your healthcare companion starts here.', form };
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
  main.replaceChildren(
    h('section', { class: 'auth-screen' },
      videoPanel(),
      h('section', { class: 'auth-panel', 'aria-label': authMode === 'signup' ? 'Create account' : 'Sign in' },
        h('div', { class: 'auth-panel-inner' },
          h('div', { class: 'auth-panel-brand' }, brandMark()),
          modeSwitcher,
          modeStage))));
}

export function renderAuthPage(initialMode = 'signin') {
  api('/auth/me').then(() => location.replace(initialMode === 'signup' ? '/dashboard/' : safeNext())).catch(() => render(modeFromPath(initialMode)));
}
