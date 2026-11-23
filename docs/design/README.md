# Design documentation

This folder is the source of truth for how Bayaan looks and behaves. Read it before you build or change UI, and update it in the same PR when you change a rule.

| Document | What it covers | Status |
| --- | --- | --- |
| [design-system.md](design-system.md) | The design system **as it exists in code today**: themes, color tokens, typography, spacing, radii, scaling helpers, core components | Reference |
| [ipad-standards.md](ipad-standards.md) | **Normative** rules for iPad and large tablets: width classes, layout, type scale, touch/pointer targets, sheets, orientation, multitasking, accessibility, reading and listening patterns. Notes marked **Built** say what `develop` does today; [§13](ipad-standards.md#13-migration-plan) tracks migration and [§14](ipad-standards.md#14-known-open-issues) lists known open issues | Standard |
| [ipad-review-checklist.md](ipad-review-checklist.md) | The checklist to run before opening any PR that touches UI | Checklist |
| [screen-inventory.md](screen-inventory.md) | Every route, overlay, and sheet in the app, tagged by area. Use it as the index for app-wide design work | Inventory |

## How to use these docs

- **Building a screen or component?** Start with [ipad-standards.md](ipad-standards.md). Every rule there is written as **MUST**, **SHOULD**, or **MAY**. A MUST rule is a review blocker.
- **Need a token value?** Look it up in [design-system.md](design-system.md). Do not invent new hex values, radii, or font sizes in a component.
- **Opening a PR?** Walk through [ipad-review-checklist.md](ipad-review-checklist.md) and attach iPad screenshots (portrait and landscape).
- **Disagree with a rule?** Change it here in a PR with the reasoning, rather than diverging silently in code.
- **Finished an iPad PR?** Update its row in [§13](ipad-standards.md#13-migration-plan), add a **Built** note under the rule it implements, and add anything the simulator check found but the PR didn't fix to [§14](ipad-standards.md#14-known-open-issues).

## What the iPad build taught us

The first iPad build (PRs #425–#466, 2026-10-27 to 2026-10-29) turned the proposals below into code. The lessons that changed the standard:

- **Match the phone unless the iPad needs something different.** The iPad play button lost its tinted circle to match the phone (#463).
- **Window, not device or screen.** The tablet line is 600pt on the window's short side, so the unfolded iPhone Duo gets the tablet layouts (#448). `Dimensions.get('screen')` lies on the Duo.
- **No full-screen or full-width sheets on iPad.** Short lists are menus beside their button, everything else is a centered card; only the player and the two readers fill the screen (#427, #430, #431).
- **Rows need the page margin too.** Track rows are inset 24pt, 32pt from 900pt (#464).
- **Keep the user's place.** The reader keeps its page through rotation, spreads and window resizes (#444, #466).
- **Phones stay pixel-identical.** Every tablet change is gated, and every PR compares an iPhone shot with its before.

## Audits and proposals

Screen-by-screen audits of the current iPad experience live next to these docs as they land. Each audit lists weaknesses and proposed designs; once a proposal is accepted, the rule it implies is folded into [ipad-standards.md](ipad-standards.md) so the standard stays the single place to look.

| Area | Benchmarks | Document |
| --- | --- | --- |
| Reading (Mushaf, translation view, verse actions) | Tarteel, Quran.com, Apple Books | [reading/README.md](reading/README.md) |
| Listening (player, queue, reciters, browse) | Apple Music, Spotify | [listening/00-overview.md](listening/00-overview.md) |
| Navigation, shell, and other screens (sidebar, home, search, collection, settings, adhkar) | Apple Music, Files, Settings on iPadOS | [ipad-audit/README.md](ipad-audit/README.md) |
