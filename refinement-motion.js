/* A shared motion finish. Native scrolling, readable text and complete photographs. */
(() => {
  'use strict';
  const start = () => {
    const root = document.documentElement;
    if (root.classList.contains('refinement-ready')) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
    const cards = '.home-work-card,.home-film-main,.home-film-small,.home-drone-media,.home-about-photo,.coming-soon-card,.album-card,.album-video-card,.portfolio-gallery>figure,.portfolio-video,.film-featured,.film-project,.film-service,.gear-opening-photo,.gear-detail-photo,.gear-camera,.gear-tool,.gear-drone,.drone-film-card,.drone-equipment,.ig-card,.service-directory nav>a';
    const blocks = '.home-video-featured-heading,.home-heading,.home-drone-copy,.home-about-copy,.home-contact-inner,.coming-soon-heading,.album-section-heading,.portfolio-gallery-heading,.portfolio-step,.portfolio-process>h2,.contact-panel,.film-section-heading,.film-approach>div,.film-approach li,.gear-section-heading,.gear-next,.drone-film-copy,.instagram-heading,.home-film-foot,.collection-browser';
    const liftTargets = '.home-work-image,.home-film-button,.portfolio-image,.film-featured-play,.film-project-play,.gear-photo,.drone-film-button,.ig-card-media,.album-card-image,.album-video-play,.clarity-action,.button,.home-btn,.coming-soon-action,.service-directory nav>a';
    const galleryRails = '.home-work-ordered,[data-album-list]';
    const mediaSurfaces = '.home-work-image,.home-film-button,.portfolio-image,.film-featured-play,.film-project-play,.gear-photo,.drone-film-button,.ig-card-media,.album-card-image,.album-video-play,.home-about-photo,.about-story-photo';
    // Home photo movement and full-photo viewers already have dedicated controllers.
    const mediaTargets = '.collection-hero-media,.film-project--portrait .film-project-play,.portfolio-feature:not([data-photo])';
    const registered = new Set();
    const media = new Map();
    const nearbyMedia = new Set();
    const animations = new Map();
    let revealObserver, mediaObserver, frame = 0, hovered = null, pressed = null;
    let observerGeneration = 0;
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const listen = (query, callback) => {
      if (query.addEventListener) query.addEventListener('change', callback);
      else query.addListener(callback);
    };
    const select = (scope, selector) => [
      ...(scope.matches?.(selector) ? [scope] : []), ...scope.querySelectorAll(selector)
    ];
    const cancelEntry = element => {
      const animation = animations.get(element);
      if (animation) animation.cancel();
      animations.delete(element);
      element.classList.remove('is-refine-entering');
    };
    const reveal = element => {
      if (element.dataset.refineSeen === 'true') return;
      element.dataset.refineSeen = 'true';
      element.classList.add('is-refine-seen');
      revealObserver?.unobserve(element);
      if (!element.isConnected || !element.parentElement) return;
      if (reduced.matches || document.hidden || typeof element.animate !== 'function' || element.contains(document.activeElement)) return;
      const card = element.dataset.refineReveal === 'card';
      const rail = card && element.closest(galleryRails);
      const mobileSwipeCard = innerWidth <= 760 && rail && /auto|scroll/.test(getComputedStyle(rail).overflowX);
      const siblings = [...element.parentElement.children].filter(sibling => sibling.hasAttribute('data-refine-reveal'));
      const columns = innerWidth <= 760 ? 1 : innerWidth <= 1050 ? 2 : 3;
      const delay = card ? Math.max(0, siblings.indexOf(element)) % columns * 70 : 0;
      const offset = innerWidth <= 760 ? 18 : 28;
      // Text fades as one intact block. Only complete cards settle into position.
      // A native scroll-snap target stays at its final geometry while swiping.
      const keyframes = mobileSwipeCard
        ? [{ opacity: .5 }, { opacity: 1 }]
        : card
        ? [{ opacity: .18, translate: `0 ${offset}px`, scale: '.985' }, { opacity: 1, translate: '0 0', scale: '1' }]
        : [{ opacity: .35, translate: '0 6px' }, { opacity: 1, translate: '0 0' }];
      element.classList.add('is-refine-entering');
      const animation = element.animate(keyframes, {
        duration: mobileSwipeCard ? 380 : card ? 860 : 620, delay, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards'
      });
      animations.set(element, animation);
      const finish = () => {
        if (animations.get(element) !== animation) return;
        animations.delete(element); element.classList.remove('is-refine-entering');
      };
      animation.finished.then(finish, finish);
    };
    const paintMedia = () => {
      frame = 0;
      if (reduced.matches || document.hidden) return;
      const height = innerHeight;
      const mobile = innerWidth <= 760;
      // Read all geometry before writing styles. Nothing runs continuously at rest.
      const values = [...nearbyMedia].map(wrapper => {
        const bounds = wrapper.getBoundingClientRect();
        const progress = clamp((height - bounds.top) / Math.max(1, height + bounds.height), 0, 1);
        return { wrapper, shift: (progress - .5) * (mobile ? .9 : 1.6), scale: (mobile ? 1.032 : 1.047) - progress * .015 };
      });
      values.forEach(({ wrapper, shift, scale }) => {
        wrapper.style.setProperty('--refine-photo-shift', `${shift.toFixed(3)}%`);
        wrapper.style.setProperty('--refine-photo-scale', scale.toFixed(4));
      });
    };
    const schedule = () => {
      if (!frame && nearbyMedia.size && !reduced.matches && !document.hidden) frame = requestAnimationFrame(paintMedia);
    };
    const observeElement = element => {
      if (element.dataset.refineSeen === 'true') return;
      if (reduced.matches || !revealObserver) { element.dataset.refineSeen = 'true'; element.classList.add('is-refine-seen'); return; }
      revealObserver.observe(element);
    };
    const register = scope => {
      select(scope, `${cards},${blocks}`).forEach(element => {
        if (registered.has(element) || element.closest('.home-hero,dialog')) return;
        // A single owner per visual block avoids compounded parent/child entrances.
        // Keep the legacy scene visible; the shared controller handles this block.
        element.classList.add('is-visible', 'is-scene-visible');
        if (element.parentElement?.closest('[data-refine-reveal]')) return;
        registered.add(element);
        element.dataset.refineReveal = element.matches(cards) ? 'card' : 'block';
        observeElement(element);
      });
      select(scope, liftTargets).forEach(element => {
        if (!element.closest('.home-hero,dialog')) element.classList.add('refine-lift');
      });
      select(scope, mediaTargets).forEach(wrapper => {
        if (media.has(wrapper) || wrapper.closest('.home-hero,dialog')) return;
        const image = wrapper.querySelector(':scope > img');
        if (!image || getComputedStyle(image).objectFit !== 'cover') return;
        media.set(wrapper, image);
        wrapper.classList.add('refine-media');
        if (!reduced.matches) mediaObserver?.observe(wrapper);
      });
    };
    const setupObservers = () => {
      const generation = ++observerGeneration;
      revealObserver?.disconnect(); mediaObserver?.disconnect();
      nearbyMedia.forEach(wrapper => wrapper.classList.remove('is-refine-media-near'));
      nearbyMedia.clear();
      if (frame) cancelAnimationFrame(frame); frame = 0;
      if (reduced.matches || !('IntersectionObserver' in window)) {
        registered.forEach(element => { element.dataset.refineSeen = 'true'; element.classList.add('is-refine-seen'); cancelEntry(element); });
        media.forEach((_, wrapper) => {
          wrapper.style.removeProperty('--refine-photo-shift');
          wrapper.style.removeProperty('--refine-photo-scale');
        });
        return;
      }
      revealObserver = new IntersectionObserver(entries => {
        if (generation !== observerGeneration) return;
        entries.forEach(entry => { if (entry.isIntersecting && entry.target.isConnected) reveal(entry.target); });
      }, { threshold: .06, rootMargin: '0px 0px -24px 0px' });
      mediaObserver = new IntersectionObserver(entries => {
        if (generation !== observerGeneration) return;
        entries.forEach(entry => {
          if (!entry.target.isConnected) return;
          entry.target.classList.toggle('is-refine-media-near', entry.isIntersecting);
          if (entry.isIntersecting) nearbyMedia.add(entry.target);
          else nearbyMedia.delete(entry.target);
        });
        schedule();
      }, { rootMargin: '100px 0px', threshold: 0 });
      registered.forEach(observeElement);
      media.forEach((_, wrapper) => mediaObserver.observe(wrapper));
    };
    const clearHover = () => { hovered?.classList.remove('is-refine-hover'); hovered = null; };
    const clearPress = () => { pressed?.classList.remove('is-refine-pressed'); pressed = null; };
    setupObservers();
    register(document);
    root.classList.add('refinement-ready');

    document.addEventListener('pointerover', event => {
      if (event.pointerType === 'touch' || !finePointer.matches || reduced.matches) return;
      const target = event.target.closest?.('.refine-lift');
      if (target === hovered) return;
      clearHover();
      if (target) { hovered = target; target.classList.add('is-refine-hover'); }
    }, { passive: true });
    document.addEventListener('pointerout', event => {
      if (hovered && !hovered.contains(event.relatedTarget)) clearHover();
    }, { passive: true });
    document.addEventListener('pointerdown', event => {
      clearPress();
      if (event.pointerType === 'touch') clearHover();
      if (reduced.matches || event.isPrimary === false) return;
      const target = event.target.closest?.('.refine-lift');
      // Touching a photograph usually starts a pan. Keep that surface steady;
      // actual action buttons retain their press feedback.
      const directPointer = event.pointerType === 'touch' || event.pointerType === 'pen';
      if (directPointer && target && (target.matches(mediaSurfaces) ||
          (target.closest(galleryRails) && !target.matches('.clarity-action,.button,.home-btn,button')))) return;
      if (target) { pressed = target; target.classList.add('is-refine-pressed'); }
    }, { passive: true });
    addEventListener('pointerup', clearPress, { passive: true });
    addEventListener('pointercancel', clearPress, { passive: true });
    addEventListener('blur', () => { clearPress(); clearHover(); });
    addEventListener('scroll', () => { clearPress(); schedule(); }, { passive: true });
    addEventListener('resize', schedule, { passive: true });
    addEventListener('pageshow', event => {
      // Back/forward restores the exact view, never a half-complete entrance.
      if (event.persisted) animations.forEach((_, element) => cancelEntry(element));
      schedule();
    });
    addEventListener('pagehide', () => {
      if (frame) cancelAnimationFrame(frame); frame = 0;
      animations.forEach((_, element) => cancelEntry(element));
      clearHover(); clearPress();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (frame) cancelAnimationFrame(frame); frame = 0;
        animations.forEach((_, element) => cancelEntry(element));
        clearHover(); clearPress();
      } else schedule();
    });
    document.addEventListener('focusin', event => {
      let target = event.target.closest?.('[data-refine-reveal]');
      while (target) {
        target.dataset.refineSeen = 'true'; target.classList.add('is-refine-seen'); revealObserver?.unobserve(target); cancelEntry(target);
        target = target.parentElement?.closest('[data-refine-reveal]');
      }
    });
    listen(reduced, () => { clearHover(); clearPress(); setupObservers(); });
    listen(finePointer, clearHover);
    // The content editor may replace a series after the initial page load.
    document.addEventListener('sdl:content-updated', () => {
      registered.forEach(element => { if (!element.isConnected) { revealObserver?.unobserve(element); cancelEntry(element); registered.delete(element); } });
      media.forEach((_, wrapper) => { if (!wrapper.isConnected) { mediaObserver?.unobserve(wrapper); nearbyMedia.delete(wrapper); media.delete(wrapper); } });
      register(document); schedule();
    });
    // The optional feed arrives after page load. Observe only that small subtree.
    const instagram = document.querySelector('#instagram');
    if (instagram && 'MutationObserver' in window) {
      new MutationObserver(records => records.forEach(record => [...record.addedNodes].forEach(node => {
        if (node.nodeType === 1) register(node);
      }))).observe(instagram, { childList: true, subtree: true });
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
