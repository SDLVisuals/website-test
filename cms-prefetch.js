/* Begin the public portfolio request while styles and photographs are loading. */
(function (scope, factory) {
  'use strict';
  const start = factory();
  if (typeof module === 'object' && module.exports) module.exports = start;
  if (scope && scope.document) start(scope);
})(typeof window === 'object' ? window : null, function () {
  'use strict';
  const ENDPOINT = 'https://sdl-visuals-beheer.sunny-mesa-3330.chatgpt.site/api/public/content';
  return function start(scope) {
    // An async script can arrive after the normal controller. That controller
    // already owns the request, so never start a competing fetch.
    if (scope.SDLCMSReady || scope.SDLCMSPrefetch || !scope.fetch || !scope.AbortController) return null;
    const endpoint = scope.document.currentScript?.dataset.endpoint || ENDPOINT;
    if (endpoint !== ENDPOINT) return null;
    const config = scope.SDLCMSConfig;
    if (config && (!config.enabled || config.endpoint !== endpoint)) return null;
    const controller = new scope.AbortController();
    const entry = { endpoint, controller, startedAt: Date.now(), response: null, used: false, release: null };
    const timer = scope.setTimeout(() => controller.abort(), 10000);
    entry.release = () => scope.clearTimeout(timer);
    entry.response = scope.fetch(endpoint, { credentials: 'omit', mode: 'cors', cache: 'no-cache', signal: controller.signal });
    // Register a rejection handler immediately. The controller will still see
    // the rejection when consuming this same promise; no data is applied here.
    entry.response.then(entry.release, entry.release);
    scope.SDLCMSPrefetch = entry;
    return entry;
  };
});
