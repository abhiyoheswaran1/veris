# Implementation Gate

Purpose: prevent vague work from turning into broad diffs.

Checklist:

- Task contract exists or the request is small enough to state inline.
- Files in scope are identified.
- Files not to touch are identified.
- Protected areas are called out.
- Plan has no unrelated refactors.

Pass criteria:

- The intended change is concrete.
- The implementation path is narrow.

Fail criteria:

- The task requires guessing product behavior.
- The agent needs to change protected areas without approval.

Escalation triggers:

- Public API change
- Dependency change
- Migration
- Secret or auth handling
