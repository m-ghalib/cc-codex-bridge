"""Regression tests for `scripts.refresh_cli_docs`."""

from __future__ import annotations

from pathlib import Path

import pytest

from scripts import refresh_cli_docs


def test_source_registry_matches_v1_bridge_scope() -> None:
    sources = refresh_cli_docs.iter_sources()

    assert [source.id for source in sources] == ["claude_code", "codex"]
    assert all(source.doc_urls for source in sources)
    assert all(url.startswith("https://") for source in sources for url in source.doc_urls)
    assert not any(source.id == "gemini" for source in sources)


def test_refresh_writes_only_under_platform_snapshots(
    monkeypatch, tmp_path: Path
) -> None:
    repo_root = tmp_path / "repo"
    snapshot_root = repo_root / "docs" / "platform-snapshots"

    monkeypatch.setattr(refresh_cli_docs, "REPO_ROOT", repo_root)
    monkeypatch.setattr(refresh_cli_docs, "SNAPSHOT_ROOT", snapshot_root)
    monkeypatch.setattr(
        refresh_cli_docs,
        "fetch",
        lambda url: f"snapshot:{url}".encode("utf-8"),
    )

    rc = refresh_cli_docs.main()

    assert rc == 0

    written_files = sorted(path for path in repo_root.rglob("*") if path.is_file())
    expected_count = sum(len(source.doc_urls) for source in refresh_cli_docs.iter_sources())

    assert len(written_files) == expected_count
    assert written_files
    assert all(path.is_relative_to(snapshot_root) for path in written_files)

    sample = snapshot_root / "codex" / refresh_cli_docs.slug_for(
        "https://developers.openai.com/codex/skills"
    )
    assert sample.read_text(encoding="utf-8") == (
        "snapshot:https://developers.openai.com/codex/skills"
    )


@pytest.mark.parametrize(
    ("url", "expected"),
    [
        ("https://api.github.com/repos/m-ghalib/cc-bridge", True),
        ("http://api.github.com/repos/m-ghalib/cc-bridge", False),
        ("https://api.github.com.evil.example/repos/m-ghalib/cc-bridge", False),
        ("https://evil.example/api.github.com", False),
        ("https://api.github.com@evil.example/repos/m-ghalib/cc-bridge", False),
        ("not-a-url", False),
    ],
)
def test_should_attach_github_token_only_for_exact_https_api_host(
    url: str, expected: bool
) -> None:
    assert refresh_cli_docs.should_attach_github_token(url) is expected
