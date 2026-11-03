# Preview consumer upgrades without changing installed files

Consumers can compare their pinned package or lock with a reviewed target
before installing it. The read-only CLI reports file, API, parameter and
dependency changes, local conflicts and declared/unknown inventory impact.
It never writes packages, lock or configuration and preserves side-by-side
pack/verify/rollback.

Validation: isolated multi-release fixtures cover byte/mtime immutability,
API-only/schema-only changes, unknown inventory, corruption, pins and conflicts.
Real rc7→rc8 dry-run and independent review passed. Full local tools/test.py
with Chrome and separate seven-tool MCP protocol passed; remote CI not run
because automatic approval rejected push/workflow. See update-preview.md.

Closes #69 after review and authorized merge. No consumer migration or deploy.
