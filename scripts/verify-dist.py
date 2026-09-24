"""Verify static output and source preservation without changing either tree."""
import hashlib
from html import unescape
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import struct
import subprocess
from urllib.parse import urlparse
import xml.etree.ElementTree as ET

# Internal graph-IA language must not reach the page as visible copy (owner rule 2026-09-18:
# 图结构/点/线/面 is plumbing, never page copy; WO askclaw-astro-02 acceptance row 9).
# Ordinary domain words such as 端点 ("endpoint") and 方面 ("aspect") are approved, so match the
# whole internal terms instead of the individual characters 点/线/面, which appear inside them.
FORBIDDEN_INTERNAL_TERMS = re.compile('|'.join([
    '点线面',
    '图结构',
    '节点',
    '出边',
    '点→跳转',
]))

def webp_dimensions(data):
    """Return (width, height) of a WebP file (VP8 / VP8L / VP8X)."""
    assert data[:4] == b'RIFF' and data[8:12] == b'WEBP', 'not a WebP file'
    offset = 12
    while offset + 8 <= len(data):
        fourcc = data[offset:offset + 4]
        size = struct.unpack('<I', data[offset + 4:offset + 8])[0]
        chunk = data[offset + 8:offset + 8 + size]
        if fourcc == b'VP8X':
            return int.from_bytes(chunk[4:7], 'little') + 1, int.from_bytes(chunk[7:10], 'little') + 1
        if fourcc == b'VP8L':
            bits = int.from_bytes(chunk[1:5], 'little')
            return (bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1
        if fourcc == b'VP8 ':
            return (int.from_bytes(chunk[6:8], 'little') & 0x3FFF,
                    int.from_bytes(chunk[8:10], 'little') & 0x3FFF)
        offset += 8 + size + (size % 2)
    raise AssertionError('no WebP dimension chunk found')


# Public charts served as WebP, resized to at most 1400px wide. Two groups:
#  * charts still owned by the legacy checkout (~/2609/askclaw.dev/assets) — it holds their PNG
#    and is the dimension ground truth;
#  * charts refreshed 2026-09-21 for the /24 + ten-axis flip (pulled from the amber public repo),
#    whose authoritative PNG sibling now lives in this repo's public/assets/.
LEGACY_CHART_ASSETS = {
    'trust-chain.en.webp': 'trust-chain.en.png',
    'effort-curves-20260911.en.webp': 'effort-curves-20260911.en.png',
    'score-vs-tokens-2026-w37.en.webp': 'score-vs-tokens-2026-w37.en.png',
    'wallclock-strip-2026-w37.en.webp': 'wallclock-strip-2026-w37.en.png',
}
REFRESHED_CHART_ASSETS = {
    'top5-2026-w39.en.webp': 'top5-2026-w39.en.png',
    'completion-matrix-7way.en.webp': 'completion-matrix-7way.en.png',
}
CHART_ASSETS = {**LEGACY_CHART_ASSETS, **REFRESHED_CHART_ASSETS}
CRAB_ASSET = 'crab-hero.webp'
# Legacy verbatim assets rescued into public/assets/ (referenced by hand-written pages:
# en.html charts + notes article figures + vega specs/vendor libs). Dirs checked recursively.
LEGACY_ASSETS = {
    'top5-2026-w39.png', 'top5-2026-w39.en.png', 'top5-card.png', 'top5-card.en.png',
    'completion-matrix-7way.png', 'completion-matrix-7way.en.png',
    'trust-chain.png', 'trust-chain.en.png',
    'effort-curves-20260911.png', 'effort-curves-20260911.en.png',
    'score-vs-tokens-2026-w37.png', 'score-vs-tokens-2026-w37.en.png',
    'wallclock-strip-2026-w37.png', 'wallclock-strip-2026-w37.en.png',
    'what-is-amber.png', 'what-is-amber.en.png',
    'agent-anatomy.png', 'traditional-vs-agent.png',
}

root = Path(__file__).resolve().parent.parent
dist = root / 'dist'
# The legacy checkout (~/2609/askclaw.dev) is the ground truth for the chart PNGs. It is NOT part
# of this repo, so the dependency is checked up front and reported readably instead of blowing up
# on a later file read.
legacy = Path(os.environ.get('LEGACY_SITE_ROOT', root.parent / 'askclaw.dev')).expanduser().resolve()
missing_legacy = [name for name in LEGACY_CHART_ASSETS.values() if not (legacy / 'assets' / name).is_file()]
if missing_legacy:
    raise SystemExit(
        f'Legacy site assets not found under {legacy / "assets"}: {sorted(missing_legacy)}\n'
        'This gate compares four unchanged charts against their original PNG, which lives in the\n'
        'older static-site checkout (a sibling directory, not tracked in this repo). Point\n'
        'LEGACY_SITE_ROOT at it, e.g.\n'
        '  LEGACY_SITE_ROOT=<legacy-checkout> python3 scripts/verify-dist.py'
    )
axes_source = Path(os.environ.get('AXES_SOURCE', root / 'src/data/axes.json')).expanduser().resolve()


def normalize_base_path(value):
    base = value or '/'
    if not base.startswith('/'):
        base = '/' + base
    if not base.endswith('/'):
        base += '/'
    return '/' if base == '//' else base


def detect_dist_base_path():
    try:
        index_html = (dist / 'index.html').read_text()
        match = re.search(r'<link rel="canonical" href="https://askclaw\.dev([^"]*)"', index_html)
        if match:
            return normalize_base_path(match.group(1))
    except OSError:
        pass
    return '/'


# SITE_BASE is explicit when present. In the required shell form
# `SITE_BASE=... npm run build && python3 scripts/verify-dist.py`, the assignment only applies to
# the build process; infer the already-built base from its canonical URL for the second process.
base_path = normalize_base_path(os.environ['SITE_BASE']) if 'SITE_BASE' in os.environ else detect_dist_base_path()
expected_base = f'https://askclaw.dev{base_path}'
expected_routes = {'index.html', 'method/index.html', 'claim/index.html', 'rank/index.html', 'en/index.html', 'en/claim/index.html', 'en/rank/index.html', 'notes/index.html'}
# public/ verbatim hand-written pages (not Astro-built): different contract, checked separately below.
public_routes = {'en.html', 'amber/index.html', 'amber/en.html', 'notes/agent-is-new-software/index.html'}
for retired in ('axes.html', 'axes.json'):
    assert not (root / 'public' / retired).exists(), retired
    assert not (dist / retired).exists(), retired
assert {str(p.relative_to(dist)) for p in dist.rglob('*.html')} == expected_routes | public_routes
assert (root / 'src/data/axes.json').read_bytes() == axes_source.read_bytes()
lanes = json.loads((root / 'src/data/axes.json').read_text())
convergence_names = {'k3', 'gpt-5.6-luna-900k (high 档)', 'deepseek-flash', 'deepseek-flash (GA)', 'doubao-seed-evolving', 'glm-5.3-flash', 'swe-2-max', 'hy4-preview-f', 'step-5-preview', 'Qwen3.8-27B', 'claude-opus-5-5'}
assert len(lanes) == 14 and len({lane['id'] for lane in lanes}) == 14
assert 'step-5-preview' in {lane['name'] for lane in lanes}
assert 'claude-opus-5-5' in {lane['name'] for lane in lanes}
assert convergence_names <= {lane['name'] for lane in lanes}
for lane in lanes:
    value = 1 if lane['name'] in convergence_names else 0
    assert lane['axis']['convergence'] == {'p': value, 'n': value}, lane['name']
# NA channel: p = effective passes, n = case slots (NA included), na = held/void cases, which
# count as neither a win nor a loss. Every held case must sit inside its own case slots, and an
# axis slot count never shrinks to hide a hold.
assert all(cell.get('na', 0) <= cell['n'] for lane in lanes for cell in lane['axis'].values())
assert sum(cell.get('na', 0) for lane in lanes for cell in lane['axis'].values()) == 16

class Page(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.refs = []
        self.cards = []
        self.card = None
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        for name in ('href', 'src'):
            if name in attrs:
                self.refs.append(attrs[name])
        if tag == 'a' and 'repo-card' in (attrs.get('class') or '').split():
            self.card = {'href': attrs['href'], 'text': ''}

    def handle_data(self, data):
        if self.card is not None:
            self.card['text'] += data + ' '

    def handle_endtag(self, tag):
        if tag == 'a' and self.card is not None:
            self.cards.append(self.card)
            self.card = None

report = {'pages': {}, 'assets': {}, 'data_sha256': hashlib.sha256((root / 'src/data/axes.json').read_bytes()).hexdigest()}
report['convergence'] = {
    'lanes': len(lanes),
    'scored': [lane['name'] for lane in lanes if lane['axis']['convergence']['n'] > 0],
    'no_data': [lane['name'] for lane in lanes if lane['axis']['convergence']['n'] == 0],
    'legacy_artifacts_absent': True,
}
for relative in sorted(expected_routes):
    text = (dist / relative).read_text()
    forbidden_terms = FORBIDDEN_INTERNAL_TERMS.findall(unescape(text))
    assert not forbidden_terms, f'{relative}: forbidden internal term {forbidden_terms}'
    scripts = re.findall(r'<script\b(?![^>]*\btype=["\']application/ld\+json["\'])[^>]*>(.*?)</script>', text, re.S | re.I)
    assert len(scripts) == (1 if relative in {'rank/index.html', 'en/rank/index.html'} else 0), relative
    parsed = Page(text)
    for ref in parsed.refs:
        url = urlparse(ref)
        if url.scheme or not url.path:
            continue
        assert url.path.startswith(base_path), ref
        target = dist / url.path.removeprefix(base_path)
        if url.path.endswith('/'):
            target /= 'index.html'
        assert target.is_file(), ref
    report['pages'][relative] = {'bytes': len(text.encode()), 'script_count': len(scripts), 'inline_js_bytes': sum(len(s.encode()) for s in scripts), 'forbidden_terms': [], 'repo_cards': parsed.cards}
    if relative == 'method/index.html':
        assert len(parsed.cards) == 13
        # Frozen lanes keep their sealed /23 basis + the ∅ marker (owner order 2026-09-21);
        # the new claude lane carries its own W39 public score. Apostrophes follow the NA channel.
        for repo, score in [('amber-ollama', '18/24'), ('amber-crof', '16/23 ∅'), ('amber-claude', "17'/24")]:
            card = next(c for c in parsed.cards if c['href'].endswith('/' + repo))
            assert score in card['text'], (repo, card['text'])
        # The historical /21 composite note is fact and stays on the page.
        assert '15/21' in text and '14/21' in text
    if relative == 'en/index.html':
        assert len(parsed.cards) == 14
        assert sum('/amber-' in c['href'] for c in parsed.cards) == 13
        assert any(c['href'].endswith('/amber-claude') for c in parsed.cards)
        assert 'placeholder' not in text
        for phrase in ['24 cases / 27 papers', 'Snapshot 2026-W39', 'scored in W37', 'public hash index', 'Three counterintuitive findings']:
            assert phrase in text, phrase
        # Frozen lanes must keep the sealed /23 basis on the English mirror too.
        for score in ['17/23 ∅', '16/23 ∅']:
            assert score in text, score
    if relative == 'rank/index.html':
        assert 'Kimi 官方 coding' in text and 'coding coding' not in text
        assert 'data-face="convergence"' in text and '收敛' in text
    if relative == 'en/rank/index.html':
        assert 'Kimi official coding' in text and 'Everyday engineering' in text
        assert 'data-face="convergence"' in text and 'Convergence' in text
        assert not re.search(r'[\u3400-\u9fff]', ''.join(scripts)), 'Chinese rank script copy'

assets = sorted((dist / 'assets').glob('*'))
top_level = {p.name for p in assets}
assert top_level == {*CHART_ASSETS, CRAB_ASSET, *LEGACY_ASSETS, 'specs', 'vendor'}, sorted(top_level)
# specs/ and vendor/ are vega chart specs + libs for the hand-written pages; verify they exist and are non-empty.
assert len(list((dist / 'assets/specs').glob('*.json'))) == 8
assert {p.name for p in (dist / 'assets/vendor').glob('*.js')} == {'vega.min.js', 'vega-lite.min.js', 'vega-embed.min.js'}
for path in assets:
    if path.name in LEGACY_ASSETS or path.is_dir():
        # Verbatim legacy files: existence + byte-identity with public/ is enough.
        if path.is_file():
            assert path.read_bytes() == (root / 'public/assets' / path.name).read_bytes(), path.name
        continue
    data = path.read_bytes()
    assert data == (root / 'public/assets' / path.name).read_bytes(), path.name
    if path.name == CRAB_ASSET:
        dimensions = webp_dimensions(data)
        assert dimensions == (1200, 400), (path.name, dimensions)
    else:
        legacy_name = CHART_ASSETS[path.name]
        if path.name in REFRESHED_CHART_ASSETS:
            # Refreshed 2026-09-21: the PNG sibling in this repo is the source of truth (the legacy
            # checkout still holds the superseded W38 / nine-axis artwork).
            legacy_data = (root / 'public/assets' / legacy_name).read_bytes()
        else:
            legacy_data = (legacy / 'assets' / legacy_name).read_bytes()
        # Same chart as the source PNG, migrated to WebP and capped at 1400px wide. Both
        # dimensions scale together; allow 1px for integer rounding of the height.
        assert legacy_data[:8] == b'\x89PNG\r\n\x1a\n', legacy_name
        legacy_width, legacy_height = struct.unpack('>II', legacy_data[16:24])
        dimensions = webp_dimensions(data)
        expected_width = min(legacy_width, 1400)
        assert dimensions[0] == expected_width, (path.name, dimensions, legacy_width)
        expected_height = legacy_height * expected_width / legacy_width
        assert abs(dimensions[1] - expected_height) <= 1, (path.name, dimensions, legacy_height)
    report['assets'][path.name] = {'bytes': len(data), 'dimensions': dimensions, 'sha256': hashlib.sha256(data).hexdigest()}

ns = {'s': 'http://www.sitemaps.org/schemas/sitemap/0.9', 'x': 'http://www.w3.org/1999/xhtml'}
robots_text = (dist / 'robots.txt').read_text()
tracked = subprocess.check_output(['git', 'ls-files'], cwd=root, text=True).splitlines()
assert not any(Path(p).name.startswith('sitemap') and p.endswith('.xml') for p in tracked)
config = (root / 'astro.config.mjs').read_text()
assert "import sitemap from '@astrojs/sitemap'" in config and 'sitemap({' in config
if base_path == '/':
    # Production root: a real sitemap of production URLs plus a robots.txt that advertises it
    # (the legacy site published robots.txt + sitemap.xml at the same paths).
    sitemap = ET.parse(dist / 'sitemap-0.xml')
    urls = sitemap.findall('s:url', ns)
    locations = [u.findtext('s:loc', namespaces=ns) for u in urls]
    assert len(locations) == 9 and set(locations) == {expected_base, expected_base + 'en/', expected_base + 'rank/', expected_base + 'en/rank/', expected_base + 'claim/', expected_base + 'en/claim/', expected_base + 'method/', expected_base + 'notes/', expected_base + 'notes/agent-is-new-software/'}
    for url in urls:
        location = url.findtext('s:loc', namespaces=ns)
        alternates = {a.attrib['hreflang']: a.attrib['href'] for a in url.findall('x:link', ns)}
        expected_alternates = {}
        if location in {expected_base, expected_base + 'en/'}:
            expected_alternates = {'zh-CN': expected_base, 'en': expected_base + 'en/'}
        elif location in {expected_base + 'rank/', expected_base + 'en/rank/'}:
            expected_alternates = {'zh-CN': expected_base + 'rank/', 'en': expected_base + 'en/rank/'}
        elif location in {expected_base + 'claim/', expected_base + 'en/claim/'}:
            expected_alternates = {'zh-CN': expected_base + 'claim/', 'en': expected_base + 'en/claim/'}
        assert alternates == expected_alternates
    assert ET.parse(dist / 'sitemap-index.xml').findtext('s:sitemap/s:loc', namespaces=ns) == expected_base + 'sitemap-0.xml'
    assert expected_base + 'sitemap-index.xml' in robots_text
    assert 'Disallow: /' not in robots_text
    for relative in expected_routes:
        assert 'noindex' not in (dist / relative).read_text(), relative
    report['sitemap'] = {'routes': locations, 'hreflang_count': len(sitemap.findall('.//x:link', ns)), 'generated': True, 'base': base_path}
else:
    # Preview base: not indexable. No sitemap is generated and robots.txt forbids crawling; every
    # page carries noindex,nofollow so the preview never becomes a duplicate of the real site.
    assert not (dist / 'sitemap-0.xml').exists() and not (dist / 'sitemap-index.xml').exists()
    assert robots_text == 'User-agent: *\nDisallow: /\n', robots_text
    for relative in expected_routes:
        assert '<meta name="robots" content="noindex,nofollow"' in (dist / relative).read_text(), relative
    report['sitemap'] = {'routes': [], 'hreflang_count': 0, 'generated': False, 'base': base_path}
assert not [p for p in dist.rglob('*.js') if 'assets/vendor/' not in str(p)]
for path in [*dist.rglob('*.html'), *dist.rglob('*.css')]:
    assert not re.search(r'@font-face|fonts\.(?:googleapis|gstatic)\.com|\.(?:woff2?|ttf|otf)\b', path.read_text()), path
package = json.loads((root / 'package.json').read_text())
assert set(package['dependencies']) == {'astro', '@astrojs/sitemap'}
lock = json.loads((root / 'package-lock.json').read_text())
for name in lock['packages']:
    assert not re.search(r'node_modules/(react(?:-dom)?|vue|svelte|solid-js|@solidjs/start|@sveltejs/kit)(/|$)', name), name
report['frameworks'] = []
report['external_js_files'] = []
report['network_fonts'] = []
report['dist'] = {str(p.relative_to(dist)): {'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(dist.rglob('*')) if p.is_file()}
print(json.dumps(report, indent=2, ensure_ascii=False))
