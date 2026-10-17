import { api } from '../api.js';
import { bindThemeToggle } from '../theme.js';

const STATES = {
  checking: { text: 'Checking', modifier: '' },
  ok: { text: 'Running', modifier: 'cr-status--success' },
  down: { text: 'Not reachable', modifier: 'cr-status--danger' },
};

/** @param {keyof typeof STATES} state */
function showStatus(state) {
  const label = document.getElementById('service-status');
  const checked = document.getElementById('service-checked');
  if (!label || !checked) return;
  label.className = `cr-status ${STATES[state].modifier}`.trim();
  label.textContent = STATES[state].text;
  if (state !== 'checking') {
    checked.textContent = `Checked at ${new Date().toLocaleTimeString()}`;
  }
}

async function checkHealth() {
  showStatus('checking');
  try {
    const result = await api('/health');
    showStatus(result?.status === 'ok' ? 'ok' : 'down');
  } catch (_error) {
    showStatus('down');
  }
}

bindThemeToggle(/** @type {HTMLButtonElement | null} */ (document.getElementById('theme-toggle')));
document.getElementById('recheck')?.addEventListener('click', checkHealth);
checkHealth();
