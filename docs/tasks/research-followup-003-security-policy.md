# Research Follow-Up 003: Security Policy

## Status

Open

## Why

The research report's `SECURITY.md` concern is real in the local tree.

Evidence:

- No root `SECURITY.md` exists.
- No `.github/SECURITY.md` exists.
- Security-sensitive behavior exists in the product: secret redaction, LLM prompt boundaries, SARIF output, CI/action usage, and local git hooks.

The project should have a clear vulnerability reporting path before broader adoption.

## Tasks

1. Add `SECURITY.md` with supported versions or release stages.
2. Document responsible disclosure contact or GitHub private vulnerability reporting expectations.
3. Clarify what should be reported: secret leakage, unsafe prompt content, action execution risks, hook behavior, and analyzer crashes that expose sensitive data.
4. Link the policy from README and installation or usage docs where security posture is discussed.

## Validation

- `pnpm format`
- Manual review for no private contact details or secrets
