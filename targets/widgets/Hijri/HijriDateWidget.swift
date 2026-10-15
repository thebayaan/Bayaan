// targets/widgets/Hijri/HijriDateWidget.swift
import AppIntents
import SwiftUI
import WidgetKit

struct HijriDateEntry: TimelineEntry {
  let date: Date
  let hijri: HijriDate?
  let occasion: OccasionInfo?
  let upcoming: UpcomingOccasion?
  let relevance: TimelineEntryRelevance?

  static func make(at date: Date, next: Date?) -> HijriDateEntry {
    let id = ContentLogic.occasion(at: date)
    let upcoming = ContentLogic.nextOccasions(today: WidgetLogic.dayNumber(date), count: 1,
                                              hijriOf: ContentLogic.hijri(dayNumber:)).first
    return HijriDateEntry(date: date, hijri: ContentLogic.hijri(date),
                          occasion: ContentStaticData.occasions?.occasion(id), upcoming: upcoming,
                          relevance: .scored(ContentLogic.occasionRelevance(id), from: date, until: next))
  }
}

struct HijriDateProvider: TimelineProvider {
  func placeholder(in context: Context) -> HijriDateEntry { HijriDateEntry.make(at: .now, next: nil) }

  func getSnapshot(in context: Context, completion: @escaping (HijriDateEntry) -> Void) {
    completion(HijriDateEntry.make(at: .now, next: nil))
  }

  // Boundaries include midnight (new date) and 18:00 (end of Jumu'ah).
  func getTimeline(in context: Context, completion: @escaping (Timeline<HijriDateEntry>) -> Void) {
    completion(Timeline(entries: ContentTimeline.entries(from: .now, make: HijriDateEntry.make), policy: .atEnd))
  }
}

struct HijriDateWidget: Widget {
  let kind = "HijriDate"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: HijriDateProvider()) { entry in
      HijriDateView(entry: entry)
    }
    .configurationDisplayName("Hijri Date")
    .description("Today's date in the Umm al-Qura calendar.")
    .supportedFamilies([.systemSmall, .accessoryInline, .accessoryRectangular])
    .contentMarginsDisabled()
  }
}

struct HijriDateView: View {
  @Environment(\.widgetFamily) private var family
  let entry: HijriDateEntry

  private var months: [HijriMonthName] { ContentStaticData.occasions?.months ?? [] }
  private var line: String { entry.hijri.map { ContentText.hijriLine($0, months: months) } ?? AppBrand.name }

  var body: some View {
    switch family {
    case .accessoryInline:
      Text(line).containerBackground(for: .widget) { Color.clear }
    case .accessoryRectangular:
      VStack(alignment: .leading, spacing: 1) {
        Text(line).font(.headline).lineLimit(1).minimumScaleFactor(0.8)
        if let o = entry.occasion {
          Text(o.name).font(.caption).lineLimit(1)
        } else if let u = entry.upcoming, let name = ContentStaticData.occasions?.occasion(u.id)?.name {
          Text("\(name) \(ContentText.daysLabel(u.days))").font(.caption).lineLimit(1)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .containerBackground(for: .widget) { Color.clear }
    default:
      small
    }
  }

  private var small: some View {
    let month = entry.hijri.flatMap { h in months.first { $0.number == h.month } }
    return VStack(alignment: .leading, spacing: 2) {
      HStack(alignment: .top) {
        Text(month?.arabic ?? "").font(WidgetFonts.dhikr(16)).opacity(0.75).lineLimit(1)
        Spacer(minLength: 0)
        BayaanLogo(size: 12)
      }
      Spacer(minLength: 0)
      if let h = entry.hijri {
        Text(String(h.day)).font(.system(size: 44, weight: .bold, design: .rounded))
        Text("\(month?.name ?? "") \(String(h.year)) AH")
          .font(.caption.weight(.semibold)).opacity(0.75).lineLimit(1).minimumScaleFactor(0.8)
      } else {
        Text("Open \(AppBrand.name)").font(.caption.weight(.semibold))
      }
      if let o = entry.occasion {
        Text(o.name).font(.caption2.weight(.bold)).lineLimit(1).padding(.top, 2)
      }
    }
    .padding(12)
    .foregroundStyle(.white)
    .containerBackground(for: .widget) { WidgetPalette.background }
  }
}

#Preview("Small", as: .systemSmall) {
  HijriDateWidget()
} timeline: {
  HijriDateEntry.make(at: .now, next: nil)
}

#Preview("Inline", as: .accessoryInline) {
  HijriDateWidget()
} timeline: {
  HijriDateEntry.make(at: .now, next: nil)
}

#Preview("Rectangular", as: .accessoryRectangular) {
  HijriDateWidget()
} timeline: {
  HijriDateEntry.make(at: .now, next: nil)
}
