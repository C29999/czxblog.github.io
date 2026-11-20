import { stats } from '../lib/blog-analytics.mjs';
import { environment, analyticsStore } from '../lib/blog-runtime.mjs';

export default (request, context) => stats(request, context, environment(), analyticsStore);
export const config = { path: '/api/blog/stats' };
