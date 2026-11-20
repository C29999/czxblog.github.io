import { createHash } from 'node:crypto';
import { isIP } from 'node:net';

export const RETENTION_DAYS = 90;
const DAY_MS = 86400000;
const MAX_DETAILS = 200;
const MAX_RECORDS = 5000;
const headers = {
  'Cache-Control': 'private, no-store, max-age=0',
  'Netlify-CDN-Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function response(body, status = 200, extra = {}) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8', ...extra },
  });
}

export function privateHeaders(extra = {}) { return { ...headers, ...extra }; }

// Canonicalize IPv6 and IPv4-mapped IPv6 before comparing. Never trust request headers.
export function normalizeIP(value) {
  if (typeof value !== 'string' || !isIP(value.trim())) return null;
  const ip = value.trim();
  if (ip.includes('%')) return null;
  if (isIP(ip) === 4) return ip;
  const canonical = new URL(`http://[${ip}]/`).hostname.slice(1, -1);
  const mapped = canonical.match(/^::ffff:([\da-f]{1,4}):([\da-f]{1,4})$/);
  if (!mapped) return canonical;
  const high = parseInt(mapped[1], 16), low = parseInt(mapped[2], 16);
  return `${high >>> 8}.${high & 255}.${low >>> 8}.${low & 255}`;
}

export function ownerIPs(env) {
  const values = (env.BLOG_OWNER_IPS || '').split(/[\s,]+/).filter(Boolean);
  const ips = values.map(normalizeIP);
  if (!ips.length || ips.some(ip => !ip)) throw new HttpError(503, '尚未正确配置后台 IP 白名单');
  return new Set(ips);
}

export function authorize(context, env) {
  const owners = ownerIPs(env);
  const ip = normalizeIP(context?.ip);
  if (!ip || !owners.has(ip)) throw new HttpError(403, '此 IP 无权访问后台');
  return ip;
}

export function dateKey(time = Date.now()) {
  // Fixed UTC+8 matches the blog's Asia/Shanghai reporting day.
  return new Date(Number(time) + 8 * 3600000).toISOString().slice(0, 10);
}

export function daysInRange(days, now = Date.now()) {
  return Array.from({ length: days }, (_, index) => dateKey(now - (days - index - 1) * DAY_MS));
}

export function originsFor(request, env) {
  const own = new URL(request.url).origin;
  const origins = (env.BLOG_ALLOWED_ORIGINS || '').split(/[\s,]+/).filter(Boolean);
  for (const item of origins) {
    let url;
    try { url = new URL(item); } catch { throw new HttpError(503, '统计来源配置无效'); }
    if (url.origin !== item || url.protocol !== 'https:') throw new HttpError(503, '统计来源配置无效');
  }
  return new Set([own, ...origins]);
}

function validateOrigin(request, env) {
  const origin = request.headers.get('Origin');
  if (!origin || !originsFor(request, env).has(origin)) throw new HttpError(403, '不允许此来源');
  return { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' };
}

function cleanPath(value) {
  if (typeof value !== 'string' || value.length > 1000 || !value.startsWith('/') || value.startsWith('//') || /[\\\x00-\x20]/.test(value)) {
    throw new HttpError(400, '页面路径无效');
  }
  const path = new URL(value, 'https://blog.invalid').pathname;
  if (/^\/(?:blog(?:\/|$)|api\/blog(?:\/|$)|\.netlify\/functions\/blog-)/i.test(path)) throw new HttpError(400, '不统计后台页面');
  return path;
}

export function validateEvent(input, origin) {
  if (!input || !['view', 'click'].includes(input.type) || typeof input.id !== 'string' || !/^[\w-]{16,80}$/.test(input.id)) {
    throw new HttpError(400, '事件无效');
  }
  const event = { id: input.id, type: input.type, path: cleanPath(input.path) };
  if (event.type === 'click') {
    if (typeof input.target !== 'string' || input.target.length > 1000) throw new HttpError(400, '点击目标无效');
    if (/^button:[\w-]{1,80}$/.test(input.target)) event.target = input.target;
    else {
      let target;
      try { target = new URL(input.target, origin); } catch { throw new HttpError(400, '点击目标无效'); }
      if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password) throw new HttpError(400, '点击目标无效');
      event.target = target.origin === origin ? target.pathname : target.origin + target.pathname;
    }
  }
  return event;
}

async function readEvent(request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') || '')) throw new HttpError(415, '仅接受 JSON');
  if (Number(request.headers.get('Content-Length')) > 4096) throw new HttpError(413, '事件过大');
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, '事件为空');
  const chunks = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) { await reader.cancel(); throw new HttpError(413, '事件过大'); }
      chunks.push(Buffer.from(value));
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'JSON 无效');
  }
}

function increment(details, key, record) {
  const existing = details.find(item => item.key === key);
  if (existing) existing.count++;
  else if (details.length < MAX_DETAILS) details.push({ key, count: 1 });
  else record.detailOverflow++;
}

