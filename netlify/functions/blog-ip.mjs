import { normalizeIP, response } from '../lib/blog-analytics.mjs';

// Public setup endpoint: reveals only this request's IP, never the allowlist or visitor data.
export default (request, context) => {
  if (request.method !== 'GET') return response({ error: '仅接受 GET' }, 405);
  const ip = normalizeIP(context?.ip);
  return ip ? response({ ip }) : response({ error: '无法读取访问 IP' }, 503);
};
export const config = { path: '/api/blog/ip' };
