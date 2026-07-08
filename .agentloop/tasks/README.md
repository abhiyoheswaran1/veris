# Task Contracts

Create task contracts with:

```bash
agentloop create-task
agentloop create-task --type feature --title "Add settings page" \
  --problem-statement "Users cannot manage account preferences" \
  --desired-outcome "Users can update settings from the app" \
  --likely-file src/settings \
  --forbidden-file migrations/ \
  --acceptance "Settings can be saved" \
  --verification "pnpm test" \
  --post-verification "npm run dogfood:strict" \
  --risk "Touches account preferences" \
  --rollback "Remove the settings route"
```

Task contracts turn fuzzy requests into scoped engineering work. A good contract names the desired outcome, constraints, non-goals, likely files, files not to touch, acceptance criteria, verification commands, post-verification gates, and rollback notes.

Use verification commands for checks that `agentloop verify --task-commands` can run before a report exists. Use post-verification gates for checks that need existing AgentLoop evidence, such as `npm run dogfood:strict`, `agentloop ship`, `agentloop prepare-pr`, `agentloop check-gates`, `agentloop maintainer-check`, or reviewer handoff checks. Those gates run only when `agentloop verify --post-verification-gates` is passed.

Verification command list items may be written as plain list text or Markdown inline code, for example `- npm test` or ``- `npm test` ``. AgentLoopKit unwraps one balanced inline-code wrapper before execution.

Supported task types are `feature`, `bugfix`, `refactor`, `tests`, `test-generation`, `docs`, `release`, `security-review`, `dependency-upgrade`, and `migration`.

In monorepos, include package-specific verification commands when root commands do not prove the touched package. Examples include `pnpm --filter <package> test`, `npm --workspace <package> test`, or a package-local command from inside `packages/<name>`.

When several task contracts exist, pin the one in progress:

```bash
agentloop task list
agentloop task show .agentloop/tasks/<task-file>.md
agentloop task set .agentloop/tasks/<task-file>.md
agentloop task status .agentloop/tasks/<task-file>.md in-progress
agentloop task done
agentloop task archive .agentloop/tasks/<task-file>.md
agentloop task doctor
```

`agentloop task list --json` is safe for agents and scripts. It reads task files and does not create or update `.agentloop/state.json`.
`agentloop create-task` sets the new contract as the active task. `agentloop create-task --json` returns the created task path, Markdown content, and active-task metadata for scripts and agents.
For unsupported `--type` values, `agentloop create-task --json` returns a parseable error with `supportedTaskTypes` and writes no task file.
`agentloop task show --json` returns one task contract's metadata and Markdown content without changing active state.
`agentloop task status --json` updates only the task contract's `- Status:` line. Supported statuses are `proposed`, `in-progress`, `blocked`, `deferred`, `review`, and `done`. Use `deferred` for parked work that should stay visible without becoming the next unpinned task.
`agentloop task done --json` marks the active task `done`. Pass a path when the task is not active.
`agentloop task archive --json` moves one named task contract into `.agentloop/tasks/archive/` after verification and handoff. It preserves the Markdown file and refuses to overwrite an existing archive file.
`agentloop task doctor --json` reports task-folder hygiene issues without editing, archiving, or deleting task files. It also warns when likely post-verification gates are listed under `Verification Commands`.
