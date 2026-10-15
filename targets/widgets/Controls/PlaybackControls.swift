// targets/widgets/Controls/PlaybackControls.swift
import AppIntents
import SwiftUI
import WidgetKit

/// Continue Listening's effective playing state (snapshot plus tap override).
enum PlaybackControlState {
  static func isPlaying(snapshot: WidgetSnapshot?, override: PlaybackOverride?, now: Date) -> Bool {
    guard let s = snapshot, let np = s.nowPlaying else { return false }
    return EffectivePlayback(nowPlaying: np, generatedAt: s.generatedAt, override: override, now: now)
      .isPlaying
  }
}

@available(iOS 18.0, *)
struct PlaybackControlValueProvider: ControlValueProvider {
  var previewValue: Bool { false }

  func currentValue() async throws -> Bool {
    PlaybackControlState.isPlaying(
      snapshot: SnapshotStore.load(), override: PlaybackOverrideStore.read(), now: .now)
  }
}

/// Control Center, Lock Screen and Action Button: play or pause in place.
@available(iOS 18.0, *)
struct PlaybackControl: ControlWidget {
  static let kind = "PlaybackControl"

  var body: some ControlWidgetConfiguration {
    StaticControlConfiguration(kind: Self.kind, provider: PlaybackControlValueProvider()) { isPlaying in
      ControlWidgetToggle("\(AppBrand.name)", isOn: isPlaying, action: SetPlayingControlIntent()) { isOn in
        Label(isOn ? "Playing" : "Paused", systemImage: isOn ? "pause.fill" : "play.fill")
      }
    }
    .displayName("Play or Pause")
    .description("Play or pause your recitation.")
  }
}

@available(iOS 18.0, *)
struct PlaySurahControlConfig: ControlConfigurationIntent {
  static var title: LocalizedStringResource = "Play Surah"
  static var description = IntentDescription("Choose the surah this control plays.")

  @Parameter(title: "Surah") var surah: SurahEntity?

  init() {}

  func perform() async throws -> some IntentResult { .result() }
}

/// Plays the configured surah (Al-Kahf until configured) with the default reciter.
@available(iOS 18.0, *)
struct PlaySurahControl: ControlWidget {
  static let kind = "PlaySurahControl"

  var body: some ControlWidgetConfiguration {
    AppIntentControlConfiguration(kind: Self.kind, intent: PlaySurahControlConfig.self) { config in
      let surah = config.surah ?? SurahEntity.fallback
      ControlWidgetButton(action: PlaySurahIntent(surah: surah)) {
        Label(surah.name, systemImage: "play.circle.fill")
      }
    }
    .displayName("Play Surah")
    .description("Play a chosen surah with your default reciter.")
    .promptsForUserConfiguration()
  }
}
