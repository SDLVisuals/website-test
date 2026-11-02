/* Gallery navigation shares the published CMS result; it makes no network requests. */
(function (scope, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (scope?.document) {
    const start = () => api.enhance(scope.document, scope);
    if (scope.document.readyState === 'loading') scope.document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
  }
})(typeof window === 'object' ? window : null, function () {
  'use strict';
  const TYPES = Object.freeze({
    photo: { label: 'Fotografie', heading: 'Jouw verhaal in beeld.', overview: 'Alle fotogalerijen', href: 'index.html#fotografie', series: 'Fotoseries' },
    video: { label: 'Videografie', heading: 'Verhalen in beweging.', overview: 'Alle videogalerijen', href: 'Video.html#filmselectie', series: 'Videogalerijen' },
    drone: { label: 'Drone', heading: 'Een ander perspectief.', overview: 'Alle dronegalerijen', href: 'drone.html#dronegalerijen', series: 'Dronegalerijen' }
  });
  const BASE_PHOTOS = ['trouw', 'evenementen', 'portret', 'koppelshoot', 'auto', 'product'];
  const safeCount = value => Number.isSafeInteger(value) && value >= 0 && value <= 2500 ? value : 0;
  function groupNavigation(navigation) {
    const groups = { photo: [], video: [], drone: [] };
    const seen = new Set();
    if (!Array.isArray(navigation?.galleries)) return groups;
    navigation.galleries.forEach(value => {
      if (!value || !Object.hasOwn(TYPES, value.kind) || !['published', 'upcoming'].includes(value.stage)
        || typeof value.key !== 'string' || !/^[a-z][a-z0-9-]{1,47}$/.test(value.key)
        || seen.has(value.key) || typeof value.title !== 'string' || !value.title.trim() || value.title.length > 100) return;
      const path = BASE_PHOTOS.includes(value.key) && value.kind === 'photo' ? `${value.key}.html` : `galerij.html?serie=${value.key}`;
      if (value.path !== path) return;
      const photoCount = safeCount(value.photoCount), videoCount = safeCount(value.videoCount);
      const hasMedia = value.kind === 'photo' ? photoCount > 0 : value.kind === 'video' ? videoCount > 0 : photoCount + videoCount > 0;
      if (value.stage === 'published' && !hasMedia) return;
      seen.add(value.key);
      groups[value.kind].push({ key: value.key, title: value.title.trim(), path, kind: value.kind, stage: value.stage, photoCount, videoCount });
    });
    return groups;
  }
  function countLabel(item) {
    const photos = `${item.photoCount} ${item.photoCount === 1 ? 'foto' : 'foto’s'}`;
    const videos = `${item.videoCount} ${item.videoCount === 1 ? 'film' : 'films'}`;
    return item.kind === 'photo' ? photos : item.kind === 'video' ? videos : [item.photoCount && photos, item.videoCount && videos].filter(Boolean).join(' · ');
  }
  function enhance(doc, win) {
    const desktop = doc.querySelector('.desktop-nav');
    const mobile = doc.getElementById('mobile-menu');
    if ((!desktop && !mobile) || doc.documentElement.dataset.portfolioNavigation === 'ready') return null;
    doc.documentElement.dataset.portfolioNavigation = 'ready';
    const reduced = win.matchMedia?.('(prefers-reduced-motion: reduce)');
    const controls = [];
    const animations = new WeakMap();
    let groups = groupNavigation(win.SDLCMSNavigation);
    let available = Array.isArray(win.SDLCMSNavigation?.galleries);
    let settled = false;
    let activeDesktop = null;
    let activeMobile = null;

    const element = (tag, className, text) => {
      const node = doc.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    };
    const focus = node => node?.focus?.({ preventScroll: true });
    const linksIn = control => [...control.panel.querySelectorAll('a')];
    const currentPath = () => {
      const filename = win.location?.pathname?.split('/').pop() || 'index.html';
      const series = new URLSearchParams(win.location?.search || '').get('serie');
      return filename === 'galerij.html' && series ? `galerij.html?serie=${series}` : filename;
    };
    const isOverviewCurrent = type => type === 'photo' ? ['index.html', 'glass.html'].includes(currentPath()) && win.location?.hash === '#fotografie'
      : currentPath() === (type === 'video' ? 'Video.html' : 'drone.html');

    function closeDesktop(restore = false) {
      if (!activeDesktop) return;
      const control = activeDesktop; activeDesktop = null;
      control.panel.hidden = true;
      control.button.setAttribute('aria-expanded', 'false');
      if (restore) focus(control.button);
    }
    function animateMobile(control, open, immediate = false) {
      const previous = animations.get(control.panel);
      if (previous) { previous.onfinish = null; previous.cancel(); animations.delete(control.panel); }
      if (immediate || reduced?.matches || typeof control.panel.animate !== 'function') { control.panel.hidden = !open; return; }
      control.panel.hidden = false;
      const height = control.panel.scrollHeight;
      const animation = control.panel.animate(open ? [{ height: '0px', opacity: 0 }, { height: `${height}px`, opacity: 1 }]
        : [{ height: `${height}px`, opacity: 1 }, { height: '0px', opacity: 0 }], { duration: open ? 230 : 170, easing: 'cubic-bezier(.2,.75,.2,1)' });
      animations.set(control.panel, animation);
      animation.onfinish = () => { control.panel.hidden = !open; animations.delete(control.panel); };
    }
    function closeMobile(restore = false, immediate = false) {
      if (!activeMobile) return;
      const control = activeMobile; activeMobile = null;
      control.button.setAttribute('aria-expanded', 'false');
      animateMobile(control, false, immediate);
      if (restore) focus(control.button);
    }
    function closeOuterMobile() {
      closeMobile(false, true);
      const toggle = doc.getElementById('menu-toggle');
      if (toggle?.getAttribute('aria-expanded') === 'true') toggle.click();
      // The original menu controller owns its usual toggle state. This also
      // works when the progressive-enhancement script was not available.
      if (mobile && !mobile.hidden) {
        mobile.hidden = true;
        toggle?.setAttribute('aria-expanded', 'false');
        toggle?.setAttribute('aria-label', 'Menu openen');
        doc.body.classList.remove('menu-open');
      }
    }
    function place(control) {
      if (!control || control.panel.hidden) return;
      const bounds = control.button.getBoundingClientRect();
      if (!bounds.width || win.getComputedStyle?.(desktop)?.display === 'none') { closeDesktop(); return; }
      const viewportWidth = win.innerWidth || doc.documentElement.clientWidth;
      const viewportHeight = win.innerHeight || doc.documentElement.clientHeight;
      const width = Math.min(560, viewportWidth - 32);
      const header = doc.querySelector('.nav-glass')?.getBoundingClientRect();
      const top = Math.max(12, Math.min((header?.bottom ?? bounds.bottom) + 12, viewportHeight - 180));
      const left = Math.max(16, Math.min(viewportWidth - width - 16, bounds.right - width * .6));
      control.panel.style.width = `${width}px`;
      control.panel.style.left = `${left}px`;
      control.panel.style.top = `${top}px`;
      control.panel.style.maxHeight = `${Math.max(150, viewportHeight - top - 16)}px`;
    }
    function open(control, target) {
      if (control.surface === 'desktop') {
        closeMobile(false, true); closeDesktop(false);
        activeDesktop = control; control.panel.hidden = false;
        control.button.setAttribute('aria-expanded', 'true'); place(control);
      } else {
        closeDesktop(false); closeMobile(false, true);
        activeMobile = control; control.button.setAttribute('aria-expanded', 'true'); animateMobile(control, true);
      }
      if (target === 'first') focus(linksIn(control)[0]);
      else if (target === 'last') focus(linksIn(control).at(-1));
    }
    function close(control, restore) {
      if (control.surface === 'desktop') closeDesktop(restore);
      else closeMobile(restore);
    }
    function followingHeaderControl(control) {
      const header = doc.getElementById('site-header');
      const elements = [...(header?.querySelectorAll('.desktop-nav a,.desktop-nav button,.nav-actions a,.nav-actions button') || [])];
      return elements[elements.indexOf(control.button) + 1];
    }
    function makeSeriesLink(item) {
      const link = element('a', 'portfolio-nav-link'); link.href = item.path;
      const copy = element('span', 'portfolio-nav-link-copy');
      copy.append(element('strong', '', item.title));
      if (item.stage === 'upcoming') copy.append(element('small', '', 'Een nieuw verhaal in voorbereiding'));
      else copy.append(element('small', '', countLabel(item)));
      link.append(copy);
      if (item.stage === 'upcoming') link.append(element('span', 'portfolio-nav-soon', 'Binnenkort'));
      else if (currentPath() === item.path) { link.setAttribute('aria-current', 'page'); link.append(element('span', 'portfolio-nav-current', 'Nu bekeken')); }
      return link;
    }
    function render(control) {
      const type = TYPES[control.type];
      const selected = groups[control.type];
      const published = selected.filter(item => item.stage === 'published');
      const upcoming = selected.filter(item => item.stage === 'upcoming');
      const focusPath = control.panel.contains(doc.activeElement) ? doc.activeElement?.getAttribute?.('href') : null;
      const content = doc.createDocumentFragment();
      const overview = element('a', 'portfolio-nav-overview'); overview.href = type.href;
      const overviewCopy = element('span', '');
      overviewCopy.append(element('small', 'portfolio-nav-kicker', type.series));
      overviewCopy.append(element('strong', '', type.overview));
      overview.append(overviewCopy, element('span', 'portfolio-nav-overview-mark'));
      if (isOverviewCurrent(control.type)) overview.setAttribute('aria-current', 'page');
      content.append(overview);
      if (published.length) {
        const list = element('div', 'portfolio-nav-grid');
        published.forEach(item => list.append(makeSeriesLink(item))); content.append(list);
      }
      if (upcoming.length) {
        const section = element('div', 'portfolio-nav-upcoming');
        section.append(element('p', 'portfolio-nav-section-label', 'Binnenkort'));
        upcoming.forEach(item => section.append(makeSeriesLink(item))); content.append(section);
      }
      if (!selected.length) content.append(element('p', 'portfolio-nav-status', !settled ? 'Galerijen worden geladen…'
        : available ? 'Nieuwe galerijen verschijnen binnenkort.' : 'Ontdek het werk in het overzicht.'));
      control.panel.replaceChildren(content);
      control.panel.setAttribute('aria-busy', String(!settled));
      const current = selected.some(item => item.path === currentPath()) || isOverviewCurrent(control.type);
      control.button.classList.toggle('is-current', current);
      if (focusPath) {
        const replacement = linksIn(control).find(link => link.getAttribute('href') === focusPath);
        focus(replacement || control.button);
      }
      if (activeDesktop === control) place(control);
    }
    function update(navigation, done = true) {
      groups = groupNavigation(navigation);
      available = Array.isArray(navigation?.galleries);
      settled = done;
      controls.forEach(render);
    }
    function enhanceNav(nav, surface) {
      if (!nav) return;
      [...nav.querySelectorAll(':scope > a')].forEach(anchor => {
        const label = anchor.textContent.replace(/\s+/g, ' ').trim();
        const entry = Object.entries(TYPES).find(([, type]) => label === type.label || label.startsWith(type.label + ' '));
        if (!entry) return;
        const [type, config] = entry;
        const button = element('button', `portfolio-nav-trigger portfolio-nav-trigger-${surface}`);
        button.type = 'button'; button.append(element('span', '', config.label), element('span', 'portfolio-nav-disclosure'));
        button.setAttribute('aria-expanded', 'false');
        const panel = element('div', surface === 'desktop' ? 'portfolio-nav-panel' : 'portfolio-nav-mobile-content');
        panel.id = `portfolio-navigation-${surface}-${type}`; panel.hidden = true;
        panel.setAttribute('aria-label', config.series);
        button.setAttribute('aria-controls', panel.id);
        const control = { type, surface, button, panel };
        controls.push(control);
        if (surface === 'desktop') { anchor.replaceWith(button); doc.body.append(panel); }
        else {
          const wrapper = element('div', 'portfolio-nav-mobile-group'); wrapper.append(button, panel); anchor.replaceWith(wrapper);
        }
        button.addEventListener('click', () => {
          if (button.getAttribute('aria-expanded') === 'true') close(control, false);
          else open(control);
        });
        button.addEventListener('keydown', event => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); open(control, event.key === 'ArrowDown' ? 'first' : 'last'); }
          else if (surface === 'desktop' && event.key === 'Tab' && !event.shiftKey && activeDesktop === control) { event.preventDefault(); focus(linksIn(control)[0]); }
        });
        panel.addEventListener('keydown', event => {
          const links = linksIn(control), index = links.indexOf(doc.activeElement);
          let target;
          if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(control, true); return; }
          if (event.key === 'ArrowDown') target = links[(index + 1 + links.length) % links.length];
          else if (event.key === 'ArrowUp') target = links[(index - 1 + links.length) % links.length];
          else if (event.key === 'Home') target = links[0];
          else if (event.key === 'End') target = links.at(-1);
          else if (surface === 'desktop' && event.key === 'Tab' && event.shiftKey && index === 0) target = button;
          else if (surface === 'desktop' && event.key === 'Tab' && !event.shiftKey && index === links.length - 1) { closeDesktop(false); target = followingHeaderControl(control); }
          if (target) { event.preventDefault(); focus(target); }
        });
        panel.addEventListener('click', event => {
          if (!event.target.closest?.('a')) return;
          if (surface === 'desktop') closeDesktop(false); else closeOuterMobile();
        });
        render(control);
      });
    }
    enhanceNav(desktop, 'desktop'); enhanceNav(mobile, 'mobile');
    doc.addEventListener('pointerdown', event => {
      if (activeDesktop && !activeDesktop.panel.contains(event.target) && !activeDesktop.button.contains(event.target)) closeDesktop(false);
    }, { passive: true });
    doc.addEventListener('focusin', event => {
      if (activeDesktop && !activeDesktop.panel.contains(event.target) && !activeDesktop.button.contains(event.target)) closeDesktop(false);
    });
    doc.addEventListener('keydown', event => { if (event.key === 'Escape' && activeDesktop) { event.preventDefault(); closeDesktop(true); } });
    doc.getElementById('theme-toggle')?.addEventListener('click', () => { closeDesktop(false); closeMobile(false, true); });
    doc.getElementById('menu-toggle')?.addEventListener('click', () => { closeDesktop(false); if (mobile?.hidden) closeMobile(false, true); });
    if (win.MutationObserver) {
      const observer = new win.MutationObserver(() => { if (mobile?.hidden) closeMobile(false, true); });
      if (mobile) observer.observe(mobile, { attributes: true, attributeFilter: ['hidden'] });
    }
    win.addEventListener?.('resize', () => {
      if (activeDesktop) place(activeDesktop);
      if (mobile && win.getComputedStyle?.(doc.getElementById('menu-toggle'))?.display === 'none') closeMobile(false, true);
    }, { passive: true });
    win.addEventListener?.('scroll', () => closeDesktop(false), { passive: true });
    doc.addEventListener('sdl:content-updated', event => update(event.detail?.navigation || win.SDLCMSNavigation));
    doc.addEventListener('sdl:themechange', () => { if (activeDesktop) place(activeDesktop); });
    const ready = win.SDLCMSReady;
    if (ready && typeof ready.then === 'function') ready.then(() => update(win.SDLCMSNavigation), () => update(win.SDLCMSNavigation));
    else update(win.SDLCMSNavigation);
    return { update, close: () => { closeDesktop(false); closeMobile(false, true); }, controls };
  }
  return { TYPES, groupNavigation, countLabel, enhance };
});
