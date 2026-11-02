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

  /* CSS touch-action on html permits native panning without page pinch zoom.
     Do not add a non-passive document touchmove listener: even when it only
     cancels multi-touch, every one-finger scroll must first wait for that JS. */

  /* Double-tap zoom is handled by CSS touch-action, not by cancelling touchend:
     cancelling touchend would also lose legitimate repeated button presses.
     Browser keyboard/menu zoom and OS accessibility zoom remain browser-owned. */
})();
