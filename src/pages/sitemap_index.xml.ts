import type { APIContext } from 'astro';
import { sitemapIndexResponse } from '../lib/sitemap';

/** Spis map witryny – adres zgłoszony w Google Search Console (ten sam co w Rank Math). */
export const GET = ({ site }: APIContext) => sitemapIndexResponse(site!);
