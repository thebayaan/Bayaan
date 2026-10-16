// targets/widgets/Adhkar/AdhkarSessionIntents.swift
import AppIntents
import WidgetKit

/// Applies one session action for the current period, records completion once,
/// and reloads every widget that shows the session.
enum AdhkarSessionActions {
  static func perform(_ action: AdhkarSessionAction, now: Date = .now) {
    guard let data = ContentStaticData.adhkar?.data(for: ContentLogic.adhkarPeriod(hour: ContentLogic.hour(now))) else { return }
    let counts = data.items.map(\.repeatCount)
    let nowMs = now.timeIntervalSince1970 * 1000
    // Built inside the lock and sent after it, because PendingWidgetEventStore takes the same lock.
    let completion: AdhkarSessionCompletion? = WidgetQueueLock.withLock {
      let before = AdhkarSessionLogic.resolve(AdhkarSessionStore.read(), period: data.period,
                                              day: AdhkarSessionLogic.sessionDay(now), repeatCounts: counts)
      let after = AdhkarSessionLogic.apply(action, to: before, repeatCounts: counts, nowMs: nowMs)
      AdhkarSessionStore.write(after)
      return AdhkarSessionLogic.completionEvent(before: before, after: after, repeatCounts: counts,
                                                superId: data.superId, nowMs: nowMs)
    }
    if let c = completion {
      PendingWidgetEventStore.add(name: "adhkar_session_completed",
                                  props: ["category": c.category, "duration_ms": c.durationMs, "dhikr_count": c.dhikrCount],
                                  completedAtMs: c.completedAtMs)
    }
    WidgetCenter.shared.reloadTimelines(ofKind: "Adhkar")
    WidgetCenter.shared.reloadTimelines(ofKind: "BayaanNow")
  }
}

struct AdhkarNextIntent: AppIntent {
  static var title: LocalizedStringResource = "Next Dhikr"
  static var isDiscoverable = false
  func perform() async throws -> some IntentResult { AdhkarSessionActions.perform(.next); return .result() }
}

struct AdhkarPrevIntent: AppIntent {
  static var title: LocalizedStringResource = "Previous Dhikr"
  static var isDiscoverable = false
  func perform() async throws -> some IntentResult { AdhkarSessionActions.perform(.prev); return .result() }
}

struct AdhkarCountIntent: AppIntent {
  static var title: LocalizedStringResource = "Count Dhikr Repetition"
  static var isDiscoverable = false
  func perform() async throws -> some IntentResult { AdhkarSessionActions.perform(.count); return .result() }
}

struct AdhkarRestartIntent: AppIntent {
  static var title: LocalizedStringResource = "Restart Adhkar"
  static var isDiscoverable = false
  func perform() async throws -> some IntentResult { AdhkarSessionActions.perform(.restart); return .result() }
}
