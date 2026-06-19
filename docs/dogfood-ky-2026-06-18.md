# Dogfood Pass: sindresorhus/ky

Date: 2026-06-18

Target repository: `sindresorhus/ky`

Critical Gate version: `2.0.0` local development build

## Goal

Tune false positives by running Critical Gate against a real TypeScript repository history instead
of hand-written fixtures.

This pass used the 12 most recent commits in `ky` at the time of testing. Each commit was checked
with:

```bash
node C:\dev\critical-gate\dist\cli.js check --task "<commit subject>" --base HEAD~1 --format json
```

The commit subject was used as task intent because that mirrors a common CI fallback when PR text
is unavailable.

## Summary

| Metric           | Before tuning | After tuning |
| ---------------- | ------------: | -----------: |
| Commits checked  |            12 |           12 |
| Failing commits  |             5 |            2 |
| Total findings   |            30 |           26 |
| Blocker findings |             0 |            0 |
| High findings    |             5 |            2 |

## Tuned False Positives

### Version-only release commits

Commits `0a24c44`, `e9eeb35`, and `7d23d68` only changed the `package.json` version field and had
SemVer-like commit subjects such as `2.0.2`.

Before tuning, scope detection treated these as high-severity unrelated manifest changes. That was
too noisy for real package maintenance.

Change made:

- Scope detection now suppresses manifest scope findings when the task looks like a release/version
  task and the package manifest diff only changes the `version` field.
- Non-version manifest edits during release tasks still remain in scope for findings.

### Localhost examples in documentation

Commit `7f2eade` added a README example containing `http://localhost:3000`.

Before tuning, the secret/path detector reported this as an internal URL leak. In documentation, a
localhost URL is often a harmless runnable example.

Change made:

- Documentation files still scan for blocker-grade secrets and provider token patterns.
- Documentation and test files no longer emit non-secret environment findings for
  localhost/internal URLs or absolute local paths.

## Findings Kept

### `2971991` - `Improve compatibility with custom fetch implementations (#858)`

The gate still fails this commit because `source/core/Ky.ts` has 115 changed lines with balanced
additions/deletions during a compatibility task. This is a reasonable high-signal rewrite warning:
it should push the author or agent to justify the broader rewrite or split it.

### `2df9b7e` - `Fix hook state leaks and fetch option forwarding`

The gate still fails this commit because it reports an API-surface finding plus several medium
scope findings across a broad runtime/test/doc change. That remains useful for a diff integrity
gate: the change may be valid, but it deserves explicit public API acknowledgement.

### `7f2eade` - `Readme tweaks`

The gate still emits medium scope findings because the commit title says README tweaks while the
diff changes many runtime and type files. These findings do not fail the gate by default, and the
signal is useful for agent repair loops.

## Follow-ups

- Improve source path/topic matching so task terms such as `fetch`, `hook`, or `Safari errors` can
  align with nearby symbols and hunks, not only file paths.
- Add a first-class dogfood command or script that records commit sample results without relying on
  ad hoc shell loops.
- Consider a separate release detector so version/changelog/package-lock patterns can be reasoned
  about as release hygiene instead of scope exceptions.
