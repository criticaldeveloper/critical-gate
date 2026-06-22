Regression for Bun projects: when `package.json` and `bun.lock` change together, the gate may still
warn about an added development dependency, but it must not report a missing companion lockfile.
