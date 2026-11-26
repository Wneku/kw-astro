import type { APIContext } from 'astro';
import { sitemapResponse } from '../lib/sitemap';

export const GET = ({ site }: APIContext) => sitemapResponse('page', site!);
