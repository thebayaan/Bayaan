import WidgetKit
import SwiftUI
internal import ExpoWidgets

struct NowPlaying: Widget {
  let name: String = "NowPlaying"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: name, provider: WidgetsTimelineProvider(name: name)) { entry in
      WidgetsEntryView(entry: entry)
    }
    .configurationDisplayName("Now Playing")
    .description("What is playing in Bayaan.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}