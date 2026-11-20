const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readFileSync } = require('node:fs');
const { randomUUID } = require('node:crypto');
const { analyticsOrigin } = require('../lib/blog-tracker-build.cjs');
const source = readFileSync('source/js/blog-tracker.js', 'utf8');

function browser(pathname = '/posts/hello/') {
  const requests = [], handlers = {};
  const window = { addEventListener: (name, fn) => { handlers[name] = fn; } }; window.top = window; window.self = window;
  const document = { currentScript: { dataset: { api: 'https://backend.example' } }, visibilityState: 'visible', addEventListener: (name, fn) => { handlers[name] = fn; } };
  const context = vm.createContext({ window, document, location: { pathname, origin: 'https://blog.example', href: `https://blog.example${pathname}?token=secret#one` }, URL, crypto: { randomUUID }, Date,
    fetch: (url, options) => { requests.push({ url: String(url), ...options, event: JSON.parse(options.body) }); return Promise.resolve(); } });
  vm.runInContext(source, context);
  return { requests, handlers, context };
}

test('tracker sends one page view with no query, uses backend origin, and ignores duplicate initialization', () => {
  const b = browser();
  vm.runInContext(source, b.context);
  assert.equal(b.requests.length, 1);
  assert.equal(b.requests[0].event.path, '/posts/hello/');
  assert.equal(b.requests[0].url, 'https://backend.example/api/blog/track');
  assert.equal(b.requests[0].credentials, 'omit');
  b.handlers.pageshow({ persisted: false }); assert.equal(b.requests.length, 1);
  b.handlers.pageshow({ persisted: true }); assert.equal(b.requests.length, 2);
});

test('click tracking strips URL parameters, omits forms and synthetic clicks', () => {
  const b = browser();
  const control = { closest: () => null, matches: () => true, getAttribute: () => '/next/?email=secret#x' };
  const event = { isTrusted: true, target: { closest: () => control } };
  b.handlers.click(event);
  assert.equal(b.requests[1].event.target, '/next/');
  b.handlers.click(event); assert.equal(b.requests.length, 2);
  b.handlers.click({ ...event, isTrusted: false }); assert.equal(b.requests.length, 2);
  control.closest = () => ({}); b.handlers.click(event); assert.equal(b.requests.length, 2);
});

test('admin paths never generate events', () => {
  assert.equal(browser('/blog/').requests.length, 0);
  assert.equal(browser('/api/blog/stats').requests.length, 0);
});

test('Netlify preview builds ignore even an explicitly inherited production backend', () => {
  const env = { NETLIFY: 'true', BLOG_ANALYTICS_ORIGIN: 'https://backend.example', URL: 'https://blog.example' };
  for (const CONTEXT of ['deploy-preview', 'branch-deploy', 'dev', undefined]) {
    assert.equal(analyticsOrigin({ ...env, CONTEXT }), '');
  }
  assert.equal(analyticsOrigin({ ...env, CONTEXT: 'production' }), env.BLOG_ANALYTICS_ORIGIN);
  assert.equal(analyticsOrigin({ BLOG_ANALYTICS_ORIGIN: env.BLOG_ANALYTICS_ORIGIN }), env.BLOG_ANALYTICS_ORIGIN);
});

test('Hexo refreshes cached HTML routes when analytics is disabled or its origin changes', async () => {
  const Router = require('hexo/dist/hexo/router');
  const route = new Router();
  const env = { BLOG_ANALYTICS_ORIGIN: 'https://old-backend.example' };
  const html = '<html><body>Standalone page</body></html>';
  let afterGenerate;
  vm.runInNewContext(readFileSync('scripts/blog-analytics.js', 'utf8'), {
    hexo: { extend: { filter: { register(name, fn) { assert.equal(name, 'after_generate'); afterGenerate = fn; } } } },
    require: () => require('../lib/blog-tracker-build.cjs'), process: { env }, Buffer
  });
  const context = { route, log: { info() {} } };
  const readRoute = async name => {
    const chunks = [];
    for await (const chunk of route.get(name)) chunks.push(chunk);
    return Buffer.concat(chunks).toString('utf8');
  };
  route.set('standalone.html', { data: html, modified: false });
  route.set('unrelated.txt', { data: 'unchanged', modified: false });
  await afterGenerate.call(context);
  assert.match(await readRoute('standalone.html'), /old-backend\.example/);

  // A skip_render source is unchanged on the next build, but public/ still
  // contains the previous injected output. Hexo must recheck its output hash.
  route.set('standalone.html', { data: html, modified: false });
  delete env.BLOG_ANALYTICS_ORIGIN;
  await afterGenerate.call(context);
  assert.equal(route.isModified('standalone.html'), true);
  assert.equal(await readRoute('standalone.html'), html);
  assert.equal(route.isModified('unrelated.txt'), false);

  env.BLOG_ANALYTICS_ORIGIN = 'https://new-backend.example';
  await afterGenerate.call(context);
  await afterGenerate.call(context);
  const updated = await readRoute('standalone.html');
  assert.match(updated, /new-backend\.example/);
  assert.doesNotMatch(updated, /old-backend\.example/);
  assert.equal((updated.match(/data-blog-tracker=/g) || []).length, 1);
});
