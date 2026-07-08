# No Destructive Actions Policy

Agents must not delete files, reset branches, discard changes, rewrite history, or remove dependencies unless the user asks for that specific action.

Allowed without extra approval:

- Reading files
- Creating task contracts, reports, and summaries
- Editing files required by the task contract

Requires explicit approval:

- `git reset`
- `git checkout --`
- `rm -rf`
- Dropping migrations or data
- Replacing existing instructions wholesale
