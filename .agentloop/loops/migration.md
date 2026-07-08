# Migration Loop

Use this loop when changing schemas, data migrations, or irreversible state.

Required inputs:

- Migration goal
- Data affected
- Rollback strategy
- Human approval status

Process:

1. Stop for human review before irreversible changes.
2. Define forward and rollback path.
3. Add tests or dry-run commands where possible.
4. Keep migration files focused.
5. Verify application compatibility.

Acceptance criteria:

- Data risk is clear.
- Rollback plan is explicit.
- Deployment order is documented.

Verification:

- Run migration dry-run if available.
- Run tests and build.

Handoff output:

- Migration notes
- Rollback plan
- Human review checklist
