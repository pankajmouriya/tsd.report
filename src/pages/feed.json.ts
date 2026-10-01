import type { APIRoute } from 'astro'; import { getContentMode, getLatestEdition } from '../lib/content'; import { toJsonFeed } from '../lib/feeds';
export const GET: APIRoute = () => new Response(JSON.stringify(toJsonFeed(getLatestEdition(), getContentMode()), null, 2), { headers: { 'Content-Type': 'application/feed+json; charset=utf-8' } });
