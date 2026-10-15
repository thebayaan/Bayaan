#!/usr/bin/env bash
# Decodes the widget snapshot fixtures with the Swift Codable models used by
# the iOS widget extension, so the TS schema and Swift decoders stay in sync.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

fixtures="$root/modules/bayaan-widgets/src/__fixtures__"

cat "$root/targets/widgets/_shared/WidgetSnapshot.swift" \
    "$root/targets/widgets/Support/WidgetModels.swift" \
    "$root/targets/widgets/Support/WidgetLogic.swift" > "$tmp/decode-test.swift"
cat >> "$tmp/decode-test.swift" <<'SWIFT'
let dir = CommandLine.arguments[1]
let targetDir = CommandLine.arguments[2]
func load(_ path: String) -> Data { try! Data(contentsOf: URL(fileURLWithPath: path)) }

for name in ["snapshot.full.json", "snapshot.empty.json"] {
  precondition(WidgetSnapshot.decode(load("\(dir)/\(name)")) != nil, "failed to decode \(name)")
}
var bumped = try! String(contentsOfFile: "\(dir)/snapshot.full.json", encoding: .utf8)
bumped = bumped.replacingOccurrences(of: "\"version\": 1", with: "\"version\": 2")
precondition(WidgetSnapshot.decode(bumped.data(using: .utf8)!) == nil, "accepted future version")

// Catalog
let catalog = WidgetCatalog.decode(load("\(dir)/catalog.json"))
precondition(catalog?.reciters.count == 2 && catalog?.dhikr("33")?.translation == nil, "catalog decode")
var futureCatalog = try! String(contentsOfFile: "\(dir)/catalog.json", encoding: .utf8)
futureCatalog = futureCatalog.replacingOccurrences(of: "\"version\": 1", with: "\"version\": 2")
precondition(WidgetCatalog.decode(futureCatalog.data(using: .utf8)!) == nil, "accepted future catalog")

// Generated static data
let surahs = try! JSONDecoder().decode([StaticSurah].self, from: load("\(targetDir)/surahs.json"))
let ayat = try! JSONDecoder().decode([StaticAyah].self, from: load("\(targetDir)/ayat.json"))
precondition(surahs.count == 114 && surahs[17].artworkFile == "surah-18.jpg", "surahs.json")
precondition(ayat.count == 390, "ayat.json")
print("swift fixture decode: OK")

// Day math (same vectors as dayMath.test.ts and DayMath.kt)
let ny = TimeZone(identifier: "America/New_York")!
let utc = TimeZone(identifier: "UTC")!
let lateEvening = Date(timeIntervalSince1970: 1_791_689_400) // 2026-10-11T03:30Z = 23:30 on the 10th in New York
precondition(WidgetLogic.dayNumber(lateEvening, timeZone: ny) == 20736, "dayNumber NY")
precondition(WidgetLogic.dayNumber(lateEvening, timeZone: utc) == 20737, "dayNumber UTC")
precondition(WidgetLogic.ayahIndex(lateEvening, count: 390, timeZone: ny) == 66, "ayahIndex")
precondition(WidgetLogic.ayahIndex(Date(timeIntervalSince1970: -43_200), count: 390, timeZone: utc) == 389, "ayahIndex negative")
precondition(WidgetLogic.ayahIndex(lateEvening, count: 0, timeZone: ny) == -1, "ayahIndex empty")
precondition(WidgetLogic.localDayKey(lateEvening, timeZone: ny) == "2026-10-10", "localDayKey")
precondition(WidgetLogic.nextMidnight(after: lateEvening, timeZone: ny).timeIntervalSince1970 == 1_791_691_200, "nextMidnight")

// Tasbeeh display from the shared pending fixture
let pending = try! JSONDecoder().decode([PendingTasbeeh].self, from: load("\(dir)/tasbeeh.pending.json"))
let entry91 = WidgetTasbeehEntry(count: 12, target: 100, day: "2026-10-10")
precondition(WidgetLogic.tasbeehDisplayCount(entry: entry91, pending: pending, dhikrId: "91", today: "2026-10-10") == 2, "display after reset")
let entry96 = WidgetTasbeehEntry(count: 4, target: 100, day: "2026-10-10")
precondition(WidgetLogic.tasbeehDisplayCount(entry: entry96, pending: pending, dhikrId: "96", today: "2026-10-10") == 4, "old day pending ignored")
let staleEntry = WidgetTasbeehEntry(count: 30, target: 33, day: "2026-10-09")
precondition(WidgetLogic.tasbeehDisplayCount(entry: staleEntry, pending: [], dhikrId: "x", today: "2026-10-10") == 0, "new day starts at 0")
precondition(WidgetLogic.tasbeehProgress(count: 50, target: 100) == 0.5 && WidgetLogic.tasbeehProgress(count: 150, target: 100) == 1 && WidgetLogic.tasbeehProgress(count: 3, target: 0) == 0, "progress")

