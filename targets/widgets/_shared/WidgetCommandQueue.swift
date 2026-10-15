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

  static func enqueue(_ command: [String: Any]) {
    guard let defaults = BayaanAppGroup.defaults else { return }
    WidgetQueueLock.withLock {
      var queue: [[String: Any]] = []
      if let raw = defaults.string(forKey: key)?.data(using: .utf8),
         let parsed = try? JSONSerialization.jsonObject(with: raw) as? [[String: Any]] {
        queue = parsed
      }
      queue.append(["command": command, "enqueuedAt": Date().timeIntervalSince1970 * 1000])
      if let data = try? JSONSerialization.data(withJSONObject: queue),
         let json = String(data: data, encoding: .utf8) {
        defaults.set(json, forKey: key)
      }
    }
    NotificationCenter.default.post(name: notification, object: nil)
  }
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
