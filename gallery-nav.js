/* A bespoke collection sheet. Ordinary category links remain the no-script fallback. */
(() => {
  'use strict';
  const picker = document.querySelector('.gallery-category-picker');
  const trigger = picker?.querySelector('.gallery-category-trigger');
  const dialog = document.querySelector('#gallery-collections');
  if (!picker || !trigger || !dialog || typeof dialog.showModal !== 'function') return;

  const closeButton = dialog.querySelector('.gallery-collections-close');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = matchMedia('(max-width: 600px)');
  let closing = false;
  let closeTimer = 0;
  let scrollLock = null;

  function releaseScroll() {
    if (!scrollLock) return;
    document.documentElement.style.overflow = scrollLock.html;
    document.body.style.overflow = scrollLock.body;
    scrollLock = null;
  }

  function finishClose() {
    clearTimeout(closeTimer);
    if (dialog.open) dialog.close();
    releaseScroll();
  }

  function close() {
    if (!dialog.open || closing) return;
    closing = true;
    dialog.classList.add('is-closing');
    if (reducedMotion.matches) finishClose();
    else closeTimer = window.setTimeout(finishClose, 180);
  }

  function open() {
    if (dialog.open) return;
    closing = false;
    dialog.classList.remove('is-closing');
    scrollLock = {
      html: document.documentElement.style.overflow,
      body: document.body.style.overflow,
    };
    dialog.showModal();
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    trigger.setAttribute('aria-expanded', 'true');
    // Native modal focus containment, custom appearance and standard link navigation.
    closeButton.focus({ preventScroll: true });
  }

  trigger.addEventListener('click', open);
  closeButton.addEventListener('click', close);
  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    close();
  });
  dialog.addEventListener('click', event => {
    if (event.target === dialog) close();
    const current = event.target.closest('a[aria-current="page"]');
    if (current && dialog.contains(current)) {
      event.preventDefault();
      close();
    }
  });
  dialog.addEventListener('close', () => {
    clearTimeout(closeTimer);
    closing = false;
    dialog.classList.remove('is-closing');
    trigger.setAttribute('aria-expanded', 'false');
    releaseScroll();
    if (mobile.matches && document.visibilityState === 'visible') trigger.focus({ preventScroll: true });
  });
  mobile.addEventListener('change', event => {
    if (!event.matches && dialog.open) finishClose();
  });
  // Avoid retaining a modal or scroll lock after Safari restores this page from history.
  window.addEventListener('pagehide', finishClose);
  picker.hidden = false;
  picker.parentElement.classList.add('gallery-nav-ready');
})();
