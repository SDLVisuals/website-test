/* Keep page gestures stable; the photo viewer retains its own zoom controls. */
(() => {
  'use strict';

  const preventPageGesture = event => {
    if (event.cancelable) event.preventDefault();
  };

  /* Safari exposes pinch gestures separately from touch-action. Do not stop
     propagation: page controls and the viewer still receive their own events. */
  document.addEventListener('gesturestart', preventPageGesture, { capture: true, passive: false });
  document.addEventListener('gesturechange', preventPageGesture, { capture: true, passive: false });

  /* A normal one-finger scroll, photo swipe or tap is never cancelled here. */
  document.addEventListener('touchmove', event => {
    if (event.touches.length > 1) preventPageGesture(event);
  }, { capture: true, passive: false });

  /* Double-tap zoom is handled by CSS touch-action, not by cancelling touchend:
     cancelling touchend would also lose legitimate repeated button presses.
     Browser keyboard/menu zoom and OS accessibility zoom remain browser-owned. */
})();
