import { admin } from '../lib/blog-admin.mjs';
import { environment } from '../lib/blog-runtime.mjs';

export default (request, context) => admin(request, context, environment());
export const config = { path: ['/blog', '/blog/*'] };
