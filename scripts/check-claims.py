#!/usr/bin/env python3
"""check-claims.py — do the hand-written places on the site still say what the data says?

    python3 scripts/check-claims.py                  # check dist/ against src/data and scripts/figures.json
    python3 scripts/check-claims.py --propose        # print a registry skeleton for what is on the pages now

Pages that are rendered from data cannot drift. Pages that are written by hand (the repo cards on /method/ and
/en/, public/en.html, the figure names and captions, the share image) can: a new sitting changes a score and the
hand-written copy keeps the old one. This gate fails closed on that:

  1. repo cards      every score in a card must be a current score of one of that repo's lanes (or an owner-pinned
                     cards.<repo>.frozen_scores value), or be listed under cards.<repo>.historical_scores; every week in a card likewise (lane weeks or historical_weeks);
                     each card must carry at least one current score of its repo.
  2. page scores     every score token on a registered page (outside cards) must equal some lane's current score
                     or be listed in pages.<page>.historical_scores.
  3. weeks           patterns in week_patterns say what a phrase means: rule 'current' (must equal the current week,
                     the newest sitting week in axes.json) or 'historical:Wxx' (must equal exactly that week), and each
                     must match at least once. Any other week mention must be in pages.<page>.historical_weeks and
                     can never be newer than the current week.
  4. figures         figures.data_fingerprint must equal the fingerprint of today's scores (a score change means the
                     top-five figures may be stale and the owner must re-approve them); every page's og:image must be
                     figures.og_image unless figures.og_overrides names its own (null = the page has none); the
                     top5-* files each page in figures.top5_files references must equal the registered list.
Week mentions that equal some lane's tested week in axes.json are always allowed (the data says that week exists);
what the registry pins down is the phrases that claim to describe NOW (rule 'current').

The registry (scripts/figures.json) is approved by the owner with the release that edits it; the gate script and the
registry are both part of the release fingerprint, so a release cannot loosen them unseen.
Exit status: 0 = consistent, 1 = at least one violation (all are printed).
"""
import argparse
import html
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from claims_lib import Facts  # noqa: E402

SCORE = re.compile(r"(\d{1,2})(?:'|’)?/(\d{2})(?: ∅)?")
WEEK = re.compile(r"(?:2026-)?(W\d\d)")
TOP5 = re.compile(r"top5-[A-Za-z0-9.-]+\.(?:png|webp|json)")


class Cards(HTMLParser):
    """Collect <a class="repo-card|repo" href=".../getaskclaw/amber-X"> anchors with their text."""

    def __init__(self):
        super().__init__()
        self.cards, self._open, self._depth = [], None, 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'a':
            classes = (attrs.get('class') or '').split()
            match = re.match(r'https://github\.com/getaskclaw/(amber-[a-z0-9-]+)$', attrs.get('href') or '')
            if match and ({'repo-card', 'repo'} & set(classes)):
                self._open = {'repo': match.group(1), 'text': ''}

    def handle_data(self, data):
        if self._open is not None:
            self._open['text'] += data + ' '

    def handle_endtag(self, tag):
        if tag == 'a' and self._open is not None:
            self.cards.append(self._open)
            self._open = None


def visible(raw):
    return html.unescape(re.sub(r'<script.*?</script>|<style.*?</style>|<[^>]+>', ' ', raw, flags=re.S | re.I))


def strip_cards(raw):
    return re.sub(r'<a\b[^>]*class="[^"]*\brepo(?:-card)?\b[^"]*"[^>]*>.*?</a>', ' ', raw, flags=re.S | re.I)


def score_tokens(text):
    return [f"{a}/{b}" for a, b in SCORE.findall(text)]


def week_tokens(text):
    return WEEK.findall(text)


