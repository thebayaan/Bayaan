import WidgetKit
import SwiftUI
internal import ExpoWidgets

struct BayaanShortcuts: Widget {
  let name: String = "BayaanShortcuts"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: name, provider: WidgetsTimelineProvider(name: name)) { entry in
      WidgetsEntryView(entry: entry)
    }
    .configurationDisplayName("Bayaan")
    .description("Open Mushaf, reciters, and playlists.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}