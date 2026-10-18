// targets/widgets/_shared/ContentIntents.swift
import AppIntents
import Foundation

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
    WidgetCommandQueue.enqueue([
      "type": "playPlaylist",
      "playlistId": playlistId,
      "itemId": itemId ?? NSNull(),
    ])
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
    WidgetCommandQueue.enqueue([
      "type": "startBedtime",
      "surahId": surahId,
      "reciterId": reciterId ?? NSNull(),
      "sleepMinutes": sleepMinutes,
      "ambient": ambient ?? NSNull(),
    ])
    return .result()
  }
}
