import { cleanup, response, errorResponse } from '../lib/blog-analytics.mjs';
import { analyticsStore } from '../lib/blog-runtime.mjs';

export default async () => {
  try { return response({ deleted: await cleanup(analyticsStore()) }); }
  catch (error) { return errorResponse(error); }
};
// Netlify scheduled functions are not exposed to ordinary HTTP requests in production.
export const config = { schedule: '20 20 * * *' };
