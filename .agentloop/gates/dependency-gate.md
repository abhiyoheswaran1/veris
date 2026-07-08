# Dependency Gate

Purpose: keep package changes intentional.

Checklist:

- Reason for dependency change is documented.
- Package manager and lockfile changes are consistent.
- No install scripts are added.
- Verification ran after install.

Pass criteria:

- Dependency change is scoped and reviewed.

Fail criteria:

- Lockfile churn is unexplained.

Escalation triggers:

- New runtime dependency
- Package with postinstall behavior
- Security advisory
