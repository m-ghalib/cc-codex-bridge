---
paths:
  - "tests/**"
---

When working in test files:
- Use pytest fixtures, not setUp/tearDown
- Use `tmp_path` for file system tests
- Mock external services, never hit real APIs in tests
