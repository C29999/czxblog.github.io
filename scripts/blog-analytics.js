const { analyticsOrigin, injectTracker } = require('../lib/blog-tracker-build.cjs');

// Hexo has populated routes here, but has not written public/ yet.
// Transform route streams so fresh builds and skip_render HTML are both covered.
hexo.extend.filter.register('after_generate', async function () {
  const origin = analyticsOrigin(process.env);
  const routes = this.route.list().filter(route => /\.html?$/i.test(route));
  for (const route of routes) {
    const chunks = [];
    for await (const chunk of this.route.get(route)) chunks.push(Buffer.from(chunk));
    const html = Buffer.concat(chunks).toString('utf8');
    const next = injectTracker(html, route, origin);
    // Even unchanged skip_render sources may have older injected output in
    // public/. Mark them for Hexo's output-hash check when config changes.
    this.route.set(route, next);
  }
  if (!origin) this.log.info('Blog analytics disabled: deploy to Netlify production or set BLOG_ANALYTICS_ORIGIN.');
});
