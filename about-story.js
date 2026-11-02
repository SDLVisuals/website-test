/* Small, event-driven controls for the personal photo story. Native touch scroll stays native. */
(() => {
  'use strict';
  const start = () => {
    const section = document.querySelector('[data-about-story]');
    const track = section?.querySelector('[data-about-photos]');
    if (!track || track.dataset.aboutReady) return;
    track.dataset.aboutReady = 'true';
    const controls = section.querySelector('[data-about-controls]');
    const count = section.querySelector('[data-about-count]');
    const previous = section.querySelector('[data-about-prev]');
    const next = section.querySelector('[data-about-next]');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let cards = [], selected = 0, frame = 0;
    const sync = () => {
      frame = 0;
      const origin = track.getBoundingClientRect().left;
      let distance = Infinity;
      cards.forEach((card, index) => {
        const candidate = Math.abs(card.getBoundingClientRect().left - origin);
        if (candidate < distance) { selected = index; distance = candidate; }
      });
      if (count) count.textContent = `${String(cards.length ? selected + 1 : 0).padStart(2, '0')} / ${String(cards.length).padStart(2, '0')}`;
      if (previous) previous.disabled = selected === 0;
      if (next) next.disabled = selected >= cards.length - 1;
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(sync); };
    const refresh = () => {
      cards = [...track.querySelectorAll('.about-story-frame')]; selected = 0;
      if (controls) controls.hidden = cards.length < 2;
      track.scrollLeft = 0; sync();
    };
    const move = direction => {
      const card = cards[Math.max(0, Math.min(cards.length - 1, selected + direction))];
      if (!card) return;
      const left = card.getBoundingClientRect().left - track.getBoundingClientRect().left + track.scrollLeft;
      track.scrollTo({ left, behavior: reduced.matches ? 'instant' : 'smooth' });
    };
    previous?.addEventListener('click', () => move(-1));
    next?.addEventListener('click', () => move(1));
    track.addEventListener('scroll', schedule, { passive: true });
    addEventListener('resize', schedule, { passive: true });
    addEventListener('pagehide', () => { if (frame) cancelAnimationFrame(frame); frame = 0; });
    addEventListener('pageshow', schedule);
    document.addEventListener('sdl:content-updated', refresh);
    refresh();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
