# After shots for the listening fixes

Captured 2026-10-29 on the same iOS 26.2 simulators as the parent folder. Before shots are in `../`.

## Row margins (branch `claude/project-thread-lcn5ew-row-margin`, commit c4158b3f)

Track rows now sit 24pt in from the pane edges with rounded corners. No double margins, nothing touches an edge.

- `ipad13-portrait-collection-loved-after-row-margin.png`: Loved, 13" portrait. Before: `../ipad-pro-13-portrait-collection-loved.png`.
- `ipad13-portrait-playlist-detail-after-row-margin.png`: Playlist detail, 13" portrait. Before: `../ipad-pro-13-portrait-playlist-detail.png`.
- `ipad13-portrait-collection-downloads-after-row-margin.png`: Downloads, 13" portrait (empty state, nothing downloaded).
- `ipad11-portrait-collection-loved-after-row-margin.png`: Loved, 11" portrait. Before: `../ipad-air-11-portrait-collection-loved.png`, where rows ran to the right screen edge.
- `ipad11-portrait-collection-downloads-after-row-margin.png`: Downloads, 11" portrait (empty state).

No 11" playlist detail shot: that simulator has no playlist.

## Reader page drift (branch `claude/project-thread-m6zzp9`, commit bacf2910)

- `ipad13-portrait-reader-bug1-fix-start.png`: Mushaf opened at page 2.
- `ipad13-landscape-reader-bug1-fix.png`: Rotated to landscape. The spread shows pages 1 and 2 and the header still says Page 2 (develop said Page 1).
- `ipad13-portrait-reader-bug1-fix-after-rotate-back.png`: Rotated back to portrait, still on page 2. Before: `../ipad13-portrait-reader-bug1-after-rotate-back.png` landed on page 1.
