import type { APIRoute } from 'astro'; import { getContentMode, getFeedEdition, isIncidentPreview } from '../lib/content'; import { toRss } from '../lib/feeds';
export const GET: APIRoute = () => new Response(toRss(getFeedEdition(), isIncidentPreview() ? 'preview' : getContentMode()), { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
