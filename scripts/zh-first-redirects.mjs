import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

async function htmlFiles(root, relative = '') {
  const result = [];
  for (const item of await readdir(join(root, relative), { withFileTypes: true })) {
    const name = relative + item.name;
    if (item.isDirectory()) result.push(...await htmlFiles(root, `${name}/`));
    else if (name.endsWith('.html')) result.push(name);
  }
  return result;
}

const escape = (value) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');

// Static Astro redirects alone are HTTP 200. Emit a deployable Caddy include and a
// machine-readable map, alongside no-JS fallback pages. The release must import the
// include before file_server; build never edits a running server.
//
// Chinese is the default language: every built page lives at its plain address (and under
// /en/ for the English twin). Each build enumerates the whole inventory itself and rewrites
// the old /zh/... addresses to their plain equivalent, so a page added after this flip is
// still reached from its legacy /zh/ URL instead of a 404.
export default function zhFirstRedirects(base) {
  const prefix = base === '/' ? '' : base.replace(/\/$/, '');
  return {
    name: 'zh-first-redirects',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        const root = fileURLToPath(dir);
        const redirects = {};
        const legacyChinese = [];
        const fallback = async (from, to) => {
          const filename = join(root, from.replace(/^\//, ''), 'index.html');
          await mkdir(join(filename, '..'), { recursive: true });
          const target = prefix + to;
          const canonical = new URL(target.split('#')[0], 'https://askclaw.dev').href;
          await writeFile(filename, `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="robots" content="noindex"><title>Moved — AskClaw</title><link rel="canonical" href="${escape(canonical)}"><meta http-equiv="refresh" content="0; url=${escape(target)}"></head><body><a href="${escape(target)}">→ ${escape(target)}</a></body></html>\n`);
        };
        // Retired per-lane addresses (owner WO site-laguna-merge-20261010): the two laguna lanes now sit as
        // sections of /laguna-s-2.1/. Each old address is a 301 to its section, with a no-JS fallback page.
        const MOVED = {
          '/laguna-s-2.1-free-nous/': '/laguna-s-2.1/#lane-laguna-np',
          '/laguna-s-2.1-free-commandcode/': '/laguna-s-2.1/#lane-laguna-cc',
          '/en/laguna-s-2.1-free-nous/': '/en/laguna-s-2.1/#lane-laguna-np',
          '/en/laguna-s-2.1-free-commandcode/': '/en/laguna-s-2.1/#lane-laguna-cc',
        };
        for (const [from, to] of Object.entries(MOVED)) {
          redirects[from] = to;
          const filename = join(root, from.replace(/^\//, ''), 'index.html');
          await mkdir(join(filename, '..'), { recursive: true });
          const canonical = new URL(to.split('#')[0], 'https://askclaw.dev').href;
          const en = from.startsWith('/en/');
          await writeFile(filename, `<!doctype html><html lang="${en ? 'en' : 'zh-CN'}"><head><meta charset="UTF-8"><meta name="robots" content="noindex"><title>${en ? 'Moved' : '已迁移'} — AskClaw</title><link rel="canonical" href="${escape(canonical)}"><meta property="og:image" content="https://askclaw.dev/assets/top5-2026-w41b.en.webp"><meta http-equiv="refresh" content="0; url=${escape(prefix + to)}"></head><body><p><a href="${escape(prefix + to)}">${en ? 'This page moved' : '此页已迁移'}</a></p></body></html>\n`);
        }
        for (const file of await htmlFiles(root)) {
          if (!file.endsWith('index.html') || file.startsWith('amber/')) continue;
          const path = '/' + file.slice(0, -'index.html'.length);
          if (Object.hasOwn(MOVED, path)) continue; // the retired laguna addresses: their own 301s above
          // The English twin keeps its /en/ address. Every other page is Chinese by default:
          // its old /zh/<path> address now strips the prefix to the plain path.
          if (!path.startsWith('/en/')) {
            const old = '/zh' + path;
            redirects[old] = path;
            legacyChinese.push(old);
            await fallback(old, path);
          }
          // Existing model/provider aliases retain their exact final targets,
          // including the single-lane provider's anchor, now with real HTTP 301.
          if (/^\/(?:en\/)?(?:model|provider)\//.test(path)) {
            const html = await readFile(join(root, file), 'utf8');
            const match = html.match(/<meta http-equiv="refresh" content="0; url=([^"]+)"/);
            if (!match) throw new Error(`Missing alias target: ${path}`);
            redirects[path] = match[1].slice(prefix.length);
          }
        }
        const entries = Object.entries(redirects).sort(([a], [b]) => a.localeCompare(b));
        const manifest = { schema: 'zh-first-redirects-v1', base, status: 301,
          legacyChinese: legacyChinese.sort(), redirects: Object.fromEntries(entries) };
        await writeFile(join(root, '_zh-first-redirects.json'), JSON.stringify(manifest, null, 2) + '\n');
        const lines = ['# Generated by the build. Import inside the site block, before file_server.', '# Must ship with this exact dist; no runtime configuration is changed by the build.'];
        for (const [i, [from, to]] of entries.entries()) {
          const [path, hash] = to.split('#');
          lines.push(`@zhfirst${i} path ${prefix}${from} ${prefix}${from.slice(0, -1)} ${prefix}${from}index.html`);
          lines.push(`redir @zhfirst${i} ${prefix}${path}{http.request.uri.prefixed_query}${hash ? '#' + hash : ''} 301`);
        }
        // Also strip /zh/ on paths added after this inventory; unknown paths still
        // reach the ordinary 404, never a language redirect loop.
        const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        lines.push(`@zhfirstRest path_regexp zhfirstRest ^${escapedPrefix}/zh/(.*)$`);
        lines.push(`redir @zhfirstRest ${prefix}/{re.zhfirstRest.1}{http.request.uri.prefixed_query} 301`);
        await writeFile(join(root, '_zh-first.caddy'), lines.join('\n') + '\n');
      },
    },
  };
}
