/* Shared interface state. Layout and photography remain usable without scripts. */
(() => {
  'use strict';
  const ready = () => {
    const theme = window.SDLTheme;
    const themeToggle = document.getElementById('theme-toggle');
    if (theme && themeToggle) {
      const icons = {
        system: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 0 0 17Z" fill="currentColor" stroke="none"/>',
        light: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/>',
        dark: '<path d="M20.8 14A9 9 0 0 1 10 3.2 9 9 0 1 0 20.8 14Z"/>'
      };
      const choices = [
        { mode: 'system', label: 'Systeem', detail: 'Volgt je apparaat' },
        { mode: 'light', label: 'Licht', detail: 'Altijd licht' },
        { mode: 'dark', label: 'Donker', detail: 'Altijd donker' }
      ];
      const icon = mode => `<svg class="theme-mode-icon" viewBox="0 0 24 24" aria-hidden="true">${icons[mode]}</svg>`;
      const panel = document.createElement('div');
      panel.id = 'theme-options';
      panel.className = 'theme-options';
      panel.hidden = true;
      panel.setAttribute('role', 'menu');
      panel.setAttribute('aria-label', 'Weergave');
      panel.innerHTML = '<p class="theme-options-heading" aria-hidden="true">Weergave</p>' + choices.map(choice =>
        `<button type="button" class="theme-option" data-color-mode="${choice.mode}" role="menuitemradio" aria-checked="false" tabindex="-1">${icon(choice.mode)}<span><strong>${choice.label}</strong><small>${choice.detail}</small></span><svg class="theme-option-check" viewBox="0 0 20 20" aria-hidden="true"><path d="m4 10 4 4 8-8"/></svg></button>`
      ).join('');
      document.body.append(panel);
      const options = [...panel.querySelectorAll('[data-color-mode]')];
      themeToggle.removeAttribute('aria-pressed');
      themeToggle.setAttribute('aria-haspopup', 'menu');
      themeToggle.setAttribute('aria-expanded', 'false');
      themeToggle.setAttribute('aria-controls', panel.id);
      const renderTheme = () => {
        const choice = choices.find(item => item.mode === theme.mode);
        themeToggle.innerHTML = icon(choice.mode) + '<span class="sr" id="theme-label">Weergave kiezen</span>';
        themeToggle.setAttribute('aria-label', `Weergave kiezen, huidig: ${choice.label.toLowerCase()}`);
        options.forEach(option => {
          const selected = option.dataset.colorMode === theme.mode;
          option.setAttribute('aria-checked', String(selected));
          option.tabIndex = selected ? 0 : -1;
        });
      };
      const place = () => {
        if (panel.hidden) return;
        const bounds = themeToggle.getBoundingClientRect();
        const width = Math.min(264, innerWidth - 24);
        panel.style.width = `${width}px`;
        panel.style.left = `${Math.max(12, Math.min(innerWidth - width - 12, bounds.right - width))}px`;
        panel.style.top = `${Math.max(12, Math.min(innerHeight - panel.offsetHeight - 12, bounds.bottom + 12))}px`;
      };
      const closeTheme = (restore = true) => {
        if (panel.hidden) return;
        panel.hidden = true;
        themeToggle.setAttribute('aria-expanded', 'false');
        if (restore) themeToggle.focus({ preventScroll: true });
      };
      const openTheme = () => {
        panel.hidden = false;
        themeToggle.setAttribute('aria-expanded', 'true');
        place();
        options.find(option => option.dataset.colorMode === theme.mode)?.focus({ preventScroll: true });
      };
      themeToggle.addEventListener('click', () => { if (panel.hidden) openTheme(); else closeTheme(); });
      themeToggle.addEventListener('keydown', event => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
        event.preventDefault();
        openTheme();
        if (event.key === 'ArrowUp') options[options.length - 1].focus({ preventScroll: true });
      });
      options.forEach(option => option.addEventListener('click', () => {
        theme.setMode(option.dataset.colorMode);
        closeTheme();
      }));
      panel.addEventListener('keydown', event => {
        let next = options.indexOf(document.activeElement);
        if (event.key === 'ArrowDown') next = (next + 1) % options.length;
        else if (event.key === 'ArrowUp') next = (next - 1 + options.length) % options.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = options.length - 1;
        else if (event.key === 'Tab') { closeTheme(); return; }
        else return;
        event.preventDefault();
        options[next].focus({ preventScroll: true });
      });
      document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !panel.hidden) { event.preventDefault(); closeTheme(); }
      });
      document.addEventListener('pointerdown', event => {
        if (!panel.hidden && !panel.contains(event.target) && !themeToggle.contains(event.target)) closeTheme();
      }, { passive: true });
      document.addEventListener('focusin', event => {
        if (!panel.hidden && !panel.contains(event.target) && !themeToggle.contains(event.target)) closeTheme(false);
      });
      document.addEventListener('sdl:themechange', renderTheme);
      addEventListener('resize', place, { passive: true });
      addEventListener('scroll', () => closeTheme(), { passive: true });
      renderTheme();
    }
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const progress = document.createElement('div');
    progress.className = 'reading-progress';
    progress.setAttribute('aria-hidden', 'true');
    document.body.append(progress);
    let frame = 0;
    const update = () => {
      frame = 0;
      const range = document.documentElement.scrollHeight - innerHeight;
      progress.style.setProperty('--reading-progress', range > 0 ? String(Math.max(0, Math.min(1, scrollY / range))) : '0');
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    addEventListener('scroll', schedule, { passive: true });
    addEventListener('resize', schedule, { passive: true });
    update();

    const categories = document.querySelector('.portfolio-categories');
    const current = categories?.querySelector('[aria-current="page"]');
    if (current) categories.scrollLeft = Math.max(0, current.offsetLeft - categories.offsetLeft - (categories.clientWidth - current.offsetWidth) / 2);

    const gallery = document.querySelector('[data-gallery]');
    if (!gallery) return;
    const buttons = [...document.querySelectorAll('[data-gallery-view]')];
    const narrow = matchMedia('(max-width:600px)');
    let manual = false;
    const applyView = (view, animate = false) => {
      const toolbar = document.querySelector('.gallery-toolbar');
      const visibleTop = Math.max(0,toolbar?.getBoundingClientRect().bottom || 0) + 16;
      const preserve = animate && gallery.getBoundingClientRect().top < visibleTop;
      const anchor = preserve ? [...gallery.children].map(element => ({element,bounds:element.getBoundingClientRect()}))
        .filter(item => item.bounds.bottom > visibleTop && item.bounds.top < innerHeight)
        .sort((a,b) => Math.abs(a.bounds.top-visibleTop)-Math.abs(b.bounds.top-visibleTop))[0] : null;
      gallery.dataset.view = view;
      if (anchor) {
        const shift = anchor.element.getBoundingClientRect().top-anchor.bounds.top;
        if (Math.abs(shift)>1) window.scrollBy({top:shift,behavior:'instant'});
      }
      buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.galleryView === view)));
      if (animate && !reduced.matches) {
        [...gallery.children].filter(figure => {
          const bounds = figure.getBoundingClientRect();
          return bounds.bottom > 0 && bounds.top < innerHeight;
        }).slice(0, 12).forEach((figure, index) => {
          figure.animate([{ opacity: .2, transform: 'translateY(20px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 430, delay: index * 35, easing: 'cubic-bezier(.2,.75,.2,1)' });
        });
      }
      schedule();
    };
    applyView(narrow.matches ? 'large' : 'overview');
    buttons.forEach(button => button.addEventListener('click', () => {
      manual = true;
      applyView(button.dataset.galleryView, true);
    }));
    narrow.addEventListener('change', () => { if (!manual) applyView(narrow.matches ? 'large' : 'overview'); });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready, { once: true });
  else ready();
})();
