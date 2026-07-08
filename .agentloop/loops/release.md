# Release Loop

Use this loop when preparing a release.

Required inputs:

- Version target
- Changelog entries
- Package checks
- Publish owner

Process:

1. Confirm working tree and branch.
2. Run typecheck, tests, build, and pack.
3. Update changelog and release notes.
4. Review package contents.
5. Handoff publish commands and risks.

Acceptance criteria:

- Package builds and packs.
- Changelog matches shipped changes.
- Release notes are reviewer-ready.

Verification:

- Run configured checks.
- Run package dry-run or pack command.

Handoff output:

- Release checklist
- Verification report
- Publish notes
