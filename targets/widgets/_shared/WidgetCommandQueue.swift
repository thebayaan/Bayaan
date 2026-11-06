// targets/widgets/_shared/WidgetCommandQueue.swift
import Foundation

enum BayaanAppGroup {
  // apple-targets names the widget extension `<main bundle id>.widget`.
  static let extensionSuffix = ".widget"

  static var id: String {
    if let v = Bundle.main.object(forInfoDictionaryKey: "BayaanAppGroup") as? String { return v }
    var bundle = Bundle.main.bundleIdentifier ?? "com.bayaan.app"
    if bundle.hasSuffix(extensionSuffix) { bundle = String(bundle.dropLast(extensionSuffix.count)) }
    return "group.\(bundle)"
  }

  static var defaults: UserDefaults? { UserDefaults(suiteName: id) }

  static var widgetsDir: URL? {
    FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: id)?
      .appendingPathComponent("widgets", isDirectory: true)
  }
}

/// Serializes queue read-modify-write against BayaanWidgetsModule's take.
/// The module lives in a separate pod and cannot share an NSLock with this
/// file, so both sides flock the same file in the App Group container. An
/// flock holds across threads (each call opens its own descriptor) and across
/// processes, so it also covers an intent that runs outside the app process.
enum WidgetQueueLock {
  static let fileName = "queue.lock"

  static func withLock<T>(_ body: () -> T) -> T {
    guard let dir = BayaanAppGroup.widgetsDir else { return body() }
    try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    let fd = open(dir.appendingPathComponent(fileName).path, O_CREAT | O_RDWR, 0o644)
    guard fd >= 0 else { return body() }
    defer { close(fd) }
    flock(fd, LOCK_EX)
    defer { flock(fd, LOCK_UN) }
    return body()
  }
}

enum WidgetCommandQueue {
  static let key = "widgets.commandQueue"
  static let notification = Notification.Name("BayaanWidgetCommandQueued")

  // @ai-start
  /// Written by the app (BayaanWidgetsModule.markCommandsHandled): the newest
  /// `enqueuedAt` that JS has taken and finished handling.
  static let handledKey = "widgets.commandsHandledThrough"
  /// Time for a cold background launch to boot React, restore the session and
  /// start audio. Measured in seconds; the intent gives up after this.
  static let handleTimeout: TimeInterval = 10
  // @ai-end

  /// Returns the command's `enqueuedAt` (epoch ms), for `waitUntilHandled`. // @ai
  @discardableResult // @ai
  static func enqueue(_ command: [String: Any]) -> Double {
    let enqueuedAt = Date().timeIntervalSince1970 * 1000 // @ai
    guard let defaults = BayaanAppGroup.defaults else { return enqueuedAt } // @ai
    WidgetQueueLock.withLock {
      var queue: [[String: Any]] = []
      if let raw = defaults.string(forKey: key)?.data(using: .utf8),
         let parsed = try? JSONSerialization.jsonObject(with: raw) as? [[String: Any]] {
        queue = parsed
      }
      queue.append(["command": command, "enqueuedAt": enqueuedAt]) // @ai
      if let data = try? JSONSerialization.data(withJSONObject: queue),
         let json = String(data: data, encoding: .utf8) {
        defaults.set(json, forKey: key)
      }
    }
    // In the app process this also boots React when the app was launched in
    // the background for the intent (BayaanCarSceneBridge observes it). // @ai
    NotificationCenter.default.post(name: notification, object: nil)
    return enqueuedAt // @ai
  }

  // @ai-start
  /// Keeps an AudioPlaybackIntent's perform() running until JS has handled the
  /// command. iOS can suspend an app it launched in the background as soon as
  /// perform() returns, which is before React has booted and started audio.
  /// Once audio plays, the audio background mode keeps the app alive.
  static func waitUntilHandled(enqueuedAt: Double, timeout: TimeInterval = handleTimeout) async {
    // Only the app process runs JS; the widget extension has nothing to wait for.
    guard !(Bundle.main.bundleIdentifier ?? "").hasSuffix(BayaanAppGroup.extensionSuffix),
          let defaults = BayaanAppGroup.defaults else { return }
    let deadline = Date().addingTimeInterval(timeout)
    while Date() < deadline {
      if defaults.double(forKey: handledKey) >= enqueuedAt { return }
      try? await Task.sleep(nanoseconds: 100_000_000)
    }
  }
  // @ai-end
}

/// Written on a widget tap so widgets render the expected state before the
/// app confirms it. `at` is epoch milliseconds.
struct PlaybackOverride: Codable, Hashable {
  let isPlaying: Bool
  let at: Double
}

enum PlaybackOverrideStore {
  static let key = "widgets.playbackOverride"
  /// Matches the 60 s max age of queued commands.
  static let ttlMs: Double = 60_000

  static func write(isPlaying: Bool) {
    let value = PlaybackOverride(isPlaying: isPlaying, at: Date().timeIntervalSince1970 * 1000)
    guard let defaults = BayaanAppGroup.defaults,
          let data = try? JSONEncoder().encode(value),
          let json = String(data: data, encoding: .utf8) else { return }
    defaults.set(json, forKey: key)
  }

  static func read() -> PlaybackOverride? {
    guard let data = BayaanAppGroup.defaults?.string(forKey: key)?.data(using: .utf8) else { return nil }
    return try? JSONDecoder().decode(PlaybackOverride.self, from: data)
  }
}
