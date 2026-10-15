// targets/widgets/_shared/PlaybackIntents.swift
import AppIntents
import Foundation
import WidgetKit

// AudioPlaybackIntent runs in the app process, so the queue notification
// reaches the JS module when the app is alive, and the app launches in the
// background when it is not.
// AudioPlaybackIntent is iOS 17+, and _shared also compiles into the iOS 16.4 app.
// Sends an absolute target state (the opposite of what the widget rendered),
// so repeated taps converge instead of toggling past each other.
@available(iOS 17.0, *)
struct SetPlaybackIntent: AudioPlaybackIntent {
  static var title: LocalizedStringResource = "Play or Pause"
  static var isDiscoverable = false

  @Parameter(title: "Playing") var playing: Bool

  init() {}

  init(playing: Bool) {
    self.playing = playing
  }

  func perform() async throws -> some IntentResult {
    PlaybackCommand.setPlaying(playing)
    return .result()
  }
}

@available(iOS 17.0, *)
struct PlayTrackIntent: AudioPlaybackIntent {
  static var title: LocalizedStringResource = "Play Surah"
  static var isDiscoverable = false

  @Parameter(title: "Surah") var surahId: Int
  @Parameter(title: "Reciter") var reciterId: String?
  @Parameter(title: "Rewayah") var rewayatId: String?
  // Start from this ayah (Ayah of the Day); nil plays from the start.
  @Parameter(title: "Ayah") var ayah: Int?

  init() {}

  init(surahId: Int, reciterId: String?, rewayatId: String?, ayah: Int? = nil) {
    self.surahId = surahId
    self.reciterId = reciterId
    self.rewayatId = rewayatId
    self.ayah = ayah
  }

  func perform() async throws -> some IntentResult {
    PlaybackCommand.playTrack(
      surahId: surahId, reciterId: reciterId, rewayatId: rewayatId, ayah: ayah)
    return .result()
  }
}

/// Resumes the reciter's last surah (Pinned Reciter).
@available(iOS 17.0, *)
struct PlayReciterIntent: AudioPlaybackIntent {
  static var title: LocalizedStringResource = "Play Reciter"
  static var isDiscoverable = false

  @Parameter(title: "Reciter") var reciterId: String

  init() {}

  init(reciterId: String) {
    self.reciterId = reciterId
  }

  func perform() async throws -> some IntentResult {
    WidgetCommandQueue.enqueue(["type": "playReciter", "reciterId": reciterId])
    return .result()
  }
}

/// Every play/pause and play-track entry point (widgets, Live Activity, controls, Siri).
enum PlaybackCommand {
  static func setPlaying(_ playing: Bool) {
    // Optimistic render first, then hand the command to the app.
    PlaybackOverrideStore.write(isPlaying: playing)
    WidgetCenter.shared.reloadTimelines(ofKind: "ContinueListening")
    WidgetCenter.shared.reloadTimelines(ofKind: "ListeningAccessory")
    if #available(iOS 18.0, *) {
      ControlCenter.shared.reloadControls(ofKind: "PlaybackControl")
    }
    WidgetCommandQueue.enqueue(["type": "setPlayback", "playing": playing])
  }

  static func playTrack(surahId: Int, reciterId: String?, rewayatId: String?, ayah: Int? = nil) {
    WidgetCommandQueue.enqueue([
      "type": "playTrack",
      "surahId": surahId,
      "reciterId": reciterId ?? NSNull(),
      "rewayatId": rewayatId ?? NSNull(),
      "ayah": ayah ?? NSNull(),
    ])
  }

  /// The app's last snapshot, readable from the app process (Siri) too.
  static func loadSnapshot() -> WidgetSnapshot? {
    guard let url = BayaanAppGroup.widgetsDir?.appendingPathComponent("snapshot.json"),
          let data = try? Data(contentsOf: url) else { return nil }
    return WidgetSnapshot.decode(data)
  }
}

/// Siri, Shortcuts and the Play Surah control: plays a surah with the default reciter.
@available(iOS 17.0, *)
struct PlaySurahIntent: AudioPlaybackIntent {
  static var title: LocalizedStringResource = "Play Surah"
  static var description = IntentDescription("Plays a surah in Bayaan with your default reciter.")

  @Parameter(title: "Surah") var surah: SurahEntity

  static var parameterSummary: some ParameterSummary {
    Summary("Play \(\.$surah)")
  }

  init() {}

  init(surah: SurahEntity) {
    self.surah = surah
  }

  func perform() async throws -> some IntentResult {
    PlaybackCommand.playTrack(surahId: surah.id, reciterId: nil, rewayatId: nil)
    return .result()
  }
}

@available(iOS 17.0, *)
struct PausePlaybackIntent: AudioPlaybackIntent {
  static var title: LocalizedStringResource = "Pause Recitation"
  static var description = IntentDescription("Pauses the recitation playing in Bayaan.")

  init() {}

  func perform() async throws -> some IntentResult {
    PlaybackCommand.setPlaying(false)
    return .result()
  }
}

@available(iOS 17.0, *)
struct ResumePlaybackIntent: AudioPlaybackIntent {
  static var title: LocalizedStringResource = "Resume Recitation"
  static var description = IntentDescription(
    "Resumes your recitation in Bayaan, or plays your most recent surah.")

  init() {}

  func perform() async throws -> some IntentResult {
    switch PlaybackResume.action(for: PlaybackCommand.loadSnapshot()) {
    case .setPlaying:
      PlaybackCommand.setPlaying(true)
    case let .playTrack(surahId, reciterId, rewayatId):
      PlaybackCommand.playTrack(surahId: surahId, reciterId: reciterId, rewayatId: rewayatId)
    case .nothing:
      break
    }
    return .result()
  }
}

/// The play/pause control's action. ControlWidgetToggle needs a SetValueIntent
/// whose `value` is the new state; AudioPlaybackIntent keeps it in the app process.
@available(iOS 18.0, *)
struct SetPlayingControlIntent: SetValueIntent, AudioPlaybackIntent {
  static var title: LocalizedStringResource = "Play or Pause Bayaan"
  static var isDiscoverable = false

  @Parameter(title: "Playing") var value: Bool

  init() {}

  func perform() async throws -> some IntentResult {
    PlaybackCommand.setPlaying(value)
    return .result()
  }
}
