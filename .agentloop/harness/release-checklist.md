# Release Checklist

## Pre-bump evidence

- [ ] Current package metadata reviewed.
- [ ] `agentloop npm-status --agentloopkit --expect-current` recorded while local package metadata still matches npm latest, or the version gap is explained.

## Local release verification

- [ ] Working tree reviewed.
- [ ] Changelog updated.
- [ ] Version selected.
- [ ] Typecheck passed.
- [ ] Tests passed.
- [ ] Build passed.
- [ ] `npm run release-flow` passed.
- [ ] Package contents reviewed.
- [ ] Publish command prepared.

## Post-publish proof

- [ ] `agentloop npm-status --agentloopkit --expect-current` passed after publishing.
- [ ] `agentloop release-proof` recorded after public release workflows finished.
- [ ] Rollback plan documented.
