# Evidence-Strength Calibration Protocol

## Current Claim Boundary

Critical Gate's `evidenceStrength` values are deterministic heuristic scores. They rank how strongly
the available repository and diff signals support a finding. They are not probabilities that a
finding is correct, and `0.84` must not be interpreted as an 84% correctness probability.

The current evaluation corpus is useful for deterministic regression testing, but it is too small
and too curated to calibrate probabilities. Until this protocol's data gates are met, reports must
use evidence-strength language and fixed policy thresholds must remain engineering policy choices.

## Unit Of Calibration

Calibration is performed by detector subtype, never as one global model. A subtype represents one
stable detection mechanism with comparable evidence. Examples include:

- `test-weakening/assertion-deletion`;
- `api-surface/export-removal`;
- `secret-path/absolute-local-path`;
- `expected-companions/missing-lockfile`.

Changing a subtype's evidence inputs, score formula, or matching boundary creates a new calibration
revision. Detector-wide metrics may be reported as rollups, but they cannot justify a subtype's
blocking threshold.

## Labeled Observation

Each observation must contain:

- immutable case ID and calibration revision;
- detector and subtype;
- repository ID stored as a stable pseudonymous hash;
- task-family and diff-family IDs used for grouping related cases;
- raw heuristic evidence strength and impact severity;
- emitted policy decision;
- reviewer label: `useful`, `false-positive`, or `missed`;
- review timestamp and evidence notes;
- source: fixture, replay, or dogfood run.

Only manually reviewed labels count toward calibration. Duplicate findings from the same underlying
diff and detector subtype form one group so repeated runs cannot inflate sample size.

## Dataset Split

Assign groups, not individual findings, to one immutable split:

1. **Development**: detector implementation and fixture refinement.
2. **Calibration**: fit any score mapping and select candidate policy thresholds.
3. **Holdout**: one-time unbiased evaluation of a frozen detector revision and mapping.

Group by repository and task/diff family before splitting. A repository or near-duplicate task must
not cross splits. Prefer a time-based holdout from repositories or task families not used during
development. Store the split assignment with the case and never move a reviewed holdout case back
to development.

Holdout labels remain hidden from threshold selection. If holdout results drive implementation or
threshold changes, that holdout is retired into development and a new untouched holdout is required.

## Minimum Data Gates

Do not publish probability-like metrics or fit a calibration mapping for a subtype unless both the
calibration and holdout splits independently contain:

- at least 100 grouped observations;
- at least 20 useful findings;
- at least 20 false positives;
- at least 3 repositories or independent task families.

These are minimum gates, not proof of adequacy. Report sample counts and class balance beside every
metric. Subtypes below a gate remain heuristic and must not display probability-like values.

## Metrics

For an eligible subtype, calculate on the untouched holdout:

- Brier score for overall probabilistic error;
- expected calibration error (ECE), using bins that each contain at least 20 observations;
- a reliability table and diagram with predicted rate, observed useful rate, and sample count;
- precision and recall at each candidate blocking threshold;
- false-positive rate with a 95% Wilson interval.

Never report ECE without its binning rule and sample counts. Avoid fixed ten-bin diagrams when they
produce sparse bins. Metrics are diagnostic evidence; they do not automatically authorize blocking.

## Threshold Governance

Choose candidate thresholds using development and calibration data only. A threshold can replace a
manual policy value when:

- the subtype meets all minimum data gates;
- its detector revision and mapping are frozen before holdout evaluation;
- holdout precision meets the subtype's documented blocking quality bar;
- the false-positive interval is acceptable for the intended rollout;
- repair-loop evidence shows the finding is actionable;
- the threshold and evidence are reviewed in a dedicated change.

Do not lower thresholds merely to improve recall. Keep under-sampled or unstable subtypes in
observation mode. A threshold change requires fixtures for the new boundary and must not reuse the
holdout to tune the result.

## Artifact Contract

When enough data exists, generate versioned JSON and Markdown artifacts under
`artifacts/calibration/`. Each artifact must include:

- dataset version, detector revision, and generation timestamp;
- split counts, repository/task-family counts, and class balance;
- subtype score mapping and candidate threshold;
- Brier score, ECE definition and value, reliability bins, and uncertainty intervals;
- explicit gate failures for under-sampled subtypes;
- hashes of input label manifests so the result is reproducible.

The generator must fail on split overlap, duplicate group IDs across splits, missing manual-review
labels, or a holdout used for threshold selection. Generated artifacts are evidence, not runtime
inputs, until a separately reviewed threshold change adopts them.

## Near-Term Work

1. Extend evidence labels with stable subtype, group, revision, and split metadata.
2. Add split-overlap and duplicate-group validation to evidence aggregation.
3. Grow cross-repository labels without changing thresholds to fit early results.
4. Implement calibration artifacts only after at least one subtype approaches the minimum gates.
5. Run the first frozen-revision holdout and document the threshold decision, including a decision
   to remain heuristic when the evidence is insufficient.
