// Local-only preview. In-memory fictional data; never imported by production functions.
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { admin } from '../netlify/lib/blog-admin.mjs';
import { recordEvent, stats } from '../netlify/lib/blog-analytics.mjs';
import { MemoryStore } from '../tests/support/memory-blog-store.mjs';

const store = new MemoryStore();
const env = { BLOG_OWNER_IPS: '127.0.0.1,::1' };
const now = Date.now();
for (let day = 0; day < 7; day++) {
  for (let index = 0; index < 24 + day * 7; index++) {
    const ip = `192.0.2.${index % 30 + 1}`;
    await recordEvent(store, ip, { id: randomUUID(), type: index % 4 ? 'view' : 'click', path: ['/posts/embedded-foundations/', '/interview/', '/'][index % 3], target: '/posts/embedded-comms/' }, now - day * 86400000 + index * 1000);
  }
}
const server = createServer(async (req, res) => {
  const request = new Request(`http://127.0.0.1:4322${req.url}`, { method: req.method });
  const context = { ip: req.socket.remoteAddress };
  let result;
  if (new URL(request.url).pathname === '/api/blog/stats') {
    result = await stats(request, context, env, () => store, now);
    if (result.ok) result = new Response(JSON.stringify({ ...await result.json(), demo: true }), { headers: result.headers });
  } else result = await admin(request, context, env);
  res.writeHead(result.status, Object.fromEntries(result.headers));
  res.end(Buffer.from(await result.arrayBuffer()));
});
server.listen(4322, '127.0.0.1', () => console.log('Local analytics preview: http://127.0.0.1:4322/blog/ (fictional data)'));
