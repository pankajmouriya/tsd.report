import type { APIRoute } from 'astro'; import { getContentMode, getHomepageEdition, isIncidentPreview } from '../lib/content'; import { toMarkdownFeed } from '../lib/feeds';
export const GET: APIRoute = () => new Response(toMarkdownFeed(getHomepageEdition(), isIncidentPreview() ? 'preview' : getContentMode()), { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