// Pending taps coalesce per dhikr and drop older days
var list = WidgetLogic.appendPending([PendingTasbeeh(dhikrId: "a", count: 9, day: "d0", reset: nil)], dhikrId: "a", day: "d1", reset: false)
list = WidgetLogic.appendPending(list, dhikrId: "a", day: "d1", reset: false)
list = WidgetLogic.appendPending(list, dhikrId: "a", day: "d1", reset: true)
list = WidgetLogic.appendPending(list, dhikrId: "a", day: "d1", reset: false)
precondition(list == [
  PendingTasbeeh(dhikrId: "a", count: 2, day: "d1", reset: nil),
  PendingTasbeeh(dhikrId: "a", count: 0, day: "d1", reset: true),
  PendingTasbeeh(dhikrId: "a", count: 1, day: "d1", reset: nil),
], "appendPending")

// Artwork requests: valid, unique, stable order, capped
let merged = WidgetLogic.mergeRequests(ArtworkRequests(surahIds: [36], reciterIds: ["r1"]), surahIds: [18, 36, 0, 115], reciterIds: ["r1", "", "r2"])
precondition(merged == ArtworkRequests(surahIds: [18, 36], reciterIds: ["r1", "r2"]), "mergeRequests")
let many = WidgetLogic.mergeRequests(.empty, surahIds: [], reciterIds: (1...60).map { "r\($0)" })
precondition(many.reciterIds.count == 50 && many.reciterIds.first == "r11", "mergeRequests cap")

// Text helpers
precondition(WidgetLogic.initials("Mishary Rashid Alafasy") == "MR" && WidgetLogic.initials("  ") == "", "initials")
precondition(WidgetLogic.reference(surahName: "Al-Kahf", key: "18:10") == "Al-Kahf 18:10", "reference")
precondition(WidgetLogic.minutesLeftLabel(61) == "2m left" && WidgetLogic.minutesLeftLabel(3_900) == "1h 5m left" && WidgetLogic.minutesLeftLabel(0) == "0m left", "minutesLeftLabel")
// Pinned reciter (same vectors as WidgetLogicTest.pinnedReciterResolve)
let fullSnapshot = WidgetSnapshot.decode(load("\(dir)/snapshot.full.json"))!
let recents = WidgetSnapshot(
  version: fullSnapshot.version, generatedAt: fullSnapshot.generatedAt, theme: fullSnapshot.theme,
  nowPlaying: fullSnapshot.nowPlaying, upNext: fullSnapshot.upNext, recent: fullSnapshot.recent,
  defaultReciter: fullSnapshot.defaultReciter, reciterRecents: ["r-alafasi": [fullSnapshot.upNext[0]]],
  lastRead: fullSnapshot.lastRead, tasbeeh: fullSnapshot.tasbeeh)
precondition(PinnedReciterResolver.resolve(reciterId: "r-alafasi", catalog: catalog, snapshot: recents)
  == .ready(id: "r-alafasi", name: "Mishary Alafasi", artworkFile: "reciter-r-alafasi.jpg",
            rows: [PinnedRow(surahId: 36, rewayatId: "rw-1")]), "pinned configured")
precondition(PinnedReciterResolver.resolve(reciterId: "gone", catalog: catalog, snapshot: fullSnapshot) == .unavailable, "pinned missing")
precondition(PinnedReciterResolver.resolve(reciterId: nil, catalog: catalog, snapshot: fullSnapshot)
  == .ready(id: "r-alafasi", name: "Mishary Alafasi", artworkFile: "reciter-r-alafasi.jpg",
            rows: [PinnedRow(surahId: 1, rewayatId: nil), PinnedRow(surahId: 36, rewayatId: nil), PinnedRow(surahId: 67, rewayatId: nil)]), "pinned default")
let noDefault = WidgetSnapshot(
  version: fullSnapshot.version, generatedAt: fullSnapshot.generatedAt, theme: fullSnapshot.theme,
  nowPlaying: nil, upNext: [], recent: [], defaultReciter: nil, reciterRecents: [:],
  lastRead: nil, tasbeeh: [:])
precondition(PinnedReciterResolver.resolve(reciterId: nil, catalog: nil, snapshot: noDefault) == .unset, "pinned unset")
print("swift widget logic: OK")
SWIFT

swift "$tmp/decode-test.swift" "$fixtures" "$root/targets/widgets"
