"""Tests for scripts.readers.context."""

from __future__ import annotations

import shutil
from pathlib import Path

from scripts.readers.context import read_context

FIXTURE_ROOT = (
    Path(__file__).resolve().parents[1] / "fixtures" / "claude_config"
)


def _copy_fixture(tmp_path: Path) -> Path:
    dest = tmp_path / "project"
    shutil.copytree(FIXTURE_ROOT, dest)
    return dest


def test_reads_main_claude_md(tmp_path: Path) -> None:
    root = _copy_fixture(tmp_path)

    ctx = read_context(root)

    assert "Test Project" in ctx["main"]
    assert "uv run pytest" in ctx["main"]


def test_reads_claude_local_md(tmp_path: Path) -> None:
    root = _copy_fixture(tmp_path)

    ctx = read_context(root)

    assert ctx["local"] is not None
    assert "Debug mode is enabled" in ctx["local"]
    assert "API key is in .env file" in ctx["local"]


def test_rule_with_paths_frontmatter(tmp_path: Path) -> None:
    root = _copy_fixture(tmp_path)

    ctx = read_context(root)

    by_name = {r["filename"]: r for r in ctx["rules"]}
    testing = by_name["testing.md"]
    assert testing["paths"] is not None
    # fixture uses a YAML list; accept either list or scalar glob.
    if isinstance(testing["paths"], list):
        assert "tests/**" in testing["paths"]
    else:
        assert testing["paths"] == "tests/**"
    assert "pytest fixtures" in testing["content"]
    # frontmatter fence should not leak into content
    assert not testing["content"].lstrip().startswith("---")


def test_rule_without_paths_frontmatter(tmp_path: Path) -> None:
    root = _copy_fixture(tmp_path)

    ctx = read_context(root)

    by_name = {r["filename"]: r for r in ctx["rules"]}
    general = by_name["general.md"]
    assert general["paths"] is None
    assert "composition over inheritance" in general["content"]


def test_resolves_import(tmp_path: Path) -> None:
    main = tmp_path / "CLAUDE.md"
    main.write_text(
        "# Root\n\nBefore.\n@imports/details.md\nAfter.\n",
        encoding="utf-8",
    )
    (tmp_path / "imports").mkdir()
    (tmp_path / "imports" / "details.md").write_text(
        "Inlined detail content.\n",
        encoding="utf-8",
    )

    ctx = read_context(tmp_path)

    assert "Before." in ctx["main"]
    assert "Inlined detail content." in ctx["main"]
    assert "After." in ctx["main"]
    # import line itself should be gone
    assert "@imports/details.md" not in ctx["main"]


def test_nested_imports_resolved(tmp_path: Path) -> None:
    (tmp_path / "CLAUDE.md").write_text("@a.md\n", encoding="utf-8")
    (tmp_path / "a.md").write_text("level-a\n@b.md\n", encoding="utf-8")
    (tmp_path / "b.md").write_text("level-b\n", encoding="utf-8")

    ctx = read_context(tmp_path)

    assert "level-a" in ctx["main"]
    assert "level-b" in ctx["main"]
    assert "@a.md" not in ctx["main"]
    assert "@b.md" not in ctx["main"]


def test_max_import_depth(tmp_path: Path) -> None:
    # 6 files: 0 -> 1 -> 2 -> 3 -> 4 -> 5. Depth counter starts at 0 when
    # reading CLAUDE.md, so we allow 5 levels of imports (through file 5).
    # File 5 importing file 6 should NOT be inlined (depth cap reached).
    (tmp_path / "CLAUDE.md").write_text("@d1.md\n", encoding="utf-8")
    for i in range(1, 6):
        (tmp_path / f"d{i}.md").write_text(
            f"line-{i}\n@d{i + 1}.md\n", encoding="utf-8"
        )
    (tmp_path / "d6.md").write_text("line-6\n", encoding="utf-8")

    ctx = read_context(tmp_path)

    for i in range(1, 6):
        assert f"line-{i}" in ctx["main"]
    # The deepest file should not be inlined; its import line survives.
    assert "line-6" not in ctx["main"]
    assert "@d6.md" in ctx["main"]


def test_circular_imports_do_not_loop(tmp_path: Path) -> None:
    (tmp_path / "CLAUDE.md").write_text("@a.md\n", encoding="utf-8")
    (tmp_path / "a.md").write_text("a-content\n@b.md\n", encoding="utf-8")
    (tmp_path / "b.md").write_text("b-content\n@a.md\n", encoding="utf-8")

    ctx = read_context(tmp_path)

    assert "a-content" in ctx["main"]
    assert "b-content" in ctx["main"]


def test_missing_claude_md_returns_empty_main(tmp_path: Path) -> None:
    ctx = read_context(tmp_path)

    assert ctx["main"] == ""
    assert ctx["local"] is None
    assert ctx["rules"] == []


def test_missing_rules_directory_returns_empty_list(tmp_path: Path) -> None:
    (tmp_path / "CLAUDE.md").write_text("hello\n", encoding="utf-8")

    ctx = read_context(tmp_path)

    assert ctx["main"] == "hello\n"
    assert ctx["rules"] == []


def test_missing_local_file_returns_none(tmp_path: Path) -> None:
    (tmp_path / "CLAUDE.md").write_text("hello\n", encoding="utf-8")

    ctx = read_context(tmp_path)

    assert ctx["local"] is None


def test_rule_without_any_frontmatter(tmp_path: Path) -> None:
    rules_dir = tmp_path / ".claude" / "rules"
    rules_dir.mkdir(parents=True)
    (rules_dir / "plain.md").write_text("just a plain rule.\n", encoding="utf-8")

    ctx = read_context(tmp_path)

    assert len(ctx["rules"]) == 1
    rule = ctx["rules"][0]
    assert rule["paths"] is None
    assert rule["filename"] == "plain.md"
    assert rule["content"] == "just a plain rule.\n"
