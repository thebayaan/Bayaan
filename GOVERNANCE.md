# Bayaan Project Governance

This document describes how decisions are made in the Bayaan project.

## Overview

Bayaan is an open-source Quran recitation and reading app. The code is
licensed under AGPL-3.0-or-later. The "Bayaan" name and logo are trademarks
governed by [TRADEMARKS.md](TRADEMARKS.md).

Governance is intentionally lightweight: we favor fast decisions and clear
ownership over committees and voting.

## Roles

### Maintainer

The project is currently maintained by **@osmansaeday** as the sole owner
and final decision-maker (Benevolent Dictator model). The maintainer:

- Has final say on all technical, product, and community decisions
- Merges pull requests
- Cuts releases and ships to app stores
- Sets the project roadmap
- Enforces this governance document, the [Code of Conduct](CODE_OF_CONDUCT.md),
  and the [Trademark Policy](TRADEMARKS.md)

As the project grows, additional maintainers may be added. Maintainers are
added by invitation of the existing maintainer(s).

### Contributor

Anyone who submits a pull request, opens an issue, or participates in
discussions is a contributor. Contributors do not need to be appointed —
participation is open.

## How Decisions Are Made

### Technical & product decisions

Maintainers decide. Discussion happens in issues and pull requests. When
contributors disagree, the maintainer's call is final.

### Content decisions (translations, tafaseer, reciters)

Because Bayaan is a religious app, decisions about which translations,
tafaseer, and reciters to include have extra scrutiny:

1. **Translations and tafaseer** must come from well-known, mainstream
   scholarly sources with clear licensing. We will not bundle content we
   do not have explicit permission to redistribute.
2. **Reciters** are added only with the reciter's (or the rights-holder's)
   written permission to distribute the audio.
3. **Sectarian scope.** Bayaan aims to serve the broad mainstream Muslim
   community. Pull requests that add content from fringe, unattested, or
   sectarian-attack-oriented sources will be declined. This is not a
   judgment on any tradition — it is a scope decision for the official
   Bayaan build. Forks under a different name are free to take a
   different scope (see [TRADEMARKS.md](TRADEMARKS.md)).
4. **Accuracy.** Reports of incorrect Arabic text, missing diacritics,
   wrong ayah numbering, or misattributed translations are treated as
   high-priority bugs.

### Governance changes

Changes to this document, the Code of Conduct, or the Trademark Policy
are decided by the maintainer. Contributors may propose changes via pull
request or issue.

## Contributions

See [CONTRIBUTING.md](CONTRIBUTING.md) for the technical workflow (branches,
PR process, coding style, commit message format).

Code contributions are accepted under the project's AGPL-3.0-or-later
license. By submitting a pull request, you certify that you have the right
to license your contribution under those terms (see the
[Developer Certificate of Origin](https://developercertificate.org/)).

## Conflicts

Disputes between contributors are resolved by the maintainer. Reports of
Code of Conduct violations go to **conduct@thebayaan.com**. Security
issues go to **security@thebayaan.com** (see [SECURITY.md](SECURITY.md)).

## Forking

Forking is explicitly allowed and encouraged. If you disagree with a
decision and want to take the code in a different direction, fork it. You
must rename the fork and use your own branding per
[TRADEMARKS.md](TRADEMARKS.md).
