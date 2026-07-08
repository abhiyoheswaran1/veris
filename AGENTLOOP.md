# AgentLoopKit

AgentLoopKit gives coding agents a repeatable engineering loop inside this repo.

## Loop

1. Specify: turn the request into a task contract with outcome, constraints, non-goals, likely files, and files not to touch.
2. Constrain: define safety rules, dependency rules, verification commands, and rollback notes.
3. Plan: inspect relevant files, identify risks, and write a short implementation plan.
4. Implement: make focused changes and avoid unrelated formatting churn.
5. Verify: run configured checks and capture pass or fail results.
6. Review: inspect the diff against the task contract and identify risks.
7. Handoff: summarize changed files, verification, risks, rollback notes, and reviewer checklist.

## Repo Layout

- .agentloop/loops/: workflow templates for different task types.
- .agentloop/gates/: checklists for implementation, tests, review, regression, docs, security, and dependencies.
- .agentloop/policies/: practical safety policies for agents.
- .agentloop/tasks/: task contracts for agentic coding sessions.
- .agentloop/reports/: verification reports, ship reports, HTML evidence reports, and local badges.
- .agentloop/handoffs/: PR summaries and reviewer handoffs.
- .agentloop/harness/: repo-specific working agreement, commands, and checklists.
- .agentloop/runs/: local run ledger entries for ship, verify, and handoff evidence.
- .agentloop/state.json: active task pointer created by `agentloop create-task` or `agentloop task set`.

## Commands Detected During Init

- Package manager: npm
- Project type: typescript-package
- Test: npm run test
- Lint: npm run lint
- Typecheck: npm run typecheck
- Build: npm run build
- Format: not configured

Use `agentloop task list` to inspect available task contracts. `agentloop create-task` activates the contract it writes. Use `agentloop task show <path>` to read one without changing active state. Use `agentloop task set <path>` to switch active tasks when a repo has multiple contracts. Use `agentloop task status <path> <status>` to update the task contract state. Use `agentloop task done` after verification and handoff or ship evidence to mark the active task done. Use `agentloop task archive <path>` to move a finished contract into `.agentloop/tasks/archive/` without deleting it. Use `agentloop task doctor` to find missing, legacy, unsupported, terminal, or misplaced post-verification gate task issues without mutating task files. Use `agentloop verify --post-verification-gates` only after reviewing the active task's post-verification gates and deciding they should run after the report exists. Use `agentloop status` to inspect the pinned active task, latest open task, parked deferred tasks, latest verification report, working tree state, and next suggested command. Use `agentloop next` when an agent or script only needs the next recommended loop command. Use `agentloop review-context` when agents need one read-only snapshot of task, gate, policy, artifact, run, and next-action state. Use `agentloop artifacts` when reviewers or agents need a read-only inventory of local task, report, handoff, badge, CI summary, release-note, and run evidence. Use `agentloop upgrade-harness` after updating AgentLoopKit to inspect older generated guidance without overwriting local edits. Use `agentloop policy list`, `agentloop policy show <policy>`, and `agentloop policy status` to inspect local safety guidance and template drift before risky edits. Use `agentloop ship` before review to score evidence readiness, write a ship report, and record a run under `.agentloop/runs/`. Use `agentloop prepare-pr` after `ship` when reviewers need a PR title, grouped body, risks, rollback notes, and checklist. Use `agentloop maintainer-check` when evaluating whether an AI-assisted PR has enough evidence to review. Use `agentloop runs`, `agentloop show-run <id>`, and `agentloop intent <file>` to inspect local run history and file intent. Use `agentloop check-gates` when you need a quick evidence gate without the full ship report. Use `agentloop check-gates --strict` in CI when warning gates should fail. Use `agentloop report` after verification and handoff or ship evidence when reviewers need one local HTML evidence artifact. Use `agentloop badge` when reviewers or CI need a local SVG status badge. Use `agentloop ci-summary --write` in CI when reviewers need a compact provenance and evidence summary. Use `agentloop release-notes --write` before a release when reviewers need local release-note evidence. Use `agentloop npm-status` before claiming npm availability in release notes or docs. Use `agentloop release-proof` after public release workflows finish before claiming cross-channel release proof.

If the active task looks stale or mismatched with recent reports, run `agentloop task doctor` before using long devlogs or changelogs as task context.

Local files under `.agentloop/policies/` are the repo's policy source of truth. Bundled templates are comparison material. Treat `modified` policy status as a prompt to read the local rule, not as a reason to overwrite it.

## Autonomous Work

Agents may work autonomously inside the task contract. They should stop and ask before changing protected areas, adding dependencies, introducing breaking public APIs, or taking destructive actions.

If you start AgentFlight directly with `npx --yes agentflight start --task "<task>" --yes`, run `agentloop status --redact-paths` afterward. If an AgentFlight placeholder becomes the active task, use `agentloop task set <path>` to re-pin the detailed AgentLoop task contract before continuing.

No agent should claim completion without verification evidence or a clear statement of what was not verified.


