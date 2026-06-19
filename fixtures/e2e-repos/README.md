# E2E Fixture Repositories

The E2E tests materialize these cases as temporary git repositories instead of storing `.git`
directories in the repository.

Each case creates a `main` baseline, applies a feature-branch diff, and runs the Critical Gate CLI
against `main` so git diff, history, graph, solution, and pattern indexes are exercised together.
