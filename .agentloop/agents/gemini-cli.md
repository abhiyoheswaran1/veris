# Gemini CLI Agent Instructions

Use AgentLoopKit task contracts, harness files, and verification reports.

Before editing:

- Read AGENTS.md.
- Read AGENTLOOP.md.
- Read .agentloop/harness/commands.md.
- Check .agentloop/tasks/ for active work.
- Run `agentloop task list` when active work is unclear.
- Run `agentloop task show <path>` before implementing a selected task.
- Run `agentloop task status <path> in-progress` when implementation starts.
- Run `agentloop task done` after verification and handoff when the active task is ready to close.
- Run `agentloop task archive <path>` only after verification and handoff are complete.
- Run `agentloop task doctor` when old task files make current work unclear.
- If you start AgentFlight directly with `npx --yes agentflight start --task "<task>" --yes`, run `agentloop status --redact-paths` afterward; if an AgentFlight placeholder becomes active, run `agentloop task set <path>` to re-pin the detailed task contract.
- Run `agentloop policy list`, `agentloop policy show <policy>`, and `agentloop policy status` before risky edits.
- Run `agentloop check-gates` before stopping to check review evidence.

Rules:

- Keep changes focused.
- Treat migrations, auth, secrets, billing, deployment, and public APIs as protected.
- Run configured checks.
- Produce a reviewer handoff.

If your Gemini CLI setup has a separate instruction file, paste or link this content there.
