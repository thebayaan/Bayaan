// targets/widgets/Support/ContentLogic.swift
import Foundation

enum AdhkarPeriod: String {
  case morning, evening
}

enum BayaanNowMode: String {
  case listening, morningAdhkar, eveningAdhkar, bedtime
}

/// Phase 3 rules, tested by scripts/check-widget-content.sh. Mirrors
/// contextRules.ts (JS) and ContentLogic.kt (Android). Hours use the
/// Gregorian calendar.
enum ContentLogic {
  static let boundaryHours = [0, 4, 11, 12, 15, 18, 20, 21]

  private static func gregorian(_ timeZone: TimeZone) -> Calendar {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = timeZone
    return calendar
  }

  static func hour(_ date: Date, timeZone: TimeZone = .current) -> Int {
    gregorian(timeZone).component(.hour, from: date)
  }

  static func adhkarPeriod(hour: Int) -> AdhkarPeriod {
    hour >= 4 && hour < 12 ? .morning : .evening
  }

  /// `adhkar` and `bedtime` turn those cards off (RFC-021); their hours fall back to listening.
  static func mode(hour: Int, isPlaying: Bool, adhkar: Bool = true, bedtime: Bool = true) -> BayaanNowMode {
    if isPlaying { return .listening }
    if adhkar && hour >= 4 && hour < 11 { return .morningAdhkar }
    if adhkar && hour >= 15 && hour < 20 { return .eveningAdhkar }
    if bedtime && (hour >= 21 || hour < 4) { return .bedtime }
    return .listening
  }

  static func relevance(mode: BayaanNowMode, isPlaying: Bool) -> Float {
    switch mode {
    case .listening: return isPlaying ? 1 : 0.2
    case .morningAdhkar, .eveningAdhkar: return 0.7
    case .bedtime: return 0.6
    }
  }

  static func adhkarRelevance(hour: Int) -> Float {
    (hour >= 4 && hour < 11) || (hour >= 15 && hour < 20) ? 0.7 : 0.2
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
  static func surahCount(_ n: Int) -> String {
    n == 1 ? "1 surah" : "\(n) surahs"
  }

  static func repeatLabel(_ n: Int) -> String? {
    n > 1 ? "×\(n)" : nil
  }
}
