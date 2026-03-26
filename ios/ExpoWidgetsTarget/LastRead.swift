import WidgetKit
import SwiftUI
internal import ExpoWidgets

struct LastRead: Widget {
  let name: String = "LastRead"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: name, provider: WidgetsTimelineProvider(name: name)) { entry in
      WidgetsEntryView(entry: entry)
    }
    .configurationDisplayName("Last Read")
    .description("Continue reading where you left off in the Mushaf.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}
