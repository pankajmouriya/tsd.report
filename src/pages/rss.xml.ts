import type { APIRoute } from 'astro'; import { getContentMode, getHomepageEdition, isIncidentPreview } from '../lib/content'; import { toRss } from '../lib/feeds';
export const GET: APIRoute = () => new Response(toRss(getHomepageEdition(), isIncidentPreview() ? 'preview' : getContentMode()), { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
