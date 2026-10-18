// NowPlayingAttributes.swift
// Two identical copies: modules/bayaan-widgets/ios (starts and updates the
// Live Activity) and targets/widgets/LiveActivity (renders it). ActivityKit
// pairs them by type name. scripts/check-widget-system-surfaces.sh fails if
// the copies differ.
import ActivityKit
import Foundation

struct NowPlayingAttributes: ActivityAttributes {
  typealias ContentState = NowPlayingActivityState
}
