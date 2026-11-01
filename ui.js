/* Shared interface state. Layout and photography remain usable without scripts. */
(() => {
  'use strict';
  const ready = () => {
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
