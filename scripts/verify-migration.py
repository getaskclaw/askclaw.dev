#!/usr/bin/env python3
"""Compare baseline build copy and protected bytes across the route migration.

Usage: python3 scripts/verify-migration.py --baseline-dist /path/to/baseline-dist --baseline-ref COMMIT
Run on a production-base build. Redirect labels are routing UI, not original content.
"""
import argparse
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import subprocess


class Copy(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=True)
        self.body = False
        self.ignore = 0
        self.words = []
        self.labels = []
        self.metadata = []
        self.in_title = False
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'body':
            self.body = True
        if tag in ('script', 'style'):
            self.ignore += 1
        if tag == 'title':
            self.in_title = True
        if tag == 'meta' and (attrs.get('name') in ('description', 'keywords') or attrs.get('property') in ('og:title', 'og:description')):
            self.metadata.append((attrs.get('name', attrs.get('property')), attrs.get('content')))
        if self.body:
            for key in ('alt', 'title', 'aria-label', 'placeholder'):
                if key in attrs:
                    self.labels.append((tag, key, attrs[key]))

    def handle_endtag(self, tag):
        if tag in ('script', 'style'):
            self.ignore -= 1
        if tag == 'body':
            self.body = False
        if tag == 'title':
            self.in_title = False

    def handle_data(self, data):
        if self.in_title:
            self.metadata.append(('title', data))
        if self.body and not self.ignore:
            self.words.extend(data.split())

    def signature(self):
        return self.words, self.labels, self.metadata


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--baseline-dist', type=Path, required=True)
    parser.add_argument('--baseline-ref', required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    dist = root / 'dist'
    compared = []
    for old in sorted(args.baseline_dist.rglob('*.html')):
        rel = old.relative_to(args.baseline_dist).as_posix()
        html = old.read_text()
        if '<main' not in html or rel in ['en.html', 'amber/en.html', 'amber/index.html']:
            continue
        new_rel = rel if rel == '404.html' else rel.removeprefix('zh/') if rel.startswith('zh/') else 'en/' + rel
        new = dist / new_rel
        assert new.is_file(), (rel, new_rel, 'missing target')
        before, after = Copy(html), Copy(new.read_text())
        assert before.signature() == after.signature(), (rel, new_rel, 'copy changed')
        compared.append({'from': rel, 'to': new_rel})
    assert compared and any(p['to'] == 'index.html' for p in compared) and any(p['to'].startswith('en/') for p in compared)
    protected = subprocess.check_output(['git', 'ls-tree', '-r', '--name-only', args.baseline_ref, '--', 'src/data', 'public'], cwd=root, text=True).splitlines()
    for path in protected:
        original = subprocess.check_output(['git', 'show', f'{args.baseline_ref}:{path}'], cwd=root)
        assert (root / path).read_bytes() == original, ('protected bytes changed', path)
    protected_diff = subprocess.check_output(['git', 'diff', args.baseline_ref, '--name-only', '--', 'src/data', 'public'], cwd=root, text=True)
    assert not protected_diff, protected_diff
    registry = json.loads((root / 'scripts/figures.json').read_text())
    baseline_registry = json.loads(subprocess.check_output(['git', 'show', f'{args.baseline_ref}:scripts/figures.json'], cwd=root, text=True))
    # Only URL registration keys move: all scores, dates, fingerprints and figure values stay identical.
    mapping = {'index.html': 'en/index.html', 'zh/method/index.html': 'method/index.html',
               'zh/notes/agent-is-new-software/index.html': 'notes/agent-is-new-software/index.html'}
    def mapped(value):
        if isinstance(value, dict):
            return {mapping.get(k, k): mapped(v) for k, v in value.items()}
        if isinstance(value, list):
            return [mapped(v) for v in value]
        return mapping.get(value, value) if isinstance(value, str) else value
    assert registry == mapped(baseline_registry), 'claims registry changed beyond route keys'
    print(json.dumps({'passed': True, 'copy_pages': len(compared), 'protected_files': len(protected),
                      'registry_only_routes_changed': True, 'pages': compared}, indent=2))


if __name__ == '__main__':
    main()
