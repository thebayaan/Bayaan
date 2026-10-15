// targets/widgets/LiveActivity/NowPlayingLiveActivity.swift
import ActivityKit
import AppIntents
import ImageIO
import SwiftUI
import WidgetKit

private let playerURL = AppLinks.url("player")!

/// Now Playing Live Activity: Lock Screen (also StandBy, scaled by the system)
/// and Dynamic Island. Started and updated by the app (NowPlayingActivityBridge).
struct NowPlayingLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: NowPlayingAttributes.self) { context in
      NowPlayingLockScreenView(state: context.state)
        .activityBackgroundTint(WidgetPalette.background)
        .activitySystemActionForegroundColor(.white)
        .widgetURL(playerURL)
    } dynamicIsland: { context in
      let state = context.state
      return DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          ActivityArtwork(file: state.artworkFile, size: 52).padding(.leading, 4)
        }
        DynamicIslandExpandedRegion(.center) {
          ActivityTitles(state: state)
        }
        DynamicIslandExpandedRegion(.trailing) {
          ActivityPlayButton(state: state).padding(.trailing, 4)
        }
        DynamicIslandExpandedRegion(.bottom) {
          VStack(spacing: 6) {
            if let ayah = state.ayah {
              AyahLine(ayah: ayah, lines: 2)
            }
            ActivityProgress(state: state)
          }
          // Keep the countdown clear of the island's rounded corners.
          .padding(.horizontal, 8)
        }
      } compactLeading: {
        ActivityArtwork(file: state.artworkFile, size: 22)
      } compactTrailing: {
        CompactProgress(state: state)
      } minimal: {
        CompactProgress(state: state)
      }
      .widgetURL(playerURL)
      .keylineTint(.white)
    }
  }
}

struct NowPlayingLockScreenView: View {
  let state: NowPlayingActivityState

  var body: some View {
    VStack(spacing: 10) {
      HStack(spacing: 12) {
        ActivityArtwork(file: state.artworkFile, size: 56)
        ActivityTitles(state: state)
        ActivityPlayButton(state: state)
      }
      if let ayah = state.ayah {
        AyahLine(ayah: ayah, lines: 3)
      }
      ActivityProgress(state: state)
    }
    .padding(14)
    .overlay(alignment: .topTrailing) {
      BayaanLogo(size: 12).padding(8)
    }
  }
}

/// Surah card for the activity. The cached cards are 900 px; the system drops
/// images that large from a Live Activity (the tile renders empty), so decode
/// a thumbnail at the size shown instead.
struct ActivityArtwork: View {
  let file: String?
  let size: CGFloat

  var body: some View {
    Group {
      if let image = Self.thumbnail(file, maxPixels: size * 3) {
        Image(uiImage: image).resizable()
      } else {
        RoundedRectangle(cornerRadius: size * 0.16).fill(.white.opacity(0.15))
      }
    }
    .aspectRatio(1, contentMode: .fill)
    .frame(width: size, height: size)
    .clipShape(RoundedRectangle(cornerRadius: size * 0.16, style: .continuous))
  }

  static func thumbnail(_ file: String?, maxPixels: CGFloat) -> UIImage? {
    guard let file, let dir = BayaanAppGroup.widgetsDir else { return nil }
    let url = dir.appendingPathComponent("artwork/\(file)")
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil) else { return nil }
    let options: [CFString: Any] = [
      kCGImageSourceCreateThumbnailFromImageAlways: true,
      kCGImageSourceCreateThumbnailWithTransform: true,
      kCGImageSourceShouldCacheImmediately: true,
      kCGImageSourceThumbnailMaxPixelSize: Int(maxPixels),
    ]
    guard let image = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else {
      return nil
    }
    return UIImage(cgImage: image)
  }
}

struct ActivityTitles: View {
  let state: NowPlayingActivityState

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      Text(state.surahName)
        .font(.headline)
        .foregroundStyle(.white)
        .lineLimit(1)
      Text(state.reciterName)
        .font(.subheadline)
        .foregroundStyle(.white.opacity(0.75))
        .lineLimit(1)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

struct ActivityPlayButton: View {
  let state: NowPlayingActivityState

  var body: some View {
    RoundIntentButton(
      intent: SetPlaybackIntent(playing: !state.isPlaying),
      systemName: state.isPlaying ? "pause.fill" : "play.fill",
      label: state.isPlaying ? "Pause" : "Play")
  }
}

/// Linear bar plus remaining time. Timer views animate while playing with no
/// activity updates; paused shows a static bar and "Nm left".
struct ActivityProgress: View {
  let state: NowPlayingActivityState

  private var live: Bool { state.isPlaying && state.durationSec > 0 }

