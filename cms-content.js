/* Published photo content; the original HTML remains the complete offline fallback. */
(function (scope, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (scope && scope.document) scope.SDLCMSReady = api.run(scope.SDLCMSConfig, scope);
})(typeof window === 'object' ? window : null, function () {
  'use strict';
  const CMS_ORIGIN = 'https://sdl-visuals-beheer.sunny-mesa-3330.chatgpt.site';
  const ENDPOINT = `${CMS_ORIGIN}/api/public/content`;
  const ROUTES = Object.freeze({
    wedding: 'trouw.html', events: 'evenementen.html', portrait: 'portret.html',
    couple: 'koppelshoot.html', auto: 'auto.html', product: 'product.html'
  });
  const GALLERIES = Object.values(ROUTES).map(path => path.slice(0, -5));
  const MAX_BYTES = 2 * 1024 * 1024;
  const fail = () => { throw new Error('Ongeldige gepubliceerde fotocollectie.'); };
  const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const text = (value, limit, fallback = '') => {
    if (value === undefined || value === null) return fallback;
    if (typeof value !== 'string' || value.length > limit) return fail();
    return value;
  };
  const positive = (value, max = 40000) => {
    if (!Number.isInteger(value) || value < 1 || value > max) return fail();
    return value;
  };
  const focal = value => {
    if (!Number.isFinite(value) || value < 0 || value > 100) return fail();
    return value;
  };
  function imageURL(value) {
    if (typeof value !== 'string' || value.length > 1500 || /[\\\u0000-\u0020]/.test(value)) return fail();
    let url;
    try { url = new URL(value, CMS_ORIGIN); } catch (_) { return fail(); }
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return fail();
    const original = (url.origin === 'https://sdlvisuals.be' || url.origin === 'https://www.sdlvisuals.be')
      && /^\/assets\/[A-Za-z0-9][A-Za-z0-9._-]*\.(?:jpe?g|png|webp)$/i.test(url.pathname);
    const upload = url.origin === CMS_ORIGIN && /^\/media\/[a-f0-9-]{36}\.(?:jpg|png|webp)$/.test(url.pathname);
    if (!original && !upload) return fail();
    return url.href;
  }
  function photo(value) {
    if (!plain(value)) return fail();
    const item = {
      id: text(value.id, 120), src: imageURL(value.src),
      alt: text(value.alt, 1000), caption: text(value.caption, 1000),
      width: positive(value.width), height: positive(value.height),
      focalX: focal(value.focalX), focalY: focal(value.focalY)
    };
    if (!item.id) return fail();
    if (value.srcset !== undefined) {
      if (!Array.isArray(value.srcset) || value.srcset.length > 4) return fail();
      item.srcset = value.srcset.map(candidate => {
        if (!plain(candidate)) return fail();
        return { src: imageURL(candidate.src), width: positive(candidate.width) };
      }).sort((a, b) => a.width - b.width);
      if (new Set(item.srcset.map(candidate => candidate.width)).size !== item.srcset.length) return fail();
    }
    return item;
  }
  function normalizePayload(payload) {
    if (!plain(payload) || payload.version !== 1 || !Number.isInteger(payload.revision) || payload.revision < 0) return fail();
    const content = payload.content;
    if (!plain(content) || content.version !== 1 || !Array.isArray(content.galleries) || content.galleries.length !== 6
      || !Array.isArray(content.hero) || content.hero.length !== 12) return fail();
    const galleries = content.galleries.map(value => {
      if (!plain(value) || !GALLERIES.includes(value.key) || value.path !== `${value.key}.html`
        || !Array.isArray(value.photos) || value.photos.length > 500) return fail();
      const photos = value.photos.map(photo);
      if (new Set(photos.map(item => item.id)).size !== photos.length) return fail();
      return { key: value.key, title: text(value.title, 120), path: value.path, cover: photo(value.cover), photos };
    });
    if (new Set(galleries.map(item => item.key)).size !== 6) return fail();
    const hero = content.hero.map(value => {
      if (!plain(value) || !Object.hasOwn(ROUTES, value.category) || value.route !== ROUTES[value.category]) return fail();
      return {
        id: text(value.id, 120), category: value.category, label: text(value.label, 120), route: value.route,
        detail: text(value.detail, 1000), desktop: photo(value.desktop), mobile: photo(value.mobile)
      };
    });
    if (new Set(hero.map(item => item.id)).size !== 12 || !Object.keys(ROUTES).every(key => hero.some(item => item.category === key))) return fail();
    return { version: 1, revision: payload.revision, publishedAt: text(payload.publishedAt, 80), content: { version: 1, galleries, hero } };
  }
  const viewerSource = photo => photo.srcset?.length ? photo.srcset[photo.srcset.length - 1].src : photo.src;
  function setImage(image, item, sizes) {
    image.src = item.src;
    image.alt = item.alt;
    image.width = item.width;
    image.height = item.height;
    image.decoding = 'async';
    image.style.setProperty('object-position', `${item.focalX}% ${item.focalY}%`, 'important');
    image.style.setProperty('--mobile-position', `${item.focalX}% ${item.focalY}%`);
    if (item.srcset?.length) {
      image.srcset = item.srcset.map(source => `${source.src} ${source.width}w`).join(', ');
      image.sizes = sizes;
    } else {
      image.removeAttribute('srcset');
      image.removeAttribute('sizes');
    }
  }
  function makeGallery(doc, gallery) {
    const fragment = doc.createDocumentFragment();
    gallery.photos.forEach((item, index) => {
      const figure = doc.createElement('figure');
      figure.setAttribute('data-reveal', '');
      const button = doc.createElement('button');
      button.type = 'button';
      button.className = 'portfolio-image';
      button.dataset.photo = viewerSource(item);
      button.dataset.caption = item.caption;
      button.setAttribute('aria-label', `Vergroot foto: ${item.caption || item.alt}`);
      const image = doc.createElement('img');
      image.loading = 'lazy';
      setImage(image, item, '(max-width:600px) 92vw, (max-width:1000px) 45vw, 30vw');
      button.append(image);
      const caption = doc.createElement('figcaption');
      const number = doc.createElement('span');
      number.textContent = String(index + 1).padStart(2, '0');
      const description = doc.createElement('p');
      description.textContent = item.caption;
      caption.append(number, description);
      figure.append(button, caption);
      fragment.append(figure);
    });
    if (!gallery.photos.length) {
      const empty = doc.createElement('p');
      empty.className = 'portfolio-empty';
      empty.textContent = 'Er zijn op dit moment geen foto’s in deze serie.';
      fragment.append(empty);
    }
    return fragment;
  }
  function makeHeroButton(doc, item, mode, first) {
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = `showcase-photo showcase-${mode}-photo`;
    button.dataset.photo = viewerSource(item);
    button.dataset.caption = item.caption;
    button.setAttribute('aria-label', `Bekijk de volledige foto: ${item.caption || item.alt}`);
    const image = doc.createElement('img');
    image.loading = first ? 'eager' : 'lazy';
    image.draggable = false;
    if (first) image.setAttribute('fetchpriority', 'high');
    const ratio = item.width / item.height;
    const mobileSizes = `(max-width:760px) max(calc(100vw - 18px), calc(${(ratio * 100).toFixed(3)}svh - ${(ratio * 260).toFixed(2)}px)), 100vw`;
    setImage(image, item, mode === 'mobile' ? mobileSizes : '100vw');
    button.append(image);
    return button;
  }
  function makeHero(doc, rows, track) {
    const originals = new Map([...track.querySelectorAll('[data-home-slide]')].map(slide => [slide.id, slide]));
    const fragment = doc.createDocumentFragment();
    rows.forEach((item, index) => {
      const original = originals.get(item.id);
      const slide = doc.createElement('div');
      slide.className = `home-slide showcase-slide showcase-slide-${item.category}${index === 0 ? ' is-active' : ''}`;
      slide.id = `home-slide-${index + 1}`;
      Object.assign(slide.dataset, {
        homeSlide: String(index), category: item.category, motion: original?.dataset.motion || '0.035',
        label: item.label, route: item.route, detail: item.detail, preview: item.mobile.src, ambient: item.desktop.src
      });
      slide.setAttribute('aria-hidden', String(index !== 0));
      const desktop = makeHeroButton(doc, item.desktop, 'desktop', index === 0);
      const mobile = makeHeroButton(doc, item.mobile, 'mobile', index === 0);
      const pair = original?.matches('.showcase-product-pair') ? original : original?.querySelector('.showcase-product-pair');
      const oldPrimary = pair?.querySelector('.showcase-photo:not(.showcase-companion) img');
      // The existing secondary product photograph is retained until the desktop photo is replaced.
      if (pair && oldPrimary && new URL(oldPrimary.getAttribute('src'), 'https://sdlvisuals.be/').href === item.desktop.src) {
        const companion = pair.querySelector('.showcase-companion');
        if (companion) {
          slide.classList.add('showcase-product-pair');
          slide.append(desktop, companion.cloneNode(true), mobile);
        } else slide.append(desktop, mobile);
      } else slide.append(desktop, mobile);
      fragment.append(slide);
    });
    return fragment;
  }
  function applyContent(payload, doc, location) {
    const { content } = payload;
    const filename = location.pathname.split('/').pop() || 'index.html';
    const isHome = filename === 'index.html' || filename === 'glass.html';
    const gallery = content.galleries.find(item => item.path === filename);
    const galleryElement = gallery && doc.querySelector('[data-gallery]');
    const track = isHome && doc.querySelector('.home-slide-track');
    // Build replacements while detached: malformed data cannot leave half of a gallery on screen.
    const galleryFragment = galleryElement ? makeGallery(doc, gallery) : null;
    const heroFragment = track ? makeHero(doc, content.hero, track) : null;
    if (galleryElement) {
      galleryElement.replaceChildren(galleryFragment);
      const count = `${gallery.photos.length} ${gallery.photos.length === 1 ? 'foto' : 'foto’s'}`;
      doc.querySelectorAll('.gallery-collection-title>p,.gallery-category-current>small').forEach(node => { node.textContent = count; });
      const explore = doc.querySelector('.collection-explore');
      if (explore) explore.textContent = `Bekijk de ${count}`;
      const cover = doc.querySelector('.collection-hero-media img');
      if (cover) setImage(cover, gallery.cover, '(max-width:760px) 100vw, 75vw');
    }
    if (track) {
      track.replaceChildren(heroFragment);
      const first = content.hero[0];
      const next = content.hero[1];
      doc.querySelectorAll('[data-home-select]').forEach(control => {
        const matches = content.hero.map((item, index) => ({ item, index })).filter(row => row.item.category === control.dataset.homeCategory);
        control.setAttribute('aria-controls', matches.map(row => `home-slide-${row.index + 1}`).join(' '));
        control.setAttribute('aria-pressed', String(first.category === control.dataset.homeCategory));
      });
      const label = doc.querySelector('[data-home-photo-label]');
      if (label) label.textContent = first.label;
      const detail = doc.querySelector('[data-showcase-detail]');
      if (detail) detail.textContent = first.detail;
      const counter = doc.querySelector('[data-home-counter]');
      if (counter) counter.textContent = `01 / ${content.hero.length}`;
      const collection = doc.querySelector('[data-showcase-collection]');
      if (collection) { collection.href = first.route; collection.setAttribute('aria-label', `Bekijk de serie ${first.label.toLowerCase()}`); }
      const ambient = doc.querySelector('[data-showcase-ambient]');
      if (ambient) ambient.src = first.desktop.src;
      const preview = doc.querySelector('[data-showcase-preview]');
      if (preview) { preview.src = next.mobile.src; preview.alt = `Voorbeeld uit de volgende serie: ${next.label.toLowerCase()}`; }
      const nextTitle = doc.querySelector('[data-showcase-next-title]');
      if (nextTitle) nextTitle.textContent = next.label;
      const nextButton = doc.querySelector('[data-showcase-next]');
      if (nextButton) nextButton.setAttribute('aria-label', `Bekijk de volgende foto: ${next.label.toLowerCase()}`);
      content.galleries.forEach(item => {
        const image = [...doc.querySelectorAll('.home-work-card')].find(card => card.getAttribute('href') === item.path)?.querySelector('.home-work-image img');
        if (image) setImage(image, item.cover, '(max-width:760px) 86vw, 40vw');
      });
    }
    doc.documentElement.dataset.cmsRevision = String(payload.revision);
  }
  async function readJSON(response) {
    if (!response.ok || !/^application\/json\b/i.test(response.headers.get('content-type') || '')) throw new Error('Publicatie niet beschikbaar.');
    const length = Number(response.headers.get('content-length'));
    if (length > MAX_BYTES) throw new Error('Publicatie te groot.');
    if (!response.body?.getReader) {
      const raw = await response.text();
      if (raw.length > MAX_BYTES) throw new Error('Publicatie te groot.');
      return JSON.parse(raw);
    }
    const reader = response.body.getReader();
    const chunks = [];
    let bytes = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BYTES) { await reader.cancel(); throw new Error('Publicatie te groot.'); }
      chunks.push(value);
    }
    const buffer = new Uint8Array(bytes);
    let offset = 0;
    chunks.forEach(chunk => { buffer.set(chunk, offset); offset += chunk.byteLength; });
    return JSON.parse(new TextDecoder().decode(buffer));
  }
  async function run(config, scope) {
    if (!config?.enabled) return { applied: false, reason: 'disabled' };
    if (config.endpoint !== ENDPOINT) return { applied: false, reason: 'configuration' };
    const controller = new scope.AbortController();
    const timeoutMs = Math.max(250, Math.min(2500, Number(config.timeoutMs) || 2200));
    let timer;
    try {
      const deadline = new Promise((_, reject) => {
        timer = scope.setTimeout(() => { controller.abort(); reject(new Error('Publicatie duurt te lang.')); }, timeoutMs);
      });
      const request = scope.fetch(ENDPOINT, { credentials: 'omit', mode: 'cors', cache: 'no-cache', signal: controller.signal })
        .then(readJSON).then(normalizePayload);
      const payload = await Promise.race([request, deadline]);
      applyContent(payload, scope.document, scope.location);
      scope.document.dispatchEvent(new scope.CustomEvent('sdl:content-updated', { detail: { revision: payload.revision } }));
      return { applied: true, revision: payload.revision };
    } catch (_) {
      // Never replace a finished page with an error screen or partial CMS data.
      return { applied: false, reason: 'fallback' };
    } finally { scope.clearTimeout(timer); }
  }
  return { imageURL, photo, normalizePayload, applyContent, readJSON, run, ENDPOINT, CMS_ORIGIN };
});
