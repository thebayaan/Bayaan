// targets/widgets/LiveActivity/LiveActivities.swift
import SwiftUI
import WidgetKit

/// The Live Activities, nested because a WidgetBundleBuilder takes at most 10
/// children and BayaanWidgetsBundle is full (P3-R16). The Now Playing activity
/// stays registered although Quran playback no longer starts it
/// (services/widgets/live-activity/config.ts). WidgetsBundle.swift compiles
/// this bundle out with BAYAAN_NO_WIDGET_LIVE_ACTIVITY; the adhkar activity
/// also follows BAYAAN_NO_FEATURE_ADHKAR (RFC-021).
struct LiveActivities: WidgetBundle {
  var body: some Widget {
    NowPlayingLiveActivity()
    #if !BAYAAN_NO_FEATURE_ADHKAR
    AdhkarSessionLiveActivity()
    #endif
  }
}
