// targets/widgets/Support/WidgetStores.swift
import Foundation

enum CatalogStore {
  static func load() -> WidgetCatalog? {
    guard let url = BayaanAppGroup.widgetsDir?.appendingPathComponent("catalog.json"),
          let data = try? Data(contentsOf: url) else { return nil }
    return WidgetCatalog.decode(data)
  }
}

enum ArtworkFiles {
  static func exists(_ file: String?) -> Bool {
    guard let file, let dir = BayaanAppGroup.widgetsDir else { return false }
    return FileManager.default.fileExists(atPath: dir.appendingPathComponent("artwork/\(file)").path)
  }
}

/// Artwork a widget wanted but did not find. The app reads the list on start
/// and foreground and caches the files (syncConfiguredWidgets.ts).
enum ArtworkRequestStore {
  static let key = "widgets.artworkRequests"

  static func record(surahIds: [Int], reciterIds: [String]) {
    guard !surahIds.isEmpty || !reciterIds.isEmpty, let defaults = BayaanAppGroup.defaults else { return }
    WidgetQueueLock.withLock {
      let existing = defaults.string(forKey: key)
        .flatMap { try? JSONDecoder().decode(ArtworkRequests.self, from: Data($0.utf8)) } ?? .empty
      let merged = WidgetLogic.mergeRequests(existing, surahIds: surahIds, reciterIds: reciterIds)
      guard merged != existing, let data = try? JSONEncoder().encode(merged) else { return }
      defaults.set(String(decoding: data, as: UTF8.self), forKey: key)
    }
  }

  /// Records the surah cards and reciter photos (by reciter id) not cached yet.
  static func recordMissing(surahs: [StaticSurah], reciterFiles: [(id: String, file: String?)]) {
    record(
      surahIds: surahs.filter { !ArtworkFiles.exists($0.artworkFile) }.map(\.id),
      reciterIds: reciterFiles.filter { !ArtworkFiles.exists($0.file) }.map(\.id))
  }
}

/// Tasbeeh taps made on the widget, waiting for the app. The module's
/// takePendingTasbeeh reads and clears the same key under the same lock.
enum PendingTasbeehStore {
  static let key = "widgets.pendingTasbeeh"

  static func read() -> [PendingTasbeeh] {
    guard let raw = BayaanAppGroup.defaults?.string(forKey: key),
          let list = try? JSONDecoder().decode([PendingTasbeeh].self, from: Data(raw.utf8)) else { return [] }
    return list
  }

  static func add(dhikrId: String, reset: Bool, now: Date = .now) {
    guard let defaults = BayaanAppGroup.defaults else { return }
    WidgetQueueLock.withLock {
      let next = WidgetLogic.appendPending(read(), dhikrId: dhikrId,
                                           day: WidgetLogic.localDayKey(now), reset: reset)
      if let data = try? JSONEncoder().encode(next) {
        defaults.set(String(decoding: data, as: UTF8.self), forKey: key)
      }
    }
  }
}

/// The Adhkar widget's session. One record: resolve() resets it when the period or day changes.
enum AdhkarSessionStore {
  private static let key = "widgets.adhkarSession"

  static func read() -> AdhkarSession? {
    guard let s = BayaanAppGroup.defaults?.string(forKey: key), let d = s.data(using: .utf8) else { return nil }
    return try? JSONDecoder().decode(AdhkarSession.self, from: d)
  }

  static func write(_ session: AdhkarSession) {
    guard let d = try? JSONEncoder().encode(session), let s = String(data: d, encoding: .utf8) else { return }
    BayaanAppGroup.defaults?.set(s, forKey: key)
  }
}

/// Analytics events raised in the extension; the app drains them (takePendingWidgetEvents).
enum PendingWidgetEventStore {
  static let key = "widgets.pendingEvents"

  /// `completedAtMs` (epoch ms) dates the event, so the app credits the day it happened.
  static func add(name: String, props: [String: Any], completedAtMs: Double) {
    WidgetQueueLock.withLock {
      let defaults = BayaanAppGroup.defaults
      var list = (defaults?.string(forKey: key)?.data(using: .utf8))
        .flatMap { try? JSONSerialization.jsonObject(with: $0) as? [[String: Any]] } ?? []
      list.append(["name": name, "props": props, "completedAtMs": completedAtMs])
      if let d = try? JSONSerialization.data(withJSONObject: list), let s = String(data: d, encoding: .utf8) {
        defaults?.set(s, forKey: key)
      }
    }
  }
}
