---
name: sample-skill
description: >
  A sample skill for testing the cc-bridge translation pipeline.
  USE WHEN user says "sample", "test skill".
when_to_use: When the user asks for a sample operation.
allowed-tools:
  - Bash
  - Read
  - Edit
model: sonnet
effort: high
context: fork
paths:
  - "src/**"
shell: bash
---

# Sample Skill

This skill demonstrates various Claude Code features.

## Steps

1. Use the `Read` tool to examine the file
2. Use `Edit` to make changes
3. Run `Bash` to verify: `uv run pytest`
4. Use `WebFetch` to check the docs

The skill accepts arguments via $ARGUMENTS.
