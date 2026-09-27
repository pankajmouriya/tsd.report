import type { APIRoute } from 'astro'; import { getContentMode, getLatestEdition } from '../lib/content'; import { toRss } from '../lib/feeds';
export const GET: APIRoute = () => new Response(toRss(getLatestEdition(), getContentMode()), { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
