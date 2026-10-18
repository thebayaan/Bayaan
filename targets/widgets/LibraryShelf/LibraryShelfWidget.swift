// targets/widgets/LibraryShelf/LibraryShelfWidget.swift
import AppIntents
import SwiftUI
import WidgetKit

struct LibraryShelfConfigIntent: WidgetConfigurationIntent {
  static var title: LocalizedStringResource = "Library Shelf"
  static var description = IntentDescription("Your downloads or a playlist, one tap away.")

  @Parameter(title: "Show") var source: LibrarySourceEntity?
}

struct LibraryShelfEntry: TimelineEntry {
  let date: Date
  let state: LibraryShelfState
}

struct LibraryShelfProvider: AppIntentTimelineProvider {
  func placeholder(in context: Context) -> LibraryShelfEntry {
    LibraryShelfEntry(date: .now, state: .downloads(items: [], count: 0))
  }

  func snapshot(for configuration: LibraryShelfConfigIntent, in context: Context) async -> LibraryShelfEntry {
    entry(configuration)
  }

  func timeline(for configuration: LibraryShelfConfigIntent, in context: Context) async -> Timeline<LibraryShelfEntry> {
    let e = entry(configuration)
    let items: [WidgetShelfItem]
    switch e.state {
    case let .downloads(list, _): items = list
    case let .playlist(p): items = p.items
    case .playlistUnavailable, .noContent: items = []
    }
    ArtworkRequestStore.recordMissing(surahs: items.compactMap { StaticData.surah($0.surahId) }, reciterFiles: [])
    // The app reloads this kind when downloads or playlists change.
    return Timeline(entries: [e], policy: .never)
  }

  private func entry(_ configuration: LibraryShelfConfigIntent) -> LibraryShelfEntry {
    LibraryShelfEntry(date: .now, state: ContentResolvers.library(sourceId: configuration.source?.id, content: ContentStore.load()))
  }
}

struct LibraryShelfWidget: Widget {
  let kind = "LibraryShelf"

  var body: some WidgetConfiguration {
    AppIntentConfiguration(kind: kind, intent: LibraryShelfConfigIntent.self, provider: LibraryShelfProvider()) { entry in
      LibraryShelfView(entry: entry)
    }
    .configurationDisplayName("Library")
    .description("Your downloads or a playlist, one tap away.")
    .supportedFamilies([.systemMedium, .systemLarge])
    .contentMarginsDisabled()
  }
}

struct LibraryShelfView: View {
  @Environment(\.widgetFamily) private var family
  let entry: LibraryShelfEntry

  private var isLarge: Bool { family == .systemLarge }

  var body: some View {
    Group {
      switch entry.state {
      case let .downloads(items, count):
        if items.isEmpty {
          ContentMessage(title: "No downloads yet", detail: "Downloaded surahs show here")
        } else {
          shelf(ShelfHeader(title: "Downloads", detail: ContentText.surahCount(count)), items: items) {
            PlayTrackIntent(surahId: $0.surahId, reciterId: $0.reciterId, rewayatId: $0.rewayatId)
          }
        }
      case let .playlist(p):
        let header = ShelfHeader(title: p.name, detail: ContentText.surahCount(p.itemCount)) {
          RoundIntentButton(intent: PlayPlaylistIntent(playlistId: p.id, itemId: nil), systemName: "play.fill", label: "Play \(p.name)")
        }
        if p.items.isEmpty {
          VStack(alignment: .leading, spacing: 10) {
            header
            Spacer(minLength: 0)
            Text("Open the playlist in \(AppBrand.name)").font(.caption).opacity(0.6)
            Spacer(minLength: 0)
          }
          .padding(14)
        } else {
          shelf(header, items: p.items) { PlayPlaylistIntent(playlistId: p.id, itemId: $0.itemId) }
        }
      case .playlistUnavailable:
        ContentMessage(title: "Playlist unavailable", detail: "Edit the widget to choose another")
      case .noContent:
        ContentMessage(title: "Open \(AppBrand.name)", detail: "to load your library")
      }
    }
    .foregroundStyle(.white)
    .containerBackground(for: .widget) { WidgetPalette.background }
    .widgetURL(url)
  }

  private var url: URL? {
    switch entry.state {
    case .downloads: return AppLinks.url("collection/downloads")
    case .playlist, .playlistUnavailable: return AppLinks.url("collection/playlists")
    case .noContent: return nil
    }
  }

  private func shelf<H: View, I: AppIntent>(_ header: H, items: [WidgetShelfItem],
                                             intent: @escaping (WidgetShelfItem) -> I) -> some View {
    let shown = Array(items.prefix(isLarge ? 8 : 4))
    let rows = (shown.count + 3) / 4
    return VStack(alignment: .leading, spacing: 10) {
      header
      ForEach(0..<rows, id: \.self) { row in
        HStack(spacing: 8) {
          ForEach(0..<4, id: \.self) { col in
            let i = row * 4 + col
            if i < shown.count {
              SurahTileButton(surahId: shown[i].surahId, size: isLarge ? 62 : 58, intent: intent(shown[i]),
                              caption: isLarge ? shown[i].surahName : nil)
                .frame(maxWidth: .infinity)
            } else {
              Color.clear.frame(maxWidth: .infinity, maxHeight: 1)
            }
          }
        }
      }
      Spacer(minLength: 0)
    }
    .padding(14)
  }
}

private let previewItems = [67, 18, 36, 55, 56, 1, 112, 114].map {
  WidgetShelfItem(surahId: $0, surahName: StaticData.surah($0)?.name ?? "", reciterId: "r",
                  reciterName: "Mishary Alafasi", rewayatId: nil, itemId: "i\($0)")
}

#Preview("Medium", as: .systemMedium) {
  LibraryShelfWidget()
} timeline: {
  LibraryShelfEntry(date: .now, state: .downloads(items: previewItems, count: 12))
  LibraryShelfEntry(date: .now, state: .playlist(WidgetPlaylist(id: "p", name: "Night", itemCount: 3, items: Array(previewItems.prefix(3)))))
  LibraryShelfEntry(date: .now, state: .playlist(WidgetPlaylist(id: "u", name: "Uploads only", itemCount: 2, items: [])))
  LibraryShelfEntry(date: .now, state: .playlistUnavailable)
}

#Preview("Large", as: .systemLarge) {
  LibraryShelfWidget()
} timeline: {
  LibraryShelfEntry(date: .now, state: .downloads(items: previewItems, count: 12))
  LibraryShelfEntry(date: .now, state: .noContent)
}
