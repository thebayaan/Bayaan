// targets/widgets/BayaanNow/BayaanNowWidget.swift
import AppIntents
import SwiftUI
import WidgetKit

struct BayaanNowEntry: TimelineEntry {
  let date: Date
  let mode: BayaanNowMode
  let snapshot: WidgetSnapshot?
  let override: PlaybackOverride?
  let content: WidgetContent?
  let relevance: TimelineEntryRelevance?
}

struct BayaanNowProvider: TimelineProvider {
  func placeholder(in context: Context) -> BayaanNowEntry {
    BayaanNowEntry(date: .now, mode: .listening, snapshot: nil, override: nil, content: nil, relevance: nil)
  }

  func getSnapshot(in context: Context, completion: @escaping (BayaanNowEntry) -> Void) {
    completion(entries(from: .now)[0])
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<BayaanNowEntry>) -> Void) {
    completion(Timeline(entries: entries(from: .now), policy: .atEnd))
  }

  /// Now, every context boundary in the next 24 hours, and the playing track's computed end.
  /// The app reloads this kind when Continue Listening's slice, recent plays or the sleep timer change.
  func entries(from now: Date) -> [BayaanNowEntry] {
    let snapshot = SnapshotStore.load()
    let override = PlaybackOverrideStore.read()
    let content = ContentStore.load()
    func playback(at date: Date) -> EffectivePlayback? {
      guard let s = snapshot, let np = s.nowPlaying else { return nil }
      return EffectivePlayback(nowPlaying: np, generatedAt: s.generatedAt, override: override, now: date)
    }
    var dates = ContentTimeline.dates(from: now)
    if let p = playback(at: now), p.isPlaying, p.end > now { dates.append(p.end) }
    dates.sort()
    return dates.enumerated().map { i, d in
      let playing = playback(at: d)?.isPlaying ?? false
      let mode = ContentLogic.mode(hour: ContentLogic.hour(d), isPlaying: playing,
                                   adhkar: WidgetFeatures.adhkar, bedtime: WidgetFeatures.sleepTimer)
      return BayaanNowEntry(
        date: d, mode: mode, snapshot: snapshot, override: override, content: content,
        relevance: .scored(ContentLogic.relevance(mode: mode, isPlaying: playing), from: d,
                           until: i + 1 < dates.count ? dates[i + 1] : nil))
    }
  }
}

struct BayaanNowWidget: Widget {
  let kind = "BayaanNow"

  /// Leaves out the cards a fork turned off; the Android picker's
  /// bayaan_widget_now_desc is generated the same way (RFC-021).
  static var gallerySummary: String {
    var parts = ["listening"]
    if WidgetFeatures.adhkar { parts.append("adhkar") }
    if WidgetFeatures.sleepTimer { parts.append("bedtime") }
    let last = parts.removeLast()
    return "What fits this moment: \(parts.joined(separator: ", ")) or \(last)."
  }

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: BayaanNowProvider()) { entry in
      BayaanNowView(entry: entry)
    }
    // A plain String: WidgetKit traps on an interpolated LocalizedStringKey here,
    // which crashes the extension and hides every widget from the gallery.
    .configurationDisplayName(AppBrand.name + " Now")
    .description(Self.gallerySummary)
    .supportedFamilies([.systemSmall, .systemMedium])
    .contentMarginsDisabled()
  }
}

/// Composes the other widgets' views by mode (spec 6.8); each sets its own background and link.
struct BayaanNowView: View {
  let entry: BayaanNowEntry

  var body: some View {
    switch entry.mode {
    case .listening:
      ContinueListeningView(entry: ContinueListeningEntry(date: entry.date, snapshot: entry.snapshot, override: entry.override))
    case .morningAdhkar, .eveningAdhkar:
      AdhkarView(entry: AdhkarEntry.make(at: entry.date, next: nil))
    case .bedtime:
      BedtimeView(entry: BedtimeEntry.make(
        at: entry.date, settings: .default(reciterName: entry.snapshot?.defaultReciter?.name),
        content: entry.content, next: nil))
    }
  }
}

#Preview("Small", as: .systemSmall) {
  BayaanNowWidget()
} timeline: {
  BayaanNowEntry(date: .now, mode: .listening, snapshot: nil, override: nil, content: nil, relevance: nil)
  BayaanNowEntry(date: .now, mode: .morningAdhkar, snapshot: nil, override: nil, content: nil, relevance: nil)
  BayaanNowEntry(date: .now, mode: .bedtime, snapshot: nil, override: nil, content: nil, relevance: nil)
}

#Preview("Medium", as: .systemMedium) {
  BayaanNowWidget()
} timeline: {
  BayaanNowEntry(date: .now, mode: .eveningAdhkar, snapshot: nil, override: nil, content: nil, relevance: nil)
  BayaanNowEntry(date: .now, mode: .bedtime, snapshot: nil, override: nil, content: nil, relevance: nil)
}
