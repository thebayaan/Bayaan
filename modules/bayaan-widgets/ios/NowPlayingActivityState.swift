// NowPlayingActivityState.swift
// Two identical copies: modules/bayaan-widgets/ios (starts and updates the
// Live Activity) and targets/widgets/LiveActivity (renders it). Field names
// match modules/bayaan-widgets/src/liveActivity.ts.
// scripts/check-widget-system-surfaces.sh fails if the copies differ.
import Foundation

struct NowPlayingAyah: Codable, Hashable {
  let number: Int
  let count: Int
  let text: String
}

struct NowPlayingActivityState: Codable, Hashable {
  let surahId: Int
  let surahName: String
  let reciterName: String
  let artworkFile: String?
  let isPlaying: Bool
  let positionSec: Double
  let durationSec: Double
  let rate: Double
  /// Epoch milliseconds at which positionSec was sampled.
  let anchorAt: Double
  let ayah: NowPlayingAyah?

  var safeRate: Double { rate > 0 && rate.isFinite ? rate : 1 }
  private var duration: Double { max(0, durationSec) }
  private var position: Double { min(max(positionSec, 0), duration) }

  /// When the track would have been at 0, playing at its rate.
  var wallStart: Date { Date(timeIntervalSince1970: anchorAt / 1000 - position / safeRate) }
  /// When the track ends if playback continues.
  var wallEnd: Date { Date(timeIntervalSince1970: anchorAt / 1000 + (duration - position) / safeRate) }
  var fraction: Double { duration > 0 ? position / duration : 0 }
  var remainingWallSec: Double { (duration - position) / safeRate }
}
