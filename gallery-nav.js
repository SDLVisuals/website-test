/* A native mobile category picker; the link navigation remains the fallback. */
(() => {
  'use strict';
  const select = document.querySelector('#gallery-category');
  const picker = select?.closest('.gallery-category-picker');
  if (!select || !picker) return;
  const allowed = new Set([...select.options].map(option => option.value));
  picker.hidden = false;
  picker.parentElement.classList.add('gallery-nav-ready');
  select.addEventListener('change', () => {
    if (allowed.has(select.value)) window.location.assign(select.value);
  });
})();
