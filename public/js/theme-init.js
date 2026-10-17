// Loaded as a blocking script in <head> so a saved theme applies before first paint.
// Kept as an external file because the Content Security Policy forbids inline scripts.
(function applySavedTheme() {
  try {
    var saved = localStorage.getItem('cr-theme');
    if (saved === 'light' || saved === 'dark') document.documentElement.dataset.theme = saved;
  } catch (_error) {
    // Storage can be blocked (private mode). The system setting applies.
  }
})();
