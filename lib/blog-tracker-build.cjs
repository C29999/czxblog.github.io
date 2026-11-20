const path = require('node:path').posix;

function analyticsOrigin(env) {
  // Preview deployments must not send events to a production backend,
  // even when an explicit origin was inherited from shared build settings.
  if (env.NETLIFY === 'true' && env.CONTEXT !== 'production') return '';
  // A GitHub Pages build must explicitly name its separately deployed backend.
  const raw = env.BLOG_ANALYTICS_ORIGIN || (env.NETLIFY === 'true' && env.CONTEXT === 'production' ? env.URL : '');
  if (!raw) return '';
  const url = new URL(raw);
  if (url.origin !== raw || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) {
    throw new Error('BLOG_ANALYTICS_ORIGIN must be an HTTPS origin without a path or trailing slash');
  }
  return url.origin;
}

function injectTracker(html, route, origin) {
  // Remove only our own generated tag; repeated builds never duplicate it.
  html = html.replace(/<script\b[^>]*\bdata-blog-tracker="v1"[^>]*><\/script>/gi, '');
  if (!origin || !/<\/body\s*>/i.test(html) || /^blog(?:\/|$)/i.test(route)) return html;
  const escape = value => value.replace(/[&"<>]/g, c => ({ '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' }[c]));
  const src = path.relative(path.dirname(route), 'js/blog-tracker.js');
  const tag = `<script defer data-blog-tracker="v1" data-api="${escape(origin)}" src="${escape(src)}?v=20261120"></script>`;
  return html.replace(/<\/body\s*>/i, `${tag}</body>`);
}

module.exports = { analyticsOrigin, injectTracker };
