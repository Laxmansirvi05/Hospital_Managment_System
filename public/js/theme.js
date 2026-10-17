const ORDER = ['system', 'light', 'dark'];
const LABELS = { system: 'Theme: system', light: 'Theme: light', dark: 'Theme: dark' };

function current() {
  const value = document.documentElement.dataset.theme;
  return value === 'light' || value === 'dark' ? value : 'system';
}

/** @param {'system'|'light'|'dark'} mode */
function apply(mode) {
  if (mode === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = mode;
  try {
    if (mode === 'system') localStorage.removeItem('cr-theme');
    else localStorage.setItem('cr-theme', mode);
  } catch (_error) {
    // Choice lasts for this page only when storage is blocked.
  }
}

/** @param {HTMLButtonElement | null} button */
export function bindThemeToggle(button) {
  if (!button) return;
  button.textContent = LABELS[current()];
  button.addEventListener('click', () => {
    const next = ORDER[(ORDER.indexOf(current()) + 1) % ORDER.length];
    apply(/** @type {'system'|'light'|'dark'} */ (next));
    button.textContent = LABELS[next];
  });
}
