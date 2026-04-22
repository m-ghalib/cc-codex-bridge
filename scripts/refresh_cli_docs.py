"""Fetch upstream CLI docs into docs/platform-snapshots/ for drift detection.

Run weekly via .github/workflows/cli-refresh.yml, or on demand:

    uv run python scripts/refresh_cli_docs.py

Each adapter declares doc_urls. We GET each one and write the response bytes
to docs/platform-snapshots/<adapter.id>/<slug>. Git diff on the resulting tree
is the drift report — no parsing, no schema extraction.
"""

from __future__ import annotations

import os
import re
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from pmkit.publish.platforms.claude_code import ClaudeCodeAdapter
from pmkit.publish.platforms.codex import CodexAdapter
from pmkit.publish.platforms.gemini import GeminiAdapter

REPO_ROOT = Path(__file__).resolve().parent.parent
SNAPSHOT_ROOT = REPO_ROOT / "docs" / "platform-snapshots"
USER_AGENT = "pmkit-refresh-cli-docs (+https://github.com/m-ghalib/product-os)"
TIMEOUT_S = 30


def slug_for(url: str) -> str:
    parsed = urlparse(url)
    path = parsed.path.strip("/") or "index"
    slug = re.sub(r"[^a-zA-Z0-9._-]+", "_", f"{parsed.netloc}_{path}")
    if not Path(slug).suffix:
        slug += ".txt"
    return slug


def fetch(url: str) -> bytes:
    headers = {"User-Agent": USER_AGENT, "Accept": "*/*"}
    token = os.environ.get("GITHUB_TOKEN")
    if token and "api.github.com" in url:
        headers["Authorization"] = f"Bearer {token}"
    req = Request(url, headers=headers)
    with urlopen(req, timeout=TIMEOUT_S) as resp:
        return resp.read()


def _fetch_one(adapter_id: str, url: str, dest: Path) -> tuple[Path, bytes] | None:
    try:
        body = fetch(url)
    except Exception as e:
        print(f"  [{adapter_id}] [warn] {url}: {e}", file=sys.stderr)
        return None
    return dest, body


def main() -> int:
    adapters = (ClaudeCodeAdapter(), GeminiAdapter(), CodexAdapter())
    tasks = []
    for adapter in adapters:
        print(f"[{adapter.id}] pinned={adapter.pinned_version}")
        out_dir = SNAPSHOT_ROOT / adapter.id
        out_dir.mkdir(parents=True, exist_ok=True)
        for url in adapter.doc_urls:
            tasks.append((adapter.id, url, out_dir / slug_for(url)))

    with ThreadPoolExecutor(max_workers=8) as pool:
        for result in pool.map(lambda t: _fetch_one(*t), tasks):
            if result is None:
                continue
            dest, body = result
            dest.write_bytes(body)
            print(f"  wrote {dest.relative_to(REPO_ROOT)} ({len(body)} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
