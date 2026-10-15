// targets/widgets/Adhkar/AdhkarWidget.swift
import AppIntents
import SwiftUI
import WidgetKit

/// Entry dates for date-driven widgets: now, then every context boundary in the next 24 hours.
enum ContentTimeline {
  static func dates(from now: Date) -> [Date] { [now] + ContentLogic.boundaries(after: now) }

  static func entries<E>(from now: Date, make: (Date, Date?) -> E) -> [E] {
    let dates = dates(from: now)
    return dates.enumerated().map { i, d in make(d, i + 1 < dates.count ? dates[i + 1] : nil) }
  }
}

struct AdhkarEntry: TimelineEntry {
  let date: Date
  let data: AdhkarPeriodData?
  let featured: FeaturedDhikr?
  let relevance: TimelineEntryRelevance?

  static func make(at date: Date, next: Date?) -> AdhkarEntry {
    let hour = ContentLogic.hour(date)
    let data = ContentStaticData.adhkar?.data(for: ContentLogic.adhkarPeriod(hour: hour))
    let featured = data.flatMap { d -> FeaturedDhikr? in
      let i = WidgetLogic.ayahIndex(date, count: d.featured.count)
      return i >= 0 ? d.featured[i] : nil
    }
    return AdhkarEntry(date: date, data: data, featured: featured,
                       relevance: .scored(ContentLogic.adhkarRelevance(hour: hour), from: date, until: next))
  }
}

struct AdhkarProvider: TimelineProvider {
  func placeholder(in context: Context) -> AdhkarEntry { AdhkarEntry.make(at: .now, next: nil) }

  func getSnapshot(in context: Context, completion: @escaping (AdhkarEntry) -> Void) {
    completion(AdhkarEntry.make(at: .now, next: nil))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<AdhkarEntry>) -> Void) {
    completion(Timeline(entries: ContentTimeline.entries(from: .now, make: AdhkarEntry.make), policy: .atEnd))
  }
}

struct AdhkarWidget: Widget {
  let kind = "Adhkar"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: AdhkarProvider()) { entry in
      AdhkarView(entry: entry)
    }
    .configurationDisplayName("Morning & Evening Adhkar")
    .description("The adhkar for this time of day.")
    .supportedFamilies([.systemSmall, .systemMedium])
    .contentMarginsDisabled()
  }
}

struct AdhkarView: View {
  @Environment(\.widgetFamily) private var family
  let entry: AdhkarEntry

  var body: some View {
    Group {
      if let data = entry.data, let dhikr = entry.featured {
        if family == .systemSmall { small(data, dhikr) } else { medium(data, dhikr) }
      } else {
        ContentMessage(title: "Open \(AppBrand.name)")
      }
    }
    .foregroundStyle(.white)
    .containerBackground(for: .widget) { WidgetPalette.background }
    .widgetURL(entry.data.flatMap { AppLinks.url("adhkar/\($0.superId)") })
  }

  private func small(_ data: AdhkarPeriodData, _ dhikr: FeaturedDhikr) -> some View {
    VStack(spacing: 6) {
      HStack {
        Text(data.arabicTitle).font(WidgetFonts.dhikr(15)).opacity(0.75).lineLimit(1)
        Spacer(minLength: 0)
        BayaanLogo(size: 12)
      }
      Spacer(minLength: 0)
      DhikrText(text: dhikr.arabic, size: 22, lines: 3).frame(maxWidth: .infinity)
      Spacer(minLength: 0)
    }
    .padding(12)
  }

  private func medium(_ data: AdhkarPeriodData, _ dhikr: FeaturedDhikr) -> some View {
    VStack(alignment: .leading, spacing: 6) {
      HStack(alignment: .firstTextBaseline, spacing: 8) {
        Text(data.title).font(.subheadline.weight(.bold)).lineLimit(1)
        Text(data.arabicTitle).font(WidgetFonts.dhikr(14)).opacity(0.6).lineLimit(1)
        Spacer(minLength: 0)
        BayaanLogo(size: 14)
      }
      Spacer(minLength: 0)
      DhikrText(text: dhikr.arabic, size: 22, lines: 2).frame(maxWidth: .infinity)
      if let translation = dhikr.translation {
        Text(translation).font(.caption).opacity(0.75).lineLimit(1)
      }
      Spacer(minLength: 0)
      HStack {
        if let r = ContentText.repeatLabel(dhikr.repeatCount) {
          Text(r).font(.caption2.weight(.bold)).opacity(0.6)
        }
        Spacer(minLength: 0)
        Text("\(data.count) adhkar").font(.caption2.weight(.semibold)).opacity(0.6)
      }
    }
    .padding(14)
  }
}

#Preview("Small", as: .systemSmall) {
  AdhkarWidget()
} timeline: {
  AdhkarEntry.make(at: .now, next: nil)
}

#Preview("Medium", as: .systemMedium) {
  AdhkarWidget()
} timeline: {
  AdhkarEntry.make(at: .now, next: nil)
  AdhkarEntry(date: .now, data: nil, featured: nil, relevance: nil)
}
