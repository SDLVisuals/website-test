/* Native-scroll scenes. Frames stay in place; photographs and copy reveal inside them. */
(() => {
  'use strict';
  const start = () => {
    const root = document.documentElement;
    const body = document.body;
    if (!body.classList.contains('home-page')) return;
    const hero = document.querySelector('.showcase-hero,.home-hero');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const nativeMedia = matchMedia('(max-width:760px), (pointer:coarse)');
    const mediaEnabled = () => !reduced.matches && !nativeMedia.matches;
    const photoSelector = '.home-work-image,.home-film-button,.home-about-photo';
    const frames = [...document.querySelectorAll(photoSelector)];
    const photoStates = new Map();
    const scenes = [];
    const clamp = (value,min,max) => Math.min(max,Math.max(min,value));
    let tick = 0;
    let introTimer = 0;
    let observer;
    let targetsDirty = true, lastPaint = 0;

    /* Native horizontal browsing on phones; the full grid remains on desktop. */
    const collectionRail = document.querySelector('.home-work-ordered');
    if (collectionRail && !document.querySelector('[data-collection-browser]')) {
      const cards = [...collectionRail.querySelectorAll('.home-work-card')];
      const controls = document.querySelector('.home-collection-controls');
      const count = controls?.querySelector('[data-collection-current]');
      const previous = controls?.querySelector('[data-collection-prev]');
      const next = controls?.querySelector('[data-collection-next]');
      const mobile = matchMedia('(max-width:760px)');
      let selected = 0;
      let railFrame = 0;
      const syncRail = () => {
        railFrame = 0;
        const max = collectionRail.scrollWidth - collectionRail.clientWidth;
        const progress = max > 0 ? clamp(collectionRail.scrollLeft / max, 0, 1) : 0;
        const left = collectionRail.getBoundingClientRect().left + parseFloat(getComputedStyle(collectionRail).paddingLeft);
        let distance = Infinity;
        cards.forEach((card, index) => {
          const delta = Math.abs(card.getBoundingClientRect().left - left);
          if (delta < distance) { distance = delta; selected = index; }
        });
        if (progress > .99 && max > 0) selected = cards.length - 1;
        if (count) count.textContent = String(selected + 1).padStart(2,'0');
        controls?.style.setProperty('--collection-progress',progress.toFixed(4));
        if (previous) previous.disabled = selected === 0;
        if (next) next.disabled = selected === cards.length - 1;
      };
      const queueRail = () => { if (!railFrame) railFrame = requestAnimationFrame(syncRail); };
      const navigateRail = direction => {
        if (!mobile.matches) return;
        const target = cards[clamp(selected + direction,0,cards.length - 1)];
        const padding = parseFloat(getComputedStyle(collectionRail).paddingLeft);
        const left = target.getBoundingClientRect().left - collectionRail.getBoundingClientRect().left + collectionRail.scrollLeft - padding;
        collectionRail.scrollTo({left,behavior:reduced.matches ? 'instant' : 'smooth'});
      };
      previous?.addEventListener('click',() => navigateRail(-1));
      next?.addEventListener('click',() => navigateRail(1));
      collectionRail.addEventListener('scroll',queueRail,{passive:true});
      addEventListener('resize',queueRail,{passive:true});
      syncRail();
    }

    const addScene = (element, delay = 0, card = false) => {
      if (element.hasAttribute('data-scroll-scene')) return;
      element.setAttribute('data-scroll-scene',card ? 'card' : 'copy');
      element.style.setProperty('--scene-delay',`${delay}ms`);
      scenes.push(element);
    };

    /* Related text arrives together, so a heading is immediately readable. */
    document.querySelectorAll('.home-heading,.home-group-title,.home-drone-copy,.home-about-copy,.home-contact-inner').forEach(group => {
      group.setAttribute('data-scene-shell','');
      addScene(group);
    });
    document.querySelectorAll('.home-work>.home-kicker,.home-film>.home-kicker,.home-film-caption,.home-film-small>div,.home-drone-caption').forEach(item => addScene(item));
    document.querySelectorAll('.home-work-grid').forEach(group => {
      [...group.querySelectorAll('.home-work-card')].forEach((card,index) => addScene(card,Math.min(index*45,90),true));
    });
    document.querySelectorAll('.home-film-button,.home-about-photo').forEach(frame => {
      frame.setAttribute('data-scene-photo','');
      addScene(frame,0,true);
    });

    const completeIntro = () => {
      body.classList.remove('home-intro-running');
      hero?.dispatchEvent(new Event('home:intro-complete'));
    };
    const measure = () => {
      targetsDirty = false;
      const height = innerHeight, mobile = innerWidth <= 760;
      // Read the whole scene before changing styles; horizontal cards outside the viewport can rest.
      const measurements = frames.map(frame => ({frame,bounds:frame.getBoundingClientRect()}));
      measurements.forEach(({frame,bounds}) => {
        const near = bounds.bottom > -100 && bounds.top < height+100 && bounds.right > -80 && bounds.left < innerWidth+80;
        frame.classList.toggle('is-media-near',near);
        let state = photoStates.get(frame);
        if (!state) { state = {ready:false}; photoStates.set(frame,state); }
        state.near = near;
        if (!near) return;
        const reveal = clamp((height*.95-bounds.top)/(height*.62),0,1);
        const passage = clamp((height-bounds.top)/(height+bounds.height),0,1);
        state.targetScale = (mobile ? 1.038 : 1.065)-passage*(mobile ? .012 : .025);
        state.targetShift = (passage-.5)*(mobile ? 1.1 : 2.6);
        state.targetInset = (1-reveal)*(mobile ? 5 : 8);
        if (!state.ready) {
          state.scale = state.targetScale; state.shift = state.targetShift; state.inset = state.targetInset;
          state.ready = true;
        }
      });
    };
    const paint = now => {
      tick = 0;
      if (!mediaEnabled() || document.hidden) { lastPaint = 0; return; }
      if (targetsDirty) measure();
      const time = Number.isFinite(now) ? now : performance.now();
      const delta = lastPaint ? Math.min(64,time-lastPaint) : 16;
      lastPaint = time;
      const ease = 1-Math.exp(-delta/85);
      let settling = false;
      photoStates.forEach((state,frame) => {
        if (!state.near) return;
        state.scale += (state.targetScale-state.scale)*ease;
        state.shift += (state.targetShift-state.shift)*ease;
        state.inset += (state.targetInset-state.inset)*ease;
        const moving = Math.abs(state.targetScale-state.scale)>.0002 || Math.abs(state.targetShift-state.shift)>.008 || Math.abs(state.targetInset-state.inset)>.015;
        if (!moving) { state.scale=state.targetScale; state.shift=state.targetShift; state.inset=state.targetInset; }
        settling ||= moving;
        frame.style.setProperty('--home-media-scale',state.scale.toFixed(4));
        frame.style.setProperty('--home-media-shift',`${state.shift.toFixed(3)}%`);
        frame.style.setProperty('--home-media-inset',`${state.inset.toFixed(2)}%`);
      });
      if (settling) tick = requestAnimationFrame(paint);
      else lastPaint = 0;
    };
    const schedule = () => {
      targetsDirty = true;
      if (!tick && !document.hidden && mediaEnabled()) tick = requestAnimationFrame(paint);
    };
    const show = element => {
      element.classList.add('is-scene-visible');
      observer?.unobserve(element);
    };
    const applyPreference = () => {
      observer?.disconnect();
      root.classList.toggle('home-motion-enhanced',mediaEnabled());
      root.classList.toggle('home-scenes-enabled',!reduced.matches);
      frames.forEach(frame => {
        frame.toggleAttribute('data-home-media',mediaEnabled());
        if (!mediaEnabled()) {
          frame.style.removeProperty('--home-media-scale');
          frame.style.removeProperty('--home-media-inset');
          frame.style.removeProperty('--home-media-shift');
          frame.classList.remove('is-media-near');
        }
      });
      if (reduced.matches || !('IntersectionObserver' in window)) {
        scenes.forEach(show);
      } else {
        observer = new IntersectionObserver(entries => {
          entries.forEach(entry => { if (entry.isIntersecting) show(entry.target); });
        },{threshold:0.06,rootMargin:'0px 0px -24px 0px'});
        scenes.forEach(scene => {
          if (!scene.classList.contains('is-scene-visible')) observer.observe(scene);
        });
      }
      if (!mediaEnabled()) {
        if (tick) cancelAnimationFrame(tick);
        tick = 0; lastPaint = 0; photoStates.clear();
      } else { targetsDirty = true; paint(); }
      if (reduced.matches) { clearTimeout(introTimer); completeIntro(); }
    };

    applyPreference();
    if (!reduced.matches) {
      body.classList.add('home-intro-running');
      introTimer = setTimeout(completeIntro,1800);
    } else completeIntro();
    addEventListener('scroll',schedule,{passive:true});
    addEventListener('resize',schedule,{passive:true});
    collectionRail?.addEventListener('scroll',schedule,{passive:true});
    addEventListener('pageshow',schedule);
    document.addEventListener('visibilitychange',schedule);
    document.addEventListener('sdl:content-updated',() => {
      for (let index=frames.length-1;index>=0;index--) {
        if (!frames[index].isConnected) { photoStates.delete(frames[index]); frames.splice(index,1); }
      }
      document.querySelectorAll(photoSelector).forEach(frame => {
        if (!frames.includes(frame)) {
          frames.push(frame); frame.toggleAttribute('data-home-media',mediaEnabled());
          frame.querySelector('img')?.addEventListener('load',schedule,{once:true});
        }
      });
      schedule();
    });
    /* Keyboard navigation must never land on an unrevealed link. */
    document.addEventListener('focusin',event => {
      const scene = event.target.closest?.('[data-scroll-scene]');
      if (scene) show(scene);
    });
    frames.forEach(frame => frame.querySelector('img')?.addEventListener('load',schedule,{once:true}));
    if (nativeMedia.addEventListener) nativeMedia.addEventListener('change',applyPreference);
    else nativeMedia.addListener(applyPreference);
    if (reduced.addEventListener) reduced.addEventListener('change',applyPreference);
    else reduced.addListener(applyPreference);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
