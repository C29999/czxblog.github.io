import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { authorize, errorResponse, HttpError, privateHeaders } from './blog-analytics.mjs';

const files = new Map([
  ['/blog', ['blog-dashboard.html', 'text/html']],
  ['/blog/', ['blog-dashboard.html', 'text/html']],
  ['/.netlify/functions/blog-admin', ['blog-dashboard.html', 'text/html']],
  ['/blog/dashboard.css', ['blog-dashboard.css', 'text/css']],
  ['/blog/dashboard.js', ['blog-dashboard.js', 'text/javascript']],
]);

export async function admin(request, context, env) {
  try {
    authorize(context, env);
    if (!['GET', 'HEAD'].includes(request.method)) throw new HttpError(405, '仅接受 GET');
    const file = files.get(new URL(request.url).pathname);
    if (!file) throw new HttpError(404, '页面不存在');
    const body = request.method === 'HEAD' ? null : await readFile(join(process.cwd(), 'netlify/private', file[0]));
    return new Response(body, { headers: privateHeaders({
      'Content-Type': `${file[1]}; charset=utf-8`,
      'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
      'X-Frame-Options': 'DENY',
    }) });
  } catch (error) { return errorResponse(error); }
}
