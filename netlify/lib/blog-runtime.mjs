import { getStore } from '@netlify/blobs';

export function environment() {
  const read = key => globalThis.Netlify?.env?.get(key) ?? process.env[key];
  return { BLOG_OWNER_IPS: read('BLOG_OWNER_IPS'), BLOG_ALLOWED_ORIGINS: read('BLOG_ALLOWED_ORIGINS') };
}

export function analyticsStore() {
  return getStore({ name: 'blog-analytics-v1', consistency: 'strong' });
}
