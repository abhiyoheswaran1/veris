# Security Review Loop

Use this loop when reviewing code for security risk.

Required inputs:

- Assets at risk
- Trust boundaries
- Auth, secrets, and data flows
- Known threat model

Process:

1. Identify sensitive files and inputs.
2. Check secret handling without reading secret values.
3. Review auth, permissions, command execution, and dependency changes.
4. Document findings with severity and evidence.
5. Recommend narrow fixes.

Acceptance criteria:

- Findings cite files and behavior.
- False positives are marked.
- Fixes avoid broad rewrites.

Verification:

- Run tests.
- Run audit tooling when configured.

Handoff output:

- Findings
- Risk rating
- Recommended fixes
