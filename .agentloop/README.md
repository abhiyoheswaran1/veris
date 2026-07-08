# AgentLoopKit Workspace

This directory contains repo-local engineering loop artifacts for coding agents and reviewers.

`manifest.json` records the AgentLoopKit template generation used to create this harness. `agentloop doctor` reads it and warns when the local harness is missing template metadata, older than the current CLI, invalid, or newer than the CLI supports.

## Start Here

1. Read `../AGENTS.md`.
2. Read `../AGENTLOOP.md`.
3. Create or inspect a task contract.

First task to try:

```bash
agentloop create-task --type feature --title "Describe the next focused change" \
  --problem-statement "What problem should this change solve?" \
  --desired-outcome "What should be true when the work is done?" \
  --acceptance "The changed behavior is covered by an explicit check" \
  --verification "npm run test" \
  --risk "Touches user-facing behavior and needs regression coverage" \
  --rollback "Revert the focused change"
```

Then pin it before implementation starts:

```bash
agentloop task list
agentloop task show .agentloop/tasks/<task-file>.md
agentloop task set .agentloop/tasks/<task-file>.md
agentloop task status .agentloop/tasks/<task-file>.md in-progress
agentloop task done
agentloop task archive .agentloop/tasks/<task-file>.md
agentloop task doctor
```

Use `agentloop task done` after verification and handoff or ship evidence when the active task is ready to close. Archive only after a task is done. The archive command moves one named Markdown file into `.agentloop/tasks/archive/` and keeps normal task lists focused. Use `agentloop task doctor` when old task files or misplaced post-verification gates need a read-only cleanup checklist.

4. Check current loop state:

```bash
agentloop status
agentloop next
agentloop review-context
agentloop artifacts
agentloop upgrade-harness
```

5. Inspect safety policies when the task touches protected areas:

```bash
agentloop policy list
agentloop policy show security
agentloop policy status
```

Local policy files are repo guidance. If `policy status` reports `modified`, read the local file and follow the repo-specific rule. Do not overwrite customized policy text just to match the bundled template.

6. Run verification when work is ready:

```bash
agentloop verify
agentloop verify --task <path> --task-commands
```

7. Ship review-readiness evidence:

```bash
agentloop ship
agentloop prepare-pr
agentloop maintainer-check
```

`ship` writes a Markdown readiness report under `reports/`, calculates an evidence score, and records a run under `.agentloop/runs/`. The score checks whether reviewers have task, verification, gate, handoff, and risk evidence. It does not measure code quality.
`prepare-pr` drafts a PR title, grouped body, reviewer checklist, risks, rollback notes, and optional GitHub-comment Markdown.
`maintainer-check` is read-only and helps reviewers decide whether an AI-assisted PR has enough evidence to review.

8. Optional: generate a reviewer handoff:

```bash
agentloop handoff
```

9. Optional: inspect run history and file intent:

```bash
agentloop runs
agentloop runs --latest
agentloop show-run <id>
agentloop intent <file>
```

The run ledger uses local metadata only. It helps agents and reviewers see which runs touched a file and why.

10. Optional: write a local HTML evidence report:

```bash
agentloop report
```

11. Optional: write a local SVG evidence badge:

```bash
agentloop badge
agentloop badge --source gates
```

12. Optional: write a CI summary:

```bash
agentloop ci-summary
agentloop ci-summary --write
```

13. Optional: draft release notes:

```bash
agentloop release-notes
agentloop release-notes --write
```

14. Optional: check npm registry catch-up:

```bash
agentloop npm-status
agentloop npm-status --agentloopkit --expect-current
```

15. Optional: check post-release proof:

```bash
agentloop release-proof
agentloop release-proof --strict
```

16. Check review gates:

```bash
agentloop check-gates
agentloop check-gates --strict
```

`check-gates` inspects local evidence. It does not run tests or call an LLM.
`review-context` returns one read-only snapshot with status, gates, policies, artifacts, recent runs, latest ship evidence, and next action.
`artifacts` inventories existing local task, report, handoff, badge, CI summary, release-note, and run evidence without writing files.
`upgrade-harness` reads existing generated guidance and reports missing current-loop topics such as `ship`, `prepare-pr`, `runs`, `intent`, `review-context`, and `maintainer-check`. It does not overwrite edited harness files.
`report` reads local evidence and writes one static HTML file under `reports/`.
`badge` reads local evidence and writes SVG files under `reports/`.
`ci-summary` reads allowlisted CI provenance and local evidence, then writes Markdown under `reports/` when `--write` is passed.
`release-notes` reads local package, changelog, git, task, verification, and CI-summary evidence, then writes Markdown under `handoffs/` when `--write` is passed.
`release-proof` checks post-release proof across npm, GitHub Releases, GitHub Marketplace, GHCR, and MCP Registry.
`npm-status` compares local package metadata with npm registry metadata. Use `--agentloopkit` when checking AgentLoopKit itself from a release smoke directory, CI workspace, or another folder. It does not publish packages or read credentials.
Use `--strict` in CI when warning gates should fail.

CI can either check committed AgentLoop evidence or generate reports and handoffs as build artifacts. Do not let CI commit generated files unless maintainers explicitly want that behavior.

When GitHub Actions runs `agentloop verify`, the report records allowlisted CI provenance fields such as workflow, event, ref, commit, run URL, and run attempt. AgentLoopKit does not print arbitrary environment variables.

Use `agentloop ci-summary --write` after verification and handoff when CI should upload one compact Markdown summary. It does not run checks or replace the verification report.

Use `agentloop release-notes --write` before a release when CI or maintainers need a local release-note draft. It does not create tags, publish packages, call provider APIs, or read tokens.

Use `agentloop release-proof` after public release workflows finish when CI or maintainers need proof that npm, GitHub Releases, GitHub Marketplace, GHCR, and MCP Registry match the local package version. It does not publish, tag, upload, post comments, or read tokens.

Use `agentloop npm-status --agentloopkit --expect-current` after AgentLoopKit npm publish when CI or maintainers need proof that npm latest matches the running AgentLoopKit package version. It refuses `.env` paths for `--registry-json` and does not publish packages, read tokens, read `.env` files, or change package metadata.

## Directories

- `loops/`: task-specific workflows
- `manifest.json`: generated template version metadata
- `gates/`: pass/fail checklists
- `policies/`: safety rules
- `tasks/`: task contracts
- `reports/`: verification reports
- `handoffs/`: PR summaries and reviewer briefs
- `agents/`: agent-specific instructions
- `harness/`: repo working agreement and commands

## Monorepo Notes

When this repository has workspace markers, use both root and package-level checks as needed. Put package-specific verification commands in the task contract so agents and reviewers can see what the change requires.

Examples:

```bash
pnpm --filter <package> test
npm --workspace <package> test
cd packages/<name> && npm test
```

Root checks are useful when they cover the touched package. If they do not, say what was not verified in the handoff.
