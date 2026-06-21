# Security Policy

## Supported Versions

Critical Gate is currently in a pre-stable dogfood release stage. Security fixes target the latest
released version and the current `main` branch. Older dogfood releases do not receive long-term
security maintenance unless a release note explicitly says otherwise.

## Reporting A Vulnerability

Report suspected vulnerabilities through GitHub private vulnerability reporting for this repository:

https://github.com/criticaldeveloper/critical-gate/security/advisories/new

Do not open a public issue for a vulnerability until it has been triaged and a maintainer confirms
that public disclosure is appropriate.

Include enough detail to reproduce the issue safely:

- Affected version, commit, or branch.
- Operating system and Node.js version.
- The command, action, hook, or extension flow involved.
- Minimal reproduction steps or a sanitized fixture.
- Whether any secrets, private paths, internal URLs, prompts, SARIF output, logs, or reports were
  exposed.

Do not include live credentials, private tokens, proprietary source code, or unredacted customer data
in the report. Use synthetic values or clearly marked redactions.

## What To Report

Please report issues such as:

- Secret values, local absolute paths, internal URLs, prompt content, or private repository data
  appearing unredacted in JSON, Markdown, SARIF, repair output, logs, caches, or editor diagnostics.
- LLM prompt construction that can send more repository context than the documented compact artifact
  allows.
- GitHub Action, Codex hook, local git hook, or VS Code extension behavior that executes unexpected
  commands or mutates files outside the documented workflow.
- Analyzer crashes that dump sensitive input data.
- Cache or artifact behavior that stores sensitive data in unexpected locations.
- Dependency, packaging, or release-artifact behavior that could run unreviewed code.

## Out Of Scope

The following are usually not security vulnerabilities by themselves:

- Expected gate findings about intentionally added test fixtures or synthetic secrets.
- False positives or false negatives in detector judgment unless they expose sensitive data or enable
  unsafe execution.
- Reports that reveal changed file names, line numbers, or detector categories that the user already
  chose to analyze locally or in CI.

## Handling Expectations

Security reports are triaged before normal feature work. The project may request a sanitized
reproduction if the report depends on private repository content. Confirmed vulnerabilities should
receive:

- A scoped fix or documented mitigation.
- Tests or fixtures when practical.
- Release notes when a released artifact is affected.
- Coordinated disclosure through the GitHub advisory when appropriate.
