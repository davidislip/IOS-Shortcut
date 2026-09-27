(() => {
  const key = 'basis.theme.v1';
  let theme = 'dark';
  try {
    const saved = localStorage.getItem(key);
    if (saved === 'light' || saved === 'dark') theme = saved;
  } catch { /* Storage can be unavailable; the default remains dark. */ }

  function applyTheme() {
    document.documentElement.dataset.theme = theme;
    const color = document.querySelector('meta[name="theme-color"]');
    if (color) color.content = theme === 'dark' ? '#1d2027' : '#f0f2f5';

    const next = theme === 'dark' ? 'light' : 'dark';
    const button = document.getElementById('theme-toggle');
    if (button) {
      button.setAttribute('aria-label', `Switch to ${next} mode`);
      button.title = `Switch to ${next} mode`;
    }
    const label = document.getElementById('theme-label');
    if (label) label.textContent = next === 'light' ? 'Light mode' : 'Dark mode';
  }

  // This classic script runs before the stylesheet to select the first paint.
  applyTheme();

  function initializeToggle() {
    applyTheme();
    const button = document.getElementById('theme-toggle');
    if (!button) return;
    button.type = 'button';
    button.addEventListener('click', () => {
      theme = theme === 'dark' ? 'light' : 'dark';
      applyTheme();
      try { localStorage.setItem(key, theme); }
      catch { /* The selected theme still works for this page session. */ }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeToggle, { once: true });
  } else initializeToggle();
})();
