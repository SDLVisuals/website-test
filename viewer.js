/* Shared photo and film viewer. No dependencies, no synthetic playback controls. */
(() => {
  'use strict';
  const filmURL = (provider, source, autoplay = false) => {
    if (provider === 'gumlet' && /^[a-f0-9]{24}$/.test(source || '')) return `https://play.gumlet.io/embed/${source}${autoplay ? '?autoplay=true&muted=false' : ''}`;
    if (provider === 'vimeo' && /^\d{6,15}$/.test(source || '')) return `https://player.vimeo.com/video/${source}${autoplay ? '?autoplay=1&dnt=1' : '?dnt=1'}`;
    if (provider === 'youtube' && /^[A-Za-z0-9_-]{11}$/.test(source || '')) return `https://www.youtube-nocookie.com/embed/${source}${autoplay ? '?autoplay=1&rel=0' : '?rel=0'}`;
    return '';
  };
  const thumbnailSource = (image, fallback) => {
    const candidates = (image?.getAttribute('srcset') || '').split(',').map(candidate => {
      const match = candidate.trim().match(/^(.*?)\s+(\d+(?:\.\d+)?)w$/);
      return match ? { src: match[1], width: Number(match[2]) } : null;
    }).filter(Boolean).sort((a, b) => a.width - b.width);
    return candidates[0]?.src || image?.currentSrc || image?.getAttribute('src') || fallback;
  };
  const photoVariant = button => {
    const image = button.querySelector('img');
    const src = button.dataset.photo;
    const title = button.dataset.caption || button.dataset.title || image?.alt || 'Fotografie · SDL Visuals';
    return { button, src, thumbnail: thumbnailSource(image, src), title, alt: image?.alt || title, format: button.dataset.format || 'portrait' };
  };
  const start = () => {
    const triggers = [...document.querySelectorAll('button[data-photo],button[data-video],button[data-video-src]')];
    if (!triggers.length || document.getElementById('work-viewer')) return;
    const library = [];
    const lookup = new Map();
    const triggerIndexes = new Map();
    triggers.forEach(button => {
      const photo = button.dataset.photo;
      const video = button.dataset.video;
      const native = button.dataset.videoSrc;
      const provider = button.dataset.videoProvider || 'gumlet';
      if (!photo && !native && !filmURL(provider, video)) return;
      const type = photo ? 'photo' : native ? 'native' : 'film';
      const src = photo || native || video;
      const homeSlide = photo && button.closest('[data-home-slide]');
      const key = homeSlide ? `home-photo:${homeSlide.dataset.homeSlide}` : `${type}:${provider}:${src}`;
      let index = lookup.get(key);
      if (index === undefined) {
        const image = button.querySelector('img');
        const poster = button.dataset.poster || image?.getAttribute('src') || button.querySelector('video')?.getAttribute('poster') || '';
        const title = button.dataset.caption || button.dataset.title || image?.alt || (photo ? 'Fotografie · SDL Visuals' : 'Een film van SDL Visuals');
        index = library.length;
        lookup.set(key, index);
        library.push({ type, src, provider, poster, thumbnail: thumbnailSource(image, poster || src), title, alt: image?.alt || title, format: button.dataset.format || 'portrait', variants: homeSlide ? [] : null });
      }
      if (homeSlide) library[index].variants.push(photoVariant(button));
      triggerIndexes.set(button, index);
    });
    if (!library.length) return;
    // Keep browsing inside the kind of work the visitor opened.
    const collections = {
      photo: library.filter(item => item.type === 'photo'),
      film: library.filter(item => item.type !== 'photo')
    };
    let media = [];
    let collection = null;

    const dialog = document.createElement('dialog');
    dialog.id = 'work-viewer';
    dialog.className = 'work-viewer';
    dialog.setAttribute('aria-labelledby', 'work-viewer-title');
    dialog.innerHTML = `<div class="work-viewer-layout"><header class="work-viewer-header"><div class="work-viewer-heading"><p class="work-viewer-kind"></p><h2 class="work-viewer-title" id="work-viewer-title"></h2></div><div class="work-viewer-header-actions"><p class="work-viewer-count"></p><button class="work-viewer-button work-viewer-close" type="button">Sluiten</button></div></header><div class="work-viewer-stage" aria-label="Beeldweergave"></div><div class="work-viewer-toolbar"><div class="work-viewer-navigation" role="group" aria-label="Door het werk bladeren"><button class="work-viewer-button" type="button" data-viewer-prev>Vorige</button><button class="work-viewer-button" type="button" data-viewer-next>Volgende</button></div><div class="work-viewer-tools" role="group" aria-label="Weergave"><button class="work-viewer-button" type="button" data-viewer-zoom-out>Uitzoomen</button><span class="work-viewer-zoom-level"></span><button class="work-viewer-button" type="button" data-viewer-zoom-in>Inzoomen</button><button class="work-viewer-button" type="button" data-viewer-fullscreen>Volledig scherm</button></div></div><div class="work-viewer-strip" role="group" aria-label="Alle beelden en films"></div><p class="work-viewer-status" aria-live="polite" role="status"></p></div>`;
    document.body.append(dialog);
    const stage = dialog.querySelector('.work-viewer-stage');
    const title = dialog.querySelector('.work-viewer-title');
    const kind = dialog.querySelector('.work-viewer-kind');
    const count = dialog.querySelector('.work-viewer-count');
    const close = dialog.querySelector('.work-viewer-close');
    const previous = dialog.querySelector('[data-viewer-prev]');
    const next = dialog.querySelector('[data-viewer-next]');
    const zoomIn = dialog.querySelector('[data-viewer-zoom-in]');
    const zoomOut = dialog.querySelector('[data-viewer-zoom-out]');
    const zoomLevel = dialog.querySelector('.work-viewer-zoom-level');
    const fullscreen = dialog.querySelector('[data-viewer-fullscreen]');
    const strip = dialog.querySelector('.work-viewer-strip');
    const status = dialog.querySelector('.work-viewer-status');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let active = 0;
    let opener = null;
    let scale = 1;
    let photoImage = null;
    let canvas = null;
    let videoWrapper = null;
    let videoRatio = 9 / 16;
    let renderId = 0;
    let resizeFrame = 0;
    let pan = null;
    let swipe = null;

    let thumbnails = [];
    let thumbnailObserver = null;
    let thumbnailFrame = 0;
    const pendingThumbnails = new Map();
    const warmPhotos = new Map();
    const clearWarmPhotos = () => {
      warmPhotos.forEach(image => image.removeAttribute('src'));
      warmPhotos.clear();
    };
    const preloadAdjacent = index => {
      const neighbours = [media[index - 1], media[index + 1]].filter(item => item?.type === 'photo');
      const keep = new Set(neighbours.map(item => item.src));
      warmPhotos.forEach((image, src) => {
        if (!keep.has(src)) { image.removeAttribute('src'); warmPhotos.delete(src); }
      });
      neighbours.forEach(item => {
        if (warmPhotos.has(item.src)) return;
        const image = document.createElement('img');
        image.loading = 'eager'; image.decoding = 'async'; image.setAttribute('fetchpriority', 'low');
        warmPhotos.set(item.src, image); image.src = item.src;
      });
    };
    const loadThumbnail = button => {
      const pending = pendingThumbnails.get(button);
      if (!pending) return;
      pending.image.src = pending.src;
      pendingThumbnails.delete(button);
      thumbnailObserver?.unobserve(button);
    };
    const loadVisibleThumbnails = () => {
      thumbnailFrame = 0;
      if (!dialog.open) return;
      const bounds = strip.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      let remaining = Math.min(28, Math.ceil(bounds.width / 50) + 4);
      for (const button of pendingThumbnails.keys()) {
        const item = button.getBoundingClientRect();
        if (item.right >= bounds.left - 80 && item.left <= bounds.right + 80 && item.bottom > bounds.top && item.top < bounds.bottom) {
          loadThumbnail(button);
          if (!--remaining) break;
        }
      }
    };
    const startThumbnailLoading = () => {
      if (!dialog.open || !pendingThumbnails.size) return;
      if ('IntersectionObserver' in window) {
        if (!thumbnailObserver) thumbnailObserver = new IntersectionObserver(entries => {
          if (!dialog.open) return;
          entries.forEach(entry => { if (entry.isIntersecting) loadThumbnail(entry.target); });
        }, { root: strip, rootMargin: '0px 80px', threshold: 0 });
        pendingThumbnails.forEach((_, button) => thumbnailObserver.observe(button));
      } else if (!thumbnailFrame) thumbnailFrame = requestAnimationFrame(loadVisibleThumbnails);
    };
    const buildThumbnails = () => {
      thumbnailObserver?.disconnect(); thumbnailObserver = null;
      if (thumbnailFrame) cancelAnimationFrame(thumbnailFrame);
      thumbnailFrame = 0; pendingThumbnails.clear();
      strip.replaceChildren();
      thumbnails = media.map((item, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'work-viewer-thumb';
      button.setAttribute('aria-label', `${index + 1}. ${item.title}`);
      button.title = item.title;
      if (item.thumbnail || item.poster) {
        const image = document.createElement('img');
        image.loading = 'eager';
        image.decoding = 'async';
        image.setAttribute('fetchpriority', 'low');
        image.alt = '';
        button.append(image);
        pendingThumbnails.set(button, { image, src: item.thumbnail || item.poster });
      } else {
        const fallback = document.createElement('span');
        fallback.className = 'work-viewer-thumb-fallback';
        fallback.textContent = item.type === 'photo' ? 'Foto' : 'Film';
        button.append(fallback);
      }
      if (item.type !== 'photo') {
        const label = document.createElement('span');
        label.className = 'work-viewer-thumb-type';
        label.textContent = 'Film';
        button.append(label);
      }
      button.addEventListener('click', () => show(index));
      strip.append(button);
      return button;
      });
    };

    const fit = () => {
      if (!dialog.open) return;
      const width = stage.clientWidth;
      const height = stage.clientHeight;
      if (photoImage?.naturalWidth && canvas) {
        const ratio = Math.min(width / photoImage.naturalWidth, height / photoImage.naturalHeight);
        const imageWidth = Math.max(1, photoImage.naturalWidth * ratio * scale);
        const imageHeight = Math.max(1, photoImage.naturalHeight * ratio * scale);
        photoImage.style.width = `${imageWidth}px`;
        photoImage.style.height = `${imageHeight}px`;
        canvas.style.width = `${Math.max(width, imageWidth)}px`;
        canvas.style.height = `${Math.max(height, imageHeight)}px`;
      }
      if (videoWrapper) {
        const mediaWidth = Math.min(width, height * videoRatio);
        videoWrapper.style.width = `${mediaWidth}px`;
        videoWrapper.style.height = `${mediaWidth / videoRatio}px`;
      }
    };
    const syncZoom = () => {
      const photo = media[active].type === 'photo';
      zoomIn.hidden = zoomOut.hidden = zoomLevel.hidden = !photo;
      zoomIn.disabled = !photoImage?.naturalWidth || scale >= 3;
      zoomOut.disabled = scale <= 1;
      zoomLevel.textContent = `${Math.round(scale * 100)}%`;
      stage.classList.toggle('is-zoomed', photo && scale > 1);
      stage.classList.toggle('is-swipeable', photo && scale === 1 && !!photoImage?.naturalWidth);
    };
    const zoom = difference => {
      if (!photoImage?.naturalWidth) return;
      swipe = null;
      /* Preserve the visible point in the photograph, excluding its letterboxing. */
      const centerX = (stage.scrollLeft + stage.clientWidth / 2 - (canvas.clientWidth - photoImage.clientWidth) / 2) / photoImage.clientWidth;
      const centerY = (stage.scrollTop + stage.clientHeight / 2 - (canvas.clientHeight - photoImage.clientHeight) / 2) / photoImage.clientHeight;
      scale = Math.max(1, Math.min(3, scale + difference));
      syncZoom();
      fit();
      stage.scrollLeft = Math.max(0, (canvas.clientWidth - photoImage.clientWidth) / 2 + centerX * photoImage.clientWidth - stage.clientWidth / 2);
      stage.scrollTop = Math.max(0, (canvas.clientHeight - photoImage.clientHeight) / 2 + centerY * photoImage.clientHeight - stage.clientHeight / 2);
      status.textContent = `Foto op ${Math.round(scale * 100)} procent.`;
    };
    const cleanup = () => {
      stage.querySelectorAll('video').forEach(video => { video.pause(); video.removeAttribute('src'); video.load(); });
      stage.querySelectorAll('iframe').forEach(frame => { frame.src = 'about:blank'; });
      stage.replaceChildren();
      stage.classList.remove('is-loading', 'is-error', 'is-zoomed', 'is-swipeable');
      stage.classList.remove('is-panning');
      pan = null;
      swipe = null;
      stage.scrollTop = stage.scrollLeft = 0;
      photoImage = canvas = videoWrapper = null;
      scale = 1;
      renderId += 1;
    };
    const showError = (item, token) => {
      if (token !== renderId) return;
      stage.classList.remove('is-loading');
      stage.classList.add('is-error');
      stage.replaceChildren();
      const message = document.createElement('p');
      message.className = 'work-viewer-error';
      message.textContent = item.type === 'photo' ? 'Deze foto kon niet worden geladen.' : 'Deze film kon niet worden geladen.';
      const link = document.createElement('a');
      link.href = item.type === 'film' ? filmURL(item.provider, item.src) : item.src;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = item.type === 'photo' ? 'Foto apart openen' : 'Film apart openen';
      message.append(link);
      stage.append(message);
    };
    const show = (index, direction = 0) => {
      if (index < 0 || index >= media.length) return;
      cleanup();
      active = index;
      const item = media[index];
      const token = renderId;
      title.textContent = item.title;
      kind.textContent = item.type === 'photo' ? 'Fotografie / SDL Visuals' : 'Film / SDL Visuals';
      count.textContent = `${index + 1} / ${media.length}`;
      previous.disabled = index === 0;
      next.disabled = index === media.length - 1;
      thumbnails.forEach((thumbnail, i) => {
        thumbnail.classList.toggle('is-active', i === index);
        thumbnail.tabIndex = i === index ? 0 : -1;
        if (i === index) thumbnail.setAttribute('aria-current', 'true');
        else thumbnail.removeAttribute('aria-current');
      });
      syncZoom();
      if (item.type === 'photo') {
        stage.classList.add('is-loading');
        canvas = document.createElement('div');
        canvas.className = 'work-viewer-canvas';
        photoImage = document.createElement('img');
        photoImage.className = 'work-viewer-image';
        photoImage.loading = 'eager';
        photoImage.decoding = 'async';
        photoImage.setAttribute('fetchpriority', 'high');
        photoImage.alt = item.alt;
        photoImage.draggable = false;
        photoImage.addEventListener('load', () => {
          if (token !== renderId) return;
          stage.classList.remove('is-loading');
          syncZoom();
          fit();
          if (direction && !reduced.matches) canvas.classList.add(direction > 0 ? 'is-swipe-next' : 'is-swipe-previous');
          preloadAdjacent(index);
        });
        photoImage.addEventListener('error', () => showError(item, token));
        photoImage.src = item.src;
        canvas.append(photoImage);
        stage.append(canvas);
      } else {
        videoRatio = item.format === 'landscape' ? 16 / 9 : 9 / 16;
        videoWrapper = document.createElement('div');
        videoWrapper.className = 'work-viewer-media';
        if (item.type === 'native') {
          const video = document.createElement('video');
          video.controls = true;
          video.playsInline = true;
          video.preload = 'metadata';
          video.src = item.src;
          if (item.poster) video.poster = item.poster;
          video.addEventListener('loadedmetadata', () => { if (token === renderId && video.videoWidth) { videoRatio = video.videoWidth / video.videoHeight; fit(); } });
          video.addEventListener('error', () => showError(item, token));
          videoWrapper.append(video);
          video.play().catch(() => {});
        } else {
          const frame = document.createElement('iframe');
          frame.src = filmURL(item.provider, item.src, true);
          frame.title = item.title;
          frame.referrerPolicy = 'strict-origin-when-cross-origin';
          frame.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media';
          frame.allowFullscreen = true;
          videoWrapper.append(frame);
        }
        stage.append(videoWrapper);
      }
      fit();
      /* Scroll only the filmstrip; never shift the dialog or the page underneath. */
      const thumbBounds = thumbnails[index].getBoundingClientRect();
      const stripBounds = strip.getBoundingClientRect();
      const edge = 12;
      if (thumbBounds.left < stripBounds.left + edge) {
        strip.scrollTo({ left: strip.scrollLeft + thumbBounds.left - stripBounds.left - edge, behavior: reduced.matches ? 'instant' : 'smooth' });
      } else if (thumbBounds.right > stripBounds.right - edge) {
        strip.scrollTo({ left: strip.scrollLeft + thumbBounds.right - stripBounds.right + edge, behavior: reduced.matches ? 'instant' : 'smooth' });
      }
      status.textContent = `${index + 1} van ${media.length}. ${item.title}`;
      // The selected photograph/player starts first. Only nearby small previews follow.
      startThumbnailLoading();
    };

    const open = button => {
      const index = triggerIndexes.get(button);
      if (index === undefined) return;
      opener = button;
      const item = library[index];
      const selectedCollection = item.type === 'photo' ? 'photo' : 'film';
      if (selectedCollection === 'photo') {
        clearWarmPhotos();
        collections.photo.forEach(photo => {
          if (!photo.variants) return;
          // Inactive slides still have layout; only CSS-hidden device variants are excluded.
          const visible = photo.variants.filter(variant => variant.button.getClientRects().length > 0);
          const variant = visible.find(variant => variant.button === button) || visible[0] || photo.variants[0];
          Object.assign(photo, { src: variant.src, thumbnail: variant.thumbnail, poster: variant.thumbnail, title: variant.title, alt: variant.alt, format: variant.format });
        });
      } else clearWarmPhotos();
      if (collection !== selectedCollection || selectedCollection === 'photo') {
        collection = selectedCollection;
        media = collections[collection];
        dialog.dataset.mediaType = collection;
        dialog.classList.toggle('is-single-item', media.length === 1);
        strip.setAttribute('aria-label', collection === 'photo' ? 'Fotogalerij' : 'Filmselectie');
        buildThumbnails();
      }
      if (!dialog.open) dialog.showModal();
      show(media.indexOf(item));
      close.focus({ preventScroll: true });
    };
    triggerIndexes.forEach((_, button) => button.addEventListener('click', () => open(button)));
    close.addEventListener('click', () => dialog.close());
    previous.addEventListener('click', () => show(active - 1));
    next.addEventListener('click', () => show(active + 1));
    zoomIn.addEventListener('click', () => zoom(.5));
    zoomOut.addEventListener('click', () => zoom(-.5));
    stage.addEventListener('pointerdown', event => {
      if (scale <= 1 || !photoImage || event.pointerType !== 'mouse' || event.button !== 0) return;
      pan = { id: event.pointerId, x: event.clientX, y: event.clientY, left: stage.scrollLeft, top: stage.scrollTop };
      stage.setPointerCapture(event.pointerId);
      stage.classList.add('is-panning');
      event.preventDefault();
    });
    stage.addEventListener('pointermove', event => {
      if (!pan || event.pointerId !== pan.id) return;
      stage.scrollLeft = pan.left - (event.clientX - pan.x);
      stage.scrollTop = pan.top - (event.clientY - pan.y);
    });
    const stopPan = () => { pan = null; stage.classList.remove('is-panning'); };
    stage.addEventListener('pointerup', stopPan);
    stage.addEventListener('pointercancel', stopPan);
    stage.addEventListener('lostpointercapture', stopPan);
    /* Touch swipes only browse photos at their fitted size. Vertical scrolling and the viewer zoom buttons remain available. */
    stage.addEventListener('pointerdown', event => {
      if (event.isPrimary === false) { swipe = null; return; }
      if (!['touch', 'pen'].includes(event.pointerType) || scale !== 1 || !photoImage?.naturalWidth || media[active].type !== 'photo') return;
      swipe = { id: event.pointerId, x: event.clientX, y: event.clientY, started: performance.now(), token: renderId, horizontal: false };
    }, { passive: true });
    stage.addEventListener('pointermove', event => {
      if (!swipe || swipe.id !== event.pointerId) return;
      const x = Math.abs(event.clientX - swipe.x);
      const y = Math.abs(event.clientY - swipe.y);
      if (!swipe.horizontal && y > 12 && y >= x * .9) { swipe = null; return; }
      if (x > 14 && x > y * 1.35) swipe.horizontal = true;
    }, { passive: true });
    stage.addEventListener('pointerup', event => {
      if (!swipe || swipe.id !== event.pointerId) return;
      const gesture = swipe;
      swipe = null;
      if (!gesture.horizontal || gesture.token !== renderId || scale !== 1 || media[active].type !== 'photo') return;
      const x = event.clientX - gesture.x;
      const y = Math.abs(event.clientY - gesture.y);
      const threshold = Math.max(64, Math.min(110, stage.clientWidth * .18));
      if (Math.abs(x) < threshold || Math.abs(x) < y * 1.6 || performance.now() - gesture.started > 1000) return;
      const direction = x < 0 ? 1 : -1;
      let index = active + direction;
      while (index >= 0 && index < media.length && media[index].type !== 'photo') index += direction;
      if (index >= 0 && index < media.length) show(index, direction);
    }, { passive: true });
    stage.addEventListener('pointercancel', () => { swipe = null; }, { passive: true });
    fullscreen.hidden = !document.fullscreenEnabled || typeof dialog.requestFullscreen !== 'function';
    fullscreen.addEventListener('click', async () => {
      try {
        if (document.fullscreenElement === dialog) await document.exitFullscreen();
        else await dialog.requestFullscreen();
      } catch (_) { status.textContent = 'Volledig scherm is niet beschikbaar in deze browser.'; }
    });
    document.addEventListener('fullscreenchange', () => {
      fullscreen.textContent = document.fullscreenElement === dialog ? 'Venster herstellen' : 'Volledig scherm';
      fullscreen.setAttribute('aria-pressed', String(document.fullscreenElement === dialog));
      scheduleFit();
    });
    dialog.addEventListener('keydown', event => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.target.closest?.('video,iframe,input,textarea,select')) return;
      const fromThumbnail = !!event.target.closest?.('.work-viewer-thumb');
      let index = active;
      if (event.key === 'ArrowLeft') index = Math.max(0,active - 1);
      else if (event.key === 'ArrowRight') index = Math.min(media.length - 1,active + 1);
      else if (fromThumbnail && event.key === 'Home') index = 0;
      else if (fromThumbnail && event.key === 'End') index = media.length - 1;
      else return;
      event.preventDefault();
      if (index !== active) show(index);
      if (fromThumbnail) thumbnails[index].focus({ preventScroll:true });
    });
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
    });
    dialog.addEventListener('close', () => {
      cleanup();
      clearWarmPhotos();
      thumbnailObserver?.disconnect(); thumbnailObserver = null;
      if (thumbnailFrame) cancelAnimationFrame(thumbnailFrame);
      thumbnailFrame = 0;
      if (resizeFrame) cancelAnimationFrame(resizeFrame);
      resizeFrame = 0;
      if (document.fullscreenElement === dialog) document.exitFullscreen().catch(() => {});
      if (opener?.isConnected) opener.focus({ preventScroll: true });
      opener = null;
    });
    const scheduleFit = () => {
      if (!dialog.open || resizeFrame) return;
      resizeFrame = requestAnimationFrame(() => { resizeFrame = 0; fit(); if (!('IntersectionObserver' in window)) startThumbnailLoading(); });
    };
    window.addEventListener('resize', scheduleFit, { passive: true });
    window.visualViewport?.addEventListener('resize', scheduleFit, { passive: true });
    if ('ResizeObserver' in window) new ResizeObserver(scheduleFit).observe(stage);
    strip.addEventListener('scroll', () => { if (!('IntersectionObserver' in window)) startThumbnailLoading(); }, { passive: true });
    // Open only the requested, published film after the CMS and viewer are ready.
    if (/\/Video\.html$/i.test(window.location?.pathname || '')) {
      const requestedFilm = new URLSearchParams(window.location.search).get('film');
      if (requestedFilm) {
        const button = triggers.find(trigger => trigger.dataset.videoId === requestedFilm && triggerIndexes.has(trigger) && library[triggerIndexes.get(trigger)].type !== 'photo');
        if (button) open(button);
      }
    }
  };
  // Wait for published photos before capturing slide and viewer elements.
  const startAfterCMS = () => {
    const ready = window.SDLCMSReady;
    if (ready && typeof ready.then === 'function') ready.then(start, start);
    else start();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startAfterCMS, { once: true });
  else startAfterCMS();
})();
