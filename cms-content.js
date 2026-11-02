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
  const COMING_SOON_GRADIENTS = ['ruby', 'violet', 'midnight', 'silver'];
  const COMING_SOON_DEFAULT = [{ id: 'communiefotografie', title: 'Communiefotografie', description: 'Communiefotografie komt binnenkort bij SDL Visuals. Meer informatie volgt.', visible: true, gradient: 'ruby', destination: { type: 'contact' } }];
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
  const VIDEO_CATEGORIES = Object.freeze({ wedding: 'Trouwfilm', business: 'Bedrijfsfilm', product: 'Productfilm', events: 'Eventfilm', auto: 'Automotive', drone: 'Dronefilm', other: 'Film' });
  function videoSource(provider, source) {
    if (typeof source !== 'string' || source.length > 2048 || /[\\\u0000-\u0020]/.test(source)) return fail();
    const patterns = { gumlet: /^[a-f0-9]{24}$/, vimeo: /^\d{6,15}$/, youtube: /^[A-Za-z0-9_-]{11}$/ };
    if (patterns[provider]) return patterns[provider].test(source) ? source : fail();
    if (provider !== 'file') return fail();
    let url;
    try { url = new URL(source); } catch (_) { return fail(); }
    const host = url.hostname.toLowerCase();
    const deniedHost = !host.includes('.') || /(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(host)
      || /^\[/.test(host) || /^\d+(?:\.\d+){0,3}$/.test(host);
    if (url.protocol !== 'https:' || url.username || url.password || url.hash || deniedHost || !/\.(mp4|webm)$/i.test(url.pathname)) return fail();
    if (url.origin === CMS_ORIGIN && (!/^\/media\/[a-f0-9-]{36}\.(mp4|webm)$/.test(url.pathname) || url.search)) return fail();
    return url.href;
  }
  function normalizeVideos(values) {
    if (values === undefined) return undefined; // Older publications retain the existing film section.
    if (!Array.isArray(values) || values.length > 100) return fail();
    const videos = values.map(value => {
      if (!plain(value) || !Object.hasOwn(VIDEO_CATEGORIES, value.category)
        || !['gumlet', 'vimeo', 'youtube', 'file'].includes(value.provider)
        || !['landscape', 'portrait'].includes(value.format)
        || typeof value.featured !== 'boolean' || typeof value.showOnHome !== 'boolean') return fail();
      const item = {
        id: text(value.id, 120), title: text(value.title, 160), category: value.category,
        description: text(value.description, 800), duration: text(value.duration, 50), format: value.format,
        provider: value.provider, source: videoSource(value.provider, value.source), poster: photo(value.poster),
        featured: value.featured, showOnHome: value.showOnHome
      };
      if (!/^[A-Za-z0-9_-]+$/.test(item.id) || !item.title.trim()) return fail();
      return item;
    });
    if (new Set(videos.map(item => item.id)).size !== videos.length || videos.filter(item => item.featured).length > 1
      || videos.filter(item => item.showOnHome && (item.category !== 'drone' || item.featured)).length > 4) return fail();
    return videos;
  }
  function write(node, value) { if (node) node.textContent = value; }
  function videoVisibility(node, visible) {
    node.hidden = !visible;
    if (visible) node.style.removeProperty('display');
    else {
      node.style.setProperty('display', 'none');
      node.querySelectorAll('button[data-video],button[data-video-src]').forEach(button => {
        button.removeAttribute('data-video'); button.removeAttribute('data-video-src');
        button.removeAttribute('data-video-provider'); button.removeAttribute('data-video-id');
      });
    }
  }
  function patchVideo(button, item) {
    button.removeAttribute('data-video');
    button.removeAttribute('data-video-src');
    button.removeAttribute('data-video-provider');
    button.dataset.videoId = item.id;
    button.dataset.videoProvider = item.provider;
    if (item.provider === 'file') button.dataset.videoSrc = item.source;
    else button.dataset.video = item.source;
    button.dataset.title = `${item.title} · ${VIDEO_CATEGORIES[item.category]}`;
    button.dataset.poster = item.poster.src;
    button.dataset.format = item.format;
    button.setAttribute('aria-label', `Bekijk de film: ${item.title}`);
    const image = button.querySelector('img');
    if (image) setImage(image, item.poster, '(max-width:760px) 92vw, 65vw');
  }
  function makeProject(template, item) {
    const article = template.cloneNode(true);
    article.removeAttribute('id');
    article.classList.toggle('film-project--portrait', item.format === 'portrait');
    article.classList.toggle('film-project--landscape', item.format === 'landscape');
    patchVideo(article.querySelector('button'), item);
    write(article.querySelector('h3'), item.title);
    const caption = article.querySelector('.film-project-caption p');
    if (caption) {
      caption.textContent = VIDEO_CATEGORIES[item.category];
      if (item.duration) { const duration = caption.ownerDocument.createElement('span'); duration.className = 'film-caption-duration'; duration.textContent = item.duration; caption.append(duration); }
    }
    return article;
  }
  function makeHomeMain(template, item) {
    const article = template.cloneNode(true);
    patchVideo(article.querySelector('button'), item);
    write(article.querySelector('.home-featured-label'), item.category === 'wedding' ? 'Uitgelichte trouwfilm' : 'Uitgelichte film');
    write(article.querySelector('.home-film-watch small'), item.title);
    write(article.querySelector('.home-film-caption h3'), item.title);
    write(article.querySelector('.home-film-caption p'), item.description);
    const meta = article.querySelector('.home-film-meta');
    if (meta) {
      meta.textContent = VIDEO_CATEGORIES[item.category];
      if (item.duration) meta.append(meta.ownerDocument.createElement('br'), meta.ownerDocument.createTextNode(item.duration));
    }
    return article;
  }
  function makeHomeSmall(template, item) {
    const article = template.cloneNode(true);
    patchVideo(article.querySelector('button'), item);
    write(article.querySelector('.home-film-type'), VIDEO_CATEGORIES[item.category]);
    write(article.querySelector('h3'), item.title);
    write(article.querySelector('p'), item.description);
    return article;
  }
  function applyVideos(videos, doc, filename) {
    if (!videos) return;
    const featured = videos.find(item => item.featured) || videos[0];
    if (filename === 'Video.html') {
      const feature = doc.querySelector('.film-featured');
      const projects = doc.querySelector('.film-projects');
      const template = projects?.querySelector('.film-project');
      if (feature) {
        videoVisibility(feature, !!featured);
        if (featured) {
          patchVideo(feature.querySelector('button'), featured);
          write(feature.querySelector('.film-featured-kicker'), featured.category === 'wedding' ? 'Uitgelichte trouwfilm' : 'Uitgelichte film');
          write(feature.querySelector('.film-featured-watch>span'), featured.category === 'wedding' ? 'Bekijk de trouwfilm' : 'Bekijk de film');
          write(feature.querySelector('h2'), featured.title);
          const caption = feature.querySelector('.film-featured-caption p');
          if (caption) {
            caption.textContent = VIDEO_CATEGORIES[featured.category];
            if (featured.duration) { const duration = doc.createElement('span'); duration.className = 'film-caption-duration'; duration.textContent = featured.duration; caption.append(duration); }
          }
        }
      }
      if (projects && template) {
        projects.replaceChildren(...videos.filter(item => item !== featured).map(item => makeProject(template, item)));
        if (!videos.length) { const empty = doc.createElement('p'); empty.textContent = 'Nieuwe films verschijnen binnenkort. Bespreek intussen gerust jouw filmidee.'; projects.append(empty); }
      }
    }
    if (filename === 'index.html' || filename === 'glass.html') {
      const layout = doc.querySelector('.home-film-layout');
      const mainTemplate = layout?.querySelector('.home-film-main');
      const sideTemplate = layout?.querySelector('.home-film-small');
      const main = videos.find(item => item.featured && item.showOnHome) || videos.find(item => item.showOnHome && item.category !== 'drone');
      if (layout && mainTemplate && sideTemplate) {
        const rows = [];
        if (main) {
          rows.push(makeHomeMain(mainTemplate, main));
          const side = doc.createElement('div'); side.className = 'home-film-side';
          side.append(...videos.filter(item => item.showOnHome && item.category !== 'drone' && item !== main).slice(0, 3).map(item => makeHomeSmall(sideTemplate, item)));
          rows.push(side);
        } else { const empty = doc.createElement('p'); empty.textContent = 'Ontdek mijn videowerk of bespreek jouw filmidee.'; rows.push(empty); }
        layout.replaceChildren(...rows);
      }
      const drone = videos.find(item => item.category === 'drone' && item.showOnHome);
      const figure = doc.querySelector('.home-drone-media');
      if (figure) {
        videoVisibility(figure, !!drone);
        if (drone) { patchVideo(figure.querySelector('button'), drone); write(figure.querySelector('figcaption>span'), drone.title); }
      }
    }
    if (filename === 'drone.html') {
      const figure = doc.querySelector('.drone-film-card');
      const drone = videos.find(item => item.category === 'drone');
      if (figure) {
        videoVisibility(figure, !!drone);
        if (drone) {
          patchVideo(figure.querySelector('button'), drone);
          write(figure.querySelector('figcaption strong'), drone.title);
          write(figure.querySelector('figcaption>span'), drone.description);
        }
      }
    }
    const galleryCategories = { 'trouw.html': ['wedding'], 'evenementen.html': ['business', 'events'], 'auto.html': ['auto'], 'product.html': ['product'] };
    if (galleryCategories[filename]) {
      const grid = doc.querySelector('.portfolio-video-grid');
      const template = grid?.querySelector('.portfolio-video');
      if (grid && template) {
        const wedding = videos.filter(item => galleryCategories[filename].includes(item.category)).sort((a, b) => Number(b.featured) - Number(a.featured));
        videoVisibility(grid.closest('section'), !!wedding.length);
        grid.replaceChildren(...wedding.map((item, index) => {
          const article = template.cloneNode(true);
          patchVideo(article.querySelector('button'), item);
          write(article.querySelector('h3'), item.title);
          write(article.querySelector('.portfolio-video-caption p'), item.category === 'wedding' ? 'Trouwfilm / Aparte reportage' : VIDEO_CATEGORIES[item.category]);
          write(article.querySelector('.portfolio-video-caption>span'), item.duration || `FILM / ${String(index + 1).padStart(2, '0')}`);
          return article;
        }));
      }
    }
  }
  function normalizePayload(payload) {
    if (!plain(payload) || payload.version !== 1 || !Number.isInteger(payload.revision) || payload.revision < 0) return fail();
    const content = payload.content;
    if (!plain(content) || content.version !== 1 || !Array.isArray(content.galleries) || content.galleries.length < 6 || content.galleries.length > 30
      || !Array.isArray(content.hero) || content.hero.length < 1 || content.hero.length > 24) return fail();
    const galleries = content.galleries.map(value => {
      if (!plain(value) || typeof value.key !== 'string' || !/^[a-z][a-z0-9-]{1,47}$/.test(value.key)
        || value.path !== (GALLERIES.includes(value.key) ? `${value.key}.html` : `galerij.html?serie=${value.key}`)
        || !Array.isArray(value.photos) || value.photos.length > 500) return fail();
      const photos = value.photos.map(photo);
      if (new Set(photos.map(item => item.id)).size !== photos.length) return fail();
      const title = text(value.title, 80);
      if (!title.trim()) return fail();
      return { key: value.key, title, path: value.path, description: value.description === undefined ? undefined : text(value.description, 600), cover: photo(value.cover), photos };
    });
    if (new Set(galleries.map(item => item.key)).size !== galleries.length || !GALLERIES.every(key => galleries.some(item => item.key === key))
      || galleries.reduce((total, item) => total + item.photos.length, 0) > 2500) return fail();
    const hero = content.hero.map(value => {
      if (!plain(value) || !Object.hasOwn(ROUTES, value.category) || value.route !== ROUTES[value.category]) return fail();
      return {
        id: text(value.id, 120), category: value.category, label: text(value.label, 120), route: value.route,
        detail: text(value.detail, 1000), desktop: photo(value.desktop), mobile: photo(value.mobile),
        motion: value.motion === undefined ? undefined : Number(value.motion)
      };
    });
    if (new Set(hero.map(item => item.id)).size !== hero.length || hero.some(item => !item.id || item.motion !== undefined && (!Number.isFinite(item.motion) || item.motion < 0 || item.motion > .08))) return fail();
    const announcements = content.comingSoon === undefined ? COMING_SOON_DEFAULT : content.comingSoon;
    if (!Array.isArray(announcements) || announcements.length > 20) return fail();
    const comingSoon = announcements.map(value => {
      if (!plain(value) || typeof value.visible !== 'boolean' || !COMING_SOON_GRADIENTS.includes(value.gradient || 'ruby')) return fail();
      const item = { id: text(value.id, 120), title: text(value.title, 100), description: text(value.description, 600), planning: text(value.planning, 80), visible: value.visible, gradient: value.gradient || 'ruby' };
      if (!/^[A-Za-z0-9_-]+$/.test(item.id) || !item.title.trim()) return fail();
      if (value.destination !== undefined) {
        const destination = value.destination;
        if (!plain(destination) || !['contact', 'gallery', 'video'].includes(destination.type)) return fail();
        item.destination = { type: destination.type };
        if (destination.type !== 'contact') {
          const target = text(destination.target, destination.type === 'gallery' ? 48 : 120);
          if (!(destination.type === 'gallery' ? /^[a-z][a-z0-9-]{1,47}$/ : /^[A-Za-z0-9_-]+$/).test(target)) return fail();
          item.destination.target = target;
        }
      }
      return item;
    });
    if (new Set(comingSoon.map(item => item.id)).size !== comingSoon.length) return fail();
    return { version: 1, revision: payload.revision, publishedAt: text(payload.publishedAt, 80), content: { version: 1, galleries, hero, videos: normalizeVideos(content.videos), comingSoon } };
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
        homeSlide: String(index), category: item.category, motion: String(item.motion ?? original?.dataset.motion ?? '0.035'),
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
  function applyGalleryNavigation(galleries, doc, currentPath) {
    const visible = galleries.filter(item => item.photos.length || item.path === currentPath);
    const categories = doc.querySelector('.portfolio-categories');
    const sheet = doc.querySelector('.gallery-collection-grid');
    [categories, sheet].filter(Boolean).forEach(nav => {
      const detailed = nav === sheet;
      const retained = [...nav.children].filter(link => ['Video.html', 'drone.html'].includes(link.getAttribute('href')));
      const links = visible.map(item => {
        const link = doc.createElement('a');
        link.className = detailed ? 'gallery-collection-option' : 'portfolio-category';
        link.href = item.path;
        if (item.path === currentPath) link.setAttribute('aria-current', 'page');
        if (detailed) {
          const image = doc.createElement('img'); image.loading = 'lazy';
          setImage(image, item.cover, '64px'); image.alt = '';
          const label = doc.createElement('span'); label.textContent = item.title;
          if (item.path === currentPath) { const current = doc.createElement('small'); current.textContent = 'Nu bekeken'; label.append(current); }
          link.append(image, label);
        } else link.textContent = item.title;
        return link;
      });
      nav.replaceChildren(...links, ...retained);
    });
  }
  function applyHomeGalleries(galleries, doc) {
    const rail = doc.querySelector('.home-work-ordered');
    if (!rail) return;
    const originals = new Map([...rail.querySelectorAll('.home-work-card')].map(card => [card.getAttribute('href'), card]));
    const visible = galleries.filter(item => item.photos.length);
    const cards = visible.map(item => {
      const original = originals.get(item.path);
      const card = original ? original.cloneNode(true) : doc.createElement('a');
      card.className = 'home-work-card'; card.href = item.path;
      if (!original) {
        const frame = doc.createElement('span'); frame.className = 'home-work-image';
        const image = doc.createElement('img'); image.loading = 'lazy'; frame.append(image);
        const title = doc.createElement('h3');
        const description = doc.createElement('p');
        const action = doc.createElement('span'); action.className = 'home-work-open'; action.textContent = 'Bekijk de fotoserie';
        card.append(frame, title, description, action);
      }
      write(card.querySelector('h3'), item.title);
      if (item.description !== undefined || !original) write(card.querySelector('p'), item.description || 'Een selectie uit mijn werk.');
      const image = card.querySelector('.home-work-image img');
      if (image) setImage(image, item.cover, '(max-width:760px) 86vw, 40vw');
      return card;
    });
    rail.replaceChildren(...cards);
    if (!cards.length) {
      const empty = doc.createElement('p'); empty.className = 'portfolio-empty';
      empty.textContent = 'Nieuwe fotoseries verschijnen binnenkort. Vertel me gerust wat je in gedachten hebt.'; rail.append(empty);
    }
    write(doc.querySelector('#fotografie .service-meta'), `${visible.length} ${visible.length === 1 ? 'serie' : 'series'} om te ontdekken`);
  }
  function comingSoonDestination(item, content = {}) {
    const fallback = { href: 'contact.html', label: 'Ik heb interesse', kind: 'contact', targetTitle: item.title };
    const destination = item.destination;
    if (destination?.type === 'gallery') {
      const gallery = content.galleries?.find(gallery => gallery.key === destination.target && gallery.photos.length);
      if (gallery) return { href: gallery.path, label: 'Bekijk de galerij', kind: 'gallery', targetTitle: gallery.title };
    }
    if (destination?.type === 'video') {
      const video = content.videos?.find(video => video.id === destination.target);
      if (video) return { href: `Video.html?film=${encodeURIComponent(video.id)}`, label: 'Bekijk de film', kind: 'video', targetTitle: video.title };
    }
    return fallback;
  }
  function applyComingSoon(items, doc, content) {
    const section = doc.querySelector('[data-coming-soon]');
    const grid = section?.querySelector('[data-coming-soon-grid]');
    if (!section || !grid) return;
    const visible = items.filter(item => item.visible);
    section.hidden = !visible.length;
    grid.replaceChildren(...visible.map(item => {
      const card = doc.createElement('article'); card.className = `coming-soon-card coming-soon-${item.gradient}`;
      card.dataset.comingSoonId = item.id;
      const destination = comingSoonDestination(item, content);
      card.dataset.destinationType = destination.kind;
      const top = doc.createElement('div'); top.className = 'coming-soon-card-top';
      const label = doc.createElement('p'); label.className = 'coming-soon-label'; label.textContent = 'Binnenkort bij SDL Visuals';
      top.append(label);
      if (destination.kind !== 'contact') {
        const badge = doc.createElement('span'); badge.className = 'coming-soon-badge';
        badge.textContent = destination.kind === 'gallery' ? 'Fotogalerij' : 'Film'; top.append(badge);
      }
      const copy = doc.createElement('div'); copy.className = 'coming-soon-copy';
      const title = doc.createElement('h3'); title.textContent = item.title;
      const description = doc.createElement('p'); description.textContent = item.description;
      copy.append(title, description);
      const foot = doc.createElement('div'); foot.className = 'coming-soon-foot';
      const planning = doc.createElement('span'); planning.textContent = item.planning || 'Meer informatie volgt';
      const action = doc.createElement('a'); action.className = 'coming-soon-action'; action.href = destination.href;
      action.textContent = destination.label;
      action.setAttribute('aria-label', destination.kind === 'contact' ? `Meer informatie over ${item.title.toLowerCase()}` : `${destination.label}: ${destination.targetTitle}`);
      foot.append(planning, action); card.append(top, copy, foot); return card;
    }));
  }
  function applyCustomGallery(gallery, doc) {
    if (!doc.body.hasAttribute('data-custom-gallery')) return;
    const empty = doc.querySelector('[data-custom-gallery-empty]');
    const contents = doc.querySelector('[data-custom-gallery-content]');
    if (empty) empty.hidden = !!gallery;
    if (contents) contents.hidden = !gallery;
    if (!gallery) return;
    const description = gallery.description || `Ontdek ${gallery.title.toLowerCase()} in een fotoreportage van SDL Visuals.`;
    const title = `${gallery.title} | Fotografie door SDL Visuals`;
    const canonical = `https://sdlvisuals.be/${gallery.path}`;
    doc.title = title;
    const meta = (selector, value) => doc.querySelector(selector)?.setAttribute('content', value);
    meta('meta[name="description"]', description);
    meta('meta[name="robots"]', 'index, follow, max-image-preview:large');
    meta('meta[property="og:title"]', title); meta('meta[property="og:description"]', description);
    meta('meta[property="og:url"]', canonical); meta('meta[property="og:image"]', gallery.cover.src);
    meta('meta[property="og:image:alt"]', gallery.cover.alt);
    meta('meta[name="twitter:title"]', title); meta('meta[name="twitter:description"]', description);
    meta('meta[name="twitter:image"]', gallery.cover.src);
    doc.querySelector('link[rel="canonical"]')?.setAttribute('href', canonical);
    write(doc.querySelector('#collection-title'), gallery.title);
    write(doc.querySelector('.collection-hero-lead'), description);
    write(doc.querySelector('.collection-breadcrumb [aria-current="page"]'), gallery.title);
    const schema = doc.querySelector('[data-custom-gallery-schema]');
    if (schema) schema.textContent = JSON.stringify({ '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, description, url: canonical, inLanguage: 'nl-BE', isPartOf: { '@id': 'https://sdlvisuals.be/#website' }, primaryImageOfPage: { '@type': 'ImageObject', contentUrl: gallery.cover.src, caption: gallery.cover.alt } });
  }
  function applyContent(payload, doc, location) {
    const { content } = payload;
    const filename = location.pathname.split('/').pop() || 'index.html';
    const isHome = filename === 'index.html' || filename === 'glass.html';
    const requested = filename === 'galerij.html' ? new URLSearchParams(location.search || '').get('serie') : null;
    const currentPath = requested ? `galerij.html?serie=${requested}` : filename;
    const gallery = content.galleries.find(item => item.path === currentPath);
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
      write(doc.querySelector('.gallery-category-current>strong'), gallery.title);
    }
    applyCustomGallery(gallery?.photos.length ? gallery : null, doc);
    applyGalleryNavigation(content.galleries, doc, currentPath);
    if (track) {
      track.replaceChildren(heroFragment);
      const first = content.hero[0];
      const next = content.hero[1] || first;
      const hero = doc.querySelector('.home-hero');
      if (hero) hero.dataset.presentedCategory = first.category;
      const tabs = doc.querySelector('.showcase-tabs');
      if (tabs) {
        const buttons = [...tabs.querySelectorAll('[data-home-select]')];
        const categories = [...new Set(content.hero.map(item => item.category))];
        tabs.replaceChildren(...categories.map((category, index) => {
          const button = buttons.find(item => item.dataset.homeCategory === category);
          if (button) { write(button.querySelector('.showcase-tab-number'), String(index + 1).padStart(2, '0')); button.dataset.homeSelect = String(index); }
          return button;
        }).filter(Boolean));
      }
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
    }
    if (isHome) { applyHomeGalleries(content.galleries, doc); applyComingSoon(content.comingSoon || COMING_SOON_DEFAULT, doc, content); }
    applyVideos(content.videos, doc, filename);
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
    const timeoutMs = Math.max(250, Math.min(10000, Number(config.timeoutMs) || 8000));
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
  return { imageURL, photo, videoSource, normalizeVideos, normalizePayload, applyContent, applyVideos, applyComingSoon, comingSoonDestination, readJSON, run, ENDPOINT, CMS_ORIGIN };
});
