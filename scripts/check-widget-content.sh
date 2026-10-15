#!/usr/bin/env bash
# Phase 3 Swift checks: content.json and the generated adhkar and occasion data
# decode with the extension's models; Umm al-Qura conversion, rules and
# resolvers match the vectors shared with contextRules.test.ts and ContentLogicTest.kt.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
fixtures="$root/modules/bayaan-widgets/src/__fixtures__"

cat "$root/targets/widgets/_shared/WidgetSnapshot.swift" \
    "$root/targets/widgets/Support/WidgetModels.swift" \
    "$root/targets/widgets/Support/WidgetLogic.swift" \
    "$root/targets/widgets/Support/ContentModels.swift" \
    "$root/targets/widgets/Support/ContentLogic.swift" > "$tmp/content-test.swift"
cat >> "$tmp/content-test.swift" <<'SWIFT'
let dir = CommandLine.arguments[1]
let targetDir = CommandLine.arguments[2]
func load(_ path: String) -> Data { try! Data(contentsOf: URL(fileURLWithPath: path)) }
func json(_ path: String) -> Any { try! JSONSerialization.jsonObject(with: load(path)) }
func close(_ a: Float, _ b: Double) -> Bool { abs(Double(a) - b) < 1e-6 }

// content.json
let content = WidgetContent.decode(load("\(dir)/content.full.json"))
precondition(content?.downloads.count == 2 && content?.downloadCount == 12, "content downloads")
precondition(content?.playlist("playlist_1")?.items.map(\.itemId) == ["item_1", "item_2"], "content playlist items")
precondition(content?.playlist("playlist_1")?.items.first?.rewayatId == nil, "content null rewayat")
precondition(content?.spotlight.first?.surahIds == [1, 18, 36] && content?.sleepTimerEndsAt == 1_791_462_600_000, "content spotlight and timer")
var future = try! String(contentsOfFile: "\(dir)/content.full.json", encoding: .utf8)
future = future.replacingOccurrences(of: "\"version\": 1", with: "\"version\": 2")
precondition(WidgetContent.decode(future.data(using: .utf8)!) == nil, "accepted future content")
precondition(WidgetContent.decode(Data("nope".utf8)) == nil, "accepted junk content")

// Generated static data
let adhkar = try! JSONDecoder().decode(AdhkarPeriods.self, from: load("\(targetDir)/adhkar-periods.json"))
precondition(adhkar.morning.count == 24 && adhkar.morning.superId == "morning-adhkar" && adhkar.evening.superId == "evening-adhkar", "adhkar periods")
precondition(adhkar.data(for: .evening).featured.contains { $0.id == "97" } && !adhkar.morning.featured.contains { $0.id == "97" }, "adhkar featured split")
let occasions = try! JSONDecoder().decode(OccasionData.self, from: load("\(targetDir)/occasions.json"))
precondition(occasions.months.count == 12 && occasions.month(9)?.name == "Ramadan", "months")
precondition(occasions.occasions.map(\.id) == ["eidFitr", "arafah", "eidAdha", "lastTen", "ramadan", "dhulHijjah", "ashura", "jumuah"], "occasion ids")
precondition(occasions.occasion("jumuah")?.listenSurahId == 18 && occasions.occasion("ramadan")?.ayat.isEmpty == false, "occasion details")
print("swift content decode: OK")

// Umm al-Qura conversion equals the committed table
let table = json("\(dir)/hijri.table.json") as! [String: Any]
let from = table["from"] as! Int
let rows = table["rows"] as! [[Int]]
for (i, row) in rows.enumerated() {
  precondition(ContentLogic.hijri(dayNumber: from + i) == HijriDate(year: row[0], month: row[1], day: row[2]),
               "hijri mismatch at day \(from + i)")
}
func tableHijri(_ day: Int) -> HijriDate? {
  let i = day - from
  guard i >= 0, i < rows.count else { return nil }
  return HijriDate(year: rows[i][0], month: rows[i][1], day: rows[i][2])
}

