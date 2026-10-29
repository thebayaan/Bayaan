// targets/widgets/PinnedReciter/PinnedReciterWidget.swift
import AppIntents
import SwiftUI
import WidgetKit

struct PinnedReciterConfigIntent: WidgetConfigurationIntent {
  static var title: LocalizedStringResource = "Pinned Reciter"
  static var description = IntentDescription("Play a favorite reciter in one tap.")

  @Parameter(title: "Reciter") var reciter: ReciterEntity?
}

struct PinnedReciterEntry: TimelineEntry {
  let date: Date
  let state: PinnedReciterState
}

struct PinnedReciterProvider: AppIntentTimelineProvider {
  func placeholder(in context: Context) -> PinnedReciterEntry {
    PinnedReciterEntry(date: .now, state: .ready(id: "", name: AppBrand.name, artworkFile: nil, rows: []))
  }

  func snapshot(for configuration: PinnedReciterConfigIntent, in context: Context) async -> PinnedReciterEntry {
    entry(for: configuration)
  }

  func timeline(for configuration: PinnedReciterConfigIntent, in context: Context) async -> Timeline<PinnedReciterEntry> {
    let e = entry(for: configuration)
    if case let .ready(id, _, file, rows) = e.state {
      let surahs = context.family == .systemSmall ? [] : rows.compactMap { StaticData.surah($0.surahId) }
      ArtworkRequestStore.recordMissing(surahs: surahs, reciterFiles: [(id: id, file: file)])
    }
    // The app reloads this kind when the catalog, default reciter or artwork changes.
    return Timeline(entries: [e], policy: .never)
  }

  private func entry(for configuration: PinnedReciterConfigIntent) -> PinnedReciterEntry {
    PinnedReciterEntry(date: .now, state: PinnedReciterResolver.resolve(
      reciterId: configuration.reciter?.id, catalog: CatalogStore.load(), snapshot: SnapshotStore.load()))
  }
}

struct PinnedReciterWidget: Widget {
  let kind = "PinnedReciter"

  var body: some WidgetConfiguration {
    AppIntentConfiguration(kind: kind, intent: PinnedReciterConfigIntent.self, provider: PinnedReciterProvider()) { entry in
      PinnedReciterView(entry: entry)
    }
    .configurationDisplayName("Pinned Reciter")
    .description("Play a favorite reciter in one tap.")
    .supportedFamilies([.systemSmall, .systemMedium])
    .contentMarginsDisabled()
  }
}

struct PinnedReciterView: View {
  @Environment(\.widgetFamily) private var family
  let entry: PinnedReciterEntry

  var body: some View {
    Group {
      switch entry.state {
      case let .ready(id, name, file, rows):
        if family == .systemSmall {
          small(id: id, name: name, file: file)
        } else {
          medium(id: id, name: name, file: file, rows: rows)
        }
      case .unavailable:
        message("Reciter unavailable", "Edit the widget to choose another")
      case .unset:
        message("Choose a reciter", "Edit the widget to pick one")
      }
    }
    .foregroundStyle(.white)
    .containerBackground(for: .widget) { Color(hex: 0x1E1838) } // @ai
  }

  private func small(id: String, name: String, file: String?) -> some View {
    let playing = PlayingNow.track(at: entry.date)?.reciterId == id // @ai
    return PlayOrPauseButton(playing: playing, play: PlayReciterIntent(reciterId: id), label: "Play \(name)") { playing in // @ai
      ZStack(alignment: .bottomLeading) {
        ReciterPhoto(file: file, name: name)
          .frame(maxWidth: .infinity, maxHeight: .infinity)
          .clipped()
        LinearGradient(colors: [WidgetPalette.ink.opacity(0), WidgetPalette.ink.opacity(0.9)], startPoint: .center, endPoint: .bottom) // @ai
        HStack(alignment: .bottom) {
          Text(name).font(.headline).lineLimit(2).minimumScaleFactor(0.85) // @ai
          Spacer(minLength: 4)
          PrimaryGlyph(systemName: playing ? "pause.fill" : "play.fill") // @ai
        }
        .padding(12)
      }
    }
  }

  private func medium(id: String, name: String, file: String?, rows: [PinnedRow]) -> some View {
    let now = PlayingNow.track(at: entry.date) // @ai
    return HStack(spacing: 12) { // @ai
      ReciterPhoto(file: file, name: name)
        .frame(width: 106, height: 106)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
      VStack(alignment: .leading, spacing: 6) {
        // @ai-start
        // The play button sits beside the name, clear of the photo's initials.
        HStack(spacing: 8) {
          Text(name).font(.subheadline.weight(.heavy)).lineLimit(2)
          Spacer(minLength: 0)
          PlayOrPauseButton(playing: now?.reciterId == id, play: PlayReciterIntent(reciterId: id),
                            label: "Play \(name)") { PrimaryGlyph(systemName: $0 ? "pause.fill" : "play.fill", size: 36) }
        }
        // @ai-end
        ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
          if let surah = StaticData.surah(row.surahId) {
            PlayOrPauseButton(playing: PlayingNow.matches(now, surahId: surah.id, reciterId: id), // @ai
                              play: PlayTrackIntent(surahId: surah.id, reciterId: id, rewayatId: row.rewayatId), label: "Play \(surah.name)") { playing in // @ai
              HStack(spacing: 8) {
                // @ai-start
                SurahCard(surah: surah, size: 26)
                Text(surah.name).font(.caption.weight(.bold)).lineLimit(1)
                  .foregroundStyle(playing ? WidgetPalette.accent : .white)
                if playing { Image(systemName: "pause.fill").font(.system(size: 10, weight: .bold)).foregroundStyle(WidgetPalette.accent) }
                // @ai-end
                Spacer(minLength: 0)
              }
            }
          }
        }
        Spacer(minLength: 0)
      }
    }
    .padding(12)
  }

  private func message(_ title: String, _ detail: String) -> some View {
    VStack(spacing: 6) {
      BayaanLogo(size: 20)
      Text(title).font(.caption.weight(.semibold)).multilineTextAlignment(.center)
      Text(detail).font(.caption2).opacity(0.7).multilineTextAlignment(.center)
    }
    .padding(12)
  }
}

#Preview("Small", as: .systemSmall) {
  PinnedReciterWidget()
} timeline: {
  PinnedReciterEntry(date: .now, state: .ready(id: "r", name: "Mishary Alafasi", artworkFile: nil, rows: []))
  PinnedReciterEntry(date: .now, state: .unavailable)
}

#Preview("Medium", as: .systemMedium) {
  PinnedReciterWidget()
} timeline: {
  PinnedReciterEntry(date: .now, state: .ready(
    id: "r", name: "Mishary Alafasi", artworkFile: nil,
    rows: PinnedReciterResolver.popularSurahIds.map { PinnedRow(surahId: $0, rewayatId: nil) }))
  PinnedReciterEntry(date: .now, state: .unset)
}
