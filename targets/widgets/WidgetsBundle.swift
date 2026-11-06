// targets/widgets/WidgetsBundle.swift
import SwiftUI
import WidgetKit

/// A fork drops a widget with `branding.widgets` or a feature flag (RFC-021):
/// plugins/withBayaanWidgets.js then defines BAYAAN_NO_WIDGET_<ID> on this
/// target, which compiles the widget out of the bundle.
@main
struct BayaanWidgetsBundle: WidgetBundle {
  var body: some Widget {
    #if !BAYAAN_NO_WIDGET_CONTINUE_LISTENING
    ContinueListeningWidget()
    #endif
    #if !BAYAAN_NO_WIDGET_CONTINUE_READING
    ContinueReadingWidget()
    #endif
    #if !BAYAAN_NO_WIDGET_QUICK_SURAH
    QuickSurahWidget()
    #endif
    #if !BAYAAN_NO_WIDGET_PINNED_RECITER
    PinnedReciterWidget()
    #endif
    #if !BAYAAN_NO_WIDGET_AYAH_OF_THE_DAY
    AyahOfTheDayWidget()
    #endif
    #if !BAYAAN_NO_WIDGET_TASBEEH
    TasbeehWidget()
    #endif
    #if !BAYAAN_NO_WIDGET_LISTENING_ACCESSORY
    ListeningAccessoryWidget()
    #endif
    #if !BAYAAN_NO_WIDGET_VERSE_OF_THE_DAY_ACCESSORY
    VerseOfTheDayAccessoryWidget()
    #endif
    #if !BAYAAN_NO_WIDGET_LIVE_ACTIVITY
    LiveActivities().body
    #endif
    if #available(iOS 18.0, *) {
      #if !BAYAAN_NO_WIDGET_PLAYBACK_CONTROL
      PlaybackControl()
      #endif
      #if !BAYAAN_NO_WIDGET_PLAY_SURAH_CONTROL
      PlaySurahControl()
      #endif
    }
    ContentWidgets().body
  }
}