// Rule vectors
let v = json("\(dir)/context.vectors.json") as! [String: Any]
for pair in v["adhkarPeriod"] as! [[Any]] {
  precondition(ContentLogic.adhkarPeriod(hour: pair[0] as! Int).rawValue == pair[1] as! String, "adhkarPeriod \(pair)")
}
for c in v["occasion"] as! [[String: Any]] {
  let h = (c["hijri"] as? [Int]).map { HijriDate(year: $0[0], month: $0[1], day: $0[2]) }
  let got = ContentLogic.occasion(hijri: h, weekday: c["weekday"] as! Int, hour: c["hour"] as! Int)
  precondition(got == c["expect"] as? String, "occasion \(c)")
}
for c in v["mode"] as! [[String: Any]] {
  let playing = c["playing"] as! Bool
  let mode = ContentLogic.mode(hour: c["hour"] as! Int, isPlaying: playing, occasion: c["occasion"] as? String)
  precondition(mode.rawValue == c["expect"] as! String, "mode \(c)")
  precondition(close(ContentLogic.relevance(mode: mode, isPlaying: playing), c["relevance"] as! Double), "relevance \(c)")
}
// RFC-021: cards a fork turns off fall back to listening (same as contextRules.test.ts).
precondition(ContentLogic.mode(hour: 8, isPlaying: false, occasion: nil, adhkar: false) == .listening, "mode without adhkar")
precondition(ContentLogic.mode(hour: 17, isPlaying: false, occasion: nil, adhkar: false) == .listening, "mode without adhkar")
precondition(ContentLogic.mode(hour: 22, isPlaying: false, occasion: nil, bedtime: false) == .listening, "mode without bedtime")
precondition(ContentLogic.mode(hour: 22, isPlaying: false, occasion: nil, adhkar: false) == .bedtime, "bedtime without adhkar")
for p in v["adhkarRelevance"] as! [[Any]] { precondition(close(ContentLogic.adhkarRelevance(hour: p[0] as! Int), p[1] as! Double), "adhkarRelevance \(p)") }
for p in v["occasionRelevance"] as! [[Any]] { precondition(close(ContentLogic.occasionRelevance(p[0] as? String), p[1] as! Double), "occasionRelevance \(p)") }
for p in v["bedtimeRelevance"] as! [[Any]] { precondition(close(ContentLogic.bedtimeRelevance(hour: p[0] as! Int), p[1] as! Double), "bedtimeRelevance \(p)") }
for p in v["nextBoundary"] as! [[Double]] { precondition(ContentLogic.nextBoundaryMinutes(after: p[0]) == Int(p[1]), "nextBoundary \(p)") }
for c in v["sleepActive"] as! [[Any]] {
  let now = Date(timeIntervalSince1970: (c[1] as! Double) / 1000)
  precondition(ContentLogic.sleepActive(endsAt: c[0] as? Double, now: now) == c[2] as! Bool, "sleepActive \(c)")
}

// Next occasions: Foundation and the table both give the committed vectors
let nv = json("\(dir)/next-occasions.vectors.json") as! [String: Any]
let count = nv["count"] as! Int
for c in nv["cases"] as! [[String: Any]] {
  let today = c["today"] as! Int
  let expect = (c["expect"] as! [[String: Any]]).map { UpcomingOccasion(id: $0["id"] as! String, days: $0["days"] as! Int) }
  precondition(ContentLogic.nextOccasions(today: today, count: count, hijriOf: ContentLogic.hijri(dayNumber:)) == expect, "nextOccasions \(today)")
  precondition(ContentLogic.nextOccasions(today: today, count: count, hijriOf: tableHijri) == expect, "nextOccasions table \(today)")
}

