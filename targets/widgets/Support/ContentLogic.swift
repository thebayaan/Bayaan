// targets/widgets/Support/ContentLogic.swift
import Foundation

enum AdhkarPeriod: String {
  case morning, evening
}

enum BayaanNowMode: String {
  case listening, occasion, morningAdhkar, eveningAdhkar, bedtime
}

struct UpcomingOccasion: Hashable {
  let id: String
  let days: Int
}

/// Phase 3 rules, tested by scripts/check-widget-content.sh. Mirrors
/// contextRules.ts (JS) and ContentLogic.kt (Android). Hours and weekdays use
/// the Gregorian calendar; Hijri dates use Umm al-Qura from the local
/// Gregorian day number, whatever calendar the device is set to.
enum ContentLogic {
  static let friday = 6
  static let jumuahEndHour = 18
  static let boundaryHours = [0, 4, 11, 12, 15, 18, 20, 21]
  static let nextOccasionHorizon = 400

  // Priority order; the Hijri windows do not overlap.
  private static let windows: [(id: String, month: Int, from: Int, to: Int)] = [
    ("eidFitr", 10, 1, 3), ("arafah", 12, 9, 9), ("eidAdha", 12, 10, 13), ("lastTen", 9, 21, 30),
    ("ramadan", 9, 1, 20), ("dhulHijjah", 12, 1, 8), ("ashura", 1, 9, 10),
  ]

  static let upcomingAnchors: [(id: String, month: Int, day: Int)] = [
    ("ramadan", 9, 1), ("eidFitr", 10, 1), ("dhulHijjah", 12, 1),
    ("arafah", 12, 9), ("eidAdha", 12, 10), ("ashura", 1, 10),
  ]

  private static func gregorian(_ timeZone: TimeZone) -> Calendar {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = timeZone
    return calendar
  }

  static func hour(_ date: Date, timeZone: TimeZone = .current) -> Int {
    gregorian(timeZone).component(.hour, from: date)
  }

  /// Sunday = 1, Friday = 6.
  static func weekday(_ date: Date, timeZone: TimeZone = .current) -> Int {
    gregorian(timeZone).component(.weekday, from: date)
  }

  // One explicit Umm al-Qura calendar at UTC, reused across the forward scans.
  private static let ummAlQura: Calendar = {
    var calendar = Calendar(identifier: .islamicUmmAlQura)
    calendar.timeZone = TimeZone(identifier: "UTC") ?? .gmt
    return calendar
  }()

  /// Umm al-Qura date of a local Gregorian day number, read at 12:00 UTC.
  static func hijri(dayNumber: Int) -> HijriDate? {
    let noon = Date(timeIntervalSince1970: Double(dayNumber) * 86_400 + 43_200)
    let c = ummAlQura.dateComponents([.year, .month, .day], from: noon)
    guard let y = c.year, let m = c.month, let d = c.day else { return nil }
    return HijriDate(year: y, month: m, day: d)
  }

  static func hijri(_ date: Date, timeZone: TimeZone = .current) -> HijriDate? {
    hijri(dayNumber: WidgetLogic.dayNumber(date, timeZone: timeZone))
  }

  static func adhkarPeriod(hour: Int) -> AdhkarPeriod {
    hour >= 4 && hour < 12 ? .morning : .evening
  }

  static func occasion(hijri: HijriDate?, weekday: Int, hour: Int) -> String? {
    if let h = hijri, let w = windows.first(where: { $0.month == h.month && h.day >= $0.from && h.day <= $0.to }) {
      return w.id
    }
    return weekday == friday && hour < jumuahEndHour ? "jumuah" : nil
  }

  static func occasion(at date: Date, timeZone: TimeZone = .current) -> String? {
    occasion(hijri: hijri(date, timeZone: timeZone), weekday: weekday(date, timeZone: timeZone),
             hour: hour(date, timeZone: timeZone))
  }

  /// `adhkar` and `bedtime` turn those cards off (RFC-021); their hours fall back to listening.
  static func mode(hour: Int, isPlaying: Bool, occasion: String?, adhkar: Bool = true, bedtime: Bool = true) -> BayaanNowMode {
    if isPlaying { return .listening }
    if occasion != nil { return .occasion }
    if adhkar && hour >= 4 && hour < 11 { return .morningAdhkar }
    if adhkar && hour >= 15 && hour < 20 { return .eveningAdhkar }
    if bedtime && (hour >= 21 || hour < 4) { return .bedtime }
    return .listening
  }

  static func relevance(mode: BayaanNowMode, isPlaying: Bool) -> Float {
    switch mode {
    case .listening: return isPlaying ? 1 : 0.2
    case .occasion: return 0.8
    case .morningAdhkar, .eveningAdhkar: return 0.7
    case .bedtime: return 0.6
    }
  }

  static func adhkarRelevance(hour: Int) -> Float {
    (hour >= 4 && hour < 11) || (hour >= 15 && hour < 20) ? 0.7 : 0.2
  }

  static func occasionRelevance(_ occasion: String?) -> Float {
    occasion != nil ? 0.8 : 0.1
  }

