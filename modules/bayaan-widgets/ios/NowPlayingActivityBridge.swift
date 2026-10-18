// modules/bayaan-widgets/ios/NowPlayingActivityBridge.swift
import ActivityKit
import Foundation
import UIKit

/// Starts, updates and ends the Now Playing Live Activity for the JS layer.
/// The widget extension renders it (targets/widgets/LiveActivity).
enum NowPlayingActivityBridge {
  /// The extension that renders the activity, and Button(intent:) inside it, need iOS 17.
  static var isSupported: Bool {
    if #available(iOS 17.0, *) { return true }
    return false
  }

  private static func decode(_ json: String) -> NowPlayingActivityState? {
    guard let data = json.data(using: .utf8) else { return nil }
    return try? JSONDecoder().decode(NowPlayingActivityState.self, from: data)
  }

  private static func content(_ state: NowPlayingActivityState, staleAtMs: Double)
    -> ActivityContent<NowPlayingActivityState>
  {
    ActivityContent(state: state, staleDate: Date(timeIntervalSince1970: staleAtMs / 1000))
  }

  /// The one Bayaan activity still on screen, if any.
  private static var current: Activity<NowPlayingAttributes>? {
    Activity<NowPlayingAttributes>.activities.first {
      $0.activityState == .active || $0.activityState == .stale
    }
  }

  /// Returns "started", "updated" (one already existed), "deferred" (the request
  /// failed while the app was not active; JS retries on foreground), "disabled",
  /// "unsupported", "invalid" or "error".
  @MainActor
  static func start(_ json: String, staleAtMs: Double) async -> String {
    guard isSupported else { return "unsupported" }
    guard ActivityAuthorizationInfo().areActivitiesEnabled else { return "disabled" }
    guard let state = decode(json) else { return "invalid" }
    if let activity = current {
      await activity.update(content(state, staleAtMs: staleAtMs))
      return "updated"
    }
    do {
      _ = try Activity.request(
        attributes: NowPlayingAttributes(),
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

  /// JSON content state of the activity still on screen, or "" when there is none.
  /// Lets a new process adopt an activity it did not start.
  static func currentStateJSON() -> String {
    guard let activity = current,
      let data = try? JSONEncoder().encode(activity.content.state),
      let json = String(data: data, encoding: .utf8)
    else { return "" }
    return json
  }

  static func endAll() async {
    for activity in Activity<NowPlayingAttributes>.activities {
      await activity.end(nil, dismissalPolicy: .immediate)
    }
  }
}
