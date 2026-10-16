// targets/widgets/Bedtime/BedtimeWidget.swift
import AppIntents
import SwiftUI
import WidgetKit

struct BedtimeConfigIntent: WidgetConfigurationIntent {
  static var title: LocalizedStringResource = "Bedtime"
  static var description = IntentDescription("Fall asleep to a surah with a sleep timer.")

  @Parameter(title: "Surah") var surah: SurahEntity?
  @Parameter(title: "Reciter") var reciter: ReciterEntity?
  @Parameter(title: "Sleep timer", default: .m30) var minutes: SleepMinutesOption
  // Compiled out for forks without ambient audio (RFC-021).
  #if !BAYAAN_NO_FEATURE_AMBIENT
  @Parameter(title: "Ambient sound", default: .off) var ambient: AmbientOption
  #endif
}

struct BedtimeSettings: Hashable {
  let surahId: Int
  let reciterId: String?
  let reciterName: String?
  let minutes: Int
  let ambient: AmbientOption

  /// Al-Mulk, default reciter, 30 minutes, no ambient (also Bayaan Now's bedtime card).
  static func `default`(reciterName: String?) -> BedtimeSettings {
    BedtimeSettings(surahId: 67, reciterId: nil, reciterName: reciterName, minutes: 30, ambient: .off)
  }
}

struct BedtimeEntry: TimelineEntry {
  let date: Date
  let settings: BedtimeSettings
  let sleepEndsAt: Date?
  let relevance: TimelineEntryRelevance?

  static func make(at date: Date, settings: BedtimeSettings, content: WidgetContent?, next: Date?) -> BedtimeEntry {
    let endsAt = content?.sleepTimerEndsAt
    return BedtimeEntry(
      date: date, settings: settings,
      sleepEndsAt: ContentLogic.sleepActive(endsAt: endsAt, now: date) ? endsAt.map { Date(timeIntervalSince1970: $0 / 1000) } : nil,
      relevance: .scored(ContentLogic.bedtimeRelevance(hour: ContentLogic.hour(date)), from: date, until: next))
  }
}

struct BedtimeProvider: AppIntentTimelineProvider {
  func placeholder(in context: Context) -> BedtimeEntry {
    BedtimeEntry(date: .now, settings: .default(reciterName: nil), sleepEndsAt: nil, relevance: nil)
  }

  func snapshot(for configuration: BedtimeConfigIntent, in context: Context) async -> BedtimeEntry {
    BedtimeEntry.make(at: .now, settings: settings(configuration), content: ContentStore.load(), next: nil)
  }

  // Entries at each context boundary (relevance changes at 21:00 and 04:00) and
  // when a running sleep timer ends; the app reloads on content changes.
  func timeline(for configuration: BedtimeConfigIntent, in context: Context) async -> Timeline<BedtimeEntry> {
    let s = settings(configuration)
    let content = ContentStore.load()
    ArtworkRequestStore.recordMissing(surahs: [StaticData.surah(s.surahId)].compactMap { $0 }, reciterFiles: [])
    let now = Date.now
    var dates = [now] + ContentLogic.boundaries(after: now)
    if let end = content?.sleepTimerEndsAt.map({ Date(timeIntervalSince1970: $0 / 1000) }), end > now {
      dates.append(end)
    }
    dates.sort()
    let entries = dates.enumerated().map { i, d in
      BedtimeEntry.make(at: d, settings: s, content: content, next: i + 1 < dates.count ? dates[i + 1] : nil)
    }
    return Timeline(entries: entries, policy: .atEnd)
  }

  private func settings(_ c: BedtimeConfigIntent) -> BedtimeSettings {
    let configured = CatalogStore.load()?.reciter(c.reciter?.id)?.name
    #if BAYAAN_NO_FEATURE_AMBIENT
    let ambient = AmbientOption.off
    #else
    let ambient = c.ambient
    #endif
    return BedtimeSettings(surahId: c.surah?.id ?? 67, reciterId: c.reciter?.id,
                           reciterName: configured ?? SnapshotStore.load()?.defaultReciter?.name,
                           minutes: c.minutes.minutes, ambient: ambient)
  }
}

