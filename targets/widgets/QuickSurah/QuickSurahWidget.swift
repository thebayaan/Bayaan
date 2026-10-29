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
  // @ai-start
  private var reciterId: String? { entry.reciter?.id ?? entry.defaultReciter?.id }

  private func isPlaying(_ surah: StaticSurah) -> Bool {
    PlayingNow.matches(PlayingNow.track(at: entry.date), surahId: surah.id, reciterId: reciterId)
  }
  // @ai-end

  var body: some View {
    Group {
      if let first = entry.surahs.first {
        if family == .systemSmall { small(first) } else { medium }
      } else {
        Text("Open \(AppBrand.name) to set up").font(.caption.weight(.semibold))
      }
    }
    .foregroundStyle(.white)
    // @ai-start
    .containerBackground(for: .widget) {
      if family == .systemSmall, let first = entry.surahs.first { SurahTint.deep(first.id) } else { WidgetPalette.ink }
    }
    // @ai-end
  }

  private func intent(_ surah: StaticSurah) -> PlayTrackIntent {
    PlayTrackIntent(surahId: surah.id, reciterId: entry.reciter?.id, rewayatId: nil)
  }

  private func small(_ surah: StaticSurah) -> some View {
    PlayOrPauseButton(playing: isPlaying(surah), play: intent(surah), label: "Play \(surah.name)") { playing in // @ai
      // @ai-start
      // A cached card prints the surah name, so it is shown larger and not repeated.
      let cardNamed = SurahCard.showsName(surah)
      VStack(alignment: .leading, spacing: 2) {
        SurahCard(surah: surah, size: cardNamed ? 92 : 64)
      // @ai-end
        Spacer(minLength: 0)
        if !cardNamed {
          Text(surah.name).font(.system(size: 16, weight: .heavy)).lineLimit(1) // @ai
        }
        HStack(spacing: 6) {
          ReciterPhoto(file: reciterFile, name: reciterName)
            .frame(width: 18, height: 18).clipShape(Circle())
          FittingName(name: reciterName).font(.caption.weight(.medium)).foregroundStyle(WidgetPalette.secondary) // @ai
          Spacer(minLength: 0)
          PrimaryGlyph(systemName: playing ? "pause.fill" : "play.fill") // @ai
        }
      }
      .padding(14)
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
  }

  private var medium: some View {
    // @ai-start
    VStack(alignment: .leading, spacing: 12) {
      HStack(spacing: 8) {
        ReciterPhoto(file: reciterFile, name: reciterName)
          .frame(width: 22, height: 22).clipShape(Circle())
        Text("with \(reciterName)").font(.caption.weight(.semibold)).foregroundStyle(WidgetPalette.secondary)
          .lineLimit(1)
    // @ai-end
        Spacer(minLength: 0)
      }
      // @ai-start
      HStack(alignment: .top, spacing: 0) {
        ForEach(0..<4, id: \.self) { tile($0).frame(maxWidth: .infinity) }
      // @ai-end
      }
      Spacer(minLength: 0)
    }
    // @ai-start
    .padding(.horizontal, 16)
    .padding(.vertical, 14)
    // @ai-end
  }

  /// One tap per tile: the tile is the play button. // @ai
  @ViewBuilder private func tile(_ index: Int) -> some View {
    if index < entry.surahs.count {
      let surah = entry.surahs[index]
      PlayOrPauseButton(playing: isPlaying(surah), play: intent(surah), label: "Play \(surah.name)") { playing in // @ai
        // @ai-start
        VStack(spacing: 6) {
          SurahCard(surah: surah, size: 72)
            .overlay { if playing { PlayingTileOverlay(size: 72) } }
          if !SurahCard.showsName(surah) {
            Text(surah.name).font(.caption.weight(.bold)).lineLimit(1).minimumScaleFactor(0.8)
          }
        // @ai-end
        }
      }
    } else {
      Color.clear.frame(width: 72, height: 72) // @ai
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
