// targets/widgets/Support/ContentChrome.swift
import AppIntents
import SwiftUI
import WidgetKit

/// Shelf title row: optional leading control, title and detail. // @ai
struct ShelfHeader<Leading: View>: View {
  let title: String
  var detail: String? = nil
  @ViewBuilder var leading: () -> Leading

  var body: some View {
    HStack(spacing: 8) {
      leading()
      VStack(alignment: .leading, spacing: 1) {
        // @ai-start
        Text(title).font(.subheadline.weight(.heavy)).lineLimit(1)
        if let detail { Text(detail).font(.caption2.weight(.medium)).foregroundStyle(WidgetPalette.secondary).lineLimit(1) }
        // @ai-end
      }
      Spacer(minLength: 0)
    }
  }
}

extension ShelfHeader where Leading == EmptyView {
  init(title: String, detail: String? = nil) {
    self.init(title: title, detail: detail) { EmptyView() }
  }
}

/// A surah card that runs an intent when tapped, with an optional caption.
struct SurahTileButton<I: AppIntent>: View {
  let surahId: Int
  let size: CGFloat
  let intent: I
  var caption: String? = nil
  var playing: Bool = false // @ai

  var body: some View {
    // @ai-start
    // While this tile's track plays, a tap pauses it and a pause badge shows.
    PlayOrPauseButton(playing: playing, play: intent, label: StaticData.surah(surahId)?.name ?? "") { playing in
    // @ai-end
      VStack(spacing: 3) {
        SurahCard(surah: StaticData.surah(surahId), size: size)
          // @ai-start
          .overlay { if playing { PlayingTileOverlay(size: size) } }
          // @ai-end
        if let caption, !(caption == StaticData.surah(surahId)?.name && SurahCard.showsName(StaticData.surah(surahId))) { // @ai
          Text(caption).font(.caption2.weight(.semibold)).foregroundStyle(WidgetPalette.secondary).lineLimit(1).frame(width: size) // @ai
        }
      }
    }
  }
}

/// Centered message for empty and unavailable states.
struct ContentMessage: View {
  let title: String
  var detail: String? = nil

  var body: some View {
    VStack(spacing: 4) {
      BayaanLogo(size: 18)
      Text(title).font(.caption.weight(.bold)).multilineTextAlignment(.center)
      if let detail {
        Text(detail).font(.caption2).foregroundStyle(WidgetPalette.secondary).multilineTextAlignment(.center) // @ai
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .padding(12)
  }
}

/// Dhikr and Arabic labels in Scheherazade New (not Quran text).
struct DhikrText: View {
  let text: String
  let size: CGFloat
  let lines: Int
  var alignment: TextAlignment = .center

  var body: some View {
    Text(text)
      .font(WidgetFonts.dhikr(size))
      .multilineTextAlignment(alignment)
      .lineLimit(lines)
      .minimumScaleFactor(0.5)
      .environment(\.layoutDirection, .rightToLeft)
  }
}

extension TimelineEntryRelevance {
  /// Relevance that lasts until the next entry (one hour when there is none).
  static func scored(_ score: Float, from date: Date, until next: Date?) -> TimelineEntryRelevance {
    TimelineEntryRelevance(score: score, duration: max(60, (next ?? date.addingTimeInterval(3_600)).timeIntervalSince(date)))
  }
}
