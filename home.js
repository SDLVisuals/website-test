/* Seamless photo track, quiet autoplay and native photo-viewer clicks. */
(() => {
  'use strict';
  const start = () => {
    const hero = document.querySelector('.home-hero');
    const track = hero?.querySelector('.home-slide-track');
    if (!track) return;
    const viewport = hero.querySelector('.home-hero-slides');
    const slides = [...track.querySelectorAll('[data-home-slide]')];
    const controls = [...hero.querySelectorAll('[data-home-select]')];
    const rail = hero.querySelector('.home-photo-rail');
    const pause = hero.querySelector('[data-home-pause]');
    const label = hero.querySelector('[data-home-photo-label]');
    const counter = hero.querySelector('[data-home-counter]');
    const status = hero.querySelector('[data-home-status]');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)');
    const labels = slides.map(slide => slide.dataset.label);
    const nextButton = hero.querySelector('[data-showcase-next]');
    const nextImage = hero.querySelector('[data-showcase-preview]');
    const nextTitle = hero.querySelector('[data-showcase-next-title]');
    const collection = hero.querySelector('[data-showcase-collection]');
    const detail = hero.querySelector('[data-showcase-detail]');
    const ambient = hero.querySelector('[data-showcase-ambient]');
    const interval = 4800;
    const count = slides.length;
    if (count < 2 || !controls.length) return;
    const categoryOf = index => slides[index].dataset.category;
    const controlFor = index => controls.find(button => button.dataset.homeCategory === categoryOf(index));

    /* Clones are inert divs: no duplicate IDs or viewer data attributes. */
    const clone = (slide,index) => {
      const element = slide.cloneNode(true);
      element.removeAttribute('id');
      element.removeAttribute('data-home-slide');
      element.classList.remove('is-active');
      element.classList.add('home-slide-clone');
      element.dataset.homeClone = String(index);
      element.setAttribute('aria-hidden','true');
      element.inert = true;
      element.querySelectorAll('*').forEach(child => {
        ['id','data-photo','data-caption','fetchpriority'].forEach(name => child.removeAttribute(name));
        if (child.tagName === 'BUTTON') child.tabIndex = -1;
        if (child.tagName === 'IMG') { child.alt = ''; child.draggable = false; }
      });
      return element;
    };
    track.prepend(clone(slides[count-1],count-1));
    track.append(clone(slides[0],0));
    slides.forEach(slide => { slide.querySelectorAll('img').forEach(image => image.draggable = false); });
    const clones = [...track.querySelectorAll('[data-home-clone]')];

    let active = 0, physical = 1, elapsed = 0, photoElapsed = 0, lastTick = 0;
    let userPaused = false, focused = false, visible = true, keyboardNavigation = false;
    let introPending = !reduce.matches;
    let moving = false, pending = null, drag = null, suppressUntil = 0;
    let frame = 0, fallback = 0, autoTimer = 0, deadline = 0, remaining = interval;
    const unavailable = new Set();
    const nextAvailable = (from,direction = 1) => {
      for (let step = 1; step <= count; step++) {
        const index = (from+direction*step+count*2)%count;
        if (!unavailable.has(index)) return index;
      }
      return null;
    };
    const blockReason = () => {
      if (userPaused) return 'paused';
      if (document.hidden) return 'background';
      if (!visible) return 'offscreen';
      if (moving) return 'transition';
      if (drag) return 'gesture';
      if (document.body.classList.contains('menu-open')) return 'menu';
      if (document.querySelector('dialog[open]')) return 'viewer';
      return '';
    };
    const canMovePhoto = () => !introPending && !blockReason() && !reduce.matches;
    const stopAuto = (preserve = true) => {
      clearTimeout(autoTimer); autoTimer = 0;
      if (preserve && deadline) remaining = Math.max(0,deadline-performance.now());
      deadline = 0;
    };
    const scheduleAuto = () => {
      const reason = blockReason() || (focused ? 'keyboard' : '') || (unavailable.size >= count-1 ? 'unavailable' : '');
      hero.dataset.autoplay = reason || 'playing';
      if (reason) { stopAuto(); return; }
      if (autoTimer) return;
      // A wall-clock timer advances the photos even when animation frames are throttled.
      deadline = performance.now()+remaining;
      autoTimer = setTimeout(() => {
        autoTimer = 0; deadline = 0; remaining = interval;
        if (blockReason() || focused) { sync(); return; }
        const next = nextAvailable(active);
        if (next !== null) go(next,false,1);
        else sync();
      },remaining);
    };
    const paint = () => {
      elapsed = interval-(deadline ? Math.max(0,deadline-performance.now()) : remaining);
      const progress = Math.min(1,Math.max(0,elapsed / interval));
      hero.style.setProperty('--home-slide-progress',String(progress));
      // A separate, continuous photo clock also keeps manual selections alive.
      const phase = (1-Math.cos(photoElapsed / 9000*Math.PI))/2;
      const direction = active % 2 ? -1 : 1;
      const amplitude = Number(slides[active].dataset.motion || .055);
      const zoom = 1.025 + phase * amplitude;
      const transform = `translate3d(${direction*(phase-.5)*1.2}%,${(phase-.5)*-.5}%,0) scale(${zoom})`;
      slides[active].querySelectorAll('img').forEach(image => image.style.transform = transform);
      clones.forEach(element => { if (Number(element.dataset.homeClone) === active) element.querySelectorAll('img').forEach(image => image.style.transform = transform); });
    };
    const stopClock = () => { cancelAnimationFrame(frame); frame = 0; lastTick = 0; };
    const sync = () => {
      stopClock();
      scheduleAuto();
      const playing = canMovePhoto();
      hero.classList.toggle('is-paused',!playing);
      pause.hidden = false;
      pause.textContent = userPaused ? 'Speel' : 'Pauze';
      pause.setAttribute('aria-label',userPaused ? 'Foto’s automatisch laten schuiven' : 'Automatisch schuiven van foto’s pauzeren');
      pause.setAttribute('aria-pressed',String(userPaused));
      if (playing) frame = requestAnimationFrame(tick);
      else paint();
    };
    const tick = now => {
      frame = 0;
      if (!canMovePhoto()) { lastTick = 0; return; }
      if (lastTick) {
        const delta = Math.min(now-lastTick,100);
        photoElapsed += delta;
      }
      lastTick = now;
      paint();
      frame = requestAnimationFrame(tick);
    };
    const position = (immediate = false) => {
      if (immediate) track.classList.add('is-resetting');
      track.style.transform = `translate3d(${-physical*100}%,0,0)`;
      if (immediate) { track.getBoundingClientRect(); track.classList.remove('is-resetting'); }
    };
    const revealControl = () => {
      const button = controlFor(active);
      if (!button) return;
      const left = button.offsetLeft - (rail.clientWidth-button.offsetWidth)/2;
      rail.scrollTo({left:Math.max(0,left),behavior:reduce.matches?'auto':'smooth'});
    };
    const mark = manual => {
      slides.forEach((slide,index) => {
        const current = index === active;
        slide.classList.toggle('is-active',current);
        slide.setAttribute('aria-hidden',String(!current));
        slide.tabIndex = -1;
        slide.inert = !current;
      });
      controls.forEach(button => button.setAttribute('aria-pressed',String(button.dataset.homeCategory === categoryOf(active))));
      label.textContent = labels[active];
      collection.href = slides[active].dataset.route;
      collection.setAttribute('aria-label',`Bekijk de serie ${labels[active].toLowerCase()}`);
      detail.textContent = slides[active].dataset.detail;
      const upcoming = nextAvailable(active);
      if (upcoming !== null) {
        nextImage.src = slides[upcoming].dataset.preview;
        nextImage.alt = `Voorbeeld uit de volgende serie: ${labels[upcoming].toLowerCase()}`;
        nextTitle.textContent = labels[upcoming];
        nextButton.setAttribute('aria-label',`Bekijk de volgende foto: ${labels[upcoming].toLowerCase()}`);
        hero.querySelector('.showcase-next-counter').textContent = String(upcoming+1).padStart(2,'0');
      }
      const ambienceSource = slides[active].dataset.ambient;
      if (ambient.getAttribute('src') !== ambienceSource) {
        const old = ambient.cloneNode();
        old.removeAttribute('data-showcase-ambient');
        old.classList.add('showcase-ambient-out');
        ambient.parentElement.querySelectorAll('.showcase-ambient-out').forEach(image => image.remove());
        ambient.parentElement.insertBefore(old,ambient);
        ambient.src = ambienceSource;
        if (!reduce.matches && ambient.animate) {
          ambient.animate([{opacity:0},{opacity:.55}],{duration:900,easing:'ease-out'});
          old.animate([{opacity:.55},{opacity:0}],{duration:1000,easing:'ease-out'}).onfinish=() => old.remove();
        } else old.remove();
      }
      if (!reduce.matches && nextImage.animate) {
        nextImage.animate([{opacity:.25,transform:'translateX(12px) scale(1.04)'},{opacity:1,transform:'translateX(0) scale(1)'}],{duration:650,easing:'cubic-bezier(.2,.75,.2,1)'});
        label.parentElement.animate([{opacity:.3},{opacity:1}],{duration:500,easing:'ease-out'});
      }
      if (counter) counter.textContent = `${String(active+1).padStart(2,'0')} / ${String(count).padStart(2,'0')}`;
      if (manual) status.textContent = `${active+1} van ${count}. ${labels[active]}.`;
      paint();
      revealControl();
    };
    const finish = () => {
      clearTimeout(fallback);
      if (!moving) return;
      if (physical === 0) { physical = count; position(true); }
      else if (physical === count+1) { physical = 1; position(true); }
      moving = false;
      track.classList.remove('is-moving');
      const next = pending;
      pending = null;
      if (next) go(next.index,next.manual,next.direction);
      else sync();
    };
    const beginMove = (immediate = false) => {
      moving = !reduce.matches && !immediate;
      track.classList.toggle('is-moving',moving);
      position(reduce.matches || immediate);
      sync();
      if (moving) fallback = setTimeout(finish,1200);
      else { moving = true; finish(); }
    };
    const go = (index,manual = false,direction = 0) => {
      if (index === null || index < 0 || index >= count || unavailable.has(index)) { sync(); return; }
      if (manual) { introPending = false; }
      if (moving) { pending = {index,manual,direction}; sync(); return; }
      if (index === active) { stopAuto(false); remaining = interval; position(); sync(); return; }
      stopAuto(false); remaining = interval;
      const steps = direction < 0 ? (active-index+count)%count : (index-active+count)%count;
      const skipBrokenFrames = unavailable.has(active) || (unavailable.size > 0 && steps > 1);
      let nextPhysical = index+1;
      if (active === count-1 && index === 0 && direction >= 0) nextPhysical = count+1;
      if (active === 0 && index === count-1 && direction <= 0) nextPhysical = 0;
      active = index;
      physical = nextPhysical;
      elapsed = 0; photoElapsed = 0;
      mark(manual);
      const jump = manual && direction === 0 && steps > 1;
      beginMove(skipBrokenFrames || jump);
      if (jump && !reduce.matches) track.animate([{opacity:.3},{opacity:1}],{duration:650,easing:'ease-out'});
    };
    hero.addEventListener('home:intro-complete',() => { introPending = false; sync(); });
    setTimeout(() => { if (introPending) { introPending = false; sync(); } },2200);
    track.addEventListener('transitionend',event => { if (event.target === track && event.propertyName === 'transform') finish(); });

    const categorySlide = (category,after = active) => {
      for (let step = 1; step <= count; step++) {
        const index = (after+step)%count;
        if (categoryOf(index) === category && !unavailable.has(index)) return index;
      }
      return null;
    };
    controls.forEach((button,index) => {
      button.addEventListener('click',() => go(categorySlide(button.dataset.homeCategory),true));
      button.addEventListener('keydown',event => {
        const enabled = controls.map((control,i) => control.disabled ? -1 : i).filter(i => i >= 0);
        if (!enabled.length) return;
        const current = enabled.indexOf(index);
        let next = index;
        if (event.key === 'ArrowRight') next = enabled[(current+1)%enabled.length];
        else if (event.key === 'ArrowLeft') next = enabled[(current-1+enabled.length)%enabled.length];
        else if (event.key === 'Home') next = enabled[0];
        else if (event.key === 'End') next = enabled[enabled.length-1];
        else return;
        event.preventDefault(); event.stopPropagation();
        go(categorySlide(controls[next].dataset.homeCategory),true);
        controls[next].focus({preventScroll:true});
      });
    });
    hero.addEventListener('keydown',event => {
      if (!event.target.closest('[data-home-slide]')) return;
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      go(nextAvailable(active,direction),true,direction);
      controlFor(active)?.focus({preventScroll:true});
    });
    nextButton.addEventListener('click',() => go(nextAvailable(active),true,1));
    pause.addEventListener('click',() => { userPaused = !userPaused; if (!userPaused) focused = false; sync(); });
    document.addEventListener('keydown',event => { if (['Tab','ArrowLeft','ArrowRight','Home','End'].includes(event.key)) keyboardNavigation = true; },true);
    hero.addEventListener('focusin',() => { focused = keyboardNavigation; sync(); });
    hero.addEventListener('focusout',() => requestAnimationFrame(() => { focused = hero.contains(document.activeElement) && keyboardNavigation; sync(); }));
    document.addEventListener('pointerdown',() => { keyboardNavigation = false; if (focused) { focused = false; sync(); } },{passive:true,capture:true});

    /* A tap opens the photograph; a horizontal gesture slides the track. */
    viewport.addEventListener('pointerdown',event => {
      if (event.isPrimary === false && drag) { drag = null; track.classList.remove('is-dragging'); hero.classList.remove('is-hero-dragging'); position(); sync(); return; }
      if (moving || event.isPrimary === false || (event.pointerType === 'mouse' && event.button !== 0)) return;
      drag = {id:event.pointerId,x:event.clientX,y:event.clientY,dx:0,started:performance.now(),locked:false};
      sync();
    });
    viewport.addEventListener('pointermove',event => {
      if (!drag || event.pointerId !== drag.id) return;
      const dx = event.clientX-drag.x, dy = event.clientY-drag.y;
      if (!drag.locked) {
        if (Math.max(Math.abs(dx),Math.abs(dy)) < 9) return;
        if (Math.abs(dy) > Math.abs(dx)) { drag = null; sync(); return; }
        drag.locked = true;
        viewport.setPointerCapture(event.pointerId);
        track.classList.add('is-dragging');
        hero.classList.add('is-hero-dragging');
      }
      event.preventDefault();
      const width = viewport.clientWidth;
      drag.dx = Math.sign(dx)*Math.min(Math.abs(dx),width*.95);
      track.style.transform = `translate3d(calc(${-physical*100}% + ${drag.dx}px),0,0)`;
    });
    const endDrag = (event,cancelled = false) => {
      if (!drag || event.pointerId !== drag.id) return;
      const gesture = drag;
      drag = null;
      track.classList.remove('is-dragging');
      hero.classList.remove('is-hero-dragging');
      if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
      if (!gesture.locked) { sync(); return; }
      suppressUntil = performance.now()+550;
      const speed = Math.abs(gesture.dx)/Math.max(1,performance.now()-gesture.started);
      const advance = !cancelled && (Math.abs(gesture.dx)>viewport.clientWidth*.15 || (Math.abs(gesture.dx)>35 && speed>.45));
      if (advance) {
        const direction = gesture.dx < 0 ? 1 : -1;
        go(nextAvailable(active,direction),true,direction);
      } else beginMove();
    };
    viewport.addEventListener('pointerup',event => endDrag(event));
    viewport.addEventListener('pointercancel',event => endDrag(event,true));
    viewport.addEventListener('lostpointercapture',event => endDrag(event,true));
    window.addEventListener('pointerup',event => endDrag(event));
    window.addEventListener('pointercancel',event => endDrag(event,true));
    hero.addEventListener('click',event => {
      if (viewport.contains(event.target) && performance.now()<suppressUntil) { event.preventDefault(); event.stopImmediatePropagation(); }
    },true);
    const recover = () => {
      drag = null; pending = null; moving = false;
      clearTimeout(fallback);
      physical = active+1;
      track.classList.remove('is-dragging','is-moving');
      hero.classList.remove('is-hero-dragging');
      position(true);
      const bounds = hero.getBoundingClientRect();
      visible = bounds.bottom > 0 && bounds.top < innerHeight;
      sync();
    };
    document.addEventListener('visibilitychange',() => { if (document.hidden) recover(); else { introPending = false; recover(); } });
    new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['class']});
    // Dialogs may be added after the carousel, and closing one must reliably resume it.
    new MutationObserver(records => {
      if (records.some(record => record.type === 'attributes' || [...record.addedNodes,...record.removedNodes].some(node => node.nodeType === 1 && (node.matches('dialog') || node.querySelector('dialog'))))) sync();
    }).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});
    window.addEventListener('pagehide',() => { stopAuto(); stopClock(); });
    window.addEventListener('pageshow',() => { introPending = false; recover(); });
    window.addEventListener('focus',() => { if (drag) recover(); else sync(); });
    reduce.addEventListener('change',() => { if (moving) finish(); sync(); });
    let measuredWidth = viewport.clientWidth;
    window.addEventListener('resize',() => {
      const width = viewport.clientWidth;
      if (Math.abs(width-measuredWidth) < 1) return;
      measuredWidth = width;
      clearTimeout(fallback); moving = false; pending = null; drag = null;
      physical = active+1;
      track.classList.remove('is-dragging','is-moving'); hero.classList.remove('is-hero-dragging');
      position(true); revealControl(); sync();
    },{passive:true});
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); },{threshold:.1}).observe(hero);
    }
    /* Recover one failed request per image without changing its viewer source. */
    const retried = new WeakSet();
    const markUnavailable = index => {
      unavailable.add(index);
      const button = controlFor(index);
      const missingCategory = slides.every((slide,i) => slide.dataset.category !== categoryOf(index) || unavailable.has(i));
      if (button && missingCategory) {
        button.disabled = true;
        button.setAttribute('aria-disabled','true');
        button.title = 'Foto’s momenteel niet beschikbaar';
      }
      if (active === index) {
        const next = nextAvailable(index);
        if (next !== null) {
          clearTimeout(fallback); moving = false; pending = null;
          track.classList.remove('is-moving');
          go(next,false,1);
        } else {
          status.textContent = 'De foto’s konden niet worden geladen.';
          sync();
        }
      } else sync();
    };
    [...track.querySelectorAll('img'),...rail.querySelectorAll('img')].forEach(image => {
      const failed = () => {
        if (retried.has(image) && !image.complete) return;
        if (!retried.has(image)) {
          retried.add(image);
          const retry = new URL(image.getAttribute('src'),document.baseURI);
          retry.searchParams.set('home_retry',String(Date.now()));
          image.src = retry.href;
          return;
        }
        const slide = image.closest('[data-home-slide],[data-home-clone]');
        if (slide) markUnavailable(Number(slide.dataset.homeSlide ?? slide.dataset.homeClone));
        else image.style.opacity = '0';
      };
      image.addEventListener('error',failed);
      if (image.complete && image.naturalWidth === 0) setTimeout(() => {
        if (image.complete && image.naturalWidth === 0 && !retried.has(image)) failed();
      },0);
    });
    mark(false); position(true); sync();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
