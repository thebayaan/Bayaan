import WidgetKit
import SwiftUI
internal import ExpoWidgets

struct ListeningStats: Widget {
  let name: String = "ListeningStats"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: name, provider: WidgetsTimelineProvider(name: name)) { entry in
      WidgetsEntryView(entry: entry)
    }
    .configurationDisplayName("Listening Stats")
    .description("See your Quran listening activity at a glance.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}
