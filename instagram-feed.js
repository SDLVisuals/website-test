/* Optional public Instagram feed. No token or account credential belongs here. */
(() => {
  'use strict';
  function asText(value, limit = 2400) {
    return typeof value === 'string' ? value.trim().slice(0, limit) : '';
  }
  function parsedUrl(value, base) {
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
      const url = new URL(value.trim(), base);
      if (url.username || url.password || [...url.searchParams.keys()].some(key => /access[_-]?token/i.test(key))) return null;
      return url;
    } catch (_) { return null; }
  }
  function safeFeedUrl(value, base = document.baseURI) {
    const url = parsedUrl(value, base);
    if (!url) return null;
    if ([...url.searchParams.keys()].some(key => /^(token|accesstoken|refreshtoken|apikey|clientsecret|authorization|auth|password|secret|signature)$/.test(key.toLowerCase().replace(/[^a-z]/g, '')))) return null;
    const origin = new URL(base).origin;
    if (url.origin === origin && /\.json$/i.test(url.pathname)) return url.href;
    return null;
  }
  function safeMediaUrl(value, base = document.baseURI) {
    const url = parsedUrl(value, base);
    if (!url) return null;
    const assets = new URL('assets/', base);
    if (url.protocol === 'https:') return url.href;
    if (url.origin === assets.origin && url.pathname.startsWith(assets.pathname)) return url.href;
    return null;
  }
  function safePermalink(value, username, base = document.baseURI) {
    const url = parsedUrl(value, base);
    if (url && url.protocol === 'https:' && !url.port && ['instagram.com', 'www.instagram.com'].includes(url.hostname) && /^\/(p|reel|tv)\/[a-zA-Z0-9_-]+\/?$/.test(url.pathname)) {
      url.search = ''; url.hash = '';
      return url.href;
    }
    return `https://www.instagram.com/${encodeURIComponent(username)}/`;
  }
  function normalizedMedia(raw, post, username, base) {
    if (!raw || !['IMAGE', 'VIDEO'].includes(raw.mediaType)) return null;
    const video = raw.mediaType === 'VIDEO';
    const medium = raw.sizes?.medium;
    const full = raw.sizes?.full;
    const large = raw.sizes?.large;
    const small = raw.sizes?.small;
    const media = values => values.map(value => safeMediaUrl(value, base)).find(Boolean) || null;
    // VIDEO image sizes are posters. Only mediaUrl is a playable video.
    const src = video ? safeMediaUrl(raw.mediaUrl, base) : media([full?.mediaUrl, large?.mediaUrl, medium?.mediaUrl, raw.mediaUrl, small?.mediaUrl]);
    if (!src) return null;
    const thumbnail = video ? media([medium?.mediaUrl, small?.mediaUrl, large?.mediaUrl, full?.mediaUrl, raw.thumbnailUrl]) : media([medium?.mediaUrl, small?.mediaUrl, large?.mediaUrl, full?.mediaUrl, raw.thumbnailUrl, src]);
    const dimensions = medium || large || full || small;
    const ratio = Number(dimensions?.width) / Number(dimensions?.height);
    const caption = asText(post.prunedCaption) || asText(post.caption);
    const permalink = safePermalink(post.permalink, username, base);
    const hasPermalink = permalink !== `https://www.instagram.com/${encodeURIComponent(username)}/`;
    const timestamp = asText(post.timestamp, 80);
    const date = /^\d{4}-\d{2}-\d{2}T/.test(timestamp) ? new Date(timestamp) : null;
    return {
      type: video ? 'video' : 'photo', src, thumbnail,
      ratio: Number.isFinite(ratio) && ratio >= .25 && ratio <= 4 ? ratio : (video ? 9 / 16 : 4 / 5),
      alt: asText(raw.altText, 500) || (video ? 'Voorbeeld van een Instagramvideo' : 'Fotografie van SDL Visuals'),
      caption, date: date && Number.isFinite(date.getTime()) ? date : null,
      permalink, hasPermalink,
      isReel: video && (raw.isReel === true || post.isReel === true)
    };
  }
  function normalizeFeed(payload, username, maxPosts = 12, base = document.baseURI) {
    if (!payload || payload.username !== username || !Array.isArray(payload.posts)) throw new Error('Invalid feed identity');
    // Instagram CDN links expire. Do not show an old feed after sync stops.
    if (payload.source === 'instagram-direct') {
      const generated = Date.parse(payload.generatedAt);
      const age = Date.now() - generated;
      if (!Number.isFinite(generated) || age > 48 * 60 * 60 * 1000 || age < -5 * 60 * 1000) throw new Error('Feed needs a fresh sync');
    }
    const result = { photos: [], videos: [], photoCards: [], videoCards: [] };
    const seen = new Set();
    let accepted = 0;
    for (const post of payload.posts.slice(0, 100)) {
      if (accepted >= maxPosts) break;
      if (!post || !['IMAGE', 'VIDEO', 'CAROUSEL_ALBUM'].includes(post.mediaType)) continue;
      const children = post.mediaType === 'CAROUSEL_ALBUM' ? (Array.isArray(post.children) ? post.children.slice(0, 50) : []) : [post];
      const items = children.map(child => normalizedMedia(child, post, username, base)).filter(Boolean);
      if (!items.length) continue;
      const key = asText(post.id, 200) || items[0].src;
      if (seen.has(key)) continue;
      seen.add(key); accepted++;
      for (const [type, collection, cards] of [['photo', result.photos, result.photoCards], ['video', result.videos, result.videoCards]]) {
        const group = items.filter(item => item.type === type);
        if (!group.length) continue;
        cards.push({ first: group[0], index: collection.length, count: group.length, album: post.mediaType === 'CAROUSEL_ALBUM' });
        collection.push(...group);
      }
    }
    return result;
  }
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const button = (className, text) => {
    const node = element('button', className, text);
    node.type = 'button';
    return node;
  };
  const dateLabel = date => new Intl.DateTimeFormat('nl-BE', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);

  function createViewer(username) {
    const dialog = element('dialog', 'ig-viewer');
    dialog.setAttribute('aria-labelledby', 'ig-viewer-title');
    const layout = element('div', 'ig-viewer-layout');
    const header = element('header', 'ig-viewer-header');
    const heading = element('div', 'ig-viewer-heading');
    const kicker = element('p', 'ig-viewer-kicker', `@${username}`);
    const title = element('h2', 'ig-viewer-title'); title.id = 'ig-viewer-title';
    heading.append(kicker, title);
    const close = button('ig-viewer-button ig-viewer-close', 'Sluiten');
    header.append(heading, close);
    const stage = element('div', 'ig-viewer-stage');
    const caption = element('p', 'ig-viewer-caption');
    const toolbar = element('div', 'ig-viewer-toolbar');
    const previous = button('ig-viewer-button', 'Vorige');
    const next = button('ig-viewer-button', 'Volgende');
    const count = element('span', 'ig-viewer-count');
    const navigation = element('div', 'ig-viewer-navigation');
    navigation.setAttribute('role', 'group'); navigation.setAttribute('aria-label', 'Door de beelden bladeren');
    navigation.append(previous, count, next);
    const external = element('a', 'ig-viewer-external', 'Bekijk op Instagram');
    external.target = '_blank'; external.rel = 'noopener noreferrer';
    toolbar.append(navigation, external);
    const status = element('p', 'ig-sr'); status.setAttribute('aria-live', 'polite');
    layout.append(header, stage, caption, toolbar, status);
    dialog.append(layout); document.body.append(dialog);
    let collection = [], index = 0, opener = null, generation = 0, loadTimer = 0;
    const cleanup = () => {
      generation++; clearTimeout(loadTimer);
      stage.querySelectorAll('video').forEach(video => {
        video.pause(); video.removeAttribute('src'); video.load();
      });
      stage.replaceChildren();
    };
    const show = position => {
      if (position < 0 || position >= collection.length) return;
      cleanup(); index = position;
      const item = collection[index], token = generation;
      const kind = item.type === 'photo' ? 'Foto' : (item.isReel ? 'Reel' : 'Video');
      title.textContent = `${kind} van @${username}`;
      caption.textContent = item.caption; caption.hidden = !item.caption;
      count.textContent = `${index + 1} / ${collection.length}`;
      previous.disabled = index === 0; next.disabled = index === collection.length - 1;
      external.href = item.permalink;
      external.textContent = item.hasPermalink ? 'Bekijk op Instagram' : 'Bekijk het profiel';
      status.textContent = `${kind} ${index + 1} van ${collection.length}`;
      stage.setAttribute('aria-busy', 'true');
      const loading = element('p', 'ig-viewer-loading', item.type === 'photo' ? 'Foto laden…' : 'Video laden…');
      stage.append(loading);
      const fail = () => {
        if (token !== generation || !dialog.open) return;
        cleanup(); stage.setAttribute('aria-busy', 'false');
        stage.append(element('p', 'ig-viewer-error', 'Dit beeld is hier niet beschikbaar. Open Instagram om verder te kijken.'));
      };
      const ready = () => {
        if (token !== generation) return;
        clearTimeout(loadTimer); loading.remove(); stage.setAttribute('aria-busy', 'false');
      };
      if (item.type === 'photo') {
        const image = element('img', 'ig-viewer-image');
        image.alt = item.alt; image.addEventListener('load', ready, { once: true }); image.addEventListener('error', fail, { once: true });
        stage.append(image); image.src = item.src;
      } else {
        const video = element('video', 'ig-viewer-video');
        video.controls = true; video.playsInline = true; video.preload = 'metadata';
        video.setAttribute('playsinline', '');
        if (item.thumbnail) video.poster = item.thumbnail;
        video.addEventListener('loadedmetadata', ready, { once: true }); video.addEventListener('error', fail, { once: true });
        stage.append(video); video.src = item.src;
      }
      loadTimer = setTimeout(fail, 20000);
    };
    close.addEventListener('click', () => dialog.close());
    previous.addEventListener('click', () => show(index - 1));
    next.addEventListener('click', () => show(index + 1));
    dialog.addEventListener('keydown', event => {
      // Native video keyboard controls retain their usual meaning.
      if (event.target.closest('video')) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault(); show(index + (event.key === 'ArrowLeft' ? -1 : 1));
      }
    });
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
    });
    dialog.addEventListener('close', () => { cleanup(); if (opener?.isConnected) opener.focus({ preventScroll: true }); opener = null; });
    return (items, start, source) => {
      collection = items; opener = source;
      if (typeof dialog.showModal !== 'function') { window.location.href = items[start].permalink; return; }
      if (!dialog.open) dialog.showModal();
      show(start); close.focus({ preventScroll: true });
    };
  }

  function renderGroup(type, cards, collection, openViewer) {
    if (!cards.length) return null;
    const group = element('section', `ig-group ig-group-${type}`);
    const heading = element('div', 'ig-group-heading');
    const title = element('h3', '', type === 'photo' ? 'Foto’s' : 'Reels & video');
    title.id = `ig-${type}-title`; group.setAttribute('aria-labelledby', title.id);
    heading.append(title, element('span', '', `${collection.length} ${type === 'photo' ? (collection.length === 1 ? 'foto' : 'foto’s') : (collection.length === 1 ? 'video' : 'video’s')}`));
    const row = element('ul', 'ig-grid');
    for (const card of cards) {
      const item = card.first;
      const entry = element('li', 'ig-card');
      const launch = button('ig-card-launch');
      const label = card.album ? `Album · ${card.count} ${type === 'photo' ? (card.count === 1 ? 'foto' : 'foto’s') : (card.count === 1 ? 'video' : 'video’s')}` : (type === 'photo' ? 'Foto' : (item.isReel ? 'Reel' : 'Video'));
      launch.setAttribute('aria-label', `Bekijk ${label.toLowerCase()}${item.caption ? ': ' + item.caption.slice(0, 140) : ''}`);
      const media = element('span', 'ig-card-media'); media.style.setProperty('--ig-ratio', String(item.ratio));
      if (item.thumbnail) {
        const image = element('img', 'ig-card-image'); image.alt = item.alt; image.loading = 'lazy'; image.decoding = 'async';
        image.addEventListener('error', () => { image.remove(); media.classList.add('ig-card-media-unavailable'); media.append(element('span', 'ig-card-placeholder', 'Open het beeld')); }, { once: true });
        image.src = item.thumbnail; media.append(image);
      } else { media.classList.add('ig-card-media-unavailable'); media.append(element('span', 'ig-card-placeholder', 'Open de video')); }
      media.append(element('span', 'ig-card-kind', label));
      if (type === 'video') {
        const play = element('span', 'ig-card-play', 'Afspelen');
        media.append(play);
      }
      launch.append(media); launch.addEventListener('click', () => openViewer(collection, card.index, launch));
      const copy = element('div', 'ig-card-copy');
      if (item.date) { const time = element('time', 'ig-card-date', dateLabel(item.date)); time.dateTime = item.date.toISOString(); copy.append(time); }
      if (item.caption) copy.append(element('p', 'ig-card-caption', item.caption));
      entry.append(launch, copy); row.append(entry);
    }
    group.append(heading, row);
    return group;
  }
  async function start() {
    const section = document.querySelector('#instagram[data-instagram-feed]');
    const content = section?.querySelector('[data-instagram-content]');
    if (!section || !content) return;
    section.hidden = true;
    const config = window.SDLInstagram || {};
    const username = asText(config.username, 80);
    const feedUrl = safeFeedUrl(config.feedUrl);
    if (!feedUrl || !/^[a-zA-Z0-9._]{1,30}$/.test(username)) { section.dataset.instagramState = 'disabled'; return; }
    const maxPosts = Number.isFinite(Number(config.maxPosts)) ? Math.max(1, Math.min(12, Math.floor(Number(config.maxPosts)))) : 12;
    section.dataset.instagramState = 'loading';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(feedUrl, { signal: controller.signal, credentials: 'omit', cache: 'no-store', headers: { Accept: 'application/json' } });
      if (!response.ok || (response.url && !safeFeedUrl(response.url))) throw new Error('Feed unavailable');
      const data = normalizeFeed(await response.json(), username, maxPosts);
      if (config.preview === true) [...data.photos, ...data.videos].forEach(item => { item.date = null; });
      if (!data.photos.length && !data.videos.length) throw new Error('Empty feed');
      const openViewer = createViewer(username);
      const groups = [renderGroup('photo', data.photoCards, data.photos, openViewer), renderGroup('video', data.videoCards, data.videos, openViewer)].filter(Boolean);
      content.replaceChildren(...groups);
      section.dataset.instagramState = 'ready'; section.hidden = false;
    } catch (_) {
      content.replaceChildren(); section.dataset.instagramState = 'unavailable'; section.hidden = true;
    } finally { clearTimeout(timeout); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
