# Multi-Repository 2.10.0 Evidence Analysis

## Scope

This review covers 53 newly collected Critical Gate 2.10.0 runs:

| Repository             | Reports | Findings | Useful | False positives | Missed/Manual gaps | Repair attempts |
| ---------------------- | ------: | -------: | -----: | --------------: | -----------------: | --------------: |
| `criticaldeveloper-ft` |       3 |        0 |      0 |               0 |                  0 |               0 |
| `diegolopes-ft`        |       1 |        5 |      0 |               5 |                  0 |               0 |
| `tamagotchi`           |      49 |      521 |    133 |             344 |                 65 |               2 |

The three FT tasks provide useful clean-run evidence across localized content, a narrow visual fix,
and a readonly TypeScript contract correction. The Diego Lopes loader task exposed five
expected-companion false positives. Tamagotchi supplied the broadest evidence across React UI,
domain simulation, persistence, Tauri integration, packaging, tests, and documentation.

## Strongest Product Signal

Expected companions accounted for 313 of Tamagotchi's 344 classified false positives. Stable
finding IDs split the signal sharply:

| Companion source      | Useful | False positives | Interpretation                                                             |
| --------------------- | -----: | --------------: | -------------------------------------------------------------------------- |
| React framework rules |     40 |              54 | Source/test prompts were useful; story prompts were not.                   |
| Git history rules     |      1 |             251 | Arbitrary co-change was not precise enough to become a repair requirement. |

The React source/test subtype produced 40 useful and 7 false-positive classifications. The React
story subtype produced 47 false positives and no useful classifications across 31 reports. React
does not establish Storybook or CSS Modules conventions by itself.

History-derived noise was dominated by three patterns:

- `ROADMAP.md` co-changing with implementation while tasks were marked complete;
- evidence indexes co-changing with implementation after dogfood export;
- shell, style, renderer, and domain files co-changing frequently during rapid application growth.

Those correlations describe the development sequence, not required file relationships. Current
calibration therefore requires a typed normal relationship, such as source/test, component/story,
translation/UI, config/docs, or package/lockfile, before history can emit a companion finding.
Planning and evidence files are excluded as historical companion sources and targets.

## Useful Findings Retained

The evidence does not support disabling expected companions wholesale. React source/test prompts
were the most consistently useful companion subtype and remain enabled. Public API findings were
also useful for making added and removed exports visible during domain and desktop work, even when
the changes were intentional.

The native-notification task supplied the strongest repair-loop evidence. The first run identified:

- an unnecessary JavaScript notification dependency when a Rust Tauri command could own the
  native boundary;
- a weakened first-run test assertion.

The repair removed the dependency, restored assertion specificity, stayed inside task scope, and
passed the rerun. This is the kind of deterministic, repairable evidence Critical Gate should
optimize for.

## Missed-Finding Interpretation

The 65 missed/manual-gap labels are not 65 independent detector misses:

- 33 repeat the same known missing `.ico` packaging prerequisite across successive runs;
- 8 record manual visual QA needs;
- the remainder primarily record desktop, tray, sleep/resume, animation, or packaging checks that
  were not automated in those task runs;
- one label records a real UI write-error visibility issue.

These observations should improve required-check reporting and project validation discipline. They
do not justify broad visual or desktop heuristics in the deterministic detector layer.

## Implemented Calibration

- React framework rules now retain source/test coverage only.
- Story findings require the Storybook framework pack.
- React no longer implies CSS Modules.
- History findings require a typed normal relationship.
- Roadmap, plan, backlog, and dogfood evidence paths cannot become historical companions.
- `eval/cases/react-without-storybook-001` preserves the repeated story false-positive regression.
- Unit tests cover untyped historical pairs and planning-file suppression.

## Next Evidence Cycle

Re-run varied React, Astro, and Tauri tasks after the next package release. The key measurements are:

1. React source/test usefulness remains high without story or style noise.
2. History findings are limited to typed relationships and do not flood fast-moving repositories.
3. The Diego Lopes layout-owned loader no longer receives unrelated history companions; the one
   remaining Astro framework-style observation should be reviewed separately before calibration.
4. Repair-loop samples grow beyond the current two Tamagotchi reports.
5. Repeated manual checks are passed as structured required-check evidence where automation exists.
