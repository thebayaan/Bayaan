# Digital Khatt Rendering

This file now serves as the short entrypoint for the full Digital Khatt documentation set.

For complete implementation and debugging detail, go to:

- `docs/features/digital-khatt/README.md`

Recommended read order:

1. `docs/features/digital-khatt/architecture.md`
2. `docs/features/digital-khatt/data-pipeline.md`
3. `docs/features/digital-khatt/rendering-pipeline.md`
4. `docs/features/digital-khatt/justification-engine.md`
5. `docs/features/digital-khatt/debugging-playbook.md`
6. `docs/features/digital-khatt/development-guide.md`
7. `docs/features/digital-khatt/glossary.md`

## Quick Summary

- Uthmani Mushaf rendering uses a Skia-based pipeline (`SkiaPage` + `SkiaLine`).
- Content comes from bundled SQLite assets loaded by `DigitalKhattDataService`.
- `QuranTextService` tokenizes lines and classifies spaces.
- `JustService` computes width fitting with space controls plus OpenType feature expansion.
- `surah_name` lines are RN text overlays, not Skia ayah-line rendering.
- Layout results are persisted in AsyncStorage (`dk_layout_*`) and in-memory cache.
