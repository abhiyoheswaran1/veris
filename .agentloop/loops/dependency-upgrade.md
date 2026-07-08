# Dependency Upgrade Loop

Use this loop when adding or upgrading dependencies.

Required inputs:

- Package name
- Reason for change
- Version target
- Lockfile policy

Process:

1. Explain why the dependency change is needed.
2. Inspect changelog or release notes when available.
3. Update package and lockfile.
4. Run focused and full verification.
5. Document compatibility risks.

Acceptance criteria:

- Dependency change is justified.
- Lockfile change is intentional.
- No unrelated package churn is included.

Verification:

- Run install, tests, typecheck, and build.

Handoff output:

- Package changed
- Risk notes
- Rollback command