  var body: some View {
    HStack(spacing: 8) {
      Group {
        if live {
          ProgressView(timerInterval: state.wallStart...state.wallEnd, countsDown: false) {
            EmptyView()
          } currentValueLabel: {
            EmptyView()
          }
        } else {
          ProgressView(value: state.fraction)
        }
      }
      .progressViewStyle(.linear)
      .tint(.white)

      Group {
        if live {
          // A timer Text takes all offered width, so it needs a fixed frame.
          Text(timerInterval: state.wallStart...state.wallEnd, countsDown: true)
            .multilineTextAlignment(.trailing)
            .frame(width: 52, alignment: .trailing)
        } else {
          // "2h 6m left" is wider than 52 pt; size the static label to fit.
          Text(WidgetLogic.minutesLeftLabel(state.remainingWallSec))
            .lineLimit(1)
            .fixedSize()
        }
      }
      .font(.caption2.monospacedDigit())
      .foregroundStyle(.white.opacity(0.6))
    }
  }
}

struct CompactProgress: View {
  let state: NowPlayingActivityState

  var body: some View {
    if state.isPlaying && state.durationSec > 0 {
      ProgressView(timerInterval: state.wallStart...state.wallEnd, countsDown: false) {
        EmptyView()
      } currentValueLabel: {
        EmptyView()
      }
      .progressViewStyle(.circular)
      .tint(.white)
      .frame(width: 20, height: 20)
    } else {
      Image(systemName: "pause.fill")
        .font(.system(size: 11, weight: .bold))
        .foregroundStyle(.white)
    }
  }
}

/// Current ayah in Digital Khatt (ayah mode only), right to left, centered.
struct AyahLine: View {
  let ayah: NowPlayingAyah
  let lines: Int

  var body: some View {
    VStack(spacing: 2) {
      Text(ayah.text)
        .font(WidgetFonts.quran(18))
        .foregroundStyle(.white)
        .lineLimit(lines)
        .multilineTextAlignment(.center)
        .environment(\.layoutDirection, .rightToLeft)
        .frame(maxWidth: .infinity)
      Text("Ayah \(ayah.number) of \(ayah.count)")
        .font(.caption2)
        .foregroundStyle(.white.opacity(0.6))
    }
  }
}

private extension NowPlayingActivityState {
  static var previewPlaying: NowPlayingActivityState {
    NowPlayingActivityState(
      surahId: 18, surahName: "Al-Kahf", reciterName: "Mishary Alafasy",
      artworkFile: "surah-18.jpg", isPlaying: true, positionSec: 120, durationSec: 1800,
      rate: 1, anchorAt: Date.now.timeIntervalSince1970 * 1000, ayah: nil)
  }

  static var previewPaused: NowPlayingActivityState {
    NowPlayingActivityState(
      surahId: 36, surahName: "Ya-Sin", reciterName: "Mishary Alafasy",
      artworkFile: nil, isPlaying: false, positionSec: 600, durationSec: 1500,
      rate: 1, anchorAt: Date.now.timeIntervalSince1970 * 1000, ayah: nil)
  }

  static var previewAyah: NowPlayingActivityState {
    NowPlayingActivityState(
      surahId: 18, surahName: "Al-Kahf", reciterName: "Mishary Alafasy",
      artworkFile: "surah-18.jpg", isPlaying: true, positionSec: 120, durationSec: 1800,
      rate: 1, anchorAt: Date.now.timeIntervalSince1970 * 1000,
      ayah: NowPlayingAyah(number: 10, count: 110, text: "إِذۡ أَوَى ٱلۡفِتۡيَةُ إِلَى ٱلۡكَهۡفِ"))
  }
}

#Preview("Lock Screen", as: .content, using: NowPlayingAttributes()) {
  NowPlayingLiveActivity()
} contentStates: {
  NowPlayingActivityState.previewPlaying
  NowPlayingActivityState.previewPaused
  NowPlayingActivityState.previewAyah
}

#Preview("Expanded", as: .dynamicIsland(.expanded), using: NowPlayingAttributes()) {
  NowPlayingLiveActivity()
} contentStates: {
  NowPlayingActivityState.previewPlaying
  NowPlayingActivityState.previewAyah
}

#Preview("Compact", as: .dynamicIsland(.compact), using: NowPlayingAttributes()) {
  NowPlayingLiveActivity()
} contentStates: {
  NowPlayingActivityState.previewPlaying
  NowPlayingActivityState.previewPaused
}

#Preview("Minimal", as: .dynamicIsland(.minimal), using: NowPlayingAttributes()) {
  NowPlayingLiveActivity()
} contentStates: {
  NowPlayingActivityState.previewPlaying
}
