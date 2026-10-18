import Foundation

/// Threading model: all mutable state (snapshot, nowPlaying, connection, the
/// pending queue, jsReady, emit, owner) is read and written on the main queue
/// only. Entry points called from other threads (the Expo module on the JS
/// thread) hop to main first. Disk IO and JSON decoding happen off main.
///
/// The emitter is owned by one module instance (owner token). A late
/// `detach` from an old instance after a reload cannot clear the new
/// instance's emitter or ready flag.
final class CarBridge {
  static let shared = CarBridge()
  static let snapshotDidChange = Notification.Name("BayaanCarSnapshotDidChange")
  static let nowPlayingDidChange = Notification.Name("BayaanCarNowPlayingDidChange")
  private static let maxPending = 32

  private(set) var snapshot: CarSnapshot?
  private(set) var nowPlaying: CarNowPlaying?
  private(set) var isConnected = false

  private var emit: ((String, [String: Any]) -> Void)?
  private var owner: UUID?
  private var jsReady = false
  private var pending: [(String, [String: Any])] = []

  private var snapshotURL: URL {
    let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
    return base.appendingPathComponent("bayaan-car/snapshot.json")
  }

  private init() {
    loadSnapshotFromDisk()
  }

  private func onMain(_ work: @escaping () -> Void) {
    if Thread.isMainThread {
      work()
    } else {
      DispatchQueue.main.async(execute: work)
    }
  }

  /// A new module instance (new JS runtime) takes over. Not ready until it
  /// calls markJsReady.
  func attach(owner id: UUID, emit: @escaping (String, [String: Any]) -> Void) {
    onMain {
      self.owner = id
      self.emit = emit
      self.jsReady = false
    }
  }

  /// Clears emitter state only if `owner` still owns it.
  func detach(owner id: UUID) {
    onMain {
      guard self.owner == id else { return }
      self.owner = nil
      self.emit = nil
      self.jsReady = false
    }
  }

  func writeSnapshot(json: String) {
    guard let data = json.data(using: .utf8) else { return }
    let decoded: CarSnapshot
    do {
      decoded = try JSONDecoder().decode(CarSnapshot.self, from: data)
    } catch {
      carDebugLog("snapshot decode failed: \(error)")
      return
    }
    guard decoded.version == 1 else {
      carDebugLog("snapshot version \(decoded.version) unsupported")
      return
    }
    let url = snapshotURL
    do {
      try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
      try data.write(to: url, options: .atomic)
    } catch {
      carDebugLog("snapshot write failed: \(error)")
    }
    onMain {
      self.snapshot = decoded
      NotificationCenter.default.post(name: CarBridge.snapshotDidChange, object: nil)
      BayaanCarSiri.donateVocabulary(decoded)
    }
  }

  func setNowPlaying(json: String?) {
    let decoded = json.flatMap { $0.data(using: .utf8) }.flatMap { try? JSONDecoder().decode(CarNowPlaying.self, from: $0) }
    onMain {
      self.nowPlaying = decoded
      NotificationCenter.default.post(name: CarBridge.nowPlayingDidChange, object: nil)
    }
  }

  func markJsReady() {
    onMain {
      // Never flush into a missing emitter: keep events queued.
      guard let emit = self.emit else { return }
      self.jsReady = true
      // Connection first: JS must apply car mode (skip buttons off) before a
      // queued play request loads a track and re-activates the lock screen.
      emit("onCarConnectionChanged", ["connected": self.isConnected])
      let queued = self.pending
      self.pending.removeAll()
      queued.forEach { emit($0.0, $0.1) }
    }
  }

  func send(play request: [String: Any]) {
    send(event: "onPlayRequest", payload: request)
  }

  func send(transport: [String: Any]) {
    send(event: "onTransport", payload: transport)
  }

  func setConnected(_ connected: Bool) {
    onMain {
      self.isConnected = connected
      guard self.jsReady else { return }
      self.emit?("onCarConnectionChanged", ["connected": connected])
    }
  }

  private func send(event: String, payload: [String: Any]) {
    guard JSONSerialization.isValidJSONObject(payload),
          let data = try? JSONSerialization.data(withJSONObject: payload),
          let json = String(data: data, encoding: .utf8) else { return }
    onMain {
      let body: [String: Any] = ["json": json]
      if self.jsReady, let emit = self.emit {
        emit(event, body)
        return
      }
      // A new play request supersedes everything queued before it.
      if event == "onPlayRequest" { self.pending.removeAll() }
      self.pending.append((event, body))
      if self.pending.count > CarBridge.maxPending {
        self.pending.removeFirst(self.pending.count - CarBridge.maxPending)
      }
    }
  }

  /// Main queue only. A cold Siri launch can ask before the async disk load
  /// finishes, so read the persisted snapshot synchronously if needed.
  func loadSnapshotIfNeeded() -> CarSnapshot? {
    if let snapshot { return snapshot }
    guard let data = try? Data(contentsOf: snapshotURL),
      let decoded = try? JSONDecoder().decode(CarSnapshot.self, from: data),
      decoded.version == 1
    else { return nil }
    snapshot = decoded
    NotificationCenter.default.post(name: CarBridge.snapshotDidChange, object: nil)
    return decoded
  }

  private func loadSnapshotFromDisk() {
    let url = snapshotURL
    DispatchQueue.global(qos: .userInitiated).async {
      guard let data = try? Data(contentsOf: url),
            let decoded = try? JSONDecoder().decode(CarSnapshot.self, from: data),
            decoded.version == 1 else { return }
      DispatchQueue.main.async {
        // A snapshot written by JS in the meantime is newer; keep it.
        guard self.snapshot == nil else { return }
        self.snapshot = decoded
        NotificationCenter.default.post(name: CarBridge.snapshotDidChange, object: nil)
      }
    }
  }
}
