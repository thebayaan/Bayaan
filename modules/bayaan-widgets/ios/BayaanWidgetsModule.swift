import ExpoModulesCore
import UIKit
import WidgetKit

let commandQueuedNotification = Notification.Name("BayaanWidgetCommandQueued")

private func appGroupId() -> String? {
  Bundle.main.object(forInfoDictionaryKey: "BayaanAppGroup") as? String
}

private func widgetsDir() -> URL? {
  guard let id = appGroupId(),
        let base = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: id)
  else { return nil }
  let dir = base.appendingPathComponent("widgets", isDirectory: true)
  try? FileManager.default.createDirectory(
    at: dir.appendingPathComponent("artwork"), withIntermediateDirectories: true)
  return dir
}

/// Same lock file as WidgetQueueLock in targets/widgets/_shared, so a take
/// cannot interleave with an enqueue and drop the appended command. flock
/// works across threads and processes, unlike an in-process NSLock.
private func withQueueLock<T>(_ body: () -> T) -> T {
  guard let dir = widgetsDir() else { return body() }
  let fd = open(dir.appendingPathComponent("queue.lock").path, O_CREAT | O_RDWR, 0o644)
  guard fd >= 0 else { return body() }
  defer { close(fd) }
  flock(fd, LOCK_EX)
  defer { flock(fd, LOCK_UN) }
  return body()
}

private func takeString(_ key: String) -> String {
  guard let id = appGroupId(), let defaults = UserDefaults(suiteName: id) else { return "[]" }
  return withQueueLock {
    let value = defaults.string(forKey: key) ?? "[]"
    defaults.removeObject(forKey: key)
    return value
  }
}

public class BayaanWidgetsModule: Module {
  private var observer: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("BayaanWidgets")
    Events("onCommandQueued")

    // App Shortcuts live in the app target (plugins/withAppShortcuts.js).
    // Refresh their surah parameters so Siri knows every surah name.
    OnCreate {
      if let cls = NSClassFromString("BayaanAppShortcutsRefresher") {
        let target = cls as AnyObject
        let selector = NSSelectorFromString("refresh")
        if target.responds(to: selector) { _ = target.perform(selector) }
      }
    }

    OnStartObserving {
      self.observer = NotificationCenter.default.addObserver(
        forName: commandQueuedNotification, object: nil, queue: .main
      ) { [weak self] _ in
        self?.sendEvent("onCommandQueued", [:])
      }
    }

    OnStopObserving {
      if let observer = self.observer { NotificationCenter.default.removeObserver(observer) }
      self.observer = nil
    }

    Function("writeSnapshot") { (json: String) in
      guard let dir = widgetsDir() else { return }
      try? json.data(using: .utf8)?.write(
        to: dir.appendingPathComponent("snapshot.json"), options: .atomic)
    }

