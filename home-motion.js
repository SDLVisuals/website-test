/* Native-scroll scenes. Frames stay in place; photographs and copy reveal inside them. */
(() => {
  'use strict';
  const start = () => {
    const root = document.documentElement;
    const body = document.body;
    if (!body.classList.contains('home-page')) return;
    const hero = document.querySelector('.showcase-hero,.home-hero');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const frames = [...document.querySelectorAll('.home-work-image,.home-film-button,.home-about-photo')];
    const scenes = [];
    const clamp = (value,min,max) => Math.min(max,Math.max(min,value));
    let tick = 0;
    let introTimer = 0;
    let observer;

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
    const paint = () => {
      tick = 0;
      if (reduced.matches) return;
      const height = innerHeight;
      frames.forEach(frame => {
        const bounds = frame.getBoundingClientRect();
        const near = bounds.bottom > -100 && bounds.top < height+100;
        frame.classList.toggle('is-media-near',near);
        if (!near) return;
        /* The mask opens as a photo enters; its gentle zoom settles as it passes. */
        const reveal = clamp((height*.95-bounds.top)/(height*.62),0,1);
        const passage = clamp((height-bounds.top)/(height+bounds.height),0,1);
        frame.style.setProperty('--home-media-scale',(1.085-passage*.085).toFixed(4));
        frame.style.setProperty('--home-media-inset',`${((1-reveal)*11).toFixed(2)}%`);
      });
      if (hero) {
        const bounds = hero.getBoundingClientRect();
        hero.style.setProperty('--showcase-scroll',clamp(-bounds.top/Math.max(bounds.height,1),0,1).toFixed(4));
      }
    };
    const schedule = () => {
      if (!tick && !document.hidden && !reduced.matches) tick = requestAnimationFrame(paint);
    };
    const show = element => {
      element.classList.add('is-scene-visible');
      observer?.unobserve(element);
    };
    const applyPreference = () => {
      observer?.disconnect();
      root.classList.toggle('home-motion-enhanced',!reduced.matches);
      root.classList.toggle('home-scenes-enabled',!reduced.matches);
      frames.forEach(frame => {
        frame.toggleAttribute('data-home-media',!reduced.matches);
        if (reduced.matches) {
          frame.style.removeProperty('--home-media-scale');
          frame.style.removeProperty('--home-media-inset');
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
      if (reduced.matches) {
        if (tick) cancelAnimationFrame(tick);
        tick = 0;
        hero?.style.removeProperty('--showcase-scroll');
        clearTimeout(introTimer);
        completeIntro();
      } else paint();
    };

    applyPreference();
    if (!reduced.matches) {
      body.classList.add('home-intro-running');
      introTimer = setTimeout(completeIntro,1800);
    } else completeIntro();
    addEventListener('scroll',schedule,{passive:true});
    addEventListener('resize',schedule,{passive:true});
    addEventListener('pageshow',schedule);
    document.addEventListener('visibilitychange',schedule);
    /* Keyboard navigation must never land on an unrevealed link. */
    document.addEventListener('focusin',event => {
      const scene = event.target.closest?.('[data-scroll-scene]');
      if (scene) show(scene);
    });
    frames.forEach(frame => frame.querySelector('img')?.addEventListener('load',schedule,{once:true}));
    if (reduced.addEventListener) reduced.addEventListener('change',applyPreference);
    else reduced.addListener(applyPreference);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
