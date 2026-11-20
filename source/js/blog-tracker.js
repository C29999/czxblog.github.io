(() => {
  'use strict';
  if (window.__blogAnalytics || window.top !== window.self) return;
  const script = document.currentScript;
  if (!script) return;
  const api = script.dataset.api;
  if (!api) return;
  window.__blogAnalytics = true;
  const endpoint = new URL('/api/blog/track', api);
  const privatePath = /^\/(?:blog(?:\/|$)|api\/blog(?:\/|$)|\.netlify\/functions\/blog-)/i;
  if (privatePath.test(location.pathname)) return;

  function send(type, target) {
    // Only paths and explicit control IDs; no query strings, form values or link text.
    const event = { id: crypto.randomUUID(), type, path: location.pathname };
    if (target) event.target = target;
    fetch(endpoint, {
      method: 'POST', mode: 'cors', credentials: 'omit', keepalive: true,
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(event),
    }).catch(() => {}); // Analytics must never interrupt reading or navigation.
  }

  function pageView() { if (!privatePath.test(location.pathname)) send('view'); }
  if (document.visibilityState === 'prerender') {
    document.addEventListener('visibilitychange', pageView, { once: true });
  } else pageView();
  // BFCache restores are new visits; PJAX is optional in the theme.
  window.addEventListener('pageshow', event => { if (event.persisted) pageView(); });
  document.addEventListener('pjax:complete', pageView);

  let lastTarget = '', lastTime = 0;
  document.addEventListener('click', event => {
    if (!event.isTrusted || privatePath.test(location.pathname)) return;
    const control = event.target.closest?.('a[href],button,[data-analytics-id]');
    if (!control || control.closest('[data-analytics-ignore],form') || control.disabled) return;
    let target;
    if (control.matches('a[href]')) {
      let url;
      try { url = new URL(control.getAttribute('href'), location.href); } catch { return; }
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return;
      if (url.origin === location.origin && privatePath.test(url.pathname)) return;
      target = url.origin === location.origin ? url.pathname : url.origin + url.pathname;
    } else {
      const id = control.dataset.analyticsId || control.id;
      if (!id || !/^[\w-]{1,80}$/.test(id)) return;
      target = `button:${id}`;
    }
    const now = Date.now();
    if (target === lastTarget && now - lastTime < 400) return;
    lastTarget = target; lastTime = now;
    send('click', target);
  }, { capture: true });
})();