    // ListeningAccessory and the play/pause control read the same snapshot slice as ContinueListening;
    // VerseOfTheDayAccessory shares AyahOfTheDay's provider.
    Function("reloadWidgets") { (kinds: [String]) in
      for kind in kinds {
        WidgetCenter.shared.reloadTimelines(ofKind: kind)
        if kind == "ContinueListening" {
          WidgetCenter.shared.reloadTimelines(ofKind: "ListeningAccessory")
          if #available(iOS 18.0, *) {
            ControlCenter.shared.reloadControls(ofKind: "PlaybackControl")
          }
        }
        if kind == "AyahOfTheDay" {
          WidgetCenter.shared.reloadTimelines(ofKind: "VerseOfTheDayAccessory")
        }
      }
    }

    Function("takeQueuedCommands") { () -> String in takeString("widgets.commandQueue") }
    // @ai-start
    // Lets a waiting AudioPlaybackIntent return (WidgetCommandQueue.waitUntilHandled).
    // Only moves forward, so an older drain cannot release a newer tap early.
    Function("markCommandsHandled") { (through: Double) in
      guard let id = appGroupId(), let defaults = UserDefaults(suiteName: id) else { return }
      withQueueLock {
        let key = "widgets.commandsHandledThrough"
        if through > defaults.double(forKey: key) { defaults.set(through, forKey: key) }
      }
    }
    // @ai-end
    Function("takePendingTasbeeh") { () -> String in takeString("widgets.pendingTasbeeh") }
    Function("takePendingWidgetEvents") { () -> String in takeString("widgets.pendingEvents") }

    Function("isLiveActivitySupported") { () -> Bool in NowPlayingActivityBridge.isSupported }

    AsyncFunction("startNowPlayingActivity") { (json: String, staleAtMs: Double) async -> String in
      await NowPlayingActivityBridge.start(json, staleAtMs: staleAtMs)
    }

    AsyncFunction("updateNowPlayingActivity") { (json: String, staleAtMs: Double) async -> Bool in
      await NowPlayingActivityBridge.update(json, staleAtMs: staleAtMs)
    }

    Function("currentNowPlayingActivity") { () -> String in
      NowPlayingActivityBridge.currentStateJSON()
    }

    AsyncFunction("endNowPlayingActivities") { () async in
      await NowPlayingActivityBridge.endAll()
    }

    AsyncFunction("startAdhkarSessionActivity") { (json: String, staleAtMs: Double) async -> String in
      await AdhkarSessionActivityBridge.start(json, staleAtMs: staleAtMs)
    }

    AsyncFunction("updateAdhkarSessionActivity") { (json: String, staleAtMs: Double) async -> Bool in
      await AdhkarSessionActivityBridge.update(json, staleAtMs: staleAtMs)
    }

    AsyncFunction("endAdhkarSessionActivities") { (dismissAtMs: Double?) async in
      await AdhkarSessionActivityBridge.endAll(dismissAtMs: dismissAtMs)
    }

    Function("writeCatalog") { (json: String) in
      guard let dir = widgetsDir() else { return }
      try? json.data(using: .utf8)?.write(
        to: dir.appendingPathComponent("catalog.json"), options: .atomic)
    }

    Function("writeContent") { (json: String) in
      guard let dir = widgetsDir() else { return }
      try? json.data(using: .utf8)?.write(
        to: dir.appendingPathComponent("content.json"), options: .atomic)
    }

    // Written by the widget extension (ArtworkRequestStore); read only, the
    // app skips files it already cached.
    Function("readArtworkRequests") { () -> String in
      guard let id = appGroupId(), let defaults = UserDefaults(suiteName: id) else { return "{}" }
      return defaults.string(forKey: "widgets.artworkRequests") ?? "{}"
    }

    Function("hasArtwork") { (fileName: String) -> Bool in
      guard let dir = widgetsDir() else { return false }
      return FileManager.default.fileExists(
        atPath: dir.appendingPathComponent("artwork/\(fileName)").path)
    }

    AsyncFunction("cacheArtwork") { (sourceUrl: String, fileName: String) async -> Bool in
      guard let dir = widgetsDir(), let url = URL(string: sourceUrl) else { return false }
      let data: Data
      if url.isFileURL {
        guard let d = try? Data(contentsOf: url) else { return false }
        data = d
      } else {
        guard let (d, _) = try? await URLSession.shared.data(from: url) else { return false }
        data = d
      }
      guard let image = UIImage(data: data) else { return false }
      let side: CGFloat = 300
      let renderer = UIGraphicsImageRenderer(size: CGSize(width: side, height: side))
      let resized = renderer.jpegData(withCompressionQuality: 0.85) { _ in
        let scale = max(side / image.size.width, side / image.size.height)
        let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
        image.draw(in: CGRect(
          x: (side - size.width) / 2, y: (side - size.height) / 2,
          width: size.width, height: size.height))
      }
      do {
        try resized.write(to: dir.appendingPathComponent("artwork/\(fileName)"), options: .atomic)
        return true
      } catch {
        return false
      }
    }
  }
}
