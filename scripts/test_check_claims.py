#!/usr/bin/env python3
"""Tests for check-claims.py: the clean fixture must pass, and each kind of hand-written value gone stale must fail.

    python3 -m unittest scripts/test_check_claims.py -v     (or: python3 scripts/test_check_claims.py)
"""
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
LANES = [
    {'id': 'a', 'name': 'model-a', 'repo': 'amber-a', 'wk': 'W40', 'total': 19, 'n': 24, 'axis': {'x': {'p': 1, 'n': 2, 'na': 1}}},
    {'id': 'b', 'name': 'model-b', 'repo': 'amber-b', 'wk': 'W39', 'total': 17, 'n': 24, 'axis': {'x': {'p': 1, 'n': 1}}},
    {'id': 'c', 'name': 'model-c', 'repo': 'amber-c', 'wk': 'W37', 'total': 15, 'n': 23, 'axis': {'x': {'p': 1, 'n': 1}}},
]
OG = '<meta property="og:image" content="https://askclaw.dev/assets/top5-2026-w40c.en.webp">'


def card(repo, text, cls='repo-card'):
    return f'<a class="{cls}" href="https://github.com/getaskclaw/{repo}"><b>{repo}</b> {text}</a>'


def pages():
    return {
        'method/index.html': OG + card('amber-a', "19'/24 model-a (W40)") + card('amber-b', "17'/24 model-b W39")
            + card('amber-c', "16'/23 ∅ model-c W37") + '<p>W40 保留的最新快照</p>',
        'en/index.html': OG + '<img src="/assets/top5-2026-w40c.en.webp"><p>Snapshot 2026-W40 · scored in W37 · its W39 first test was 17/23</p>',
        'en.html': '<meta property="og:image" content="https://askclaw.dev/assets/top5-card-w40c.en.png">'
            + '<img src="/assets/top5-2026-w40c.en.png"><p>Snapshot 2026-W40 · scored in W37</p>',
        'index.html': OG,
    }


def registry(fingerprint):
    return {
        'pages': {'method/index.html': {}, 'en/index.html': {'historical_scores': ['17/23']}, 'en.html': {}},
        'cards': {'amber-c': {'frozen_scores': ['16/23']}},
        'week_patterns': [
            {'page': 'method/index.html', 'regex': r'(W\d\d)\s+保留的最新快照', 'rule': 'current'},
            {'page': 'en/index.html', 'regex': r'Snapshot (2026-W\d\d)', 'rule': 'current'},
            {'page': 'en/index.html', 'regex': r'scored in (W\d\d)', 'rule': 'historical:W37'},
            {'page': 'en.html', 'regex': r'Snapshot (2026-W\d\d)', 'rule': 'current'},
        ],
        'figures': {
            'data_fingerprint': fingerprint, 'og_image': '/assets/top5-2026-w40c.en.webp',
            'og_overrides': {'en.html': '/assets/top5-card-w40c.en.png'},
            'top5_files': {'en.html': ['top5-2026-w40c.en.png', 'top5-card-w40c.en.png'], 'en/index.html': ['top5-2026-w40c.en.webp']},
        },
    }


def fingerprint(lanes):
    sys.path.insert(0, str(HERE))
    from claims_lib import Facts
    with tempfile.TemporaryDirectory() as tmp:
        write_root(Path(tmp), lanes)
        return Facts(tmp).fingerprint()


def write_root(root, lanes):
    (root / 'src/data').mkdir(parents=True, exist_ok=True)
    (root / 'src/utils').mkdir(parents=True, exist_ok=True)
    (root / 'src/data/axes.json').write_text(json.dumps(lanes), encoding='utf-8')
    (root / 'src/utils/picker-core.js').write_text("export const FROZEN_HELD = ['c'];\n", encoding='utf-8')


