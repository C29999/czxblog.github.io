import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { authorize, cleanup, dateKey, daysInRange, normalizeIP, ownerIPs, recordEvent, report, stats, track, validateEvent } from '../netlify/lib/blog-analytics.mjs';
import { admin } from '../netlify/lib/blog-admin.mjs';
import ipEndpoint from '../netlify/functions/blog-ip.mjs';
import { MemoryStore } from './support/memory-blog-store.mjs';
import build from '../lib/blog-tracker-build.cjs';

const now = Date.parse('2026-11-20T10:00:00Z');
const env = { BLOG_OWNER_IPS: '203.0.113.1, 2001:db8::1', BLOG_ALLOWED_ORIGINS: 'https://c29999.github.io' };
const owner = { ip: '203.0.113.1' }, visitor = { ip: '198.51.100.22' };
const event = (fields = {}) => ({ id: randomUUID(), type: 'view', path: '/posts/test/', ...fields });
const request = (payload, headers = {}, method = 'POST') => new Request('https://blog.example/api/blog/track', {
  method, headers: { Origin: 'https://blog.example', 'Content-Type': 'application/json', ...headers },
  ...(['GET', 'HEAD', 'OPTIONS'].includes(method) ? {} : { body: JSON.stringify(payload) }),
});

test('IP normalization compares IPv6 and mapped IPv4, fails closed on malformed allowlists', () => {
  assert.equal(normalizeIP('2001:0DB8:0:0:0:0:0:1'), '2001:db8::1');
  assert.equal(normalizeIP('::ffff:203.0.113.1'), '203.0.113.1');
  for (const ip of ['garbage', '127.0.0.1:4000', '203.0.113.1, 1.2.3.4', 'fe80::1%eth0', '', undefined]) assert.equal(normalizeIP(ip), null);
  for (const ips of ['', '203.0.113.1,garbage', '203.0.113.0/24']) assert.throws(() => ownerIPs({ BLOG_OWNER_IPS: ips }), { status: 503 });
  assert.equal(authorize({ ip: '2001:0db8:0:0:0:0:0:1' }, env), '2001:db8::1');
});

test('owner visits and clicks do not open storage; missing config disables collection', async () => {
  const never = () => { throw new Error('Storage must not be opened'); };
  for (const type of ['view', 'click']) assert.equal((await track(request(event({ type })), owner, env, never, now)).status, 204);
  assert.equal((await track(request(event()), visitor, {}, never, now)).status, 503);
  assert.equal((await track(request(event()), {}, env, never, now)).status, 503);
});

test('dashboard, assets, stats, and direct function URL reject spoofed forwarding headers', async () => {
  const spoof = { 'x-forwarded-for': owner.ip, 'x-nf-client-connection-ip': owner.ip, 'cf-connecting-ip': owner.ip };
  for (const path of ['/blog', '/blog/', '/blog/dashboard.js', '/blog/dashboard.css', '/.netlify/functions/blog-admin']) {
    const req = new Request(`https://blog.example${path}`, { headers: spoof });
    assert.equal((await admin(req, visitor, env)).status, 403);
    assert.equal((await admin(req, owner, {})).status, 503);
    const allowed = await admin(req, owner, env);
    assert.equal(allowed.status, 200);
    assert.match(allowed.headers.get('Cache-Control'), /no-store/);
    assert.match(allowed.headers.get('Content-Security-Policy'), /frame-ancestors 'none'/);
  }
  const res = await stats(new Request('https://blog.example/api/blog/stats', { headers: spoof }), visitor, env, () => { throw new Error('No read allowed'); });
  assert.equal(res.status, 403);
  assert.equal((await admin(new Request('https://blog.example/blog/unknown'), owner, env)).status, 404);
});

test('tracking uses trusted IP despite forged headers and drops queries and fragments', async () => {
  const store = new MemoryStore();
  const res = await track(request(event({ type: 'click', path: '/posts/test/?secret=1#section', target: 'https://outside.example/a?secret=2#b' }), { 'x-forwarded-for': owner.ip }), visitor, env, () => store, now);
  assert.equal(res.status, 204);
  const data = [...store.data.values()][0].data;
  assert.equal(data.ip, visitor.ip);
  assert.deepEqual(JSON.parse(data.targets[0].key), ['/posts/test/', 'https://outside.example/a']);
  assert.equal(JSON.stringify(data).includes('secret'), false);
});

test('origin, content type, size, and event validation reject invalid data without writes', async () => {
  const store = new MemoryStore(), getStore = () => store;
  assert.equal((await track(request(event(), { Origin: 'https://evil.example' }), visitor, env, getStore)).status, 403);
  assert.equal((await track(request(event(), { Origin: 'null' }), visitor, env, getStore)).status, 403);
  assert.equal((await track(request(event(), { 'Content-Type': 'text/plain' }), visitor, env, getStore)).status, 415);
  assert.equal((await track(request({ padding: 'a'.repeat(5000) }), visitor, env, getStore)).status, 413);
  for (const payload of [event({ type: 'other' }), event({ id: 'short' }), event({ path: '//evil.example/' }), event({ path: '/blog/' }), event({ path: '/a/../blog/' }), event({ type: 'click', target: 'javascript:alert(1)' })]) {
    assert.equal((await track(request(payload), visitor, env, getStore)).status, 400);
  }
  assert.equal(store.data.size, 0);
  const preflight = await track(request(null, { Origin: 'https://c29999.github.io' }, 'OPTIONS'), visitor, env, getStore);
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), 'https://c29999.github.io');
  const cross = await track(request(event(), { Origin: 'https://c29999.github.io' }), visitor, env, getStore, now);
  assert.equal(cross.status, 204);
  assert.equal(cross.headers.get('Access-Control-Allow-Origin'), 'https://c29999.github.io');
});