  static func bedtimeRelevance(hour: Int) -> Float {
    hour >= 21 || hour < 4 ? 0.6 : 0.1
  }

  /// Minutes since local midnight of the next boundary; 1440 is the next midnight.
  static func nextBoundaryMinutes(after minutes: Double) -> Int {
    for h in boundaryHours where Double(h * 60) > minutes { return h * 60 }
    return 1440
  }

  /// Local boundary times strictly after `date` and at most `within` seconds later.
  static func boundaries(after date: Date, within: TimeInterval = 86_400, timeZone: TimeZone = .current) -> [Date] {
    let calendar = gregorian(timeZone)
    let today = calendar.startOfDay(for: date)
    var out: [Date] = []
    for offset in 0...1 {
      guard let day = calendar.date(byAdding: .day, value: offset, to: today) else { continue }
      for h in boundaryHours {
        guard let d = calendar.date(bySettingHour: h, minute: 0, second: 0, of: day) else { continue }
        if d > date && d.timeIntervalSince(date) <= within { out.append(d) }
      }
    }
    return out.sorted()
  }

  /// Scans forward day by day; stops early when the converter returns nil.
  static func nextOccasions(today: Int, count: Int, horizon: Int = nextOccasionHorizon,
                            hijriOf: (Int) -> HijriDate?) -> [UpcomingOccasion] {
    var found: [UpcomingOccasion] = []
    var d = 1
    while d <= horizon && found.count < count {
      guard let h = hijriOf(today + d) else { break }
      for a in upcomingAnchors where a.month == h.month && a.day == h.day && !found.contains(where: { $0.id == a.id }) {
        found.append(UpcomingOccasion(id: a.id, days: d))
      }
      d += 1
    }
    return Array(found.prefix(count))
  }

  static func sleepActive(endsAt: Double?, now: Date) -> Bool {
    guard let endsAt else { return false }
    return endsAt > now.timeIntervalSince1970 * 1000
  }
}

struct RecentShelf {
  let tracks: [WidgetTrack]
  /// True when the tracks are the popular-surah suggestion, not real history.
  let isSuggestion: Bool
}

enum LibraryShelfState: Hashable {
  case downloads(items: [WidgetShelfItem], count: Int)
  case playlist(WidgetPlaylist)
  case playlistUnavailable
  case noContent
}

/// Mirrors ContentLogic.kt (recentShelf, library, spotlight).
enum ContentResolvers {
  /// Al-Fatihah, Al-Kahf, Ya-Sin, Al-Mulk.
  static let popularSurahIds = [1, 18, 36, 67]
  static let downloadsSourceId = "downloads"
  static let playlistPrefix = "playlist:"

  static func recentShelf(_ snapshot: WidgetSnapshot?, limit: Int = 6) -> RecentShelf {
    guard let s = snapshot else { return RecentShelf(tracks: [], isSuggestion: false) }
    let real = s.recent.filter { !$0.isUserUpload && (1...114).contains($0.surahId) }
    if !real.isEmpty { return RecentShelf(tracks: Array(real.prefix(limit)), isSuggestion: false) }
    guard let d = s.defaultReciter else { return RecentShelf(tracks: [], isSuggestion: false) }
    let tracks = popularSurahIds.prefix(limit).map {
      WidgetTrack(surahId: $0, surahName: "", reciterId: d.id, reciterName: d.name,
                  rewayatId: nil, artworkFile: nil, isUserUpload: false)
    }
    return RecentShelf(tracks: tracks, isSuggestion: true)
  }

  static func library(sourceId: String?, content: WidgetContent?) -> LibraryShelfState {
    guard let content else { return .noContent }
    guard let sourceId, sourceId.hasPrefix(playlistPrefix) else {
      return .downloads(items: content.downloads, count: content.downloadCount)
    }
    let id = String(sourceId.dropFirst(playlistPrefix.count))
    return content.playlist(id).map { .playlist($0) } ?? .playlistUnavailable
  }

  static func spotlight(_ content: WidgetContent?, date: Date, timeZone: TimeZone = .current) -> WidgetSpotlightReciter? {
    guard let list = content?.spotlight, !list.isEmpty else { return nil }
    let i = WidgetLogic.ayahIndex(date, count: list.count, timeZone: timeZone)
    return i >= 0 ? list[i] : nil
  }
}

/// Mirrors ContentLogic.kt text helpers.
enum ContentText {
  static func hijriLine(_ h: HijriDate, months: [HijriMonthName]) -> String {
    let name = months.first { $0.number == h.month }?.name ?? String(h.month)
    return "\(h.day) \(name) \(h.year)"
  }

  static func daysLabel(_ days: Int) -> String {
    days == 1 ? "Tomorrow" : "in \(days) days"
  }

  static func surahCount(_ n: Int) -> String {
    n == 1 ? "1 surah" : "\(n) surahs"
  }

  static func repeatLabel(_ n: Int) -> String? {
    n > 1 ? "×\(n)" : nil
  }
}
