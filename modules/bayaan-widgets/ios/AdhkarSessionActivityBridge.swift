// modules/bayaan-widgets/ios/AdhkarSessionActivityBridge.swift
import ActivityKit
import Foundation
import UIKit

/// Starts, updates and ends the adhkar session Live Activity for the JS layer.
/// The widget extension renders it (targets/widgets/LiveActivity). Same
/// contract as NowPlayingActivityBridge, on its own ActivityKit type, so
/// ending one never ends the other.
enum AdhkarSessionActivityBridge {
  private static func decode(_ json: String) -> AdhkarSessionActivityState? {
    guard let data = json.data(using: .utf8) else { return nil }
    return try? JSONDecoder().decode(AdhkarSessionActivityState.self, from: data)
  }

  private static func content(_ state: AdhkarSessionActivityState, staleAtMs: Double)
    -> ActivityContent<AdhkarSessionActivityState>
  {
    ActivityContent(state: state, staleDate: Date(timeIntervalSince1970: staleAtMs / 1000))
  }

  /// The adhkar activity still on screen, if any.
  private static var current: Activity<AdhkarSessionAttributes>? {
    Activity<AdhkarSessionAttributes>.activities.first {
      $0.activityState == .active || $0.activityState == .stale
    }
  }

  /// Returns "started", "updated" (one already existed), "deferred" (the request
  /// failed while the app was not active; JS retries on foreground), "disabled",
  /// "unsupported", "invalid" or "error".
  @MainActor
  static func start(_ json: String, staleAtMs: Double) async -> String {
    // The extension that renders activities targets iOS 17.
    guard NowPlayingActivityBridge.isSupported else { return "unsupported" }
    guard ActivityAuthorizationInfo().areActivitiesEnabled else { return "disabled" }
    guard let state = decode(json) else { return "invalid" }
    if let activity = current {
      await activity.update(content(state, staleAtMs: staleAtMs))
      return "updated"
    }
    do {
      _ = try Activity.request(
        attributes: AdhkarSessionAttributes(),
        content: content(state, staleAtMs: staleAtMs),
        pushType: nil)
      return "started"
    } catch {
      return UIApplication.shared.applicationState == .active ? "error" : "deferred"
    }
  }

  /// False when no activity is on screen (the user dismissed it or the system ended it).
  static func update(_ json: String, staleAtMs: Double) async -> Bool {
    guard let state = decode(json), let activity = current else { return false }
    await activity.update(content(state, staleAtMs: staleAtMs))
    return true
  }

  /// Ends every adhkar activity. With dismissAtMs it stays on screen, ended,
  /// until then (the system still removes it within four hours), so it goes
  /// away on time even while the app is suspended.
  static func endAll(dismissAtMs: Double? = nil) async {
    let policy: ActivityUIDismissalPolicy =
      dismissAtMs.map { .after(Date(timeIntervalSince1970: $0 / 1000)) } ?? .immediate
    for activity in Activity<AdhkarSessionAttributes>.activities {
      await activity.end(nil, dismissalPolicy: policy)
    }
  }
}
