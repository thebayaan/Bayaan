# iPad simulator screenshots: listening screens

Captured 2026-10-29 on iOS 26.2 simulators, light theme. All shots run develop at
`ad520313` (JS via Metro on an SDK 57 dev-client build) unless the line says otherwise.
No landscape test patch was needed: develop already lets iPads rotate
(`UIRequiresFullScreen: false`, portrait lock is phone-only), so every landscape shot
is current code.

Devices: `ipad-pro-13` is iPad Pro 13" (M5), `ipad-air-11` is iPad Air 11" (M3).
The iPad mini was dropped to save disk space. PNGs are downscaled to 1400px.

Test data: playing Mishary Alafasi (Play all, so the queue has ~112 tracks), Loved has
Al-Baqarah, Ali 'Imran and Al-Kahf (13") or the first two (11"), one playlist "Evening
Listening" with 2 surahs. Nothing downloaded, so Downloads shows its empty state.

## Audit claims checked

| Claim | Result |
|---|---|
| Browse-all-reciters grid overflows on the right | Not reproduced on 13" or 11", portrait or landscape. Grid ends with a normal margin; only the rewayah chip row scrolls sideways (intended). |
| Reciter profile clipped, or swipes landing mid-page | Not reproduced. Rewayah tabs switch cleanly (I switched by tab press, not by swipe, so swipe snapping is untested). |
| 150-230pt blank space at the end of lists | Not reproduced. Home, Browse All and the profile surah list end with roughly 60-80pt after the last row. |
| Oversized text (reciter name ~63pt on 13") | Not reproduced. Profile name renders around 34pt. |
| Portrait player squeezes verses to phone width | Not reproduced on 13": portrait uses two panes (art and controls left, verses right, ~430pt column). 11" portrait is single column with full-width verses and a floating control card. |
| Full-width bottom sheets | Not reproduced. Surah options and Add to Collection open as centered cards on 13". |
| "Choose reciter for surah" opens the profile instead of playing | Fixed on develop. Tapping a reciter starts that surah and stays on the list (mini player updates). |

## Other things seen

- Browse All on 13" lists "Yasser Salamah" twice near the end (`ipad-pro-13-portrait-browse-all-reciters-end.png`).
- Tapping a surah card on the Surahs tab opens the mushaf reader, not a reciter picker; the picker is on long-press there, and on tap in Browse All Surahs.
- Loved and playlist rows sit on a grey filled band; on 11" portrait the band runs to the right screen edge with no margin.
- 11" portrait swaps the sidebar for an icon rail with an artwork-only mini player; the full sidebar returns in 11" landscape.
- Collection screens in landscape use a centered column capped near 600pt, leaving wide empty sides on 13".
- After a JS reload the speed, options and sleep-timer sheets would not open for me (also with real taps), so those shots are missing. Likely a side effect of how I drove the app, not confirmed as an app bug.
- Search shots were driven by feeding the query to the search bar, so the bar itself looks empty while results show "Mishary".

## Files

### iPad Pro 13", portrait (develop)
- `ipad-pro-13-portrait-home-top.png`: Home, top.
- `ipad-pro-13-portrait-home-scrolled.png`: Home, scrolled.
- `ipad-pro-13-portrait-home-bottom.png`: Home, end of list.
- `ipad-pro-13-portrait-search.png`: Search, empty query.
- `ipad-pro-13-portrait-search-results-mishary.png`: Search results for "Mishary".
- `ipad-pro-13-portrait-browse-all-reciters.png`: Browse All reciters grid.
- `ipad-pro-13-portrait-browse-all-reciters-end.png`: Browse All, end of list (duplicate Yasser Salamah).
- `ipad-pro-13-portrait-surah-tap-opens-mushaf.png`: Tapping a surah card on the Surahs tab opens the reader.
- `ipad-pro-13-portrait-choose-reciter-for-surah.png`: "Choose a reciter · Yunus".
- `ipad-pro-13-portrait-choose-reciter-after-tap-settled.png`: After tapping a reciter: plays, stays on the list.
- `ipad-pro-13-portrait-reciter-profile-top.png`: Mishary profile, top.
- `ipad-pro-13-portrait-reciter-profile-scrolled.png`: Profile, scrolled into the surah list.
- `ipad-pro-13-portrait-reciter-profile-end.png`: Profile, end of surah list.
- `ipad-pro-13-portrait-reciter-profile-rewayah-2.png`: Second rewayah tab (Al-Duri).
- `ipad-pro-13-portrait-surah-options-sheet.png`: Surah options sheet (centered card).
- `ipad-pro-13-portrait-add-to-collection-sheet.png`: Add to Collection sheet.
- `ipad-pro-13-portrait-collection-playlists.png`: Playlists.
- `ipad-pro-13-portrait-playlist-detail.png`: Playlist detail.
- `ipad-pro-13-portrait-collection-loved.png`: Loved.
- `ipad-pro-13-portrait-collection-downloads.png`: Downloads (empty).
- `ipad-pro-13-portrait-player.png`: Full player, Text tab. Before shot for the play-button change.
- `ipad-pro-13-portrait-player-queue.png`: Player, Queue tab.
- `ipad-pro-13-portrait-player-reciters.png`: Player, Reciters tab.

### iPad Pro 13", landscape (develop)
- `ipad-pro-13-landscape-home-top.png`: Home, top, with sidebar mini player.
- `ipad-pro-13-landscape-home-scrolled.png`: Home, scrolled.
- `ipad-pro-13-landscape-browse-all-reciters.png`: Browse All reciters grid.
- `ipad-pro-13-landscape-reciter-profile-top.png`: Mishary profile.
- `ipad-pro-13-landscape-collection-playlists.png`: Playlists.
- `ipad-pro-13-landscape-playlist-detail.png`: Playlist detail.
- `ipad-pro-13-landscape-collection-loved.png`: Loved.
- `ipad-pro-13-landscape-collection-downloads.png`: Downloads (empty).
- `ipad-pro-13-landscape-player.png`: Full player. Before shot for the play-button change.
- `ipad-pro-13-landscape-player-queue.png`: Player, Queue tab.

### iPad Air 11", portrait (develop)
- `ipad-air-11-portrait-home-top.png`: Home, top, with icon rail.
- `ipad-air-11-portrait-home-scrolled.png`: Home, scrolled.
- `ipad-air-11-portrait-search.png`: Search.
- `ipad-air-11-portrait-search-results-mishary.png`: Search results for "Mishary".
- `ipad-air-11-portrait-browse-all-reciters.png`: Browse All reciters grid.
- `ipad-air-11-portrait-choose-reciter-for-surah.png`: "Choose a reciter · Yunus".
- `ipad-air-11-portrait-reciter-profile-top.png`: Mishary profile.
- `ipad-air-11-portrait-reciter-profile-rewayah-2.png`: Second rewayah tab.
- `ipad-air-11-portrait-collection.png`: Collection hub.
- `ipad-air-11-portrait-collection-loved.png`: Loved (rows run to the right edge).
- `ipad-air-11-portrait-player.png`: Full player, single column with floating controls.
- `ipad-air-11-portrait-player-queue.png`: Player, Queue tab.

### iPad Air 11", landscape (develop)
- `ipad-air-11-landscape-home-top.png`: Home, full sidebar.
- `ipad-air-11-landscape-reciter-profile-top.png`: Mishary profile.
- `ipad-air-11-landscape-browse-all-reciters.png`: Browse All reciters grid.
- `ipad-air-11-landscape-collection-loved.png`: Loved.
- `ipad-air-11-landscape-collection-downloads.png`: Downloads (empty).
- `ipad-air-11-landscape-player.png`: Full player.

### Play button change (PR #463, branch `claude/project-thread-lcn5ew-play-button`)
- `ipad13-portrait-player-after-play-button.png`: After. Pair with `ipad-pro-13-portrait-player.png`. Circle behind play is gone.
- `ipad13-landscape-player-after-play-button.png`: After. Pair with `ipad-pro-13-landscape-player.png`. Circle behind play is gone.

### Reader bug recheck (develop plus the play-button commit, which does not touch the reader)
- `ipad13-portrait-reader-bug1.png`: Mushaf opened at page 2, portrait.
- `ipad13-landscape-reader-bug1.png`: After rotating to landscape: correct spread (pages 1 and 2), no half-pages.
- `ipad13-portrait-reader-bug1-after-rotate-back.png`: After rotating back to portrait: shows page 1, not page 2. Bug 1 partly still happens (page drifts back one page; no half-pages seen). The List/Mushaf view switch and bugs 2-4 were not checked.
