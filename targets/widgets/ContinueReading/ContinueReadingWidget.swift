// targets/widgets/ContinueReading/ContinueReadingWidget.swift
import SwiftUI
import WidgetKit

struct ContinueReadingEntry: TimelineEntry {
  let date: Date
  let lastRead: WidgetLastRead?
}

struct ContinueReadingProvider: TimelineProvider {
  func placeholder(in context: Context) -> ContinueReadingEntry {
    ContinueReadingEntry(date: .now, lastRead: nil)
  }

  func getSnapshot(in context: Context, completion: @escaping (ContinueReadingEntry) -> Void) {
    completion(ContinueReadingEntry(date: .now, lastRead: SnapshotStore.load()?.lastRead))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<ContinueReadingEntry>) -> Void) {
    let lastRead = SnapshotStore.load()?.lastRead
    if let surah = StaticData.surah(lastRead?.surahId ?? 1) {
      ArtworkRequestStore.recordMissing(surahs: [surah], reciterFiles: [])
    }
    completion(Timeline(entries: [ContinueReadingEntry(date: .now, lastRead: lastRead)], policy: .never))
  }
}

struct ContinueReadingWidget: Widget {
  let kind = "ContinueReading"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: ContinueReadingProvider()) { entry in
      ContinueReadingView(entry: entry)
    }
    .configurationDisplayName("Continue Reading")
    .description("Return to the page you were reading.")
    .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular])
    .contentMarginsDisabled()
  }
}

struct ContinueReadingView: View {
  @Environment(\.widgetFamily) private var family
  @Environment(\.colorScheme) private var colorScheme // @ai
  let entry: ContinueReadingEntry

  // @ai-start
  private static let mushafPages = 604

  // @ai-end
  private var page: Int { entry.lastRead?.page ?? 1 }
  private var surah: StaticSurah? { StaticData.surah(entry.lastRead?.surahId ?? 1) }
  private var surahName: String { entry.lastRead?.surahName ?? surah?.name ?? "Al-Fatihah" }
  // @ai-start
  private var detail: String { entry.lastRead.map { "\(surahName) · Juz \($0.juz)" } ?? "Start reading" }
  private var style: ReadingStyle { .forScheme(colorScheme) }
  // @ai-end

  var body: some View {
    content
      .foregroundStyle(family == .accessoryRectangular ? Color.primary : style.primary) // @ai
      .containerBackground(for: .widget) {
        if family == .accessoryRectangular { Color.clear } else { style.background } // @ai
      }
      .widgetURL(AppLinks.url("mushaf/\(page)"))
  }

