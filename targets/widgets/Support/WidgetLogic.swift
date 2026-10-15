// targets/widgets/Support/WidgetLogic.swift
import Foundation

/// Pure helpers for the widgets, tested by scripts/check-widget-fixtures.sh.
/// Mirrors dayMath.ts / tasbeeh.ts (JS) and DayMath.kt / TasbeehLogic.kt /
/// ArtworkRequests.kt / WidgetText.kt (Android). Dates always use the
/// Gregorian calendar, whatever calendar the device is set to.
enum WidgetLogic {
  static let maxRequestedReciters = 50

  private static func gregorian(_ timeZone: TimeZone) -> Calendar {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = timeZone
    return calendar
  }

  /// Days from 1970-01-01 to the local calendar date of `date`.
  static func dayNumber(_ date: Date, timeZone: TimeZone = .current) -> Int {
    let parts = gregorian(timeZone).dateComponents([.year, .month, .day], from: date)
    let utcDate = gregorian(TimeZone(identifier: "UTC")!).date(
      from: DateComponents(year: parts.year, month: parts.month, day: parts.day)) ?? date
    return Int((utcDate.timeIntervalSince1970 / 86_400).rounded(.down))
  }

  static func ayahIndex(_ date: Date, count: Int, timeZone: TimeZone = .current) -> Int {
    guard count > 0 else { return -1 }
    let n = dayNumber(date, timeZone: timeZone) % count
    return n < 0 ? n + count : n
  }

  static func localDayKey(_ date: Date, timeZone: TimeZone = .current) -> String {
    let p = gregorian(timeZone).dateComponents([.year, .month, .day], from: date)
    return String(format: "%04d-%02d-%02d", p.year ?? 0, p.month ?? 0, p.day ?? 0)
  }

  static func nextMidnight(after date: Date, timeZone: TimeZone = .current) -> Date {
    let calendar = gregorian(timeZone)
    let start = calendar.startOfDay(for: date)
    return calendar.date(byAdding: .day, value: 1, to: start) ?? date.addingTimeInterval(86_400)
  }

  /// The snapshot's count for today, then pending widget taps in order.
  static func tasbeehDisplayCount(entry: WidgetTasbeehEntry?, pending: [PendingTasbeeh],
                                  dhikrId: String, today: String) -> Int {
    var count = entry?.day == today ? (entry?.count ?? 0) : 0
    for p in pending where p.dhikrId == dhikrId && p.day == today {
      if p.reset == true { count = 0 } else { count += max(0, p.count) }
    }
    return count
  }

  static func tasbeehProgress(count: Int, target: Int) -> Double {
    target > 0 ? min(1, Double(max(0, count)) / Double(target)) : 0
  }

  /// Adds one tap (or a reset), merging into the last entry when it is the
  /// same dhikr and day. Entries from earlier days are dropped: the app
  /// discards them anyway.
  static func appendPending(_ list: [PendingTasbeeh], dhikrId: String, day: String,
                            reset: Bool) -> [PendingTasbeeh] {
    var out = list.filter { $0.day == day }
    if !reset, let last = out.last, last.dhikrId == dhikrId, last.reset != true {
      out[out.count - 1] = PendingTasbeeh(dhikrId: dhikrId, count: last.count + 1, day: day, reset: nil)
    } else {
      out.append(PendingTasbeeh(dhikrId: dhikrId, count: reset ? 0 : 1, day: day, reset: reset ? true : nil))
    }
    return out
  }

  /// Valid, unique ids. Surah ids come back sorted; reciter ids keep first-seen order (capped to the newest 50).
  static func mergeRequests(_ existing: ArtworkRequests, surahIds: [Int],
                            reciterIds: [String]) -> ArtworkRequests {
    let surahs = Array(Set(existing.surahIds + surahIds.filter { (1...114).contains($0) })).sorted()
    var reciters = existing.reciterIds
    for id in reciterIds where !id.isEmpty && !reciters.contains(id) { reciters.append(id) }
    return ArtworkRequests(surahIds: surahs, reciterIds: Array(reciters.suffix(maxRequestedReciters)))
  }

  static func initials(_ name: String) -> String {
    name.split(separator: " ").prefix(2).compactMap { $0.first.map { String($0).uppercased() } }.joined()
  }

  static func reference(surahName: String, key: String) -> String {
    "\(surahName) \(key)"
  }

  static func minutesLeftLabel(_ seconds: Double) -> String {
    let minutes = Int((max(0, seconds) / 60).rounded(.up))
    return minutes >= 60 ? "\(minutes / 60)h \(minutes % 60)m left" : "\(minutes)m left"
  }
}

struct PinnedRow: Hashable {
  let surahId: Int
  let rewayatId: String?
}

enum PinnedReciterState: Hashable {
  case ready(id: String, name: String, artworkFile: String?, rows: [PinnedRow])
  /// The configured reciter is no longer in the catalog.
  case unavailable
  /// Nothing configured and no default reciter yet.
  case unset
}

/// Mirrors PinnedReciterModel.kt.
enum PinnedReciterResolver {
  /// Al-Fatihah, Ya-Sin, Al-Mulk.
  static let popularSurahIds = [1, 36, 67]

  static func resolve(reciterId: String?, catalog: WidgetCatalog?, snapshot: WidgetSnapshot?) -> PinnedReciterState {
    let id: String
    let name: String
    let file: String?
    if let reciterId {
      guard let r = catalog?.reciter(reciterId) else { return .unavailable }
      id = r.id
      name = r.name
      file = r.artworkFile
    } else {
      guard let d = snapshot?.defaultReciter else { return .unset }
      id = d.id
      name = d.name
      file = catalog?.reciter(d.id)?.artworkFile ?? d.artworkFile
    }
    let recents = (snapshot?.reciterRecents[id] ?? [])
      .filter { (1...114).contains($0.surahId) }
      .prefix(3)
      .map { PinnedRow(surahId: $0.surahId, rewayatId: $0.rewayatId) }
    let rows = recents.isEmpty ? popularSurahIds.map { PinnedRow(surahId: $0, rewayatId: nil) } : Array(recents)
    return .ready(id: id, name: name, artworkFile: file, rows: rows)
  }
}
