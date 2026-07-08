# Review Gate

Purpose: make the diff reviewer-ready.

Checklist:

- Diff matches acceptance criteria.
- Unrelated changes are removed.
- Risk files are reviewed.
- Handoff includes tests, risks, and rollback notes.

Pass criteria:

- A reviewer can understand the change without reconstructing the session.

Fail criteria:

- Summary omits verification or changed behavior.

Escalation triggers:

- Large diff
- Ambiguous acceptance criteria
- Conflicting requirements
