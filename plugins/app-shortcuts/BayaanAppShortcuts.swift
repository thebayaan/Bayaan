// plugins/app-shortcuts/BayaanAppShortcuts.swift
// Copied into the app target by plugins/withAppShortcuts.js on every prebuild.
// App only: putting this in targets/widgets/_shared would also declare App
// Shortcuts in the widget extension.
import AppIntents
import Foundation

@available(iOS 17.0, *)
struct BayaanAppShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: PlaySurahIntent(),
      phrases: [
        "Play \(\.$surah) in \(.applicationName)",
        "Play Surah \(\.$surah) in \(.applicationName)",
        "Play \(\.$surah) on \(.applicationName)",
      ],
      shortTitle: "Play Surah",
      systemImageName: "play.circle")
    AppShortcut(
      intent: PlayReciterByNameIntent(),
      phrases: [
        "Play \(\.$reciter) in \(.applicationName)",
        "Play \(\.$reciter) on \(.applicationName)",
        "Listen to \(\.$reciter) in \(.applicationName)",
      ],
      shortTitle: "Play Reciter",
      systemImageName: "person.wave.2")
    AppShortcut(
      intent: PausePlaybackIntent(),
      phrases: [
        "Pause \(.applicationName)",
        "Stop \(.applicationName)",
      ],
      shortTitle: "Pause",
      systemImageName: "pause.circle")
    AppShortcut(
      intent: ResumePlaybackIntent(),
      phrases: [
        "Resume \(.applicationName)",
        "Continue \(.applicationName)",
      ],
      shortTitle: "Resume",
      systemImageName: "play.circle.fill")
  }
}

/// The bayaan-widgets pod cannot import app-target code, so it calls this
/// through the Objective-C runtime when the module is created.
@objc(BayaanAppShortcutsRefresher)
final class BayaanAppShortcutsRefresher: NSObject {
  @objc static func refresh() {
    if #available(iOS 17.0, *) {
      BayaanAppShortcuts.updateAppShortcutParameters()
    }
  }
}
