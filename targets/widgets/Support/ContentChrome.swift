// targets/widgets/Support/ContentChrome.swift
import AppIntents
import SwiftUI
import WidgetKit

/// Shelf title row: optional leading control, title and detail, Bayaan mark.
struct ShelfHeader<Leading: View>: View {
  let title: String
  var detail: String? = nil
  @ViewBuilder var leading: () -> Leading

  var body: some View {
    HStack(spacing: 8) {
      leading()
      VStack(alignment: .leading, spacing: 1) {
        Text(title).font(.subheadline.weight(.bold)).lineLimit(1)
        if let detail { Text(detail).font(.caption2).opacity(0.6).lineLimit(1) }
      }
      Spacer(minLength: 0)
      BayaanLogo(size: 14)
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

  var body: some View {
    Button(intent: intent) {
      VStack(spacing: 3) {
        SurahCard(surah: StaticData.surah(surahId), size: size)
        if let caption {
          Text(caption).font(.caption2.weight(.medium)).opacity(0.75).lineLimit(1).frame(width: size)
        }
      }
    }
    .buttonStyle(.plain)
    .accessibilityLabel(StaticData.surah(surahId)?.name ?? "")
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
        Text(detail).font(.caption2).opacity(0.6).multilineTextAlignment(.center)
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