test('deduplication and conditional writes preserve concurrent counts', async () => {
  const store = new MemoryStore();
  const duplicate = event();
  await Promise.all(Array.from({ length: 12 }, () => recordEvent(store, visitor.ip, duplicate, now)));
  assert.equal([...store.data.values()][0].data.views, 1);
  await Promise.all(Array.from({ length: 20 }, () => recordEvent(store, visitor.ip, event(), now)));
  assert.equal([...store.data.values()][0].data.views, 21);
  assert.equal(store.data.size, 1);
});

test('per-IP rate limits and bounded details retain accurate totals', async () => {
  const store = new MemoryStore();
  for (let index = 0; index < 120; index++) await recordEvent(store, visitor.ip, event(), now);
  await assert.rejects(recordEvent(store, visitor.ip, event(), now), { status: 429 });
  for (let index = 0; index < 205; index++) await recordEvent(store, visitor.ip, event({ path: `/p${index}/` }), now + (index + 1) * 60000);
  const data = [...store.data.values()][0].data;
  assert.equal(data.views, 325); assert.equal(data.pages.length, 200); assert.equal(data.detailOverflow, 6);
});

test('reports deduplicate IPs across days and exclude newly allowlisted historical IPs', async () => {
  const store = new MemoryStore();
  for (const time of [now - 86400000, now]) {
    await recordEvent(store, visitor.ip, event(), time);
    await recordEvent(store, owner.ip, event(), time);
  }
  await recordEvent(store, visitor.ip, validateEvent(event({ type: 'click', target: 'button:search' }), 'https://blog.example'), now);
  const res = await stats(new Request('https://blog.example/api/blog/stats?days=7'), owner, env, () => store, now);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.deepEqual(data.totals, { views: 2, clicks: 1, visitors: 1 });
  assert.equal(data.daily.length, 7); assert.equal(data.visitors[0].ip, visitor.ip);
  assert.equal(data.targets[0].target, 'button:search');
  assert.equal((await stats(new Request('https://blog.example/api/blog/stats?days=1000'), owner, env, () => store)).status, 400);
});

test('query limit reports an error instead of incomplete totals; unexpected SDK errors stay private', async () => {
  const store = { async *list() { yield { blobs: Array.from({ length: 5001 }, (_, i) => ({ key: String(i) })) }; } };
  await assert.rejects(report(store, new Set(), 1, now), { status: 422 });
  const res = await stats(new Request('https://blog.example/api/blog/stats'), owner, env, () => { throw new Error('secret-token'); });
  assert.equal(res.status, 503); assert.equal((await res.text()).includes('secret-token'), false);
});

test('retention uses Shanghai dates and deletes only expired complete days', async () => {
  assert.equal(dateKey(Date.parse('2026-11-20T16:00:00Z')), '2026-11-21');
  const store = new MemoryStore();
  for (const offset of [0, 89, 90, 100]) await recordEvent(store, visitor.ip, event(), now - offset * 86400000);
  assert.equal(await cleanup(store, now), 2);
  assert.deepEqual([...store.data.values()].map(x => x.data.date).sort(), [daysInRange(90, now)[0], dateKey(now)]);
});

test('setup endpoint discloses only the actual requesting IP', async () => {
  const res = await ipEndpoint(new Request('https://blog.example/api/blog/ip', { headers: { 'x-forwarded-for': owner.ip } }), visitor);
  assert.deepEqual(await res.json(), { ip: visitor.ip });
  assert.match(res.headers.get('Cache-Control'), /no-store/);
});

test('build injects once into standalone and nested pages and disables unconfigured static builds', async () => {
  const html = '<!doctype html><html><body>文章</body></html>';
  const origin = 'https://backend.example';
  const first = build.injectTracker(html, 'interview/lesson/index.html', origin);
  assert.match(first, /src="\.\.\/\.\.\/js\/blog-tracker.js/);
  assert.equal(build.injectTracker(first, 'interview/lesson/index.html', origin), first);
  assert.equal(build.injectTracker(first, 'interview/lesson/index.html', ''), html);
  assert.equal(build.injectTracker(html, 'blog/index.html', origin), html);
  assert.equal(build.analyticsOrigin({}), '');
  assert.equal(build.analyticsOrigin({ NETLIFY: 'true', CONTEXT: 'deploy-preview', URL: origin }), '');
  assert.equal(build.analyticsOrigin({ NETLIFY: 'true', CONTEXT: 'production', URL: origin }), origin);
  assert.equal(build.analyticsOrigin({ BLOG_ANALYTICS_ORIGIN: origin }), origin);
  assert.throws(() => build.analyticsOrigin({ BLOG_ANALYTICS_ORIGIN: 'https://backend.example/path' }));
  const dashboard = await readFile('netlify/private/blog-dashboard.html', 'utf8');
  assert.equal(dashboard.includes('blog-tracker'), false);
});
