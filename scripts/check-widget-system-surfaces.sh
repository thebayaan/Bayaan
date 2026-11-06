#!/usr/bin/env bash
# Phase 2 Swift checks: files that must stay identical between the module pod
# and the widget extension, the Live Activity fixture decode, and pure logic
# compiled into the app and the extension.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

fixtures="$root/modules/bayaan-widgets/src/__fixtures__"

cmp "$root/modules/bayaan-widgets/ios/NowPlayingActivityState.swift" \
    "$root/targets/widgets/LiveActivity/NowPlayingActivityState.swift"
cmp "$root/modules/bayaan-widgets/ios/NowPlayingAttributes.swift" \
    "$root/targets/widgets/LiveActivity/NowPlayingAttributes.swift"
cmp "$root/modules/bayaan-widgets/ios/AdhkarSessionActivityState.swift" \
    "$root/targets/widgets/LiveActivity/AdhkarSessionActivityState.swift"
cmp "$root/modules/bayaan-widgets/ios/AdhkarSessionAttributes.swift" \
    "$root/targets/widgets/LiveActivity/AdhkarSessionAttributes.swift"

cat "$root/targets/widgets/LiveActivity/NowPlayingActivityState.swift" \
    "$root/targets/widgets/LiveActivity/AdhkarSessionActivityState.swift" \
    "$root/targets/widgets/_shared/WidgetSnapshot.swift" \
    "$root/targets/widgets/_shared/SurahCatalog.swift" \
    "$root/targets/widgets/_shared/SurahSynonyms.swift" \
    "$root/targets/widgets/_shared/PlaybackResume.swift" > "$tmp/surfaces-test.swift"
cat >> "$tmp/surfaces-test.swift" <<'SWIFT'
let dir = CommandLine.arguments[1]
func load(_ path: String) -> Data { try! Data(contentsOf: URL(fileURLWithPath: path)) }

// Live Activity content state (same vectors as liveActivity.test.ts)
let states = try! JSONDecoder().decode([NowPlayingActivityState].self, from: load("\(dir)/liveActivity.states.json"))
precondition(states.count == 2 && states[0].ayah?.number == 10 && states[0].ayah?.count == 110, "state decode")
precondition(states[1].ayah == nil && states[1].artworkFile == nil, "nulls decode")
precondition(states[0].wallStart.timeIntervalSince1970 == 1_791_460_679.5, "wallStart")
precondition(states[0].wallEnd.timeIntervalSince1970 == 1_791_462_479.5, "wallEnd")
precondition(states[1].wallStart.timeIntervalSince1970 == 1_791_460_200, "wallStart rate 1.5")
precondition(states[1].wallEnd.timeIntervalSince1970 == 1_791_461_400, "wallEnd rate 1.5")
precondition(states[1].fraction == 0.5 && states[1].remainingWallSec == 600, "paused fraction")
// Adhkar session Live Activity content state (same vectors as adhkarActivity.test.ts)
let adhkar = try! JSONDecoder().decode([AdhkarSessionActivityState].self, from: load("\(dir)/adhkarActivity.states.json"))
precondition(adhkar.count == 2 && adhkar[0].isPlaying && !adhkar[1].isPlaying, "adhkar state decode")
precondition(adhkar[0].positionLabel == "4 of 23" && adhkar[0].shortPositionLabel == "4/23", "adhkar position labels")
precondition(adhkar[1].listTitle == "أذكار المساء" && adhkar[1].preview.hasPrefix("أَمْسَيْنَا"), "adhkar Arabic decode")
// Surah catalog and Siri synonyms
precondition(SurahCatalog.all.count == 114 && SurahCatalog.surah(18)?.name == "Al-Kahf", "surah catalog")
precondition(SurahCatalog.surah(0) == nil && SurahCatalog.surah(115) == nil, "surah catalog bounds")
precondition(SurahSynonyms.of(name: "Al-Kahf", translatedName: "The Cave")
  == ["Al-Kahf", "Al Kahf", "Kahf", "Surah Al-Kahf", "The Cave"], "synonyms Al-")
precondition(SurahSynonyms.of(name: "Ya-Sin", translatedName: "Ya Sin")
  == ["Ya-Sin", "Ya Sin", "Surah Ya-Sin"], "synonyms dedupe")
precondition(SurahSynonyms.of(name: "Ali 'Imran", translatedName: "Family of Imran")
  == ["Ali 'Imran", "Surah Ali 'Imran", "Family of Imran"], "synonyms no article")

// Resume Bayaan
let fullSnapshot = WidgetSnapshot.decode(load("\(dir)/snapshot.full.json"))!
let upload = WidgetTrack(surahId: 0, surahName: "My upload", reciterId: "u", reciterName: "Me",
                         rewayatId: nil, artworkFile: nil, isUserUpload: true)
let mulk = WidgetTrack(surahId: 67, surahName: "Al-Mulk", reciterId: "r2", reciterName: "R2",
                       rewayatId: "rw-2", artworkFile: nil, isUserUpload: false)
func idle(recent: [WidgetTrack], upNext: [WidgetTrack]) -> WidgetSnapshot {
  WidgetSnapshot(version: 1, generatedAt: 0, theme: .dark, nowPlaying: nil, upNext: upNext,
                 recent: recent, defaultReciter: nil, reciterRecents: [:], lastRead: nil, tasbeeh: [:])
}
precondition(PlaybackResume.action(for: fullSnapshot) == .setPlaying, "resume loaded track")
precondition(PlaybackResume.action(for: nil) == .nothing, "resume without snapshot")
precondition(PlaybackResume.action(for: idle(recent: [upload, mulk], upNext: fullSnapshot.upNext))
  == .playTrack(surahId: 67, reciterId: "r2", rewayatId: "rw-2"), "resume recent, skipping uploads")
precondition(PlaybackResume.action(for: idle(recent: [upload], upNext: fullSnapshot.upNext))
  == .playTrack(surahId: 36, reciterId: "r-alafasi", rewayatId: "rw-1"), "resume suggestion")
precondition(PlaybackResume.action(for: idle(recent: [upload], upNext: [])) == .nothing, "resume nothing")
print("swift system surfaces: OK")
SWIFT

swift "$tmp/surfaces-test.swift" "$fixtures"
