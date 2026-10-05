# RFC-001: Workspace structure and RFC convention

| Field    | Value                                              |
| -------- | -------------------------------------------------- |
| Status   | Proposed                                           |
| Date     | 2026-04-30                                         |
| Author   | Omar Zarka                                         |

## Summary

Add an npm workspace at `packages/*` so reusable platform layers can live alongside the application without forking into a separate repository, and establish a `docs/rfcs/` convention so larger architectural changes can be proposed and reviewed in bounded chunks. This RFC is itself the first instance of the convention — its scope is intentionally small.

## Motivation

The Bayaan codebase combines two kinds of code:

1. **Application concerns** — UI, screens, navigation, branding, app-specific stores.
2. **Platform concerns** — audio engine, mushaf rendering, rewayat logic, downloads. These don't depend on Bayaan's UI and could in principle serve additional consumers (an alternate UI, a web client, a headless tool).

Today they live intermixed. Whenever someone wants to reuse a platform layer — even informally, e.g. for testing in isolation — they have to navigate the application layer to find it.

A workspace layout fixes this without committing to anything else. Adding `packages/*` is purely structural. No code moves yet. Future RFCs can propose extracting specific concerns into their own packages, each as a separate decision.

The RFC convention exists for the same reason: split larger architectural changes into focused proposals that can be reviewed individually. A 4,000-word grand-design document forces the reviewer to consent to dozens of decisions at once. A series of 500-word RFCs lets each decision be debated, modified, or rejected on its own.

## Decision

### Workspace

Add an npm workspaces declaration at the repository root:

```json
"workspaces": ["packages/*"]
```

The `packages/` directory is created with a `.gitkeep` placeholder. No package code lands in this RFC — the first package is proposed in RFC-002.

`npm install` from the repository root continues to work unchanged. Once packages exist, npm will hoist their dependencies and link `@bayaan/<name>` imports to the workspace copies automatically.

### RFC convention

Create `docs/rfcs/` containing:

- `000-template.md` — a single-page template for new RFCs
- `001-workspace-and-rfc-convention.md` — this document

Each subsequent RFC PR follows the same shape:

1. Adds exactly one `docs/rfcs/NNN-title.md` document, numbered sequentially.
2. May include scaffolding the design enables, as long as it does not change observable behavior — for example, new types, contract test fixtures, CI workflow files, or empty package skeletons.
3. Does **not** include refactors of existing services. Refactors land as named follow-up PRs that reference the merged RFC. This keeps each RFC's diff small enough to review alongside the design discussion, and avoids wasted code if the design needs revision.

`CONTRIBUTING.md` gets a one-paragraph section pointing at the convention and adding `rfc/<short-title>` to the existing branch-naming list.

## Alternatives considered

### A — Single-app, no workspace

Continue with the current flat layout. Keep platform and application code intermixed.

Rejected because every future "extract this into a reusable layer" conversation reopens the question of where reusable code should live. Adding the workspace once, separately from any extraction, makes future RFCs about *what to extract* rather than *where to put it*.

### B — Separate `bayaan/platform` repository

Stand up a parallel repo for reusable modules. Application stays in `thebayaan/Bayaan`, platform lives elsewhere.

Rejected for now. Cross-repo refactors (move code from app repo to platform repo) require coordinated PRs across both repositories, doubling review burden for every extraction. Single-repo workspace lets refactor-then-move land in a single PR series. The separate-repo option remains available later if the platform genuinely outgrows being a workspace.

### C — pnpm or yarn workspaces

Both offer better install performance and stricter hoisting than npm workspaces.

Rejected for this RFC. Bayaan currently uses npm. Switching package managers is a separate decision worth its own RFC if install-time performance becomes a real problem; not worth bundling into this proposal. npm workspaces are sufficient for the immediate need.

### D — RFC convention in GitHub Discussions

Use the Discussions tab for design proposals. Lighter-weight than committing markdown.

Rejected because Discussions don't sit alongside the code that implements them. RFCs as committed markdown make the design record visible from the repository, navigable from the file tree, and durable across changes in third-party tools. The discussion thread on the RFC PR is itself a Discussions-like artifact, attached to the doc.

## Consequences

**Positive**

- A clear pattern for proposing larger architectural changes incrementally.
- Future cross-cutting work (e.g., extracting the audio engine into a package) has a place to live before the extraction PR series begins.
- New contributors find `docs/rfcs/000-template.md` and can produce a sensible RFC without further guidance.

**Neutral**

- `npm install` behavior unchanged.
- Build and run scripts unchanged.
- `packages/` is empty until RFC-002.

**Negative / risks**

- The RFC convention adds a small process overhead per architectural change. Mitigated by keeping each RFC focused — anything small enough to skip the RFC step should just open a normal PR.

## How we'll know it worked

- The merged change passes existing CI (lint + tsc) without modification to other workflows.
- A subsequent RFC (RFC-002) lands a real package under `packages/` without re-litigating the workspace setup.
- The contribution guide's "Pull request workflow" section now distinguishes RFC PRs from regular PRs.

## Open questions (deferred)

- The package manager (npm vs pnpm vs yarn). Revisitable when install performance or hoisting strictness becomes a problem.
- Test runner organization across packages (per-package Jest config vs shared). Deferred to RFC-003.
- Static-grep CI gates for package conventions (e.g., "no consumer state imported from packages"). Deferred to RFC-003.

## Roadmap (informative — not committed by this RFC)

This RFC establishes the convention only. Anticipated near-term RFCs that will use it:

- RFC-002: `@bayaan/types` shared primitives
- RFC-003: CI gates and contract test runners (`@bayaan/test-utils`)
- RFC-004: Audio extraction seam (`PlayerController` and sibling ports)
- RFC-005: Mushaf split (data / render / rewayat)
- RFC-006: Governance and shared maintainership

Each lands as its own PR. Each can be rejected, deferred, or modified independently. None depend on this RFC for anything beyond the workspace and the docs directory existing.
