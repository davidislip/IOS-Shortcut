export function createShell() {
  const tabs = [...document.querySelectorAll('[data-show-pane]')];
  const showPane = name => {
    document.body.dataset.pane = name;
    for (const tab of tabs) tab.setAttribute('aria-pressed', String(tab.dataset.showPane === name));
  };
  for (const tab of tabs) tab.addEventListener('click', () => showPane(tab.dataset.showPane));
  const info = document.querySelector('.app-info');
  document.addEventListener('pointerdown', event => {
    if (info.open && !info.contains(event.target)) info.open = false;
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && info.open) {
      info.open = false;
      info.querySelector('summary').focus();
    }
  });
  // Keep the workbench above an on-screen keyboard, as in cppad.
  const resize = () => document.documentElement.style.setProperty('--app-height', `${window.visualViewport?.height ?? window.innerHeight}px`);
  window.visualViewport?.addEventListener('resize', resize);
  window.addEventListener('resize', resize);
  resize();
  return { showResults: () => showPane('results') };
}
