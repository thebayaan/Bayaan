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
  let entry: ContinueReadingEntry

  private var page: Int { entry.lastRead?.page ?? 1 }
  private var surah: StaticSurah? { StaticData.surah(entry.lastRead?.surahId ?? 1) }
  private var surahName: String { entry.lastRead?.surahName ?? surah?.name ?? "Al-Fatihah" }
  private var detail: String { entry.lastRead.map { "Juz \($0.juz)" } ?? "Start reading" }

  var body: some View {
    content
      .foregroundStyle(.white)
      .containerBackground(for: .widget) {
        if family == .accessoryRectangular { Color.clear } else { WidgetPalette.background }
      }
      .widgetURL(AppLinks.url("mushaf/\(page)"))
  }

  @ViewBuilder private var content: some View {
    if family == .accessoryRectangular {
      VStack(alignment: .leading, spacing: 1) {
        Text("Page \(page)").font(.headline).widgetAccentable()
        Text(entry.lastRead.map { "\(surahName) · Juz \($0.juz)" } ?? "Start reading").font(.caption).lineLimit(1)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    } else if family == .systemMedium {
      HStack(spacing: 14) {
        pageColumn(showLogo: false)
        VStack(alignment: .trailing, spacing: 6) {
          BayaanLogo(size: 14)
          Spacer(minLength: 0)
          if let opening = entry.lastRead?.openingText, !opening.isEmpty {
            Text(opening)
              .font(WidgetFonts.quran(22))
              .multilineTextAlignment(.trailing)
              .lineLimit(2)
              .minimumScaleFactor(0.5)
              .environment(\.layoutDirection, .rightToLeft)
              .frame(maxWidth: .infinity, alignment: .trailing)
          }
          Text(entry.lastRead == nil ? "Start reading" : "Continue reading")
            .font(.caption.weight(.semibold)).opacity(0.75)
        }
        .frame(maxWidth: .infinity, alignment: .trailing)
      }
      .padding(14)
    } else {
      pageColumn(showLogo: true).padding(14)
    }
  }

  private func pageColumn(showLogo: Bool) -> some View {
    VStack(alignment: .leading, spacing: 2) {
      HStack(alignment: .top) {
        SurahCard(surah: surah, size: 44)
        if showLogo {
          Spacer(minLength: 0)
          BayaanLogo(size: 14)
        }
      }
      Spacer(minLength: 0)
      Text("\(page)").font(.system(size: 34, weight: .bold, design: .rounded)).minimumScaleFactor(0.7)
      Text(surahName).font(.caption.weight(.semibold)).lineLimit(1)
      Text(detail).font(.caption2).opacity(0.7).lineLimit(1)
    }
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
