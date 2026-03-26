import WidgetKit
import SwiftUI
internal import ExpoWidgets

struct AyahOfTheDay: Widget {
  let name: String = "AyahOfTheDay"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: name, provider: WidgetsTimelineProvider(name: name)) { entry in
      WidgetsEntryView(entry: entry)
    }
    .configurationDisplayName("Ayah of the Day")
    .description("A daily verse with English translation (Saheeh International).")
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
  }
}