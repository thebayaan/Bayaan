// targets/widgets/LockScreen/VerseOfTheDayAccessoryWidget.swift
import SwiftUI
import WidgetKit

/// Lock Screen verse of the day. Reuses Ayah of the Day's provider, so it
/// changes at midnight with the home screen widget.
struct VerseOfTheDayAccessoryWidget: Widget {
  let kind = "VerseOfTheDayAccessory"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: AyahOfTheDayProvider()) { entry in
      VerseOfTheDayAccessoryView(entry: entry)
    }
    .configurationDisplayName("Verse of the Day")
    .description("Today's verse on the Lock Screen.")
    .supportedFamilies([.accessoryCircular, .accessoryRectangular])
  }
}

struct VerseOfTheDayAccessoryView: View {
  @Environment(\.widgetFamily) private var family
  let entry: AyahOfTheDayEntry

  var body: some View {
    content
      .containerBackground(for: .widget) {
        if family == .accessoryCircular { AccessoryWidgetBackground() } else { Color.clear }
      }
      .widgetURL(entry.ayah.flatMap { AppLinks.url("quran/\($0.surahId)?ayah=\($0.ayah)") })
  }

  @ViewBuilder private var content: some View {
    switch family {
    case .accessoryCircular: circular
    default: rectangular
    }
  }

  @ViewBuilder private var circular: some View {
    if let ayah = entry.ayah {
      Text(verbatim: "\(ayah.surahId):\(ayah.ayah)")
        .font(.headline)
        .monospacedDigit()
        .lineLimit(1)
        .minimumScaleFactor(0.4)
        .padding(.horizontal, 4)
    } else {
      BayaanLogo(size: 18)
    }
  }

  @ViewBuilder private var rectangular: some View {
    if let ayah = entry.ayah {
      VStack(alignment: .leading, spacing: 1) {
        Text(ayah.surahName).font(.headline).lineLimit(1).widgetAccentable()
        Text("Verse \(ayah.ayah)").font(.caption).lineLimit(1)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    } else {
      HStack(spacing: 6) {
        BayaanLogo(size: 18)
        Text(AppBrand.name).font(.headline).lineLimit(1)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
  }
}

#Preview("Circular", as: .accessoryCircular) {
  VerseOfTheDayAccessoryWidget()
} timeline: {
  AyahOfTheDayEntry(date: .now, ayah: StaticData.ayat.first { $0.key == "2:255" } ?? StaticData.ayat.first)
  AyahOfTheDayEntry(date: .now, ayah: nil)
}

#Preview("Rectangular", as: .accessoryRectangular) {
  VerseOfTheDayAccessoryWidget()
} timeline: {
  AyahOfTheDayEntry(date: .now, ayah: StaticData.ayat.first { $0.key == "2:255" } ?? StaticData.ayat.first)
  AyahOfTheDayEntry(date: .now, ayah: nil)
}
