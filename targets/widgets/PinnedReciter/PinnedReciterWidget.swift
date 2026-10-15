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
    .containerBackground(for: .widget) { WidgetPalette.background }
  }

  private func small(id: String, name: String, file: String?) -> some View {
    Button(intent: PlayReciterIntent(reciterId: id)) {
      ZStack(alignment: .bottomLeading) {
        ReciterPhoto(file: file, name: name)
          .frame(maxWidth: .infinity, maxHeight: .infinity)
          .clipped()
        LinearGradient(colors: [.clear, .black.opacity(0.7)], startPoint: .center, endPoint: .bottom)
        HStack(alignment: .bottom) {
          Text(name).font(.headline).lineLimit(2)
          Spacer(minLength: 4)
          RoundGlyph(systemName: "play.fill")
        }
        .padding(12)
      }
      .overlay(alignment: .topTrailing) { BayaanLogo(size: 14).padding(12) }
    }
    .buttonStyle(.plain)
    .accessibilityLabel("Play \(name)")
  }

  private func medium(id: String, name: String, file: String?, rows: [PinnedRow]) -> some View {
    HStack(spacing: 12) {
      ZStack(alignment: .bottomLeading) {
        ReciterPhoto(file: file, name: name)
          .frame(width: 106, height: 106)
          .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        RoundIntentButton(intent: PlayReciterIntent(reciterId: id), systemName: "play.fill", label: "Play \(name)")
          .padding(8)
      }
      VStack(alignment: .leading, spacing: 6) {
        HStack {
          Text(name).font(.subheadline.bold()).lineLimit(1)
          Spacer(minLength: 0)
          BayaanLogo(size: 14)
        }
        ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
          if let surah = StaticData.surah(row.surahId) {
            Button(intent: PlayTrackIntent(surahId: surah.id, reciterId: id, rewayatId: row.rewayatId)) {
              HStack(spacing: 8) {
                SurahCard(surah: surah, size: 24)
                Text(surah.name).font(.caption.weight(.semibold)).lineLimit(1)
                Spacer(minLength: 0)
              }
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Play \(surah.name)")
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
