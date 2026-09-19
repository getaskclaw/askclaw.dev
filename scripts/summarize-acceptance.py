"""Print a compact summary of the complete JSONL browser evidence."""
import json
from pathlib import Path
import sys

for name in sys.argv[1:]:
    rows = [json.loads(line) for line in Path(name).read_text().splitlines() if line.startswith('{')]
    print(name, 'routes:', len(rows))
    for row in rows:
        selected = {key: row[key] for key in ['route', 'status', 'contentChars', 'initialTransfer', 'lcpMs', 'scriptTags', 'consoleMessages', 'consoleErrors', 'pageErrors', 'requestFailed', 'httpErrors', 'fontRequests', 'scriptRequests', 'forbiddenTerms', 'chipCount', 'presetRowCount', 'laneDataPreserved', 'rankOrderPreserved', 'chipInteractionPassed', 'kimiVendor', 'compositeExplanation', 'englishLeadPreserved', 'englishMirrorPassed', 'resultRepoCount', 'refreshStatus', 'refreshContentPreserved', 'mobileOverflow'] if key in row}
        for name, value in row.items():
            if isinstance(value, list):
                failures = [item for item in value if isinstance(item, dict) and item.get('passed') is False]
                if failures:
                    selected[name + '_failures'] = failures
        print(json.dumps(selected, ensure_ascii=False))
