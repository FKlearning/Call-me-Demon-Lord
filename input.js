/* Normalize physical keys and the key-only events used by some embedded browsers. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DemonInput = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const keys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'KeyR', 'KeyF',
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Escape', 'Enter', 'Digit1', 'Digit2', 'Digit3']);
  function normalize(event) {
    if (event.ctrlKey || event.metaKey || event.altKey) return null;
    if (keys.has(event.code)) return event.code;
    const key = event.key || event.code || '';
    if (/^[wasdqerf]$/i.test(key)) return 'Key' + key.toUpperCase();
    if (/^[123]$/.test(key)) return 'Digit' + key;
    if (keys.has(key)) return key;
    if (key === ' ' || key === 'Spacebar') return 'Space';
    if (key === 'Esc') return 'Escape';
    // IME events may say Process while still exposing the original virtual key.
    const legacy = { 87: 'KeyW', 65: 'KeyA', 83: 'KeyS', 68: 'KeyD', 81: 'KeyQ',
      69: 'KeyE', 82: 'KeyR', 70: 'KeyF', 38: 'ArrowUp', 40: 'ArrowDown', 37: 'ArrowLeft',
      39: 'ArrowRight', 32: 'Space', 27: 'Escape', 13: 'Enter', 49: 'Digit1', 50: 'Digit2', 51: 'Digit3' };
    return legacy[event.keyCode || event.which] || null;
  }
  return { normalize };
});
