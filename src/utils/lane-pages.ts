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
  return { id, lane, page, name: label.card ?? label.name ?? lane.name, record: label.name ?? lane.name, vendor: label.vendor ?? lane.vendor };
}

// One URL space: /<name>/ (Chinese, the default) and /en/<name>/. A name is a model, or a provider that has several lanes.
// A provider with a single lane has no page of its own (it would repeat the model page): its old
// /provider/<name>/ address redirects to that lane's model page.
//
// Two model names that are one model are listed here. Source: DeepSeek's pricing page
// (api-docs.deepseek.com/quick_start/pricing) says the model name deepseek-flash is DeepSeek-V4.1-Flash;
// owner 2026-10-06: V4.1-Flash came out on 09-10 and deepseek-flash has been it since. The lanes keep their
// recorded names and are still scored per endpoint, never merged.
// laguna-s-2.1 on two gateways is one page (owner WO site-laguna-merge-20261010): the two lanes are sections of it.
// swe-2 is one model on four lanes (owner ruling A, 2026-10-10): the ACP lane swe-2-max joins the three HTTP lanes.
const MODEL_MERGE: Record<string, string> = { 'deepseek-flash': 'deepseek', 'deepseek-v4.1-flash': 'deepseek',
  'laguna-s-2.1-free-nous': 'laguna-s-2.1', 'laguna-s-2.1-free-commandcode': 'laguna-s-2.1', 'swe-2-max': 'swe-2' };
export const MODEL_TITLE: Record<string, string> = { deepseek: 'deepseek-flash', 'laguna-s-2.1': 'laguna-s-2.1', 'swe-2': 'swe-2' };
// Pages that compare exactly two lanes of one model: a per-case table side by side and a divergence list.
export const PAIR_PAGE: Record<string, { h1: { zh: string; en: string } }> = {
  'laguna-s-2.1': { h1: { zh: 'laguna-s-2.1 · 2 条道', en: 'laguna-s-2.1 · 2 lanes' } },
};
export const MODEL_NOTE: Record<string, { href: string }> = { deepseek: { href: 'https://api-docs.deepseek.com/quick_start/pricing' } };
// Footnote on a provider page: why two lanes of one account pool differ (owner, 2026-10-10). Display text only.
export const PROVIDER_NOTE: Record<string, { zh: string; en: string }> = {
  devin: {
    zh: '两条道用的是同一个 Devin Max 账号池，区别在调用方式。swe-2-max (ACP)：经 Devin 智能体客户端外壳发出，请求前带系统前缀；W37 测试时图片输入会被静默丢弃；它名字里的 max 是旧模型名的一部分，不是推理档位。swe-2-max (API)、swe-2-medium (API)、swe-2-high (API)：普通的 chat/completions 调用，没有智能体外壳，图片输入真实可用。',
    en: 'Both lanes draw on the same Devin Max account pool; they differ in how the model is called. swe-2-max (ACP) goes through the Devin agent client shell: a system prefix is attached, images were silently dropped during the W37 sitting, and its "max" is part of the legacy model name, not a reasoning tier. swe-2-max (API), swe-2-medium (API) and swe-2-high (API) are plain chat/completions calls to the model, with no agent shell and with true vision.',
  },
};
export const canonModel = (slug: string) => MODEL_MERGE[slug] ?? slug;

export const modelSlugs = () => [...new Set(pageLaneIds.map((id) => canonModel(lanesData[id].model_slug)))];
export const providerSlugs = () => [...new Set(pageLaneIds.map((id) => lanesData[id].provider_slug))];
export const lanesOfModel = (slug: string) => pageLaneIds.filter((id) => canonModel(lanesData[id].model_slug) === slug);
export const lanesOfProvider = (slug: string) => pageLaneIds.filter((id) => lanesData[id].provider_slug === slug);
export const modelSlugOf = (id: string) => (lanesData[id] ? canonModel(lanesData[id].model_slug) : undefined) as string | undefined;
/** The model-group table: lane id -> model key. The board's chips, counts and tier titles all read this one map. */
export const modelKeyByLane = () => Object.fromEntries(pageLaneIds.map((id) => [id, modelSlugOf(id)]));
/** Providers with at least two lanes keep a page; the others are redirects to their model page. */
export const providerHasPage = (slug: string) => lanesOfProvider(slug).length > 1;
export const providerPageSlugs = () => providerSlugs().filter(providerHasPage);

const RESERVED = new Set(['en', 'zh', 'rank', 'method', 'notes', 'claim', 'amber', 'model', 'provider', 'assets', 'astro-preview', '404']);
const models = modelSlugs();
export const entitySlugs = () => [...models, ...providerPageSlugs()];
for (const s of providerPageSlugs()) if (models.includes(s)) throw new Error(`name ${s} is both a model and a provider page`);
for (const s of entitySlugs()) if (RESERVED.has(s)) throw new Error(`name ${s} collides with a site path`);
export const entityKind = (slug: string) => (models.includes(slug) ? 'model' : 'provider');

export const entityPath = (lang: Lang, slug: string) => `/${lang === 'en' ? 'en/' : ''}${slug}/`;
export const modelPath = (lang: Lang, slug: string) => entityPath(lang, canonModel(slug));
/** Where a provider's address leads: its own page, or (single lane) the model page, at that lane's block when the model has several. */
export function providerPath(lang: Lang, slug: string) {
  if (providerHasPage(slug)) return entityPath(lang, slug);
  const id = lanesOfProvider(slug)[0];
  const m = modelSlugOf(id)!;
  return entityPath(lang, m) + (lanesOfModel(m).length > 1 ? `#lane-${id}` : '');
}

/** Every model slug as recorded (before merging): the old /model/<slug>/ addresses. */
export const rawModelSlugs = () => [...new Set(pageLaneIds.map((id) => lanesData[id].model_slug as string))];
