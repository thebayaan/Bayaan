#!/usr/bin/env bash
# Phase 3 Swift checks: content.json and the generated adhkar data decode
# with the extension's models; rules and resolvers match the vectors shared with contextRules.test.ts and ContentLogicTest.kt.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
fixtures="$root/modules/bayaan-widgets/src/__fixtures__"

cat "$root/targets/widgets/_shared/WidgetSnapshot.swift" \
    "$root/targets/widgets/Support/WidgetModels.swift" \
    "$root/targets/widgets/Support/WidgetLogic.swift" \
    "$root/targets/widgets/Support/ContentModels.swift" \
    "$root/targets/widgets/Support/ContentLogic.swift" \
    "$root/targets/widgets/Support/AdhkarSessionLogic.swift" > "$tmp/content-test.swift"
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
precondition(adhkar.morning.count == 23 && adhkar.evening.count == 21 && adhkar.morning.superId == "morning-adhkar" && adhkar.evening.superId == "evening-adhkar", "adhkar periods")
precondition(adhkar.data(for: .evening).featured.contains { $0.id == "97" } && !adhkar.morning.featured.contains { $0.id == "97" } && !adhkar.evening.featured.contains { $0.id == "94" }, "adhkar featured split")
print("swift content decode: OK")

// Rule vectors
let v = json("\(dir)/context.vectors.json") as! [String: Any]
for pair in v["adhkarPeriod"] as! [[Any]] {
  precondition(ContentLogic.adhkarPeriod(hour: pair[0] as! Int).rawValue == pair[1] as! String, "adhkarPeriod \(pair)")
}
for c in v["mode"] as! [[String: Any]] {
  let playing = c["playing"] as! Bool
  let mode = ContentLogic.mode(hour: c["hour"] as! Int, isPlaying: playing)
  precondition(mode.rawValue == c["expect"] as! String, "mode \(c)")
  precondition(close(ContentLogic.relevance(mode: mode, isPlaying: playing), c["relevance"] as! Double), "relevance \(c)")
}
// RFC-021: cards a fork turns off fall back to listening (same as contextRules.test.ts).
precondition(ContentLogic.mode(hour: 8, isPlaying: false, adhkar: false) == .listening, "mode without adhkar")
precondition(ContentLogic.mode(hour: 17, isPlaying: false, adhkar: false) == .listening, "mode without adhkar")
precondition(ContentLogic.mode(hour: 22, isPlaying: false, bedtime: false) == .listening, "mode without bedtime")
precondition(ContentLogic.mode(hour: 22, isPlaying: false, adhkar: false) == .bedtime, "bedtime without adhkar")
for p in v["adhkarRelevance"] as! [[Any]] { precondition(close(ContentLogic.adhkarRelevance(hour: p[0] as! Int), p[1] as! Double), "adhkarRelevance \(p)") }
for p in v["bedtimeRelevance"] as! [[Any]] { precondition(close(ContentLogic.bedtimeRelevance(hour: p[0] as! Int), p[1] as! Double), "bedtimeRelevance \(p)") }
for p in v["nextBoundary"] as! [[Double]] { precondition(ContentLogic.nextBoundaryMinutes(after: p[0]) == Int(p[1]), "nextBoundary \(p)") }
for c in v["sleepActive"] as! [[Any]] {
  let now = Date(timeIntervalSince1970: (c[1] as! Double) / 1000)
  precondition(ContentLogic.sleepActive(endsAt: c[0] as? Double, now: now) == c[2] as! Bool, "sleepActive \(c)")
}

// Time zones: 2026-02-19T03:30Z is 22:30 in New York and 12:30 the next day in Tokyo.
let ny = TimeZone(identifier: "America/New_York")!
let tokyo = TimeZone(identifier: "Asia/Tokyo")!
let instant = Date(timeIntervalSince1970: 1_771_471_800)
precondition(ContentLogic.hour(instant, timeZone: ny) == 22, "NY hour")
precondition(ContentLogic.hour(instant, timeZone: tokyo) == 12, "Tokyo hour")
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
precondition(ContentText.surahCount(1) == "1 surah" && ContentText.surahCount(12) == "12 surahs", "surahCount")
precondition(ContentText.repeatLabel(1) == nil && ContentText.repeatLabel(3) == "×3", "repeatLabel")
// Adhkar session vectors (shared with AdhkarSessionLogicTest.kt)
let sv = json("\(dir)/adhkarSession.vectors.json") as! [String: Any]
let rc = sv["repeatCounts"] as! [Int]
let ids = sv["ids"] as! [String]
func session(_ v: Any) -> AdhkarSession? {
  guard let d = v as? [String: Any] else { return nil }
  return AdhkarSession(period: d["period"] as! String, day: d["day"] as! String, index: d["index"] as! Int,
                       remaining: d["remaining"] as! Int, completed: d["completed"] as! Bool,
                       startedAtMs: (d["startedAtMs"] as? NSNumber)?.doubleValue)
}
for case let pair as [Any] in sv["sessionDay"] as! [Any] {
  let ms = (pair[0] as! NSNumber).doubleValue
  precondition(AdhkarSessionLogic.sessionDay(Date(timeIntervalSince1970: ms / 1000), timeZone: utc) == pair[1] as! String, "sessionDay \(ms)")
}
for case let c as [String: Any] in sv["resolve"] as! [Any] {
  let got = AdhkarSessionLogic.resolve(session(c["stored"]!), period: c["period"] as! String, day: c["day"] as! String, repeatCounts: rc)
  precondition(got == session(c["expect"]!)!, "resolve \(c["name"]!)")
}
for case let c as [String: Any] in sv["apply"] as! [Any] {
  let got = AdhkarSessionLogic.apply(AdhkarSessionAction(rawValue: c["action"] as! String)!, to: session(c["start"]!)!,
                                     repeatCounts: rc, nowMs: (c["nowMs"] as! NSNumber).doubleValue)
  precondition(got == session(c["expect"]!)!, "apply \(c["name"]!)")
}
for case let c as [String: Any] in sv["completion"] as! [Any] {
  let start = session(c["start"]!)!
  let nowMs = (c["nowMs"] as! NSNumber).doubleValue
  let after = AdhkarSessionLogic.apply(AdhkarSessionAction(rawValue: c["action"] as! String)!, to: start, repeatCounts: rc, nowMs: nowMs)
  let got = AdhkarSessionLogic.completionEvent(before: start, after: after, repeatCounts: rc, superId: "morning-adhkar", nowMs: nowMs)
  let want = (c["expect"] as? [String: Any]).map {
    AdhkarSessionCompletion(category: $0["category"] as! String, durationMs: $0["duration_ms"] as! Int,
                            dhikrCount: $0["dhikr_count"] as! Int, completedAtMs: ($0["completedAtMs"] as! NSNumber).doubleValue)
  }
  precondition(got == want, "completion \(c["name"]!)")
}
for case let c as [String: Any] in sv["link"] as! [Any] {
  precondition(AdhkarSessionLogic.link(superId: "morning-adhkar", session: session(c["session"]!)!, ids: ids) == c["expect"] as! String, "link")
}
precondition(adhkar.morning.items.count == 24 && adhkar.morning.items.allSatisfy { $0.repeatCount >= 1 }, "adhkar items")
print("swift adhkar session: OK")
print("swift content logic: OK")
SWIFT

swift "$tmp/content-test.swift" "$fixtures" "$root/targets/widgets"
