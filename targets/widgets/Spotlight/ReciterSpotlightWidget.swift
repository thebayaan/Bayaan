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
    .containerBackground(for: .widget) { Color(hex: 0x1E1838) } // @ai
  }

  private func small(_ r: WidgetSpotlightReciter) -> some View {
    let playing = PlayingNow.track(at: entry.date)?.reciterId == r.id // @ai
    return PlayOrPauseButton(playing: playing, play: PlayReciterIntent(reciterId: r.id), label: "Play \(r.name)") { playing in // @ai
      ZStack(alignment: .bottomLeading) {
        ReciterPhoto(file: r.artworkFile, name: r.name)
          .frame(maxWidth: .infinity, maxHeight: .infinity)
          .clipped()
        LinearGradient(colors: [WidgetPalette.ink.opacity(0), WidgetPalette.ink.opacity(0.9)], startPoint: .center, endPoint: .bottom) // @ai
        VStack(alignment: .leading, spacing: 2) {
          Eyebrow(text: "Reciter of the Day") // @ai
          HStack(alignment: .bottom) {
            Text(r.name).font(.headline).lineLimit(2).minimumScaleFactor(0.85) // @ai
            Spacer(minLength: 4)
            PrimaryGlyph(systemName: playing ? "pause.fill" : "play.fill") // @ai
          }
        }
        .padding(12)
      }
    }
  }

  private func medium(_ r: WidgetSpotlightReciter) -> some View {
    let now = PlayingNow.track(at: entry.date) // @ai
    return HStack(spacing: 12) { // @ai
      ReciterPhoto(file: r.artworkFile, name: r.name)
        .frame(width: 106, height: 106)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
      VStack(alignment: .leading, spacing: 6) {
        HStack(alignment: .top) {
          VStack(alignment: .leading, spacing: 1) {
            // @ai-start
            Eyebrow(text: "Reciter of the Day")
            Text(r.name).font(.subheadline.weight(.heavy)).lineLimit(1)
            // @ai-end
          }
          Spacer(minLength: 0)
          // @ai-start
          // Beside the name, clear of the photo's initials.
          PlayOrPauseButton(playing: now?.reciterId == r.id, play: PlayReciterIntent(reciterId: r.id),
                            label: "Play \(r.name)") { PrimaryGlyph(systemName: $0 ? "pause.fill" : "play.fill", size: 36) }
          // @ai-end
        }
        ForEach(r.surahIds, id: \.self) { id in
          if let surah = StaticData.surah(id) {
            PlayOrPauseButton(playing: PlayingNow.matches(now, surahId: id, reciterId: r.id), // @ai
                              play: PlayTrackIntent(surahId: id, reciterId: r.id, rewayatId: nil), label: "Play \(surah.name)") { playing in // @ai
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
