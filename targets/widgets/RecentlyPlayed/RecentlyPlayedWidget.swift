// targets/widgets/RecentlyPlayed/RecentlyPlayedWidget.swift
import AppIntents
import SwiftUI
import WidgetKit

struct RecentlyPlayedEntry: TimelineEntry {
  let date: Date
  let shelf: RecentShelf
}

struct RecentlyPlayedProvider: TimelineProvider {
  func placeholder(in context: Context) -> RecentlyPlayedEntry {
    RecentlyPlayedEntry(date: .now, shelf: RecentShelf(tracks: [], isSuggestion: false))
  }

  func getSnapshot(in context: Context, completion: @escaping (RecentlyPlayedEntry) -> Void) {
    completion(entry(context))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<RecentlyPlayedEntry>) -> Void) {
    let e = entry(context)
    ArtworkRequestStore.recordMissing(surahs: e.shelf.tracks.compactMap { StaticData.surah($0.surahId) }, reciterFiles: [])
    // The app reloads this kind when recent plays or the default reciter change.
    completion(Timeline(entries: [e], policy: .never))
  }

  private func entry(_ context: Context) -> RecentlyPlayedEntry {
    RecentlyPlayedEntry(date: .now, shelf: ContentResolvers.recentShelf(
      SnapshotStore.load(), limit: context.family == .systemLarge ? 6 : 4))
  }
}

struct RecentlyPlayedWidget: Widget {
  let kind = "RecentlyPlayed"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: RecentlyPlayedProvider()) { entry in
      RecentlyPlayedView(entry: entry)
    }
    .configurationDisplayName("Recently Played")
    .description("Jump back into what you listened to.")
    .supportedFamilies([.systemMedium, .systemLarge])
    .contentMarginsDisabled()
  }
}

struct RecentlyPlayedView: View {
  @Environment(\.widgetFamily) private var family
  let entry: RecentlyPlayedEntry

  var body: some View {
    Group {
      if entry.shelf.tracks.isEmpty {
        ContentMessage(title: "Open \(AppBrand.name)", detail: "Your recent surahs show here")
      } else {
        VStack(alignment: .leading, spacing: 10) {
          ShelfHeader(title: entry.shelf.isSuggestion ? "Start listening" : "Recently Played")
          if family == .systemLarge { large } else { medium }
          Spacer(minLength: 0)
        }
        .padding(14)
      }
    }
    .foregroundStyle(.white)
    .containerBackground(for: .widget) { WidgetPalette.background }
    .widgetURL(AppLinks.url("player"))
  }

  private func intent(_ t: WidgetTrack) -> PlayTrackIntent {
    PlayTrackIntent(surahId: t.surahId, reciterId: t.reciterId, rewayatId: t.rewayatId)
  }

  private var medium: some View {
    HStack(spacing: 8) {
      ForEach(Array(entry.shelf.tracks.prefix(4).enumerated()), id: \.offset) { _, t in
        SurahTileButton(surahId: t.surahId, size: 62, intent: intent(t)).frame(maxWidth: .infinity)
      }
    }
  }

  private var large: some View {
    let tracks = Array(entry.shelf.tracks.prefix(6))
    return VStack(spacing: 12) {
      ForEach(0..<2, id: \.self) { row in
        HStack(spacing: 10) {
          ForEach(0..<3, id: \.self) { col in
            let i = row * 3 + col
            if i < tracks.count {
              SurahTileButton(surahId: tracks[i].surahId, size: 84, intent: intent(tracks[i]), caption: tracks[i].reciterName)
                .frame(maxWidth: .infinity)
            } else {
              Color.clear.frame(maxWidth: .infinity, maxHeight: 1)
            }
          }
        }
      }
    }
  }
}

private let previewTracks = [18, 36, 67, 55, 56, 1].map {
  WidgetTrack(surahId: $0, surahName: "", reciterId: "r", reciterName: "Mishary Alafasi",
              rewayatId: nil, artworkFile: nil, isUserUpload: false)
}

#Preview("Medium", as: .systemMedium) {
  RecentlyPlayedWidget()
} timeline: {
  RecentlyPlayedEntry(date: .now, shelf: RecentShelf(tracks: previewTracks, isSuggestion: false))
  RecentlyPlayedEntry(date: .now, shelf: RecentShelf(tracks: Array(previewTracks.prefix(4)), isSuggestion: true))
}

#Preview("Large", as: .systemLarge) {
  RecentlyPlayedWidget()
} timeline: {
  RecentlyPlayedEntry(date: .now, shelf: RecentShelf(tracks: previewTracks, isSuggestion: false))
  RecentlyPlayedEntry(date: .now, shelf: RecentShelf(tracks: [], isSuggestion: false))
}
