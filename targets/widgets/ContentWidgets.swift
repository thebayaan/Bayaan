// targets/widgets/ContentWidgets.swift
import SwiftUI
import WidgetKit

/// Phase 3 widgets, nested because a WidgetBundleBuilder takes at most 10 children (P3-R16).
/// Each can be compiled out with BAYAAN_NO_WIDGET_<ID> (RFC-021).
struct ContentWidgets: WidgetBundle {
  var body: some Widget {
    #if !BAYAAN_NO_WIDGET_RECENTLY_PLAYED
    RecentlyPlayedWidget()
    #endif
    #if !BAYAAN_NO_WIDGET_LIBRARY_SHELF
    LibraryShelfWidget()
    #endif
    #if !BAYAAN_NO_WIDGET_BEDTIME
    BedtimeWidget()
    #endif
    #if !BAYAAN_NO_WIDGET_RECITER_SPOTLIGHT
    ReciterSpotlightWidget()
    #endif
    #if !BAYAAN_NO_WIDGET_ADHKAR
    AdhkarWidget()
    #endif
    #if !BAYAAN_NO_WIDGET_HIJRI_DATE
    HijriDateWidget()
    #endif
    #if !BAYAAN_NO_WIDGET_OCCASION
    OccasionWidget()
    #endif
    #if !BAYAAN_NO_WIDGET_BAYAAN_NOW
    BayaanNowWidget()
    #endif
  }
}