export async function recordEvent(store, ip, event, now = Date.now()) {
  const date = dateKey(now);
  const hash = createHash('sha256').update(ip).digest('hex');
  const key = `days/${date}/${hash}`;
  for (let attempt = 0; attempt < 8; attempt++) {
    const previous = await store.getWithMetadata(key, { type: 'json' });
    if (previous && !previous.etag) throw new HttpError(503, '统计存储版本不可用');
    const record = previous?.data || {
      date, ip, views: 0, clicks: 0, firstSeen: now, lastSeen: now,
      pages: [], targets: [], recentIds: [], detailOverflow: 0, minute: 0, minuteCount: 0,
    };
    if (record.recentIds.includes(event.id)) return;
    const minute = Math.floor(now / 60000);
    if (record.minute !== minute) { record.minute = minute; record.minuteCount = 0; }
    if (record.minuteCount >= 120) throw new HttpError(429, '访问频率过高');
    record.minuteCount++;
    record.lastSeen = Math.max(record.lastSeen, now);
    record.firstSeen = Math.min(record.firstSeen, now);
    record.recentIds = [...record.recentIds.slice(-127), event.id];
    if (event.type === 'view') { record.views++; increment(record.pages, event.path, record); }
    else { record.clicks++; increment(record.targets, JSON.stringify([event.path, event.target]), record); }
    const result = await store.setJSON(key, record, previous ? { onlyIfMatch: previous.etag } : { onlyIfNew: true });
    if (result.modified) return;
    await new Promise(resolve => setTimeout(resolve, 5 + Math.random() * 20 * (attempt + 1)));
  }
  throw new HttpError(503, '统计繁忙，请稍后重试');
}

export async function track(request, context, env, getStore, now = Date.now()) {
  let cors = {};
  try {
    cors = validateOrigin(request, env);
    if (request.method === 'OPTIONS') return response(null, 204, {
      ...cors, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type',
    });
    if (request.method !== 'POST') throw new HttpError(405, '仅接受 POST');
    const owners = ownerIPs(env);
    const ip = normalizeIP(context?.ip);
    if (!ip) throw new HttpError(503, '无法读取访问 IP');
    // Deliberately identical acknowledgement for owners and visitors.
    if (owners.has(ip)) return response(null, 204, cors);
    const event = validateEvent(await readEvent(request), request.headers.get('Origin'));
    await recordEvent(getStore(), ip, event, now);
    return response(null, 204, cors);
  } catch (error) { return errorResponse(error, cors); }
}

export function errorResponse(error, extra = {}) {
  // Never send SDK errors, tokens, or raw request details back to visitors.
  return response({ error: error instanceof HttpError ? error.message : '统计服务暂不可用' }, error instanceof HttpError ? error.status : 503, extra);
}

async function mapLimited(items, callback, concurrency = 12) {
  let cursor = 0;
  return Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) { const item = items[cursor++]; await callback(item); }
  }));
}

export async function report(store, owners, days, now = Date.now()) {
  const dates = daysInRange(days, now);
  const daily = new Map(dates.map(date => [date, { date, views: 0, clicks: 0, ips: new Set() }]));
  const keys = [];
  // Bound list requests as well as reads; never return silently partial totals.
  for (const date of dates) {
    for await (const page of store.list({ prefix: `days/${date}/`, paginate: true })) {
      keys.push(...page.blobs.map(blob => blob.key));
      if (keys.length > MAX_RECORDS) throw new HttpError(422, '数据超过单次查询上限，请缩小日期范围');
    }
  }
  const visitors = new Map(), pages = new Map(), targets = new Map();
  let views = 0, clicks = 0, detailOverflow = 0;
  await mapLimited(keys, async key => {
    const data = await store.get(key, { type: 'json' });
    if (!data || owners.has(normalizeIP(data.ip))) return;
    const day = daily.get(data.date);
    if (!day) return;
    views += data.views; clicks += data.clicks; detailOverflow += data.detailOverflow;
    day.views += data.views; day.clicks += data.clicks; day.ips.add(data.ip);
    const visitor = visitors.get(data.ip) || { ip: data.ip, views: 0, clicks: 0, firstSeen: data.firstSeen, lastSeen: data.lastSeen };
    visitor.views += data.views; visitor.clicks += data.clicks;
    visitor.firstSeen = Math.min(visitor.firstSeen, data.firstSeen); visitor.lastSeen = Math.max(visitor.lastSeen, data.lastSeen);
    visitors.set(data.ip, visitor);
    for (const item of data.pages) pages.set(item.key, (pages.get(item.key) || 0) + item.count);
    for (const item of data.targets) targets.set(item.key, (targets.get(item.key) || 0) + item.count);
  });
  const ranked = map => [...map].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count).slice(0, 100);
  return {
    generatedAt: now, timezone: 'Asia/Shanghai', days, retentionDays: RETENTION_DAYS,
    totals: { views, clicks, visitors: visitors.size }, detailOverflow,
    daily: [...daily.values()].map(({ ips, ...day }) => ({ ...day, visitors: ips.size })),
    pages: ranked(pages), targets: ranked(targets).map(({ key, count }) => ({ path: JSON.parse(key)[0], target: JSON.parse(key)[1], count })),
    visitors: [...visitors.values()].sort((a, b) => b.lastSeen - a.lastSeen),
    rankingLimit: 100,
  };
}

export async function stats(request, context, env, getStore, now = Date.now()) {
  try {
    const currentIP = authorize(context, env);
    if (request.method !== 'GET') throw new HttpError(405, '仅接受 GET');
    const days = Number(new URL(request.url).searchParams.get('days') || '7');
    if (![1, 7, 30, 90].includes(days)) throw new HttpError(400, '日期范围无效');
    return response({ ...await report(getStore(), ownerIPs(env), days, now), currentIP });
  } catch (error) { return errorResponse(error); }
}

export async function cleanup(store, now = Date.now()) {
  const cutoff = daysInRange(RETENTION_DAYS, now)[0];
  let deleted = 0;
  // Enumerate day directories, then delete only complete expired days.
  for await (const page of store.list({ prefix: 'days/', directories: true, paginate: true })) {
    for (const prefix of page.directories) {
      const match = prefix.match(/^days\/(\d{4}-\d{2}-\d{2})\/$/);
      if (!match || match[1] >= cutoff) continue;
      for await (const batch of store.list({ prefix, paginate: true })) {
        await mapLimited(batch.blobs, async blob => { await store.delete(blob.key); deleted++; });
      }
    }
  }
  return deleted;
}
