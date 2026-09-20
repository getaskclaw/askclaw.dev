"""Verify static output and source preservation without changing either tree."""
import hashlib
from html import unescape
from html.parser import HTMLParser
import json
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


# The six public charts were migrated from legacy PNG to WebP (resized to 1400px wide) in the
# same change that rebuilt dist; crab-hero.webp is a new asset with no legacy counterpart.
CHART_ASSETS = {
    'top5-2026-w38.en.webp': 'top5-2026-w38.en.png',
    'completion-matrix-7way.en.webp': 'completion-matrix-7way.en.png',
    'trust-chain.en.webp': 'trust-chain.en.png',
    'effort-curves-20260911.en.webp': 'effort-curves-20260911.en.png',
    'score-vs-tokens-2026-w37.en.webp': 'score-vs-tokens-2026-w37.en.png',
    'wallclock-strip-2026-w37.en.webp': 'wallclock-strip-2026-w37.en.png',
}
CRAB_ASSET = 'crab-hero.webp'

root = Path(__file__).resolve().parent.parent
dist = root / 'dist'
legacy = root.parent / 'askclaw.dev'
base = 'https://askclaw.dev/astro-preview/'
expected_routes = {'index.html', 'method/index.html', 'rank/index.html', 'en/index.html'}
assert {str(p.relative_to(dist)) for p in dist.rglob('*.html')} == expected_routes
assert (root / 'src/data/axes.json').read_bytes() == (root.parent / 'amber-axes/axes.json').read_bytes()

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
for relative in sorted(expected_routes):
    text = (dist / relative).read_text()
    forbidden_terms = FORBIDDEN_INTERNAL_TERMS.findall(unescape(text))
    assert not forbidden_terms, f'{relative}: forbidden internal term {forbidden_terms}'
    scripts = re.findall(r'<script\b(?![^>]*\btype=["\']application/ld\+json["\'])[^>]*>(.*?)</script>', text, re.S | re.I)
    assert len(scripts) == (1 if relative == 'rank/index.html' else 0), relative
    parsed = Page(text)
    for ref in parsed.refs:
        url = urlparse(ref)
        if url.scheme or not url.path:
            continue
        assert url.path.startswith('/astro-preview/'), ref
        target = dist / url.path.removeprefix('/astro-preview/')
        if url.path.endswith('/'):
            target /= 'index.html'
        assert target.is_file(), ref
    report['pages'][relative] = {'bytes': len(text.encode()), 'script_count': len(scripts), 'inline_js_bytes': sum(len(s.encode()) for s in scripts), 'forbidden_terms': [], 'repo_cards': parsed.cards}
    if relative == 'method/index.html':
        assert len(parsed.cards) == 11
        for repo, score in [('amber-ollama', '17/23'), ('amber-crof', '16/23')]:
            card = next(c for c in parsed.cards if c['href'].endswith('/' + repo))
            assert score in card['text'] and 'W37' in card['text'] and 'W36' not in card['text']
    if relative == 'en/index.html':
        assert len(parsed.cards) == 12
        assert sum('/amber-' in c['href'] for c in parsed.cards) == 11
        assert 'placeholder' not in text
        for phrase in ['23 cases / 26 papers', 'Snapshot 2026-W38', 'scored in W37', 'public hash index', 'Three counterintuitive findings']:
            assert phrase in text, phrase
    if relative == 'rank/index.html':
        assert 'Kimi official coding' in text and 'coding coding' not in text

assets = sorted((dist / 'assets').glob('*'))
assert {p.name for p in assets} == {*CHART_ASSETS, CRAB_ASSET}, [p.name for p in assets]
for path in assets:
    data = path.read_bytes()
    assert data == (root / 'public/assets' / path.name).read_bytes(), path.name
    if path.name == CRAB_ASSET:
        dimensions = webp_dimensions(data)
        assert dimensions == (1200, 400), (path.name, dimensions)
    else:
        legacy_name = CHART_ASSETS[path.name]
        legacy_data = (legacy / 'assets' / legacy_name).read_bytes()
        # Same chart as the legacy PNG, migrated to WebP and capped at 1400px wide. Both
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
sitemap = ET.parse(dist / 'sitemap-0.xml')
urls = sitemap.findall('s:url', ns)
locations = [u.findtext('s:loc', namespaces=ns) for u in urls]
assert len(locations) == 4 and set(locations) == {base, base + 'en/', base + 'rank/', base + 'method/'}
for url in urls:
    location = url.findtext('s:loc', namespaces=ns)
    alternates = {a.attrib['hreflang']: a.attrib['href'] for a in url.findall('x:link', ns)}
    assert alternates == ({'zh-CN': base, 'en': base + 'en/'} if location in {base, base + 'en/'} else {})
assert ET.parse(dist / 'sitemap-index.xml').findtext('s:sitemap/s:loc', namespaces=ns) == base + 'sitemap-0.xml'
assert base + 'sitemap-index.xml' in (dist / 'robots.txt').read_text()
tracked = subprocess.check_output(['git', 'ls-files'], cwd=root, text=True).splitlines()
assert not any(Path(p).name.startswith('sitemap') and p.endswith('.xml') for p in tracked)
config = (root / 'astro.config.mjs').read_text()
assert "import sitemap from '@astrojs/sitemap'" in config and 'sitemap({' in config
report['sitemap'] = {'routes': locations, 'hreflang_count': len(sitemap.findall('.//x:link', ns)), 'generated': True}
assert not list(dist.rglob('*.js'))
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
