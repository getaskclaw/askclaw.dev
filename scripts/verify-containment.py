"""Compare the captured local/remote manifests after the scoped deployment."""
import json
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parent.parent
evidence = root / 'evidence/r2'
load = lambda name: json.loads((evidence / name).read_text())
before, after = load('remote-before.json'), load('remote-after.json')
prefix = 'astro-preview/'
siblings = lambda manifest: {name: value for name, value in manifest['files'].items() if not name.startswith(prefix)}
assert before['top_level'] == after['top_level']
assert before['symlinks'] == after['symlinks'] == {}
assert siblings(before) == siblings(after), 'Remote siblings changed'
local = load('dist-manifest.json')['files']
deployed = {name.removeprefix(prefix): value for name, value in after['files'].items() if name.startswith(prefix)}
assert local == deployed, 'Remote preview differs from final dist'
assert load('legacy-before.json') == load('legacy-after.json'), 'Legacy checkout files changed'
for label in ['legacy-status', 'legacy-refs', 'remote-main']:
    assert (evidence / f'{label}-before.txt').read_bytes() == (evidence / f'{label}-after.txt').read_bytes(), label
assert subprocess.check_output(['git', 'branch', '--show-current'], cwd=root, text=True).strip() == 'feat/astro-batch1'
assert subprocess.check_output(['git', 'remote'], cwd=root, text=True).strip() == ''
subprocess.run(['git', 'diff', '--exit-code', 'HEAD', '--', 'src/data/axes.json', 'src/pages/index.astro', 'astro.config.mjs', 'package.json', 'package-lock.json'], cwd=root, check=True)
report = {
    'remote_sibling_files_unchanged': len(siblings(before)),
    'remote_top_level_unchanged': after['top_level'],
    'remote_preview_file_matches': len(local),
    'changed_preview_files': [name for name, value in after['files'].items() if name.startswith(prefix) and before['files'].get(name) != value],
    'removed_preview_files': sorted(set(before['files']) - set(after['files'])),
    'legacy_file_count_unchanged': len(load('legacy-after.json')['files']),
    'legacy_status_unchanged': (evidence / 'legacy-status-after.txt').read_text(),
    'legacy_refs_unchanged': True,
    'github_main_unchanged': (evidence / 'remote-main-after.txt').read_text().strip(),
    'branch': 'feat/astro-batch1',
    'candidate_remotes': [],
    'canonical_axes_and_home_unchanged': True,
}
print(json.dumps(report, indent=2))
