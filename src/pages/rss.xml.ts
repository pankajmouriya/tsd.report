import type { APIRoute } from 'astro'; import { getLatestEdition } from '../lib/content'; import { toRss } from '../lib/feeds';
export const GET: APIRoute = () => new Response(toRss(getLatestEdition()), { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
