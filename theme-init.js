/* Run before stylesheets: follow the device unless a visitor chooses a mode. */
(() => {
  'use strict';
  const key = 'sdl-color-mode';
  const root = document.documentElement;
  const preference = matchMedia('(prefers-color-scheme: dark)');
  const valid = value => ['system', 'light', 'dark'].includes(value);
  const read = () => {
    try {
      const value = localStorage.getItem(key);
      return valid(value) ? value : 'system';
    } catch (_) { return 'system'; }
  };
  let mode = read();
  let theme;
  let sessionOnly = false;
  const apply = () => {
    theme = mode === 'system' ? (preference.matches ? 'dark' : 'light') : mode;
    root.dataset.colorMode = mode;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    if (document.body) document.body.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0d0d10' : '#f5f5f7');
    document.dispatchEvent(new CustomEvent('sdl:themechange', { detail: { mode, theme } }));
  };
  window.SDLTheme = {
    get mode() { return mode; },
    get theme() { return theme; },
    setMode(value) {
      if (!valid(value)) return;
      mode = value;
      try { localStorage.setItem(key, mode); sessionOnly = false; }
      catch (_) { sessionOnly = true; /* Session choice still works without storage. */ }
      apply();
    }
  };
  const systemChanged = () => { if (mode === 'system') apply(); };
  if (preference.addEventListener) preference.addEventListener('change', systemChanged);
  else preference.addListener(systemChanged);
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) { mode = read(); apply(); }
  });
  window.addEventListener('pageshow', () => { if (!sessionOnly) mode = read(); apply(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply, { once: true });
  apply();
})();