def run(root, dist, registry, propose=False):
    facts = Facts(root)
    violations, checked = [], {'cards': 0, 'score_tokens': 0, 'week_tokens': 0, 'patterns': 0, 'pages': 0}
    current_scores = set(facts.numeric.values())
    num = lambda w: int(w[1:])
    proposal = {'pages': {}, 'cards': {}}

    for page, spec in registry.get('pages', {}).items():
        path = dist / page
        if not path.is_file():
            violations.append(f"{page}: registered page is missing from dist")
            continue
        checked['pages'] += 1
        raw = path.read_text(encoding='utf-8')

        parser = Cards()
        parser.feed(raw)
        for card in parser.cards:
            repo = card['repo']
            checked['cards'] += 1
            text = html.unescape(card['text'])
            lanes = facts.repo_lanes.get(repo, [])
            cspec = registry.get('cards', {}).get(repo, {})
            # frozen_scores: values the owner pinned on a card (a frozen lane keeps its sealed record), not derived from data
            lane_scores = {facts.numeric[lane['id']] for lane in lanes} | set(cspec.get('frozen_scores', []))
            lane_weeks = {lane['wk'] for lane in lanes}
            tokens = score_tokens(text)
            checked['score_tokens'] += len(tokens)
            stale = [t for t in tokens if t not in lane_scores and t not in cspec.get('historical_scores', [])]
            for token in stale:
                violations.append(f"{page}: card {repo} says {token}; lane scores are {sorted(lane_scores) or 'none'}")
            if lanes and not any(t in lane_scores for t in tokens):
                violations.append(f"{page}: card {repo} carries none of its current scores {sorted(lane_scores)}")
            weeks = week_tokens(text)
            checked['week_tokens'] += len(weeks)
            for week in weeks:
                if week not in lane_weeks and week not in cspec.get('historical_weeks', []):
                    violations.append(f"{page}: card {repo} mentions {week}; lane weeks are {sorted(lane_weeks)}")
            proposal['cards'].setdefault(repo, {'historical_scores': [], 'historical_weeks': []})
            proposal['cards'][repo]['historical_scores'] = sorted(set(proposal['cards'][repo]['historical_scores']) | {t for t in tokens if t not in lane_scores})
            proposal['cards'][repo]['historical_weeks'] = sorted(set(proposal['cards'][repo]['historical_weeks']) | {w for w in weeks if w not in lane_weeks})

        text = visible(strip_cards(raw))
        tokens = score_tokens(text)
        checked['score_tokens'] += len(tokens)
        allowed = current_scores | set(spec.get('historical_scores', []))
        for token in sorted({t for t in tokens if t not in allowed}):
            violations.append(f"{page}: score {token} is neither a current lane score nor registered as historical")
        weeks = week_tokens(text)
        checked['week_tokens'] += len(weeks)
        allowed_weeks = set(spec.get('historical_weeks', [])) | facts.lane_weeks | {facts.current_week}
        for week in sorted(set(weeks)):
            if num(week) > num(facts.current_week):
                violations.append(f"{page}: {week} is newer than the current week {facts.current_week}")
            elif week not in allowed_weeks:
                violations.append(f"{page}: week {week} is not registered (current is {facts.current_week})")
        proposal['pages'][page] = {
            'historical_scores': sorted({t for t in tokens if t not in current_scores}),
            'historical_weeks': sorted({w for w in weeks if w != facts.current_week}),
        }

        for pattern in (p for p in registry.get('week_patterns', []) if p['page'] == page):
            checked['patterns'] += 1
            found = [m.group(1) for m in re.finditer(pattern['regex'], text)]
            week_of = lambda value: WEEK.search(value).group(1) if WEEK.search(value) else value
            if not found:
                violations.append(f"{page}: expected phrase /{pattern['regex']}/ is missing")
            for value in found:
                want = facts.current_week if pattern['rule'] == 'current' else pattern['rule'].split(':', 1)[1]
                if week_of(value) != want:
                    violations.append(f"{page}: /{pattern['regex']}/ says {value}; rule {pattern['rule']} wants {want}")

    figures = registry.get('figures', {})
    if figures:
        fingerprint = facts.fingerprint()
        if figures.get('data_fingerprint') != fingerprint:
            violations.append("figures: scores changed since the top-five figures were approved "
                              f"(registry {str(figures.get('data_fingerprint'))[:12]}, data {fingerprint[:12]}); "
                              "the owner must re-approve the figures and re-register figures.json")
        for html_path in sorted(dist.rglob('*.html')):
            relative = str(html_path.relative_to(dist))
            if relative.startswith('zh/') or re.match(r'(?:en/)?(?:model|provider)/', relative):
                # Only genuine redirect stubs may omit a share image. Content is checked at its new URL.
                stub = html_path.read_text(encoding='utf-8')
                if '<meta http-equiv="refresh"' not in stub or '<link rel="canonical"' not in stub:
                    violations.append(f"{relative}: expected a redirect stub")
                continue
            overrides = figures.get('og_overrides', {})
            want = overrides.get(relative, figures['og_image']) if relative in overrides or True else None
            match = re.search(r'<meta property="og:image" content="([^"]*)"', html_path.read_text(encoding='utf-8'))
            if relative in overrides and overrides[relative] is None:
                if match:
                    violations.append(f"{relative}: has an og:image but the registry says it has none")
                continue
            if not match or not match.group(1).endswith(want):
                violations.append(f"{relative}: og:image is {match.group(1) if match else 'missing'}; registry says {want}")
        for page, names in figures.get('top5_files', {}).items():
            path = dist / page
            if not path.is_file():
                violations.append(f"{page}: registered figure page is missing from dist")
                continue
            found = set(TOP5.findall(path.read_text(encoding='utf-8')))
            if found != set(names):
                violations.append(f"{page}: figure files {sorted(found)} differ from registered {sorted(names)}")
    return violations, checked, proposal


def main():
    here = Path(__file__).resolve().parent
    ap = argparse.ArgumentParser()
    ap.add_argument('--root', default=str(here.parent))
    ap.add_argument('--dist', default=None)
    ap.add_argument('--registry', default=str(here / 'figures.json'))
    ap.add_argument('--propose', action='store_true', help='print a registry skeleton for what the pages say now')
    args = ap.parse_args()
    root = Path(args.root)
    dist = Path(args.dist) if args.dist else root / 'dist'
    registry = json.loads(Path(args.registry).read_text(encoding='utf-8'))
    if args.propose:
        registry = {**registry, 'pages': {p: {} for p in registry.get('pages', {})}, 'cards': {}, 'week_patterns': []}
    violations, checked, proposal = run(root, dist, registry, propose=args.propose)
    if args.propose:
        out = {'pages': proposal['pages'], 'cards': proposal['cards']}
        print(json.dumps(out, ensure_ascii=False, indent=1, sort_keys=True))
        return 0
    if violations:
        print(f"check-claims FAILED: {len(violations)} violation(s)")
        for violation in violations:
            print('  -', violation)
        return 1
    print("check-claims ok: " + ', '.join(f"{k} {v}" for k, v in checked.items()))
    return 0


if __name__ == '__main__':
    sys.exit(main())
