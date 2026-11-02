/* SDL Visuals: progressive enhancement, no dependencies. */
(() => {
  'use strict';

  const start = () => {
    const root = document.documentElement;
    const body = document.body;
    if (!body) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    const listen = (query, callback) => {
      if (query.addEventListener) query.addEventListener('change', callback);
      else if (query.addListener) query.addListener(callback);
    };

    /* Headings enter as complete, readable blocks instead of separate clipped lines. */
    document.querySelectorAll('.portfolio-intro').forEach(intro => intro.setAttribute('data-reveal',''));

    /* Each item reveals once. Content stays visible if JS or the observer is unavailable. */
    const revealItems = new Set(document.querySelectorAll('[data-reveal]')); 
    document.querySelectorAll('[data-stagger]').forEach(group => {
      [...group.querySelectorAll('[data-reveal]')]
        .filter(item => item.closest('[data-stagger]') === group)
        .forEach((item, index) => {
          const hasPhoto = !!item.querySelector('img,video');
          item.style.setProperty('--reveal-delay', `${hasPhoto ? Math.min(index * 45, 90) : 0}ms`);
        });
    });
    let revealObserver;
    const showAll = () => {
      revealItems.forEach(item => {
        item.classList.add('is-visible');
        item.style.setProperty('--reveal-delay', '0ms');
      });
      revealObserver?.disconnect();
    };
    if (!reducedMotion.matches && 'IntersectionObserver' in window) {
      revealObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        });
      }, { threshold: 0.08, rootMargin: '0px 0px -24px 0px' });
      root.classList.add('js-motion');
      revealItems.forEach(item => revealObserver.observe(item));
    } else {
      showAll();
    }
    document.addEventListener('sdl:content-updated', () => {
      // CMS replaces gallery nodes in place. Release old observer targets and
      // immediately hand refined cards to the shared animation controller.
      revealItems.forEach(item => {
        if (!item.isConnected) { revealObserver?.unobserve(item); revealItems.delete(item); }
      });
      document.querySelectorAll('[data-reveal]').forEach(item => {
        if (revealItems.has(item)) return;
        revealItems.add(item);
        if (item.closest('[data-refine-reveal]') || reducedMotion.matches || !revealObserver) item.classList.add('is-visible');
        else revealObserver.observe(item);
      });
    });
    document.addEventListener('focusin', event => {
      const item = event.target.closest?.('[data-reveal]');
      if (!item) return;
      item.style.setProperty('--reveal-delay','0ms');
      item.classList.add('is-visible');
      revealObserver?.unobserve(item);
    });

    /* State only: the stylesheet owns the glass header's visual treatment. */
    const header = document.getElementById('site-header');
    let headerFrame = 0;
    const syncHeader = () => {
      header?.classList.toggle('is-scrolled', window.scrollY > 24);
      headerFrame = 0;
    };
    syncHeader();
    if (header) window.addEventListener('scroll', () => {
      if (!headerFrame) headerFrame = requestAnimationFrame(syncHeader);
    }, { passive: true });

    /* Fine-pointer effects use independent variables so reveal transforms remain intact. */
    const motionResets = [];
    const canMove = () => !reducedMotion.matches && finePointer.matches;
    const addPointerEffect = (element, update, reset) => {
      let frame = 0;
      let pointerX = 0;
      let pointerY = 0;
      const cancel = () => {
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        reset();
      };
      element.addEventListener('pointermove', event => {
        if (!canMove() || event.pointerType === 'touch' || element.matches(':focus-visible')) {
          cancel();
          return;
        }
        pointerX = event.clientX;
        pointerY = event.clientY;
        if (frame) return;
        frame = requestAnimationFrame(() => {
          frame = 0;
          if (!canMove() || element.matches(':focus-visible')) return cancel();
          const bounds = element.getBoundingClientRect();
          if (!bounds.width || !bounds.height) return;
          const x = Math.max(-1, Math.min(1, (pointerX - bounds.left) / bounds.width * 2 - 1));
          const y = Math.max(-1, Math.min(1, (pointerY - bounds.top) / bounds.height * 2 - 1));
          update(x, y);
        });
      }, { passive: true });
      element.addEventListener('pointerleave', cancel);
      element.addEventListener('pointercancel', cancel);
      element.addEventListener('focusin', cancel);
      motionResets.push(cancel);
    };

    document.querySelectorAll('[data-tilt]').forEach(element => {
      const reset = () => {
        element.style.setProperty('--tilt-x', '0deg');
        element.style.setProperty('--tilt-y', '0deg');
        element.style.setProperty('--tilt-glare-x', '50%');
        element.style.setProperty('--tilt-glare-y', '50%');
      };
      reset();
      addPointerEffect(element, (x, y) => {
        element.style.setProperty('--tilt-x', `${(-y * 2.5).toFixed(2)}deg`);
        element.style.setProperty('--tilt-y', `${(x * 2.5).toFixed(2)}deg`);
        element.style.setProperty('--tilt-glare-x', `${((x + 1) * 50).toFixed(1)}%`);
        element.style.setProperty('--tilt-glare-y', `${((y + 1) * 50).toFixed(1)}%`);
      }, reset);
    });
    document.querySelectorAll('.magnetic').forEach(element => {
      const reset = () => {
        element.style.setProperty('--magnet-x', '0px');
        element.style.setProperty('--magnet-y', '0px');
      };
      reset();
      addPointerEffect(element, (x, y) => {
        element.style.setProperty('--magnet-x', `${(x * 4).toFixed(2)}px`);
        element.style.setProperty('--magnet-y', `${(y * 4).toFixed(2)}px`);
      }, reset);
    });
    listen(reducedMotion, () => {
      if (reducedMotion.matches) showAll();
      motionResets.forEach(reset => reset());
    });
    listen(finePointer, () => motionResets.forEach(reset => reset()));
    window.addEventListener('blur', () => motionResets.forEach(reset => reset()));

    const menuToggle = document.getElementById('menu-toggle');
    const mobileMenu = document.getElementById('mobile-menu');
    if (menuToggle && mobileMenu) {
      const setMenu = open => {
        mobileMenu.hidden = !open;
        menuToggle.setAttribute('aria-expanded', String(open));
        menuToggle.setAttribute('aria-label', open ? 'Menu sluiten' : 'Menu openen');
        body.classList.toggle('menu-open', open);
      };
      setMenu(false);
      menuToggle.addEventListener('click', () => setMenu(mobileMenu.hidden));
      mobileMenu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setMenu(false)));
      document.addEventListener('click', event => {
        if (!mobileMenu.hidden && !mobileMenu.contains(event.target) && !menuToggle.contains(event.target)) setMenu(false);
      });
      document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !mobileMenu.hidden) {
          setMenu(false);
          menuToggle.focus();
        }
      });
      window.addEventListener('resize', () => {
        if (!mobileMenu.hidden && getComputedStyle(menuToggle).display === 'none') setMenu(false);
      }, { passive: true });
    }


  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
