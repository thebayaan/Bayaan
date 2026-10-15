// targets/widgets/ContinueListening/ContinueListeningWidget.swift
import SwiftUI
import WidgetKit

struct ContinueListeningEntry: TimelineEntry {
  let date: Date
  let snapshot: WidgetSnapshot?
  var override: PlaybackOverride? = nil

  /// Playback as of this entry's date, after the override and end checks.
  var playback: EffectivePlayback? {
    guard let s = snapshot, let np = s.nowPlaying else { return nil }
    return EffectivePlayback(nowPlaying: np, generatedAt: s.generatedAt, override: override, now: date)
  }
}

struct ContinueListeningProvider: TimelineProvider {
  func placeholder(in context: Context) -> ContinueListeningEntry {
    ContinueListeningEntry(date: .now, snapshot: nil)
  }

  func getSnapshot(in context: Context, completion: @escaping (ContinueListeningEntry) -> Void) {
    completion(ContinueListeningEntry(date: .now, snapshot: SnapshotStore.load(),
                                      override: PlaybackOverrideStore.read()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<ContinueListeningEntry>) -> Void) {
    // App pushes reloads on change; no polling. While playing, a second entry
    // at the computed end renders the stopped state if no reload arrives.
    let now = Date.now
    let first = ContinueListeningEntry(date: now, snapshot: SnapshotStore.load(),
                                       override: PlaybackOverrideStore.read())
    var dates: [Date] = []
    if let playback = first.playback, playback.isPlaying, playback.end > now {
      dates.append(playback.end)
    }
    // An active override stops applying after its TTL; render that moment too.
    if let o = first.override, let s = first.snapshot, o.at > s.generatedAt {
      let expiry = Date(timeIntervalSince1970: (o.at + PlaybackOverrideStore.ttlMs) / 1000)
      if expiry > now { dates.append(expiry.addingTimeInterval(1)) }
    }
    let later = dates.sorted().map {
      ContinueListeningEntry(date: $0, snapshot: first.snapshot, override: first.override)
    }
    completion(Timeline(entries: [first] + later, policy: .never))
  }
}

struct ContinueListeningWidget: Widget {
  let kind = "ContinueListening"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: ContinueListeningProvider()) { entry in
      ContinueListeningView(entry: entry)
    }
    .configurationDisplayName("Continue Listening")
    .description("Pick up where you left off.")
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    .contentMarginsDisabled()
  }
}
