# Database Change Policy

Treat schema and data changes as high-risk.

Rules:

- Ask for human review before irreversible migrations.
- Document forward and rollback steps.
- Do not edit production data from an agent session.
- Keep migration files focused.
- Run migration tests or dry-runs when available.