  @ViewBuilder private var content: some View {
    if family == .accessoryRectangular {
      VStack(alignment: .leading, spacing: 1) {
        Text("Page \(page)").font(.headline).widgetAccentable()
        // @ai-start
        Text(detail).font(.caption).lineLimit(1)
        ProgressView(value: Double(page), total: Double(Self.mushafPages)).tint(.white)
        // @ai-end
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    } else if family == .systemMedium {
      // @ai-start
      HStack(spacing: 16) {
        pageGlimpse
        VStack(alignment: .leading, spacing: 0) {
          Eyebrow(text: entry.lastRead == nil ? "Start reading" : "Continue reading", color: style.label)
          Text(surahName).font(.system(size: 20, weight: .heavy)).lineLimit(1).padding(.top, 4)
          Text(entry.lastRead.map { "Page \(page) · Juz \($0.juz)" } ?? "Page \(page)")
            .font(.footnote.weight(.semibold)).foregroundStyle(style.secondary).lineLimit(1)
      // @ai-end
          Spacer(minLength: 0)
          // @ai-start
          progress
          Text(entry.lastRead == nil ? "Open the mushaf" : "Resume reading")
            .font(.footnote.weight(.heavy))
            .foregroundStyle(style.buttonGlyph)
            .frame(maxWidth: .infinity)
            .frame(height: 34)
            .background(style.buttonFill, in: Capsule())
            .padding(.top, 10)
          // @ai-end
        }
      }
      .padding(16) // @ai
    } else {
      // @ai-start
      VStack(alignment: .leading, spacing: 0) {
        Eyebrow(text: entry.lastRead == nil ? "Start reading" : "Continue reading", color: style.label)
        HStack(alignment: .firstTextBaseline, spacing: 6) {
          Text("\(page)").font(.system(size: 44, weight: .heavy, design: .rounded)).minimumScaleFactor(0.7)
          Text("page").font(.caption.weight(.bold)).foregroundStyle(style.secondary)
        }
        .padding(.top, 8)
        Text(detail).font(.footnote.weight(.bold)).lineLimit(1).padding(.top, 4)
        Spacer(minLength: 0)
        progress
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(14)
      // @ai-end
    }
  }

  // @ai-start
  /// How far through the mushaf this page is.
  private var progress: some View {
    VStack(alignment: .leading, spacing: 5) {
      ProgressView(value: Double(page), total: Double(Self.mushafPages))
        .progressViewStyle(.linear)
        .tint(style.primary)
        .frame(height: 5)
        .background(Capsule().fill(style.rule))
        .clipShape(Capsule())
      Text("Page \(page) of \(Self.mushafPages)").font(.caption2.weight(.semibold)).foregroundStyle(style.secondary)
    }
  }

  /// A small page with the surah header and the opening text.
  private var pageGlimpse: some View {
    VStack(spacing: 5) {
      Text(surahName)
        .font(.system(size: 9, weight: .bold))
        .foregroundStyle(style.label)
        .lineLimit(1)
        .frame(maxWidth: .infinity)
        .padding(.vertical, 2)
        .overlay(RoundedRectangle(cornerRadius: 3).stroke(style.label.opacity(0.6), lineWidth: 1))
      if let opening = entry.lastRead?.openingText, !opening.isEmpty {
        Text(opening)
          .font(WidgetFonts.quran(13))
          .foregroundStyle(style.secondary)
          .multilineTextAlignment(.center)
          .lineLimit(5)
          .minimumScaleFactor(0.6)
          .environment(\.layoutDirection, .rightToLeft)
      } else {
  // @ai-end
        SurahCard(surah: surah, size: 44)
      }
      Spacer(minLength: 0)
    }
    // @ai-start
    .padding(8)
    .frame(width: 98, height: 138)
    .background(RoundedRectangle(cornerRadius: 8, style: .continuous).fill(style.primary.opacity(0.04)))
    .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).stroke(style.rule, lineWidth: 1))
    // @ai-end
  }
}

#Preview("Small", as: .systemSmall) {
  ContinueReadingWidget()
} timeline: {
  ContinueReadingEntry(date: .now, lastRead: WidgetLastRead(page: 293, surahId: 18, surahName: "Al-Kahf", juz: 15, openingText: "ٱلْحَمْدُ لِلَّهِ ٱلَّذِىٓ أَنزَلَ"))
  ContinueReadingEntry(date: .now, lastRead: nil)
}

#Preview("Medium", as: .systemMedium) {
  ContinueReadingWidget()
} timeline: {
  ContinueReadingEntry(date: .now, lastRead: WidgetLastRead(page: 293, surahId: 18, surahName: "Al-Kahf", juz: 15, openingText: "ٱلْحَمْدُ لِلَّهِ ٱلَّذِىٓ أَنزَلَ"))
  ContinueReadingEntry(date: .now, lastRead: nil)
}

#Preview("Lock Screen", as: .accessoryRectangular) {
  ContinueReadingWidget()
} timeline: {
  ContinueReadingEntry(date: .now, lastRead: WidgetLastRead(page: 293, surahId: 18, surahName: "Al-Kahf", juz: 15, openingText: ""))
}