struct BedtimeWidget: Widget {
  let kind = "Bedtime"

  var body: some WidgetConfiguration {
    AppIntentConfiguration(kind: kind, intent: BedtimeConfigIntent.self, provider: BedtimeProvider()) { entry in
      BedtimeView(entry: entry)
    }
    .configurationDisplayName("Bedtime")
    .description("Fall asleep to a surah with a sleep timer.")
    .supportedFamilies([.systemSmall, .systemMedium])
    .contentMarginsDisabled()
  }
}

struct BedtimeView: View {
  @Environment(\.widgetFamily) private var family
  let entry: BedtimeEntry

  private var surah: StaticSurah? { StaticData.surah(entry.settings.surahId) }

  private var intent: StartBedtimeIntent {
    StartBedtimeIntent(surahId: entry.settings.surahId, reciterId: entry.settings.reciterId,
                       sleepMinutes: entry.settings.minutes, ambient: entry.settings.ambient.commandValue)
  }

  private var detail: String {
    ["\(entry.settings.minutes) min", entry.settings.ambient.label].compactMap { $0 }.joined(separator: " · ")
  }

  var body: some View {
    // The whole widget is the action.
    Button(intent: intent) { content }
      .buttonStyle(.plain)
      .accessibilityLabel("Start bedtime with \(surah?.name ?? "")")
      .foregroundStyle(.white)
      .containerBackground(for: .widget) { WidgetPalette.background }
  }

  @ViewBuilder private var content: some View {
    if family == .systemSmall {
      VStack(alignment: .leading, spacing: 6) {
        HStack(alignment: .top) {
          SurahCard(surah: surah, size: 54)
          Spacer(minLength: 0)
          BayaanLogo(size: 12)
        }
        Spacer(minLength: 0)
        Text("Bedtime").font(.headline)
        HStack(alignment: .bottom) {
          subtitle.font(.caption).opacity(0.75).lineLimit(2)
          Spacer(minLength: 4)
          RoundGlyph(systemName: "moon.zzz.fill")
        }
      }
      .padding(12)
    } else {
      HStack(spacing: 12) {
        SurahCard(surah: surah, size: 96)
        VStack(alignment: .leading, spacing: 3) {
          HStack {
            Text("Bedtime").font(.caption.weight(.semibold)).opacity(0.6)
            Spacer(minLength: 0)
            BayaanLogo(size: 14)
          }
          Text(surah?.name ?? "").font(.headline).lineLimit(1)
          if let reciter = entry.settings.reciterName {
            Text(reciter).font(.subheadline).opacity(0.75).lineLimit(1)
          }
          Spacer(minLength: 0)
          HStack(alignment: .bottom) {
            subtitle.font(.caption).opacity(0.75).lineLimit(1)
            Spacer(minLength: 4)
            RoundGlyph(systemName: "moon.zzz.fill")
          }
        }
      }
      .padding(14)
    }
  }

  @ViewBuilder private var subtitle: some View {
    if let end = entry.sleepEndsAt {
      Text("Sleep at \(end, style: .time)")
    } else if family == .systemSmall {
      Text("\(surah?.name ?? "") · \(detail)")
    } else {
      Text(detail)
    }
  }
}

#Preview("Small", as: .systemSmall) {
  BedtimeWidget()
} timeline: {
  BedtimeEntry(date: .now, settings: .default(reciterName: "Mishary Alafasi"), sleepEndsAt: nil, relevance: nil)
  BedtimeEntry(date: .now, settings: .default(reciterName: "Mishary Alafasi"), sleepEndsAt: .now.addingTimeInterval(1_800), relevance: nil)
}

#Preview("Medium", as: .systemMedium) {
  BedtimeWidget()
} timeline: {
  BedtimeEntry(date: .now, settings: BedtimeSettings(surahId: 32, reciterId: "r", reciterName: "Mishary Alafasi", minutes: 45, ambient: .rain), sleepEndsAt: nil, relevance: nil)
}
