# Maestro flows

Run in CI by `.github/workflows/sim-builds.yml` on an iOS simulator, against a
Release simulator build (no Metro). Start a run from the Actions tab, with
`gh workflow run sim-builds.yml -f ref=<ref> [-f upgrade_from=<older ref>]`,
or by adding the `sim-qa` label to a PR into develop. Screenshots are in the
run's `qa-output` artifact.

- `flows/*.yaml`: each runs on a clean install of the build.
- `upgrade/<case>/before.yaml` and `after.yaml`: run only with an older build
  (`upgrade_from`, or the PR's base). `before` runs on the old build, then the
  new build is installed over it, keeping its data, and `after` runs.
- `common/`: shared steps.

The app has no testIDs, so flows match visible text. Spots without a label
(the mushaf settings icon on iOS 26, verses on the Skia canvas) are tapped by
screen position, measured on an iPhone 17 Pro.

To iterate on flows without rebuilding, pass `-f builds_from_run=<run id>` to
reuse an earlier run's builds. Locally: `scripts/ci/run-sim-qa.sh app.zip
[base.zip]` with builds downloaded from a run.
