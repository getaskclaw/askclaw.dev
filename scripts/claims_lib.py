"""Facts about the published data that hand-written pages and the gates must agree with.

Shared by check-claims.py and verify-dist.py. Everything here derives from the files the site
publishes (src/data/axes.json, src/data/lane-pages.json, src/utils/picker-core.js); nothing is typed in.
"""
import hashlib
import json
import re
from pathlib import Path


def frozen_held(root):
    """Lane ids whose total always carries the apostrophe (FROZEN_HELD in picker-core.js)."""
    text = (Path(root) / 'src/utils/picker-core.js').read_text(encoding='utf-8')
    match = re.search(r'FROZEN_HELD\s*=\s*\[(.*?)\]', text, re.S)
    if not match:
        raise SystemExit('picker-core.js: FROZEN_HELD not found')
    return re.findall(r"'([^']+)'", match.group(1))


class Facts:
    def __init__(self, root):
        root = Path(root)
        self.lanes = json.loads((root / 'src/data/axes.json').read_text(encoding='utf-8'))
        frozen = set(frozen_held(root))
        self.by_id = {lane['id']: lane for lane in self.lanes}
        self.shown = {}
        for lane in self.lanes:
            marked = any(cell.get('na', 0) > 0 for cell in lane['axis'].values()) or lane['id'] in frozen
            self.shown[lane['id']] = f"{lane['total']}{chr(39) if marked else ''}/{lane['n']}"
        self.numeric = {lane['id']: f"{lane['total']}/{lane['n']}" for lane in self.lanes}
        weeks = sorted(lane['wk'] for lane in self.lanes)
        self.current_week = weeks[-1]                       # e.g. 'W40'
        self.lane_weeks = set(weeks)
        self.repo_lanes = {}
        for lane in self.lanes:
            self.repo_lanes.setdefault(lane['repo'], []).append(lane)

    def fingerprint(self):
        """sha256 over every lane's displayed score: any score change changes it."""
        text = '\n'.join(sorted(f"{lane_id}:{value}" for lane_id, value in self.shown.items()))
        return hashlib.sha256(text.encode('utf-8')).hexdigest()
