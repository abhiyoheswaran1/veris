# Security Gate

Purpose: force caution around sensitive changes.

Checklist:

- Secrets are not read or printed.
- Env files are only reported by path.
- Command execution is explicit and user-triggered.
- Auth, permission, and crypto changes are reviewed.

Pass criteria:

- Sensitive behavior is clear and verified.

Fail criteria:

- The change adds hidden network calls, telemetry, or credential access.

Escalation triggers:

- Secrets
- Auth
- Shell execution
- File deletion
- Network behavior
