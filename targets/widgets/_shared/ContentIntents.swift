// targets/widgets/_shared/ContentIntents.swift
import AppIntents
import Foundation
import WidgetKit // @ai

// AudioPlaybackIntents run in the app process, like PlayTrackIntent. They
// only enqueue a command; services/widgets/contentCommands.ts does the work.

/// Queues a playlist starting at an item (Library Shelf).
@available(iOS 17.0, *)
struct PlayPlaylistIntent: AudioPlaybackIntent {
  static var title: LocalizedStringResource = "Play Playlist"
  static var isDiscoverable = false

  @Parameter(title: "Playlist") var playlistId: String
  @Parameter(title: "Item") var itemId: String?

  init() {}

  init(playlistId: String, itemId: String?) {
    self.playlistId = playlistId
    self.itemId = itemId
  }

  func perform() async throws -> some IntentResult {
    let enqueuedAt = WidgetCommandQueue.enqueue([ // @ai
      "type": "playPlaylist",
      "playlistId": playlistId,
      "itemId": itemId ?? NSNull(),
    ])
    await PlaybackCommand.waitUntilHandled(enqueuedAt) // @ai
    return .result()
  }
}

/// Plays a surah from the start, sets the sleep timer, optionally starts ambient (Bedtime).
@available(iOS 17.0, *)
struct StartBedtimeIntent: AudioPlaybackIntent {
  static var title: LocalizedStringResource = "Start Bedtime"
  static var isDiscoverable = false

  @Parameter(title: "Surah") var surahId: Int
  @Parameter(title: "Reciter") var reciterId: String?
  @Parameter(title: "Minutes") var sleepMinutes: Int
  @Parameter(title: "Ambient") var ambient: String?

  init() {}

  init(surahId: Int, reciterId: String?, sleepMinutes: Int, ambient: String?) {
    self.surahId = surahId
    self.reciterId = reciterId
    self.sleepMinutes = sleepMinutes
    self.ambient = ambient
  }

  func perform() async throws -> some IntentResult {
    let enqueuedAt = WidgetCommandQueue.enqueue([ // @ai
      "type": "startBedtime",
      "surahId": surahId,
      "reciterId": reciterId ?? NSNull(),
      "sleepMinutes": sleepMinutes,
      "ambient": ambient ?? NSNull(),
    ])
    await PlaybackCommand.waitUntilHandled(enqueuedAt) // @ai
    return .result()
  }
}

// @ai-start
/// Plays an adhkar list's audio from a dhikr (Adhkar widget). Like the other
/// AudioPlaybackIntents it works with the app closed: the app is launched in
/// the background, boots React, and services/adhkar/playback/widgetPlay.ts
/// starts the session.
@available(iOS 17.0, *)
struct PlayAdhkarIntent: AudioPlaybackIntent {
  static var title: LocalizedStringResource = "Play Adhkar"
  static var isDiscoverable = false

  @Parameter(title: "List") var superId: String
  // Start from this dhikr; nil starts from the first one with audio.
  @Parameter(title: "Dhikr") var dhikrId: String?

  init() {}

  init(superId: String, dhikrId: String?) {
    self.superId = superId
    self.dhikrId = dhikrId
  }

  func perform() async throws -> some IntentResult {
    let enqueuedAt = WidgetCommandQueue.enqueue([
      "type": "playAdhkar",
      "superId": superId,
      "dhikrId": dhikrId ?? NSNull(),
    ])
    await PlaybackCommand.waitUntilHandled(enqueuedAt)
    return .result()
  }
}
// @ai-end

// @ai-start
/// Pauses or resumes the adhkar player (Adhkar widgets' pause button).
/// Sends an absolute state, like SetPlaybackIntent.
@available(iOS 17.0, *)
struct SetAdhkarPlaybackIntent: AudioPlaybackIntent {
  static var title: LocalizedStringResource = "Play or Pause Adhkar"
  static var isDiscoverable = false

  @Parameter(title: "Playing") var playing: Bool

  init() {}

  init(playing: Bool) {
    self.playing = playing
  }

  func perform() async throws -> some IntentResult {
    // Optimistic render first, then hand the command to the app.
    AdhkarPlaybackOverrideStore.write(isPlaying: playing)
    WidgetCenter.shared.reloadTimelines(ofKind: "Adhkar")
    WidgetCenter.shared.reloadTimelines(ofKind: "BayaanNow")
    let enqueuedAt = WidgetCommandQueue.enqueue(["type": "setAdhkarPlayback", "playing": playing])
    await PlaybackCommand.waitUntilHandled(enqueuedAt)
    return .result()
  }
}

/// Written on an adhkar pause or play tap so the widget flips before the app
/// confirms it. Same shape and lifetime as PlaybackOverride.
enum AdhkarPlaybackOverrideStore {
  static let key = "widgets.adhkarPlaybackOverride"

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

/// Whether the adhkar list `superId` is playing: the snapshot, unless a newer
/// tap override (younger than the TTL) says otherwise. Show pause when true.
enum AdhkarPlaybackState {
  static func isPlaying(superId: String, snapshot: WidgetSnapshot?,
                        override: PlaybackOverride? = AdhkarPlaybackOverrideStore.read(),
                        now: Date = .now) -> Bool {
    guard let snapshot, let adhkar = snapshot.adhkar, adhkar.superId == superId else { return false }
    let nowMs = now.timeIntervalSince1970 * 1000
    if let o = override, o.at > snapshot.generatedAt, nowMs - o.at <= PlaybackOverrideStore.ttlMs {
      return o.isPlaying
    }
    return adhkar.isPlaying
  }
}
// @ai-end
