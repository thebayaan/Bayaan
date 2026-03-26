import WidgetKit
import SwiftUI
internal import ExpoWidgets

struct Favorites: Widget {
  let name: String = "Favorites"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: name, provider: WidgetsTimelineProvider(name: name)) { entry in
      WidgetsEntryView(entry: entry)
    }
    .configurationDisplayName("Favorites")
    .description("Quick access to your loved recitations.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}
