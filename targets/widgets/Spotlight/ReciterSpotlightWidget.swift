// targets/widgets/Spotlight/ReciterSpotlightWidget.swift
import AppIntents
import SwiftUI
import WidgetKit

struct ReciterSpotlightEntry: TimelineEntry {
  let date: Date
  let reciter: WidgetSpotlightReciter?
}

struct ReciterSpotlightProvider: TimelineProvider {
  func placeholder(in context: Context) -> ReciterSpotlightEntry {
    ReciterSpotlightEntry(date: .now, reciter: nil)
  }

  func getSnapshot(in context: Context, completion: @escaping (ReciterSpotlightEntry) -> Void) {
    completion(ReciterSpotlightEntry(date: .now, reciter: ContentResolvers.spotlight(ContentStore.load(), date: .now)))
  }

  // Today's reciter now and tomorrow's at midnight; the app reloads when the list changes.
  func getTimeline(in context: Context, completion: @escaping (Timeline<ReciterSpotlightEntry>) -> Void) {
    let content = ContentStore.load()
    let now = Date.now
    let midnight = WidgetLogic.nextMidnight(after: now)
    let today = ContentResolvers.spotlight(content, date: now)
    if let r = today {
      let rows = context.family == .systemSmall ? [] : r.surahIds.compactMap { StaticData.surah($0) }
      ArtworkRequestStore.recordMissing(surahs: rows, reciterFiles: [(id: r.id, file: r.artworkFile)])
    }
    completion(Timeline(entries: [
      ReciterSpotlightEntry(date: now, reciter: today),
      ReciterSpotlightEntry(date: midnight, reciter: ContentResolvers.spotlight(content, date: midnight)),
    ], policy: .atEnd))
  }
}

struct ReciterSpotlightWidget: Widget {
  let kind = "ReciterSpotlight"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: ReciterSpotlightProvider()) { entry in
      ReciterSpotlightView(entry: entry)
    }
    .configurationDisplayName("Reciter of the Day")
    .description("Meet a new reciter every day.")
    .supportedFamilies([.systemSmall, .systemMedium])
    .contentMarginsDisabled()
  }
}

struct ReciterSpotlightView: View {
  @Environment(\.widgetFamily) private var family
  let entry: ReciterSpotlightEntry

  var body: some View {
    Group {
      if let r = entry.reciter {
        if family == .systemSmall { small(r) } else { medium(r) }
      } else {
        ContentMessage(title: "Open \(AppBrand.name)", detail: "to meet today's reciter")
      }
    }
    .foregroundStyle(.white)
    .containerBackground(for: .widget) { WidgetPalette.background }
  }

  private func small(_ r: WidgetSpotlightReciter) -> some View {
    Button(intent: PlayReciterIntent(reciterId: r.id)) {
      ZStack(alignment: .bottomLeading) {
        ReciterPhoto(file: r.artworkFile, name: r.name)
          .frame(maxWidth: .infinity, maxHeight: .infinity)
          .clipped()
        LinearGradient(colors: [.clear, .black.opacity(0.7)], startPoint: .center, endPoint: .bottom)
        VStack(alignment: .leading, spacing: 2) {
          Text("Reciter of the Day").font(.caption2.weight(.semibold)).opacity(0.75)
          HStack(alignment: .bottom) {
            Text(r.name).font(.headline).lineLimit(2)
            Spacer(minLength: 4)
            RoundGlyph(systemName: "play.fill")
          }
        }
        .padding(12)
      }
      .overlay(alignment: .topTrailing) { BayaanLogo(size: 14).padding(12) }
    }
    .buttonStyle(.plain)
    .accessibilityLabel("Play \(r.name)")
  }

  private func medium(_ r: WidgetSpotlightReciter) -> some View {
    HStack(spacing: 12) {
      ZStack(alignment: .bottomLeading) {
        ReciterPhoto(file: r.artworkFile, name: r.name)
          .frame(width: 106, height: 106)
          .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        RoundIntentButton(intent: PlayReciterIntent(reciterId: r.id), systemName: "play.fill", label: "Play \(r.name)")
          .padding(8)
      }
      VStack(alignment: .leading, spacing: 6) {
        HStack(alignment: .top) {
          VStack(alignment: .leading, spacing: 1) {
            Text("Reciter of the Day").font(.caption2.weight(.semibold)).opacity(0.6)
            Text(r.name).font(.subheadline.bold()).lineLimit(1)
          }
          Spacer(minLength: 0)
          BayaanLogo(size: 14)
        }
        ForEach(r.surahIds, id: \.self) { id in
          if let surah = StaticData.surah(id) {
            Button(intent: PlayTrackIntent(surahId: id, reciterId: r.id, rewayatId: nil)) {
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
}

private let previewReciter = WidgetSpotlightReciter(id: "r", name: "Albaraa Basfar", artworkFile: "reciter-r.jpg", surahIds: [1, 18, 36])

#Preview("Small", as: .systemSmall) {
  ReciterSpotlightWidget()
} timeline: {
  ReciterSpotlightEntry(date: .now, reciter: previewReciter)
  ReciterSpotlightEntry(date: .now, reciter: nil)
}

#Preview("Medium", as: .systemMedium) {
  ReciterSpotlightWidget()
} timeline: {
  ReciterSpotlightEntry(date: .now, reciter: previewReciter)
}
