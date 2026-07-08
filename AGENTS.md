# AGENTS

<!-- agentloopkit:start -->

This repository uses AgentLoopKit.

Before changing code:

- Read AGENTLOOP.md.
- Check `.agentloop/state.json` for a pinned active task, then inspect `.agentloop/tasks/` for open task contracts.
- Use `agentloop task list` to inspect available task contracts before choosing one.
- Use `agentloop task show <path>` to read a task contract without changing active state.
- Use `agentloop task set <path>` when the active task is ambiguous.
- Use `agentloop task status <path> <status>` to update task state without hand-editing Markdown.
- Use `agentloop task done` after verification and review-readiness evidence when the active task is ready to close.
- Use `agentloop task archive <path>` only after verification and handoff or ship evidence are complete.
- Use `agentloop task doctor` when old task files or misplaced post-verification gates need a read-only cleanup checklist.
- Run `agentloop status` when you need the pinned active task, latest open task, parked deferred tasks, verification, dirty-file, and next-action state.
- Run `agentloop next` when you only need the next recommended loop command.
- Run `agentloop review-context` when an agent needs one read-only snapshot of task, gate, policy, artifact, run, and next-action state.
- Run `agentloop artifacts` when you need a read-only inventory of local task, report, handoff, badge, CI summary, release-note, and run evidence.
- Run `agentloop upgrade-harness` after updating AgentLoopKit to see whether older generated guidance should be reviewed manually.
- Run `agentloop policy list`, `agentloop policy show <policy>`, and `agentloop policy status` before touching security, dependency, database, git, public API, or secret-handling areas.
- Treat local `.agentloop/policies/*.md` files as the repo's safety guidance. A `modified` policy is a local decision to review, not a failure.
- Run `agentloop ship` before review to score evidence readiness, write a ship report, and record a run under `.agentloop/runs/`.
- Run `agentloop prepare-pr` after `ship` when a reviewer needs a PR title, grouped body, risks, rollback notes, and checklist.
- Run `agentloop maintainer-check` when evaluating whether an AI-assisted PR has enough evidence to review.
- Run `agentloop runs`, `agentloop show-run <id>`, and `agentloop intent <file>` to inspect local run history and file intent.
- Run `agentloop check-gates` when you need a quick evidence gate without the full ship report.
- Run `agentloop report` after verification and handoff or ship evidence when a local HTML evidence artifact helps review.
- Run `agentloop badge` when a local SVG evidence badge helps review or CI artifact uploads.
- Run `agentloop ci-summary --write` in CI when reviewers need a compact provenance and evidence summary.
- Run `agentloop release-notes --write` before a release when reviewers need local release-note evidence.
- Run `agentloop npm-status` before claiming npm availability in release notes or docs.
- Run `agentloop release-proof` after public release workflows finish before claiming cross-channel release proof.
- Follow the Specify, Constrain, Plan, Implement, Verify, Review, Handoff loop.
- Keep changes small and tied to the task contract.
- Do not run destructive git or filesystem commands unless the user asks for them.
- Do not read or print secrets. If env files exist, mention only their paths.
- Run the configured verification commands before claiming completion.
- Use AgentFlight for meaningful autonomous sessions: `npx --yes agentflight start --task "<task>" --yes`, `npx --yes agentflight status`, `npx --yes agentflight doctor`, and `npx --yes agentflight report`.
- After raw `agentflight start`, run `agentloop status --redact-paths`; if an AgentFlight placeholder becomes active, run `agentloop task set <path>` to re-pin the detailed AgentLoop task.
- Generate review evidence with changed files, tests run, risks, rollback notes, and reviewer checklist.

Agent roster:

Use these roles as routing hints when a coding-agent session needs focused expertise. One session may cover multiple roles, but the handoff should name which roles mattered.

- Product Maintainer: Use for scope, positioning, roadmap, backlog, and release-channel decisions. Owns README claims, ROADMAP.md, DECISIONS.md, and public tradeoffs.
- CLI Engineer: Use for command behavior, flags, JSON output, exit codes, path handling, and package-manager detection. Owns `src/cli/`, `src/core/`, and command tests.
- Template and Harness Engineer: Use for `init`, generated files, `.agentloop/` structure, task templates, policies, gates, and agent instructions. Owns `src/templates/`, template tests, and migration notes.
- Verification Engineer: Use for Vitest coverage, smoke scripts, CI workflows, release gates, and reproducible evidence. Owns `tests/`, `scripts/`, `.github/workflows/`, and verification reports.
- Security Reviewer: Use for file writes, command execution, env-file handling, dependency changes, publishing, and registry metadata. Blocks unsafe defaults and requires transparent user-facing behavior.
- Release Engineer: Use for npm, GitHub Releases, GitHub Marketplace, GHCR, MCP Registry, changelog entries, version bumps, tarballs, checksums, and post-release proof.
- Docs and DX Writer: Use for README, getting-started docs, examples, CLI copy, error messages, and install instructions. Keeps public docs user-facing and removes maintainer-only notes.
- Agent Compatibility Engineer: Use for Codex, Claude Code, Cursor, OpenCode, Gemini CLI, GitHub Copilot CLI, and generic-agent guidance. Keeps instructions tool-agnostic unless behavior is implemented.
- MCP and Automation Engineer: Use for read-only MCP server behavior, GitHub Action usage, CI summaries, and automation docs. Keeps automation local-first and reviewable.
- Repo Steward: Use for cleanup, file organization, small diffs, issue templates, contribution paths, and preserving unrelated user work.

When splitting work across agents:

- Keep the active task contract as the source of truth.
- Give each agent a disjoint file scope when possible.
- Do not let background work bypass verification, review, or handoff.
- Merge outputs through one final reviewer before claiming completion.

Safety rules:

- Treat migrations, auth, billing, deployment, lockfiles, public APIs, and security code as high-risk.
- Do not change dependencies without a clear reason and verification plan.
- Preserve existing user work. Do not revert unrelated changes.
- Update DECISIONS.md when architecture or public behavior changes.
<!-- agentloopkit:end -->