class CheckClaims(unittest.TestCase):
    def run_case(self, edit_pages=None, edit_registry=None, lanes=None, registry_lanes=None):
        lanes = lanes or LANES
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            write_root(root, lanes)
            page_map = pages()
            if edit_pages:
                edit_pages(page_map)
            for relative, text in page_map.items():
                path = root / 'dist' / relative
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(f'<html><body><main>{text}</main></body></html>', encoding='utf-8')
            reg = registry(fingerprint(registry_lanes or LANES))
            if edit_registry:
                edit_registry(reg)
            (root / 'figures.json').write_text(json.dumps(reg), encoding='utf-8')
            result = subprocess.run([sys.executable, str(HERE / 'check-claims.py'), '--root', str(root),
                                     '--registry', str(root / 'figures.json')], capture_output=True, text=True)
            return result.returncode, result.stdout

    def assertFails(self, needle, **kw):
        code, out = self.run_case(**kw)
        self.assertEqual(code, 1, out)
        self.assertIn(needle, out)

    def test_clean_fixture_passes(self):
        code, out = self.run_case()
        self.assertEqual(code, 0, out)

    def test_card_score_gone_stale(self):
        self.assertFails("card amber-a says 18/24", edit_pages=lambda p: p.update({'method/index.html': p['method/index.html'].replace("19'/24", "18'/24")}))

    def test_card_without_any_current_score(self):
        self.assertFails("carries none of its current scores",
                         edit_pages=lambda p: p.update({'method/index.html': p['method/index.html'].replace("17'/24 model-b", "model-b")}))

    def test_card_week_not_a_lane_week(self):
        self.assertFails("card amber-b mentions W35", edit_pages=lambda p: p.update({'method/index.html': p['method/index.html'].replace('model-b W39', 'model-b W35')}))

    def test_frozen_score_is_owner_pinned_not_stale(self):
        code, out = self.run_case()          # amber-c shows 16'/23 while its lane says 15/23: allowed only via frozen_scores
        self.assertEqual(code, 0, out)
        self.assertFails("card amber-c says 16/23", edit_registry=lambda r: r['cards'].pop('amber-c'))

    def test_unregistered_score_on_a_page(self):
        self.assertFails("score 12/24 is neither", edit_pages=lambda p: p.update({'en.html': p['en.html'] + '<p>tied at 12/24</p>'}))

    def test_registered_historical_score_is_tolerated(self):
        code, out = self.run_case()          # 17/23 appears on en/index.html and is registered there
        self.assertEqual(code, 0, out)
        self.assertFails("score 17/23 is neither", edit_registry=lambda r: r['pages']['en/index.html'].pop('historical_scores'))

    def test_current_week_phrase_gone_stale(self):
        self.assertFails("Snapshot", edit_pages=lambda p: p.update({'en/index.html': p['en/index.html'].replace('Snapshot 2026-W40', 'Snapshot 2026-W39')}))
        self.assertFails("保留的最新快照", edit_pages=lambda p: p.update({'method/index.html': p['method/index.html'].replace('W40 保留', 'W39 保留')}))

    def test_historical_phrase_changed(self):
        self.assertFails("rule historical:W37 wants W37", edit_pages=lambda p: p.update({'en/index.html': p['en/index.html'].replace('scored in W37', 'scored in W38')}))

    def test_expected_phrase_removed(self):
        self.assertFails("expected phrase", edit_pages=lambda p: p.update({'en.html': p['en.html'].replace('Snapshot 2026-W40', 'Snapshot')}))

    def test_week_newer_than_current(self):
        self.assertFails("newer than the current week", edit_pages=lambda p: p.update({'en.html': p['en.html'] + '<p>W41</p>'}))

    def test_unregistered_old_week(self):
        self.assertFails("week W35 is not registered", edit_pages=lambda p: p.update({'method/index.html': p['method/index.html'] + '<p>see W35</p>'}))

    def test_share_image_changed(self):
        self.assertFails("og:image", edit_pages=lambda p: p.update({'index.html': p['index.html'].replace('w40c', 'w41a')}))

    def test_page_specific_share_image_changed(self):
        self.assertFails("en.html: og:image", edit_pages=lambda p: p.update({'en.html': p['en.html'].replace('top5-card-w40c', 'top5-card-w39')}))

    def test_figure_file_name_changed(self):
        self.assertFails("figure files", edit_pages=lambda p: p.update({'en/index.html': p['en/index.html'].replace('top5-2026-w40c.en.webp', 'top5-2026-w41a.en.webp')}))

    def test_scores_changed_so_figures_may_be_stale(self):
        moved = [dict(l) for l in LANES]
        moved[1] = {**moved[1], 'total': 18}          # one lane moves; the registry was approved against the old scores
        self.assertFails("figures: scores changed", lanes=moved, registry_lanes=LANES,
                         edit_pages=lambda p: p.update({'method/index.html': p['method/index.html'].replace("17'/24", "18'/24")}))

    def test_apostrophe_follows_na_and_frozen_rule(self):
        sys.path.insert(0, str(HERE))
        from claims_lib import Facts
        with tempfile.TemporaryDirectory() as tmp:
            write_root(Path(tmp), LANES)
            shown = Facts(tmp).shown
        self.assertEqual(shown, {'a': "19'/24", 'b': '17/24', 'c': "15'/23"})   # a has NA, c is frozen, b is neither


if __name__ == '__main__':
    unittest.main(verbosity=2)
