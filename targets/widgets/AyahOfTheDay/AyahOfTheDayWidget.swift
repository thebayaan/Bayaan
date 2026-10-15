// targets/widgets/AyahOfTheDay/AyahOfTheDayWidget.swift
import AppIntents
import SwiftUI
import WidgetKit

struct AyahOfTheDayEntry: TimelineEntry {
  let date: Date
  let ayah: StaticAyah?
}

struct AyahOfTheDayProvider: TimelineProvider {
  func placeholder(in context: Context) -> AyahOfTheDayEntry {
    AyahOfTheDayEntry(date: .now, ayah: StaticData.ayahOfTheDay(.now))
  }

  func getSnapshot(in context: Context, completion: @escaping (AyahOfTheDayEntry) -> Void) {
    completion(placeholder(in: context))
  }

  // Today's ayah now and tomorrow's at midnight; then WidgetKit asks again.
  func getTimeline(in context: Context, completion: @escaping (Timeline<AyahOfTheDayEntry>) -> Void) {
    let now = Date.now
    let midnight = WidgetLogic.nextMidnight(after: now)
    completion(Timeline(entries: [
      AyahOfTheDayEntry(date: now, ayah: StaticData.ayahOfTheDay(now)),
      AyahOfTheDayEntry(date: midnight, ayah: StaticData.ayahOfTheDay(midnight)),
    ], policy: .atEnd))
  }
}

struct AyahOfTheDayWidget: Widget {
  let kind = "AyahOfTheDay"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: AyahOfTheDayProvider()) { entry in
      AyahOfTheDayView(entry: entry)
    }
    .configurationDisplayName("Ayah of the Day")
    .description("A new ayah every day, in Digital Khatt.")
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    .contentMarginsDisabled()
  }
}

struct AyahOfTheDayView: View {
  @Environment(\.widgetFamily) private var family
  let entry: AyahOfTheDayEntry

  var body: some View {
    Group {
      if let ayah = entry.ayah {
        content(ayah)
      } else {
        Text("Open \(AppBrand.name)").font(.caption.weight(.semibold))
      }
    }
    .foregroundStyle(.white)
    .containerBackground(for: .widget) { WidgetPalette.background }
    .widgetURL(entry.ayah.flatMap { AppLinks.url("quran/\($0.surahId)?ayah=\($0.ayah)") })
  }

  @ViewBuilder private func content(_ ayah: StaticAyah) -> some View {
    switch family {
    case .systemSmall:
      VStack(spacing: 4) {
        HStack { Spacer(minLength: 0); BayaanLogo(size: 12) }
        Spacer(minLength: 0)
        arabic(ayah, size: 26, lines: 4)
        Spacer(minLength: 0)
      }
      .padding(12)
    case .systemMedium:
      VStack(alignment: .leading, spacing: 6) {
        header(ayah)
        arabic(ayah, size: 24, lines: 2)
        Text(ayah.translation).font(.caption).opacity(0.8).lineLimit(2).minimumScaleFactor(0.85)
      }
      .padding(14)
    default:
      VStack(alignment: .leading, spacing: 12) {
        header(ayah)
        Spacer(minLength: 0)
        arabic(ayah, size: 32, lines: 6)
        Text(ayah.translation).font(.subheadline).opacity(0.85).lineLimit(5)
        Spacer(minLength: 0)
      }
      .padding(16)
    }
  }

  private func header(_ ayah: StaticAyah) -> some View {
    HStack(spacing: 8) {
      RoundIntentButton(intent: PlayTrackIntent(surahId: ayah.surahId, reciterId: nil, rewayatId: nil, ayah: ayah.ayah),
                        systemName: "play.fill", label: "Listen")
      Text(WidgetLogic.reference(surahName: ayah.surahName, key: ayah.key))
        .font(.caption.weight(.semibold)).opacity(0.75).lineLimit(1)
      Spacer(minLength: 0)
      BayaanLogo(size: 14)
    }
  }

  // Centered and ragged, never justified (Digital Khatt spike caveat).
  private func arabic(_ ayah: StaticAyah, size: CGFloat, lines: Int) -> some View {
    Text(ayah.arabic)
      .font(WidgetFonts.quran(size))
      .multilineTextAlignment(.center)
      .lineLimit(lines)
      .minimumScaleFactor(0.4)
      .frame(maxWidth: .infinity)
      .environment(\.layoutDirection, .rightToLeft)
  }
}

#Preview("Small", as: .systemSmall) {
  AyahOfTheDayWidget()
} timeline: {
  AyahOfTheDayEntry(date: .now, ayah: StaticData.ayat.first { $0.key == "94:6" })
}

#Preview("Medium", as: .systemMedium) {
  AyahOfTheDayWidget()
} timeline: {
  AyahOfTheDayEntry(date: .now, ayah: StaticData.ayat.first { $0.key == "2:152" })
}

#Preview("Large", as: .systemLarge) {
  AyahOfTheDayWidget()
} timeline: {
  AyahOfTheDayEntry(date: .now, ayah: StaticData.ayat.first { $0.key == "39:53" })
  AyahOfTheDayEntry(date: .now, ayah: nil)
}
