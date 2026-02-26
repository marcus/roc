/**
 * Disco Mode Easter Egg
 *
 * Double-click any "disco-ball" icon cell to toggle disco mode.
 * All effects are CSS-driven and scoped under `.disco-mode` on <html>,
 * so nothing fires until activated. No dependencies on app.js.
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // 1. Inject disco styles into <head>
  // ---------------------------------------------------------------------------

  var styleEl = document.createElement('style');
  styleEl.id = 'disco-mode-styles';
  styleEl.textContent = [
    // -- Keyframes ----------------------------------------------------------

    // Slow hue rotation for the background overlay
    '@keyframes disco-hue {',
    '  0%   { filter: hue-rotate(0deg); }',
    '  100% { filter: hue-rotate(360deg); }',
    '}',

    // Spotlight sweep — five radial gradients drifting across the page
    '@keyframes disco-spotlight {',
    '  0%   { background-position: 20% 30%, 80% 70%, 50% 10%, 10% 60%, 90% 40%; }',
    '  20%  { background-position: 60% 10%, 30% 80%, 80% 50%, 40% 90%, 20% 20%; }',
    '  40%  { background-position: 80% 60%, 10% 20%, 30% 80%, 70% 30%, 50% 70%; }',
    '  60%  { background-position: 40% 90%, 70% 40%, 10% 40%, 90% 70%, 30% 10%; }',
    '  80%  { background-position: 10% 50%, 50% 10%, 70% 70%, 20% 20%, 80% 80%; }',
    '  100% { background-position: 20% 30%, 80% 70%, 50% 10%, 10% 60%, 90% 40%; }',
    '}',

    // Icon wobble/dance — a playful rotation + slight scale
    '@keyframes disco-wobble {',
    '  0%   { transform: rotate(0deg)   scale(1); }',
    '  20%  { transform: rotate(-6deg)  scale(1.04); }',
    '  40%  { transform: rotate(5deg)   scale(0.97); }',
    '  60%  { transform: rotate(-3deg)  scale(1.02); }',
    '  80%  { transform: rotate(4deg)   scale(0.98); }',
    '  100% { transform: rotate(0deg)   scale(1); }',
    '}',

    // Rainbow border shimmer for the header
    '@keyframes disco-rainbow {',
    '  0%   { background-position: 0% 50%; }',
    '  100% { background-position: 200% 50%; }',
    '}',

    // -- Body overlay (hue-cycling tinted veil) -----------------------------

    // Smooth transition on body for the overlay entrance
    '.disco-mode body {',
    '  position: relative;',
    '}',

    'html.disco-mode body::after {',
    '  content: "";',
    '  position: fixed;',
    '  inset: 0;',
    '  z-index: 0;',
    '  pointer-events: none;',
    '  background:',
    '    radial-gradient(ellipse 500px 500px, rgba(255,50,150,0.14), transparent),',
    '    radial-gradient(ellipse 450px 450px, rgba(50,100,255,0.12), transparent),',
    '    radial-gradient(ellipse 400px 400px, rgba(255,200,50,0.10), transparent),',
    '    radial-gradient(ellipse 350px 350px, rgba(50,255,150,0.10), transparent),',
    '    radial-gradient(ellipse 500px 500px, rgba(180,50,255,0.12), transparent);',
    '  background-size: 100% 100%;',
    '  animation:',
    '    disco-spotlight 8s ease-in-out infinite,',
    '    disco-hue 10s linear infinite;',
    '  opacity: 1;',
    '  transition: opacity 0.6s ease;',
    '}',

    // Before disco mode is added, the pseudo-element doesn't exist.
    // When it's removed, we can't transition ::after out because it
    // disappears instantly. Instead we use a helper class for fade-out
    // (see toggle logic below).

    // -- Header rainbow border ----------------------------------------------

    'html.disco-mode .page-header {',
    '  border-bottom: 2px solid transparent;',
    '  background-clip: padding-box;',
    '  position: relative;',
    '}',

    'html.disco-mode .page-header::after {',
    '  content: "";',
    '  position: absolute;',
    '  left: 0; right: 0; bottom: -2px;',
    '  height: 2px;',
    '  background: linear-gradient(',
    '    90deg,',
    '    #ff0000, #ff8800, #ffff00, #00ff00,',
    '    #0088ff, #8800ff, #ff0088, #ff0000',
    '  );',
    '  background-size: 200% 100%;',
    '  animation: disco-rainbow 3s linear infinite;',
    '}',

    // -- Icon coloring via nth-child hue-rotate filters ---------------------
    // 16 steps cycling through the full 360-degree spectrum

    'html.disco-mode .icon-cell:nth-child(16n+1)  .icon-wrap { filter: hue-rotate(0deg)    brightness(1.2); }',
    'html.disco-mode .icon-cell:nth-child(16n+2)  .icon-wrap { filter: hue-rotate(22deg)   brightness(1.2); }',
    'html.disco-mode .icon-cell:nth-child(16n+3)  .icon-wrap { filter: hue-rotate(45deg)   brightness(1.2); }',
    'html.disco-mode .icon-cell:nth-child(16n+4)  .icon-wrap { filter: hue-rotate(67deg)   brightness(1.2); }',
    'html.disco-mode .icon-cell:nth-child(16n+5)  .icon-wrap { filter: hue-rotate(90deg)   brightness(1.2); }',
    'html.disco-mode .icon-cell:nth-child(16n+6)  .icon-wrap { filter: hue-rotate(112deg)  brightness(1.2); }',
    'html.disco-mode .icon-cell:nth-child(16n+7)  .icon-wrap { filter: hue-rotate(135deg)  brightness(1.2); }',
    'html.disco-mode .icon-cell:nth-child(16n+8)  .icon-wrap { filter: hue-rotate(157deg)  brightness(1.2); }',
    'html.disco-mode .icon-cell:nth-child(16n+9)  .icon-wrap { filter: hue-rotate(180deg)  brightness(1.2); }',
    'html.disco-mode .icon-cell:nth-child(16n+10) .icon-wrap { filter: hue-rotate(202deg)  brightness(1.2); }',
    'html.disco-mode .icon-cell:nth-child(16n+11) .icon-wrap { filter: hue-rotate(225deg)  brightness(1.2); }',
    'html.disco-mode .icon-cell:nth-child(16n+12) .icon-wrap { filter: hue-rotate(247deg)  brightness(1.2); }',
    'html.disco-mode .icon-cell:nth-child(16n+13) .icon-wrap { filter: hue-rotate(270deg)  brightness(1.2); }',
    'html.disco-mode .icon-cell:nth-child(16n+14) .icon-wrap { filter: hue-rotate(292deg)  brightness(1.2); }',
    'html.disco-mode .icon-cell:nth-child(16n+15) .icon-wrap { filter: hue-rotate(315deg)  brightness(1.2); }',
    'html.disco-mode .icon-cell:nth-child(16n+16) .icon-wrap { filter: hue-rotate(337deg)  brightness(1.2); }',

    // Base transition so hue filters fade in smoothly
    'html.disco-mode .icon-cell .icon-wrap {',
    '  transition: filter 0.6s ease, transform 0.2s ease;',
    '}',

    // -- Icon wobble animation with staggered nth-child delays --------------

    'html.disco-mode .icon-cell .icon-wrap {',
    '  animation: disco-wobble 1.2s ease-in-out infinite;',
    '}',

    // Stagger the wobble so icons dance at different times (12 offsets)
    'html.disco-mode .icon-cell:nth-child(12n+1)  .icon-wrap { animation-delay: 0s; }',
    'html.disco-mode .icon-cell:nth-child(12n+2)  .icon-wrap { animation-delay: 0.1s; }',
    'html.disco-mode .icon-cell:nth-child(12n+3)  .icon-wrap { animation-delay: 0.2s; }',
    'html.disco-mode .icon-cell:nth-child(12n+4)  .icon-wrap { animation-delay: 0.3s; }',
    'html.disco-mode .icon-cell:nth-child(12n+5)  .icon-wrap { animation-delay: 0.4s; }',
    'html.disco-mode .icon-cell:nth-child(12n+6)  .icon-wrap { animation-delay: 0.5s; }',
    'html.disco-mode .icon-cell:nth-child(12n+7)  .icon-wrap { animation-delay: 0.6s; }',
    'html.disco-mode .icon-cell:nth-child(12n+8)  .icon-wrap { animation-delay: 0.7s; }',
    'html.disco-mode .icon-cell:nth-child(12n+9)  .icon-wrap { animation-delay: 0.8s; }',
    'html.disco-mode .icon-cell:nth-child(12n+10) .icon-wrap { animation-delay: 0.9s; }',
    'html.disco-mode .icon-cell:nth-child(12n+11) .icon-wrap { animation-delay: 1.0s; }',
    'html.disco-mode .icon-cell:nth-child(12n+12) .icon-wrap { animation-delay: 1.1s; }',

    // -- Hover boost during disco mode --------------------------------------

    'html.disco-mode .icon-cell:hover .icon-wrap {',
    '  transform: scale(1.25);',
    '  animation: none;',
    '}',

    // -- Smooth transition scaffolding --------------------------------------
    // Ensure main content sits above the body::after overlay
    'html.disco-mode .page-header,',
    'html.disco-mode .page-content,',
    'html.disco-mode #content {',
    '  position: relative;',
    '  z-index: 1;',
    '}',

    // Fade-out helper: applied briefly before removing .disco-mode so the
    // overlay opacity can transition to 0 before the pseudo-element is gone.
    'html.disco-fade-out body::after {',
    '  content: "";',
    '  position: fixed;',
    '  inset: 0;',
    '  z-index: 0;',
    '  pointer-events: none;',
    '  background:',
    '    radial-gradient(ellipse 500px 500px, rgba(255,50,150,0.14), transparent),',
    '    radial-gradient(ellipse 450px 450px, rgba(50,100,255,0.12), transparent),',
    '    radial-gradient(ellipse 400px 400px, rgba(255,200,50,0.10), transparent),',
    '    radial-gradient(ellipse 350px 350px, rgba(50,255,150,0.10), transparent),',
    '    radial-gradient(ellipse 500px 500px, rgba(180,50,255,0.12), transparent);',
    '  opacity: 0;',
    '  transition: opacity 0.6s ease;',
    '}',

    // Fade icon filters back to normal during fade-out
    'html.disco-fade-out .icon-cell .icon-wrap {',
    '  filter: none !important;',
    '  animation: none !important;',
    '  transition: filter 0.6s ease, transform 0.2s ease;',
    '}',

    // Fade the header rainbow out
    'html.disco-fade-out .page-header::after {',
    '  content: "";',
    '  position: absolute;',
    '  left: 0; right: 0; bottom: -2px;',
    '  height: 2px;',
    '  background: linear-gradient(',
    '    90deg,',
    '    #ff0000, #ff8800, #ffff00, #00ff00,',
    '    #0088ff, #8800ff, #ff0088, #ff0000',
    '  );',
    '  background-size: 200% 100%;',
    '  opacity: 0;',
    '  transition: opacity 0.6s ease;',
    '}',

  ].join('\n');

  document.head.appendChild(styleEl);

  // ---------------------------------------------------------------------------
  // 2. Single-click on any disco-ball icon cell toggles disco mode
  //
  // Uses a capture-phase listener so it fires before app.js's bubble-phase
  // click handler. We stopImmediatePropagation to prevent the detail panel
  // from opening.
  // ---------------------------------------------------------------------------

  var fadeOutTimer = null;

  document.addEventListener('click', function (e) {
    var discoBall = e.target.closest('[data-icon-name="disco-ball"]');
    if (!discoBall) return;

    // Swallow the click so app.js never sees it (we'll open the panel ourselves)
    e.stopImmediatePropagation();
    e.preventDefault();

    var html = document.documentElement;

    // If we're currently fading out, cancel and snap off
    if (fadeOutTimer) {
      clearTimeout(fadeOutTimer);
      fadeOutTimer = null;
      html.classList.remove('disco-mode', 'disco-fade-out');
      return;
    }

    var isActive = html.classList.contains('disco-mode');

    if (isActive) {
      // -- Turn off: fade out, then clean up classes --------------------
      html.classList.add('disco-fade-out');
      html.classList.remove('disco-mode');

      fadeOutTimer = setTimeout(function () {
        html.classList.remove('disco-fade-out');
        fadeOutTimer = null;
      }, 650);
    } else {
      // -- Turn on -----------------------------------------------------
      html.classList.remove('disco-fade-out');
      html.classList.add('disco-mode');
    }

    // Still open the detail panel so users can access the icon
    if (typeof openDetail === 'function') {
      openDetail('disco-ball');
    }
  }, true); // ← capture phase: fires before app.js bubble-phase listener
})();