// Time zones: 2026-02-19T03:30Z is 22:30 Wednesday 18 Feb in New York (1 Ramadan 1447)
// and 12:30 Thursday 19 Feb in Tokyo (the next Hijri day).
let ny = TimeZone(identifier: "America/New_York")!
let tokyo = TimeZone(identifier: "Asia/Tokyo")!
let instant = Date(timeIntervalSince1970: 1_771_471_800)
precondition(ContentLogic.hijri(instant, timeZone: ny) == HijriDate(year: 1447, month: 9, day: 1), "hijri NY")
precondition(ContentLogic.hijri(instant, timeZone: tokyo) == tableHijri(20503), "hijri Tokyo")
precondition(ContentLogic.hour(instant, timeZone: ny) == 22 && ContentLogic.weekday(instant, timeZone: ny) == 4, "NY hour and weekday")
precondition(ContentLogic.hour(instant, timeZone: tokyo) == 12 && ContentLogic.weekday(instant, timeZone: tokyo) == 5, "Tokyo hour and weekday")
precondition(ContentLogic.occasion(at: instant, timeZone: ny) == "ramadan", "occasion NY")
let b = ContentLogic.boundaries(after: instant, timeZone: ny)
precondition(b.count == 8 && ContentLogic.hour(b[0], timeZone: ny) == 0 && ContentLogic.hour(b[7], timeZone: ny) == 21, "boundaries")

// Resolvers
let full = WidgetSnapshot.decode(load("\(dir)/snapshot.full.json"))!
func withRecent(_ recent: [WidgetTrack], _ reciter: WidgetReciter?) -> WidgetSnapshot {
  WidgetSnapshot(version: full.version, generatedAt: full.generatedAt, theme: full.theme, nowPlaying: nil,
                 upNext: [], recent: recent, defaultReciter: reciter, reciterRecents: [:], lastRead: nil, tasbeeh: [:])
}
let upload = WidgetTrack(surahId: 0, surahName: "Talk", reciterId: "me", reciterName: "Me", rewayatId: nil, artworkFile: nil, isUserUpload: true)
let kahf = full.nowPlaying!.track
let shelf = ContentResolvers.recentShelf(withRecent([upload, kahf], full.defaultReciter))
precondition(shelf.tracks == [kahf] && !shelf.isSuggestion, "recent filters uploads")
let suggestion = ContentResolvers.recentShelf(withRecent([upload], full.defaultReciter), limit: 4)
precondition(suggestion.isSuggestion && suggestion.tracks.map(\.surahId) == [1, 18, 36, 67]
             && suggestion.tracks.allSatisfy { $0.reciterId == "r-alafasi" }, "recent suggestion")
precondition(ContentResolvers.recentShelf(withRecent([], nil)).tracks.isEmpty, "recent empty")
precondition(ContentResolvers.recentShelf(nil).tracks.isEmpty, "recent no snapshot")
let cf = content!
precondition(ContentResolvers.library(sourceId: nil, content: cf) == .downloads(items: cf.downloads, count: 12), "library default")
precondition(ContentResolvers.library(sourceId: "downloads", content: cf) == .downloads(items: cf.downloads, count: 12), "library downloads")
precondition(ContentResolvers.library(sourceId: "playlist:playlist_1", content: cf) == .playlist(cf.playlist("playlist_1")!), "library playlist")
precondition(ContentResolvers.library(sourceId: "playlist:playlist_2", content: cf) == .playlist(cf.playlist("playlist_2")!), "library uploads-only playlist")
precondition(ContentResolvers.library(sourceId: "playlist:gone", content: cf) == .playlistUnavailable, "library gone")
precondition(ContentResolvers.library(sourceId: "playlist:playlist_1", content: nil) == .noContent, "library no content")
let utc = TimeZone(identifier: "UTC")!
// Day 20737 is odd, so the second spotlight reciter.
precondition(ContentResolvers.spotlight(cf, date: Date(timeIntervalSince1970: 20737 * 86_400 + 3_600), timeZone: utc)?.id == "r-balilah", "spotlight rotation")
precondition(ContentResolvers.spotlight(nil, date: instant) == nil, "spotlight none")

// Text
precondition(ContentText.hijriLine(HijriDate(year: 1448, month: 4, day: 29), months: occasions.months) == "29 Rabi al-Thani 1448", "hijriLine")
precondition(ContentText.daysLabel(1) == "Tomorrow" && ContentText.daysLabel(23) == "in 23 days", "daysLabel")
precondition(ContentText.surahCount(1) == "1 surah" && ContentText.surahCount(12) == "12 surahs", "surahCount")
precondition(ContentText.repeatLabel(1) == nil && ContentText.repeatLabel(3) == "×3", "repeatLabel")
print("swift content logic: OK")
SWIFT

swift "$tmp/content-test.swift" "$fixtures" "$root/targets/widgets"
