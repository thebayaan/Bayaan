// targets/widgets/Support/AdhkarSessionLogic.swift
import Foundation

/// Where the Adhkar widget is in this period's session (spec 2026-10-12).
/// Foundation only: scripts/check-widget-content.sh compiles it standalone.
struct AdhkarSession: Codable, Equatable {
  var period: String
  var day: String
  var index: Int
  var remaining: Int
  var completed: Bool
  var startedAtMs: Double?
}

enum AdhkarSessionAction: String, Codable { case next, prev, count, restart }

/// The adhkar_session_completed event an action raised; the app sends it later.
struct AdhkarSessionCompletion: Equatable {
  var category: String
  var durationMs: Int
  var dhikrCount: Int
  var completedAtMs: Double
}

enum AdhkarSessionLogic {
  /// The day a session belongs to: shifted 4 hours so the evening period
  /// (12:00 to 03:59) stays one session across midnight.
  static func sessionDay(_ date: Date, timeZone: TimeZone = .current) -> String {
    WidgetLogic.localDayKey(date.addingTimeInterval(-4 * 3600), timeZone: timeZone)
  }

  static func fresh(period: String, day: String, repeatCounts: [Int]) -> AdhkarSession {
    AdhkarSession(period: period, day: day, index: 0, remaining: count(repeatCounts, 0),
                  completed: false, startedAtMs: nil)
  }

  static func resolve(_ stored: AdhkarSession?, period: String, day: String, repeatCounts: [Int]) -> AdhkarSession {
    guard let s = stored, s.period == period, s.day == day, repeatCounts.indices.contains(s.index) else {
      return fresh(period: period, day: day, repeatCounts: repeatCounts)
    }
    return s
  }

  static func apply(_ action: AdhkarSessionAction, to s: AdhkarSession, repeatCounts: [Int], nowMs: Double) -> AdhkarSession {
    if action == .restart { return fresh(period: s.period, day: s.day, repeatCounts: repeatCounts) }
    if s.completed { return s }
    var out = s
    out.startedAtMs = s.startedAtMs ?? nowMs
    switch action {
    case .next: advance(&out, repeatCounts)
    case .count:
      if s.remaining > 1 { out.remaining = s.remaining - 1 } else { advance(&out, repeatCounts) }
    case .prev:
      if s.index > 0 { out.index = s.index - 1; out.remaining = count(repeatCounts, out.index) }
    case .restart: break
    }
    return out
  }

  /// The completion event when this action finished the session, else nil (once per session).
  static func completionEvent(before: AdhkarSession, after: AdhkarSession, repeatCounts: [Int],
                              superId: String, nowMs: Double) -> AdhkarSessionCompletion? {
    guard !before.completed, after.completed else { return nil }
    return AdhkarSessionCompletion(category: superId, durationMs: Int(nowMs - (after.startedAtMs ?? nowMs)),
                                   dhikrCount: repeatCounts.count, completedAtMs: nowMs)
  }

  /// Body-tap path: the top of the list on the first card or when done, else the current dhikr.
  static func link(superId: String, session: AdhkarSession, ids: [String]) -> String {
    guard !session.completed, session.index > 0, ids.indices.contains(session.index) else { return "adhkar/\(superId)" }
    return "adhkar/\(superId)?dhikr=\(ids[session.index])"
  }

  private static func advance(_ s: inout AdhkarSession, _ repeatCounts: [Int]) {
    if s.index + 1 >= repeatCounts.count {
      s.completed = true
      s.remaining = 0
    } else {
      s.index += 1
      s.remaining = count(repeatCounts, s.index)
    }
  }

  private static func count(_ repeatCounts: [Int], _ i: Int) -> Int {
    repeatCounts.indices.contains(i) ? max(1, repeatCounts[i]) : 1
  }
}
