// AdhkarSessionActivityState.swift
// Two identical copies: modules/bayaan-widgets/ios (starts and updates the
// Live Activity) and targets/widgets/LiveActivity (renders it). Field names
// match modules/bayaan-widgets/src/adhkarActivity.ts.
// scripts/check-widget-system-surfaces.sh fails if the copies differ.
import Foundation

struct AdhkarSessionActivityState: Codable, Hashable {
  let listTitle: String
  /// First 60 characters of the clean Arabic of the current dhikr.
  let preview: String
  /// 1-based.
  let position: Int
  let total: Int
  let isPlaying: Bool

  /// "4 of 23". English like the Now Playing "Ayah 10 of 110": the extension
  /// has no string catalog.
  var positionLabel: String { "\(position) of \(total)" }
  /// "4/23", for the compact Dynamic Island.
  var shortPositionLabel: String { "\(position)/\(total)" }
}
