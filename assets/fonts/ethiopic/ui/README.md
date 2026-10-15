# Bayaan UI Ethiopic font derivatives

These seven OFL-1.1 faces combine the repository's existing Manrope glyphs with the pinned Noto Sans Ethiopic 2.102 faces in the parent folder. They use the reserved-name-safe family **Bayaan UI Ethiopic**. Both projects' copyright notices and the complete license are in [OFL.txt](OFL.txt).

The Noto files cover Ethiopic but lack Latin letters. Platform fallback was acceptable for the earlier separate UI-font preview; the upstream registry now requires explicit Latin coverage for languages that show English catalog names. Combining the faces also retains the original Manrope glyphs used by Latin interface and content text.

| UI face | Latin source | Ethiopic source |
| --- | --- | --- |
| Regular | Manrope Regular | Noto Sans Ethiopic Regular |
| Medium | Manrope Medium | Noto Sans Ethiopic Medium |
| SemiBold | Manrope SemiBold | Noto Sans Ethiopic SemiBold |
| Bold | Manrope Bold | Noto Sans Ethiopic Bold |
| Light | Manrope Light | Noto Sans Ethiopic Regular |
| ExtraLight | Manrope ExtraLight | Noto Sans Ethiopic Regular |
| ExtraBold | Manrope ExtraBold | Noto Sans Ethiopic Bold |

`manifest.json` pins every source/output SHA-256 and byte count. Original Manrope, Noto, Arabic and Quran assets are unchanged. Combined font payload: **2,677,600 bytes**; this is a source/export payload measurement, not installed app size or startup impact.

Rebuild with Python and the project's existing pinned glyph dependencies (`scripts/rewayah/requirements-ci.txt`: FontTools 4.66.1, uharfbuzz 0.56.3):

```bash
python scripts/build-ethiopic-ui-fonts.py
python scripts/verify-ethiopic-ui-fonts.py
python scripts/verify-ethiopic-ui-fonts.py --export-dir .expo/amharic-ui-completion-export
```

The build rescales only Ethiopic from 1000 to Manrope's 2000 units/em and removes Ethiopic hint programs before rescaling. Manrope geometry, advances and line metrics remain original. All Ethiopic ink fits those line metrics. The verification enforces every source/output hash and output byte count in the manifest, derivative family/PostScript names, every original Manrope cmap glyph's decomposed geometry and horizontal metrics, font line/weight metrics, six Latin HarfBuzz samples per face, and every Ethiopic character in the draft resources/name/brand, including Unicode extensions. The optional export check requires all seven exact font hashes in the exported assets. Failures remain enabled under Python's optimized mode. Composite glyph names may be renamed by the merger; geometry and shaping are compared independently of those names.

Seven faces cover all **189 distinct Ethiopic characters** in the current 1,322 populated resource leaves plus its language name and approved brand. Light/ExtraLight retain their original Latin weights but use regular Ethiopic; ExtraBold retains its Latin weight and uses bold Ethiopic. Fluent and native typography review is still required, including clipping, accessibility sizes and both platform shapers. Do not advertise release readiness from the cmap/shaping check alone.

The i18n CI workflow runs the font verifier with the same dependency pins. Coverage reads decoded JSON string values, so Unicode-escaped translations receive the same glyph checks as literal Ethiopic text. A regression fixture removes a glyph from a temporary derivative and confirms an escaped resource using it fails verification. Original assets are never modified by these tests. Export hash verification remains a separate local check after an Expo export; CI's source-font job does not establish installed size, startup time or native rendering quality.
