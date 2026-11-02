/* One clear controller for the native mobile photography rail. */
(() => {
  'use strict';
  const start = () => {
    const controls = document.querySelector('[data-collection-browser]');
    const rail = document.querySelector('.home-work-ordered');
    if (!controls || !rail || controls.dataset.collectionReady === 'true') return;
    let cards = [...rail.querySelectorAll('.home-work-card')];
    const choices = controls.querySelector('[data-collection-choices]');
    const name = controls.querySelector('[data-collection-name]');
    const position = controls.querySelector('[data-collection-position]');
    const previous = controls.querySelector('[data-collection-prev]');
    const next = controls.querySelector('[data-collection-next]');
    if (!cards.length || !choices || !name || !position || !previous || !next) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let names = cards.map((card, index) => card.querySelector('h3')?.textContent.trim() || `Serie ${index + 1}`);
    const section = rail.closest('.home-work');
    let selected = -1, requested = null, frame = 0, settleTimer = 0;
    const clamp = index => Math.max(0, Math.min(cards.length - 1, index));
    const createChoices = () => cards.map((card, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'collection-choice';
      button.dataset.collectionSelect = String(index);
      button.textContent = String(index + 1).padStart(2, '0');
      button.setAttribute('aria-label', `Toon ${names[index]}, serie ${index + 1} van ${cards.length}`);
      button.setAttribute('aria-controls', rail.id);
      button.setAttribute('aria-pressed', 'false');
      button.title = names[index];
      return button;
    });
    let buttons = createChoices();
    choices.replaceChildren(...buttons);
    const edges = () => {
      const current = requested ?? Math.max(0, selected);
      previous.disabled = current === 0;
      next.disabled = current === cards.length - 1;
    };
    const placeControls = scrolling => {
      const image = cards[0]?.querySelector('.home-work-image');
      const integrated = scrolling && innerWidth <= 760 && !!section && !!image;
      controls.classList.toggle('is-integrated', integrated);
      section?.classList.toggle('has-integrated-controls', integrated);
      if (!integrated) {
        controls.style.top = '';
        section?.style.removeProperty('--collection-controls-height');
        return;
      }
      // Reserve a real row between every image and its title. The controls are
      // outside the horizontal rail so they stay still when the photos swipe.
      const height = `${Math.ceil(controls.offsetHeight)}px`;
      if (section.style.getPropertyValue('--collection-controls-height') !== height) {
        section.style.setProperty('--collection-controls-height', height);
      }
      // Offset geometry ignores reveal transforms and page scrolling. The
      // section is the positioned ancestor, including after CMS gallery edits.
      let imageTop = 0, element = image;
      while (element && element !== section) {
        imageTop += element.offsetTop;
        element = element.offsetParent;
      }
      controls.style.top = `${Math.round(imageTop + image.offsetHeight + 12)}px`;
    };
    const sync = () => {
      frame = 0;
      const maximum = Math.max(0, rail.scrollWidth - rail.clientWidth);
      const scrolling = maximum > 3 && /auto|scroll/.test(getComputedStyle(rail).overflowX);
      controls.hidden = !scrolling;
      if (!scrolling) { requested = null; placeControls(false); return; }
      const padding = parseFloat(getComputedStyle(rail).paddingLeft) || 0;
      const start = rail.getBoundingClientRect().left + padding;
      let closest = 0, distance = Infinity;
      cards.forEach((card, index) => {
        const delta = Math.abs(card.getBoundingClientRect().left - start);
        if (delta < distance) { closest = index; distance = delta; }
      });
      if (rail.scrollLeft >= maximum - 3) closest = cards.length - 1;
      if (closest !== selected) {
        selected = closest;
        name.textContent = names[selected];
        position.textContent = `Serie ${selected + 1} van ${cards.length}`;
        buttons.forEach((button, index) => button.setAttribute('aria-pressed', String(index === selected)));
        const button = buttons[selected];
        choices.scrollTo?.({left:Math.max(0,button.offsetLeft - (choices.clientWidth-button.offsetWidth)/2),behavior:reduced.matches?'auto':'smooth'});
      }
      edges();
      placeControls(true);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(sync); };
    const release = () => { clearTimeout(settleTimer); requested = null; schedule(); };
    const settling = () => { clearTimeout(settleTimer); settleTimer = setTimeout(release, 180); };
    const navigate = index => {
      if (controls.hidden) return;
      requested = clamp(index);
      const padding = parseFloat(getComputedStyle(rail).paddingLeft) || 0;
      const left = cards[requested].getBoundingClientRect().left - rail.getBoundingClientRect().left + rail.scrollLeft - padding;
      rail.scrollTo({ left, behavior: reduced.matches ? 'instant' : 'smooth' });
      edges();
      settling();
    };
    previous.addEventListener('click', () => navigate((requested ?? selected) - 1));
    next.addEventListener('click', () => navigate((requested ?? selected) + 1));
    choices.addEventListener('click', event => {
      const button = event.target.closest('[data-collection-select]');
      if (button && choices.contains(button)) navigate(Number(button.dataset.collectionSelect));
    });
    choices.addEventListener('keydown', event => {
      const current = buttons.indexOf(event.target);
      if (current < 0) return;
      let target;
      if (event.key === 'ArrowLeft') target = clamp(current - 1);
      else if (event.key === 'ArrowRight') target = clamp(current + 1);
      else if (event.key === 'Home') target = 0;
      else if (event.key === 'End') target = cards.length - 1;
      else return;
      event.preventDefault();
      buttons[target].focus({ preventScroll: true });
      navigate(target);
    });
    rail.addEventListener('scroll', () => { schedule(); settling(); }, { passive: true });
    rail.addEventListener('scrollend', release, { passive: true });
    rail.addEventListener('pointerdown', release, { passive: true });
    rail.addEventListener('wheel', release, { passive: true });
    addEventListener('resize', release, { passive: true });
    window.visualViewport?.addEventListener('resize',schedule,{passive:true});
    document.addEventListener('sdl:content-updated',() => {
      cards = [...rail.querySelectorAll('.home-work-card')];
      if (!cards.length) { controls.hidden = true; placeControls(false); return; }
      names = cards.map((card,index) => card.querySelector('h3')?.textContent.trim() || `Serie ${index + 1}`);
      buttons = createChoices(); choices.replaceChildren(...buttons);
      selected = -1; requested = null; schedule();
    });
    addEventListener('pageshow', schedule);
    if ('ResizeObserver' in window) {
      const observer = new ResizeObserver(schedule);
      observer.observe(rail); observer.observe(controls);
      if (section) observer.observe(section);
    }
    document.fonts?.ready.then(schedule);
    controls.dataset.collectionReady = 'true';
    sync();
  };
  const startAfterCMS = () => {
    const ready = window.SDLCMSReady;
    if (ready && typeof ready.then === 'function') ready.then(start, start);
    else start();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startAfterCMS, { once: true });
  else startAfterCMS();
})();
