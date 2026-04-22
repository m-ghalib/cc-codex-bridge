"""Fetch upstream CLI docs into docs/platform-snapshots/ for drift detection.

Run weekly via .github/workflows/cli-refresh.yml, or on demand:

    uv run python scripts/refresh_cli_docs.py

The source registry is repo-local on purpose. `cc-bridge` only tracks the
Claude Code and Codex docs needed for the v1 bridge surface, so the refresher
should not depend on the old product-os adapter package or pull Gemini docs.
Git diff on the resulting tree is the drift report — no parsing, no schema
extraction.
"""

from __future__ import annotations

import os
import re
import sys
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen

REPO_ROOT = Path(__file__).resolve().parent.parent
SNAPSHOT_ROOT = REPO_ROOT / "docs" / "platform-snapshots"
USER_AGENT = "cc-bridge-refresh-cli-docs (+https://github.com/mominabrarghalib/cc-bridge)"
TIMEOUT_S = 30


@dataclass(frozen=True)
class DocSource:
    id: str
    pinned_version: str
    doc_urls: tuple[str, ...]


SOURCE_REGISTRY: tuple[DocSource, ...] = (
    DocSource(
        id="claude_code",
        pinned_version="2.1.108",
        doc_urls=(
            "https://registry.npmjs.org/@anthropic-ai/claude-code/latest",
            "https://docs.claude.com/en/docs/claude-code/skills.md",
            "https://docs.claude.com/en/docs/claude-code/hooks.md",
            "https://docs.claude.com/en/docs/claude-code/settings.md",
            "https://docs.claude.com/en/docs/claude-code/sub-agents.md",
            "https://docs.claude.com/en/docs/claude-code/slash-commands.md",
        ),
    ),
    DocSource(
        id="codex",
        pinned_version="0.120.0",
        doc_urls=(
            "https://developers.openai.com/codex/skills",
            "https://developers.openai.com/codex/guides/agents-md",
            "https://developers.openai.com/codex/hooks",
            "https://developers.openai.com/codex/config-reference",
            "https://developers.openai.com/codex/concepts/sandboxing",
        ),
    ),
)


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


def iter_sources() -> tuple[DocSource, ...]:
    return SOURCE_REGISTRY


def _build_tasks(
    sources: tuple[DocSource, ...] | None = None,
    snapshot_root: Path | None = None,
) -> list[tuple[str, str, Path]]:
    sources = iter_sources() if sources is None else sources
    snapshot_root = SNAPSHOT_ROOT if snapshot_root is None else snapshot_root
    tasks: list[tuple[str, str, Path]] = []
    for source in sources:
        print(f"[{source.id}] pinned={source.pinned_version}")
        out_dir = snapshot_root / source.id
        out_dir.mkdir(parents=True, exist_ok=True)
        for url in source.doc_urls:
            tasks.append((source.id, url, out_dir / slug_for(url)))
    return tasks


def write_snapshot(dest: Path, body: bytes) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(body)


def refresh_sources(
    sources: tuple[DocSource, ...] | None = None,
    snapshot_root: Path | None = None,
    repo_root: Path | None = None,
) -> int:
    snapshot_root = SNAPSHOT_ROOT if snapshot_root is None else snapshot_root
    repo_root = REPO_ROOT if repo_root is None else repo_root
    tasks = _build_tasks(sources=sources, snapshot_root=snapshot_root)

    if not tasks:
        print("[warn] no doc sources configured", file=sys.stderr)
        return 0

    max_workers = min(8, len(tasks))
    if max_workers == 0:
        return 0

    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        for result in pool.map(lambda task: _fetch_one(*task), tasks):
            if result is None:
                continue
            dest, body = result
            write_snapshot(dest, body)
            print(f"  wrote {dest.relative_to(repo_root)} ({len(body)} bytes)")
    return 0


def main() -> int:
    return refresh_sources()


if __name__ == "__main__":
    sys.exit(main())
