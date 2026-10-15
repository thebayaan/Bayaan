// targets/widgets/Hijri/OccasionWidget.swift
import AppIntents
import SwiftUI
import WidgetKit

struct OccasionEntry: TimelineEntry {
  let date: Date
  let hijri: HijriDate?
  let occasion: OccasionInfo?
  let ayah: StaticAyah?
  let upcoming: [UpcomingOccasion]
  let relevance: TimelineEntryRelevance?

  static func make(at date: Date, next: Date?) -> OccasionEntry {
    let id = ContentLogic.occasion(at: date)
    let occasion = ContentStaticData.occasions?.occasion(id)
    let ayah = occasion.flatMap { o -> StaticAyah? in
      let i = WidgetLogic.ayahIndex(date, count: o.ayat.count)
      return i >= 0 ? o.ayat[i] : nil
    }
    let upcoming = ContentLogic.nextOccasions(today: WidgetLogic.dayNumber(date), count: 3,
                                              hijriOf: ContentLogic.hijri(dayNumber:))
    return OccasionEntry(date: date, hijri: ContentLogic.hijri(date), occasion: occasion, ayah: ayah,
                         upcoming: upcoming,
                         relevance: .scored(ContentLogic.occasionRelevance(id), from: date, until: next))
  }
}

struct OccasionProvider: TimelineProvider {
  func placeholder(in context: Context) -> OccasionEntry { OccasionEntry.make(at: .now, next: nil) }

  func getSnapshot(in context: Context, completion: @escaping (OccasionEntry) -> Void) {
    completion(OccasionEntry.make(at: .now, next: nil))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<OccasionEntry>) -> Void) {
    completion(Timeline(entries: ContentTimeline.entries(from: .now, make: OccasionEntry.make), policy: .atEnd))
  }
}

struct OccasionWidget: Widget {
  let kind = "Occasion"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: OccasionProvider()) { entry in
      OccasionView(entry: entry)
    }
    .configurationDisplayName("Occasions")
    .description("Ayat for Ramadan, Dhul Hijjah, Jumu'ah and more.")
    .supportedFamilies([.systemMedium, .systemLarge])
    .contentMarginsDisabled()
  }
}

struct OccasionView: View {
  @Environment(\.widgetFamily) private var family
  let entry: OccasionEntry

  private var data: OccasionData? { ContentStaticData.occasions }
  private var isLarge: Bool { family == .systemLarge }
  private var hijriText: String { entry.hijri.map { ContentText.hijriLine($0, months: data?.months ?? []) } ?? "" }

  var body: some View {
    Group {
      if let o = entry.occasion, let ayah = entry.ayah {
        occasionBody(o, ayah)
      } else if entry.hijri != nil {
        upcomingBody
      } else {
        ContentMessage(title: "Open \(AppBrand.name)")
      }
    }
    .foregroundStyle(.white)
    .containerBackground(for: .widget) { WidgetPalette.background }
    .widgetURL(entry.occasion == nil ? nil : entry.ayah.flatMap { AppLinks.url("quran/\($0.surahId)?ayah=\($0.ayah)") })
  }

  // Jumu'ah plays Surah Al-Kahf from the start; other occasions play from the ayah onward.
  private func listen(_ o: OccasionInfo, _ a: StaticAyah) -> PlayTrackIntent {
    if let surah = o.listenSurahId { return PlayTrackIntent(surahId: surah, reciterId: nil, rewayatId: nil, ayah: 1) }
    return PlayTrackIntent(surahId: a.surahId, reciterId: nil, rewayatId: nil, ayah: a.ayah)
  }

  private func occasionBody(_ o: OccasionInfo, _ a: StaticAyah) -> some View {
    VStack(alignment: .leading, spacing: isLarge ? 12 : 6) {
      HStack(spacing: 8) {
        RoundIntentButton(intent: listen(o, a), systemName: "play.fill", label: o.listenSurahId == nil ? "Listen" : "Listen to Al-Kahf")
        VStack(alignment: .leading, spacing: 1) {
          Text(o.name).font(.subheadline.weight(.bold)).lineLimit(1)
          Text(hijriText).font(.caption2).opacity(0.6).lineLimit(1)
        }
        Spacer(minLength: 0)
        BayaanLogo(size: 14)
      }
      if isLarge { Spacer(minLength: 0) }
      // Centered and ragged, never justified (Digital Khatt spike caveat).
      Text(a.arabic)
        .font(WidgetFonts.quran(isLarge ? 32 : 24))
        .multilineTextAlignment(.center)
        .lineLimit(isLarge ? 6 : 2)
        .minimumScaleFactor(0.4)
        .frame(maxWidth: .infinity)
        .environment(\.layoutDirection, .rightToLeft)
      Text(a.translation).font(isLarge ? .subheadline : .caption).opacity(0.8)
        .lineLimit(isLarge ? 4 : 2).minimumScaleFactor(0.85)
      if isLarge {
        Text(WidgetLogic.reference(surahName: a.surahName, key: a.key)).font(.caption2.weight(.semibold)).opacity(0.6)
        Spacer(minLength: 0)
      }
    }
    .padding(isLarge ? 16 : 14)
  }

  private var upcomingBody: some View {
    let month = entry.hijri.flatMap { h in data?.month(h.month) }
    return VStack(alignment: .leading, spacing: 8) {
      HStack(alignment: .top) {
        VStack(alignment: .leading, spacing: 1) {
          Text(hijriText).font(.headline).lineLimit(1)
          Text(month?.arabic ?? "").font(WidgetFonts.dhikr(14)).opacity(0.6)
        }
        Spacer(minLength: 0)
        BayaanLogo(size: 14)
      }
      Text("Coming up").font(.caption.weight(.semibold)).opacity(0.6)
      ForEach(Array(entry.upcoming.prefix(isLarge ? 3 : 2)), id: \.self) { u in
        HStack {
          Text(data?.occasion(u.id)?.name ?? u.id).font(.subheadline.weight(.semibold)).lineLimit(1)
          Spacer(minLength: 0)
          Text(ContentText.daysLabel(u.days)).font(.caption).opacity(0.75)
        }
      }
      Spacer(minLength: 0)
    }
    .padding(14)
  }
}

#Preview("Medium", as: .systemMedium) {
  OccasionWidget()
} timeline: {
  OccasionEntry.make(at: .now, next: nil)
  OccasionEntry(date: .now, hijri: HijriDate(year: 1447, month: 9, day: 27),
                occasion: ContentStaticData.occasions?.occasion("lastTen"),
                ayah: ContentStaticData.occasions?.occasion("lastTen")?.ayat.first, upcoming: [], relevance: nil)
}

#Preview("Large", as: .systemLarge) {
  OccasionWidget()
} timeline: {
  OccasionEntry(date: .now, hijri: HijriDate(year: 1448, month: 4, day: 30),
                occasion: ContentStaticData.occasions?.occasion("jumuah"),
                ayah: ContentStaticData.occasions?.occasion("jumuah")?.ayat.first, upcoming: [], relevance: nil)
  OccasionEntry.make(at: .now, next: nil)
}
