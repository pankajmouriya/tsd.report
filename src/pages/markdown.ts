import type { APIRoute } from 'astro'; import { getContentMode, getLatestEdition } from '../lib/content'; import { toMarkdownFeed } from '../lib/feeds';
export const GET: APIRoute = () => new Response(toMarkdownFeed(getLatestEdition(), getContentMode()), { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
