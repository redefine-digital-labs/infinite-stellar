# GitHub Actions Activation

`ci.yml` is the reviewed release workflow. Install it as
`.github/workflows/ci.yml` after the repository credential used for the change
has GitHub's `workflow` scope. The current OAuth credential can write source
code but GitHub rejects workflow-file updates without that additional scope.

The workflow uses Node.js 24, the locked npm dependency graph, the pinned Sui
testnet 1.78.1 toolchain, strict Move checks, the web/SDK test suite, Markdown
linting, live verification of the immutable testnet deployment record, and an
official Circom 2.2.3 source build followed by development proof/adversarial
relation tests. Development setup material remains forbidden in production.
