// Shared lookups for the model and provider pages. Totals and axis cells always come from axes.json;
// lane-pages.json adds the per-case records and must agree with it or the build fails.
import axesLanes from '../data/axes.json';
import pages from '../data/lane-pages.json';
import { I18N } from './picker-i18n.js';

type Lang = 'zh' | 'en';
const lanesData = (pages as any).lanes as Record<string, any>;
export const pageLaneIds: string[] = (axesLanes as any[]).map((l) => l.id).filter((id) => lanesData[id]);

export function laneInfo(id: string, lang: Lang) {
  const lane = (axesLanes as any[]).find((l) => l.id === id);
  const page = lanesData[id];
  if (!lane || !page || lane.total !== page.total || lane.n !== page.n) {
    throw new Error(`lane-pages.json disagrees with axes.json for ${id}`);
  }
  const label = (I18N as any)[lang].laneLabels?.[id] ?? {};
  return { id, lane, page, name: label.name ?? lane.name, vendor: label.vendor ?? lane.vendor };
}

export const modelSlugs = () => [...new Set(pageLaneIds.map((id) => lanesData[id].model_slug))];
export const providerSlugs = () => [...new Set(pageLaneIds.map((id) => lanesData[id].provider_slug))];
export const lanesOfModel = (slug: string) => pageLaneIds.filter((id) => lanesData[id].model_slug === slug);
export const lanesOfProvider = (slug: string) => pageLaneIds.filter((id) => lanesData[id].provider_slug === slug);
export const modelPath = (lang: Lang, slug: string) => `/${lang === 'zh' ? '' : 'en/'}model/${slug}/`;
export const providerPath = (lang: Lang, slug: string) => `/${lang === 'zh' ? '' : 'en/'}provider/${slug}/`;
export const modelSlugOf = (id: string) => lanesData[id]?.model_slug as string | undefined;
