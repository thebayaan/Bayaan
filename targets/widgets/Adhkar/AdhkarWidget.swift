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
  let session: AdhkarSession?
  let relevance: TimelineEntryRelevance?

  static func make(at date: Date, next: Date?) -> AdhkarEntry {
    let hour = ContentLogic.hour(date)
    let data = ContentStaticData.adhkar?.data(for: ContentLogic.adhkarPeriod(hour: hour))
    let featured = data.flatMap { d -> FeaturedDhikr? in
      let i = WidgetLogic.ayahIndex(date, count: d.featured.count)
      return i >= 0 ? d.featured[i] : nil
    }
    let session = data.map { d in
      AdhkarSessionLogic.resolve(AdhkarSessionStore.read(), period: d.period,
                                 day: AdhkarSessionLogic.sessionDay(date), repeatCounts: d.items.map(\.repeatCount))
    }
    return AdhkarEntry(date: date, data: data, featured: featured, session: session,
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
    .description("Go through the adhkar for this time of day.")
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    .contentMarginsDisabled()
  }
}

struct AdhkarView: View {
  @Environment(\.widgetFamily) private var family
  let entry: AdhkarEntry

  var body: some View {
    Group {
      if family == .systemSmall {
        if let data = entry.data, let dhikr = entry.featured {
          small(data, dhikr).widgetURL(AppLinks.url("adhkar/\(data.superId)"))
        } else {
          ContentMessage(title: "Open \(AppBrand.name)")
        }
      } else if let data = entry.data, let session = entry.session, !data.items.isEmpty {
        AdhkarSessionView(data: data, session: session)
      } else {
        ContentMessage(title: "Open \(AppBrand.name)")
      }
    }
    // @ai-start
    .foregroundStyle(style.primary)
    .containerBackground(for: .widget) { style.background }
  }

  /// Time-of-day tint; the period of the shown data, else today's clock.
  private var style: AdhkarStyle {
    .forPeriod(entry.data?.period ?? (Calendar.current.component(.hour, from: entry.date) < 12 ? "morning" : "evening"))
    // @ai-end
  }

  private func small(_ data: AdhkarPeriodData, _ dhikr: FeaturedDhikr) -> some View {
    // @ai-start
    VStack(alignment: .leading, spacing: 6) {
      HStack(spacing: 6) {
        Image(systemName: style.symbol).font(.system(size: 13, weight: .bold)).foregroundStyle(style.accent)
        // Drops "Adhkar" before cutting letters; the icon already says which.
        ViewThatFits(in: .horizontal) {
          Text(data.title).lineLimit(1).fixedSize(horizontal: true, vertical: false)
          Text(data.title.split(separator: " ").first.map(String.init) ?? data.title).lineLimit(1)
        }
        .font(.footnote.weight(.heavy))
    // @ai-end
        // @ai-start
        Spacer(minLength: 0)
        // Plays the period's adhkar audio from this dhikr, even with the app closed; pauses while it plays.
        PlayOrPauseButton(playing: AdhkarPlaybackState.isPlaying(superId: data.superId, snapshot: SnapshotStore.load()),
                          play: PlayAdhkarIntent(superId: data.superId, dhikrId: dhikr.id),
                          pause: SetAdhkarPlaybackIntent(playing: false), label: "Listen") { playing in
          Image(systemName: playing ? "pause.fill" : "play.fill").font(.system(size: 11, weight: .bold))
            .foregroundStyle(style.onAccent)
            .frame(width: 28, height: 28)
            .background(style.accent, in: Circle())
        }
        // @ai-end
      }
      DhikrText(text: dhikr.arabic, size: 22, lines: 3).frame(maxWidth: .infinity, maxHeight: .infinity) // @ai
    }
    .padding(14) // @ai
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
  AdhkarEntry(date: .now, data: nil, featured: nil, session: nil, relevance: nil)
}

#Preview("Large", as: .systemLarge) {
  AdhkarWidget()
} timeline: {
  AdhkarEntry.make(at: .now, next: nil)
}
