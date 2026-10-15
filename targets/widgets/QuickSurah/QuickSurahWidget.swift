// targets/widgets/QuickSurah/QuickSurahWidget.swift
import AppIntents
import SwiftUI
import WidgetKit

struct QuickSurahConfigIntent: WidgetConfigurationIntent {
  static var title: LocalizedStringResource = "Quick Surah"
  static var description = IntentDescription("Play a surah in one tap.")
  /// Al-Kahf, Ya-Sin, Al-Mulk, Al-Waqi'ah.
  static let defaultSurahIds = [18, 36, 67, 56]

  @Parameter(title: "Surah") var surah: SurahEntity?
  @Parameter(title: "Second surah") var surah2: SurahEntity?
  @Parameter(title: "Third surah") var surah3: SurahEntity?
  @Parameter(title: "Fourth surah") var surah4: SurahEntity?
  @Parameter(title: "Reciter") var reciter: ReciterEntity?

  static var parameterSummary: some ParameterSummary {
    When(widgetFamily: .equalTo, .systemSmall) {
      Summary("Play \(\.$surah)") {
        \.$reciter
      }
    } otherwise: {
      Summary("Play \(\.$surah)") {
        \.$surah2
        \.$surah3
        \.$surah4
        \.$reciter
      }
    }
  }

  /// The four surahs with defaults in unset slots.
  var surahIds: [Int] {
    [surah, surah2, surah3, surah4].enumerated().map { $0.element?.id ?? Self.defaultSurahIds[$0.offset] }
  }
}

struct QuickSurahEntry: TimelineEntry {
  let date: Date
  let surahs: [StaticSurah]
  /// The configured reciter when it is still in the catalog; nil plays the default reciter.
  let reciter: WidgetCatalogReciter?
  let defaultReciter: WidgetReciter?
}

struct QuickSurahProvider: AppIntentTimelineProvider {
  func placeholder(in context: Context) -> QuickSurahEntry {
    QuickSurahEntry(date: .now, surahs: QuickSurahConfigIntent.defaultSurahIds.compactMap(StaticData.surah),
                    reciter: nil, defaultReciter: nil)
  }

  func snapshot(for configuration: QuickSurahConfigIntent, in context: Context) async -> QuickSurahEntry {
    entry(for: configuration)
  }

  func timeline(for configuration: QuickSurahConfigIntent, in context: Context) async -> Timeline<QuickSurahEntry> {
    let e = entry(for: configuration)
    let shown = context.family == .systemSmall ? Array(e.surahs.prefix(1)) : e.surahs
    let shownReciter: (id: String, file: String?)? = e.reciter.map { ($0.id, $0.artworkFile) }
      ?? e.defaultReciter.map { ($0.id, $0.artworkFile) }
    ArtworkRequestStore.recordMissing(surahs: shown, reciterFiles: shownReciter.map { [$0] } ?? [])
    // The app reloads this kind when the catalog, default reciter or artwork changes.
    return Timeline(entries: [e], policy: .never)
  }

  private func entry(for configuration: QuickSurahConfigIntent) -> QuickSurahEntry {
    QuickSurahEntry(
      date: .now,
      surahs: configuration.surahIds.compactMap(StaticData.surah),
      reciter: CatalogStore.load()?.reciter(configuration.reciter?.id),
      defaultReciter: SnapshotStore.load()?.defaultReciter)
  }
}

struct QuickSurahWidget: Widget {
  let kind = "QuickSurah"

  var body: some WidgetConfiguration {
    AppIntentConfiguration(kind: kind, intent: QuickSurahConfigIntent.self, provider: QuickSurahProvider()) { entry in
      QuickSurahView(entry: entry)
    }
    .configurationDisplayName("Quick Surah")
    .description("Play a favorite surah in one tap.")
    .supportedFamilies([.systemSmall, .systemMedium])
    .contentMarginsDisabled()
  }
}

struct QuickSurahView: View {
  @Environment(\.widgetFamily) private var family
  let entry: QuickSurahEntry

  private var reciterName: String { entry.reciter?.name ?? entry.defaultReciter?.name ?? "Default reciter" }
  private var reciterFile: String? { entry.reciter?.artworkFile ?? entry.defaultReciter?.artworkFile }

  var body: some View {
    Group {
      if let first = entry.surahs.first {
        if family == .systemSmall { small(first) } else { medium }
      } else {
        Text("Open \(AppBrand.name) to set up").font(.caption.weight(.semibold))
      }
    }
    .foregroundStyle(.white)
    .containerBackground(for: .widget) { WidgetPalette.background }
  }

  private func intent(_ surah: StaticSurah) -> PlayTrackIntent {
    PlayTrackIntent(surahId: surah.id, reciterId: entry.reciter?.id, rewayatId: nil)
  }

  private func small(_ surah: StaticSurah) -> some View {
    Button(intent: intent(surah)) {
      VStack(alignment: .leading, spacing: 3) {
        HStack(alignment: .top) {
          SurahCard(surah: surah, size: 56)
          Spacer(minLength: 0)
          BayaanLogo(size: 14)
        }
        Spacer(minLength: 0)
        Text(surah.name).font(.headline).lineLimit(1)
        HStack(spacing: 6) {
          ReciterPhoto(file: reciterFile, name: reciterName)
            .frame(width: 18, height: 18).clipShape(Circle())
          Text(reciterName).font(.caption).opacity(0.75).lineLimit(1)
          Spacer(minLength: 0)
          RoundGlyph(systemName: "play.fill")
        }
      }
      .padding(14)
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
    .buttonStyle(.plain)
    .accessibilityLabel("Play \(surah.name)")
  }

  private var medium: some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack {
        Text(reciterName).font(.caption2.weight(.semibold)).opacity(0.6).lineLimit(1)
        Spacer(minLength: 0)
        BayaanLogo(size: 14)
      }
      Grid(horizontalSpacing: 10, verticalSpacing: 8) {
        GridRow { tile(0); tile(1) }
        GridRow { tile(2); tile(3) }
      }
      Spacer(minLength: 0)
    }
    .padding(12)
  }

  @ViewBuilder private func tile(_ index: Int) -> some View {
    if index < entry.surahs.count {
      let surah = entry.surahs[index]
      Button(intent: intent(surah)) {
        HStack(spacing: 8) {
          SurahCard(surah: surah, size: 38)
          Text(surah.name).font(.caption.weight(.semibold)).lineLimit(1)
          Spacer(minLength: 0)
        }
      }
      .buttonStyle(.plain)
      .frame(maxWidth: .infinity)
      .accessibilityLabel("Play \(surah.name)")
    } else {
      Color.clear.frame(height: 38)
    }
  }
}

#Preview("Small", as: .systemSmall) {
  QuickSurahWidget()
} timeline: {
  QuickSurahEntry(date: .now, surahs: [18].compactMap(StaticData.surah), reciter: nil,
                  defaultReciter: WidgetReciter(id: "r", name: "Mishary Alafasi", artworkFile: nil))
  QuickSurahEntry(date: .now, surahs: [], reciter: nil, defaultReciter: nil)
}

#Preview("Medium", as: .systemMedium) {
  QuickSurahWidget()
} timeline: {
  QuickSurahEntry(date: .now, surahs: QuickSurahConfigIntent.defaultSurahIds.compactMap(StaticData.surah),
                  reciter: nil, defaultReciter: WidgetReciter(id: "r", name: "Mishary Alafasi", artworkFile: nil))
}
