"""Read-only file manifest for deployment containment checks."""
import hashlib
import json
from pathlib import Path
import sys

root = Path(sys.argv[1]).resolve(strict=True)
files = {}
links = {}
for path in sorted(root.rglob("*")):
    relative = path.relative_to(root)
    if ".git" in relative.parts:
        continue
    if path.is_symlink():
        links[str(relative)] = str(path.readlink())
    elif path.is_file():
        if path.name.startswith(".env") or path.suffix in {".key", ".pem"}:
            raise RuntimeError(f"Unexpected credential file: {relative}")
        content = path.read_bytes()
        files[str(relative)] = {"bytes": len(content), "sha256": hashlib.sha256(content).hexdigest()}
print(json.dumps({"root": str(root), "top_level": sorted(p.name for p in root.iterdir() if p.name != ".git"), "files": files, "symlinks": links}, indent=2))
