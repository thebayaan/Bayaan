// targets/widgets/ContinueListening/ContinueListeningViews.swift
import AppIntents
import SwiftUI
import WidgetKit

private let deepLinkPlayer = AppLinks.url("player")!

// Fixed near-black in both appearances, like Podcasts and Spotify, so the
// artwork is the only color and white text always has contrast.
private let widgetBackground = Color(red: 0x1C / 255, green: 0x1C / 255, blue: 0x1E / 255)

/// Playback as the widget should render it at `now`: prefers a tap override
/// newer than the snapshot and younger than the TTL, and treats playback as stopped past the end
/// (anchor + remaining / rate). Mirrors PlaybackState.kt on Android.
struct EffectivePlayback {
  let isPlaying: Bool
  let positionSec: Double
  let durationSec: Double
  let rate: Double
  let end: Date

  /// Virtual start time such that start...end spans the whole track at rate.
  var trackStart: Date { end.addingTimeInterval(-durationSec / rate) }
  var remainingWallSec: Double { max(0, (durationSec - positionSec) / rate) }

  init(nowPlaying np: WidgetNowPlaying, generatedAt: Double, override: PlaybackOverride?, now: Date) {
    let rate = np.rate > 0 && np.rate.isFinite ? np.rate : 1
    let duration = max(0, np.durationSec)
    func clamp(_ v: Double) -> Double { min(max(v, 0), duration) }
    func positionAt(_ ms: Double) -> Double {
      np.isPlaying ? clamp(np.positionSec + (ms - generatedAt) / 1000 * rate) : clamp(np.positionSec)
    }
    let nowMs = now.timeIntervalSince1970 * 1000
    let applied = override.flatMap {
      $0.at > generatedAt && nowMs - $0.at <= PlaybackOverrideStore.ttlMs ? $0 : nil
    }
    let playing = applied?.isPlaying ?? np.isPlaying
    let anchorMs = applied?.at ?? generatedAt
    let anchorPos = applied.map { positionAt($0.at) } ?? clamp(np.positionSec)
    let end = Date(timeIntervalSince1970: anchorMs / 1000 + (duration - anchorPos) / rate)
    let ended = playing && now >= end
    self.isPlaying = playing && !ended
    self.positionSec = ended ? duration
      : playing ? clamp(anchorPos + max(0, nowMs - anchorMs) / 1000 * rate) : anchorPos
    self.durationSec = duration
    self.rate = rate
    self.end = end
  }
}

struct ContinueListeningView: View {
  @Environment(\.widgetFamily) private var family
  let entry: ContinueListeningEntry

  private var current: WidgetTrack? {
    entry.snapshot?.nowPlaying?.track ?? entry.snapshot?.recent.first ?? entry.snapshot?.upNext.first
  }

  var body: some View {
    Group {
      if let track = current {
        switch family {
        case .systemSmall:
          SmallView(track: track, playback: entry.playback)
        case .systemMedium:
          MediumView(track: track, playback: entry.playback, side: sideList(limit: 3),
                     sideTitle: sideTitle)
        default:
          LargeView(track: track, playback: entry.playback, rows: sideList(limit: 4),
                    rowsTitle: sideTitle)
        }
      } else {
        EmptyStateView()
      }
    }
    .containerBackground(for: .widget) { widgetBackground }
    .widgetURL(deepLinkPlayer)
  }

  private var sideTitle: String {
    entry.snapshot?.upNext.isEmpty == false ? "Up next" : "Recent"
  }

  private func sideList(limit: Int) -> [WidgetTrack] {
    guard let s = entry.snapshot else { return [] }
    // Drop the side list's first item when it is already the hero.
    let source = s.upNext.isEmpty
      ? Array(s.recent.dropFirst(s.nowPlaying == nil ? 1 : 0))
      : Array(s.upNext.dropFirst(s.nowPlaying == nil && s.recent.isEmpty ? 1 : 0))
    return Array(source.prefix(limit))
  }
}

struct Artwork: View {
  let file: String?
  let size: CGFloat

  var body: some View {
    Group {
      if let image = SnapshotStore.artwork(file) {
        // widgetAccentedRenderingMode is iOS 18+; the extension targets iOS 17.
        if #available(iOS 18.0, *) {
          Image(uiImage: image).resizable().widgetAccentedRenderingMode(.fullColor)
        } else {
          Image(uiImage: image).resizable()
        }
      } else {
        RoundedRectangle(cornerRadius: size * 0.16).fill(.white.opacity(0.15))
      }
    }
    .aspectRatio(1, contentMode: .fill)
    .frame(width: size, height: size)
    .clipShape(RoundedRectangle(cornerRadius: size * 0.16, style: .continuous))
  }
}

/// Round play/pause button. With nothing loaded (the hero is a recent item or
/// the surah of the day), it starts that track.
struct PlayButton: View {
  let track: WidgetTrack
  let playback: EffectivePlayback?

  var body: some View {
    if let playback {
      Button(intent: SetPlaybackIntent(playing: !playback.isPlaying)) {
        glyph(isPlaying: playback.isPlaying)
      }
      .buttonStyle(.plain)
      .accessibilityLabel(playback.isPlaying ? "Pause" : "Play")
    } else if !track.isUserUpload && track.surahId != 0 {
      Button(intent: PlayTrackIntent(surahId: track.surahId, reciterId: track.reciterId,
                                     rewayatId: track.rewayatId)) {
        glyph(isPlaying: false)
      }
      .buttonStyle(.plain)
      .accessibilityLabel("Play")
    }
  }

  private func glyph(isPlaying: Bool) -> some View {
    Image(systemName: isPlaying ? "pause.fill" : "play.fill")
      .font(.system(size: 12, weight: .bold))
      .foregroundStyle(.white)
      .frame(width: 30, height: 30)
      .background(.white.opacity(0.18), in: Circle())
  }
}

/// Spotify-style thin bar on a faint track, visible even at 0%. Animates from
/// the snapshot while playing, so no timeline reloads are needed.
struct PlaybackProgress: View {
  let playback: EffectivePlayback?

  var body: some View {
    if let p = playback, p.durationSec > 0 {
      Group {
        if p.isPlaying {
          ProgressView(timerInterval: p.trackStart...p.end, countsDown: false) {
            EmptyView()
          } currentValueLabel: {
            EmptyView()
          }
        } else {
          ProgressView(value: p.positionSec, total: p.durationSec)
        }
      }
      .progressViewStyle(.linear)
      .tint(.white)
      // The timer variant lays out taller than the value one; pin both to a
      // thin bar so they match.
      .frame(height: 4)
      .background(Capsule().fill(.white.opacity(0.22)))
      .clipShape(Capsule())
    }
  }
}

struct SmallView: View {
  let track: WidgetTrack
  let playback: EffectivePlayback?

  var body: some View {
    // Fits the 120 pt content height of the smallest phones.
    VStack(alignment: .leading, spacing: 3) {
      HStack(alignment: .top) {
        Artwork(file: track.artworkFile, size: 44)
        Spacer(minLength: 0)
        BayaanLogo(size: 14)
      }
      Spacer(minLength: 0)
      Text(track.surahName).font(.headline).lineLimit(1)
      Text(track.reciterName).font(.caption).opacity(0.75).lineLimit(1)
      HStack(spacing: 8) {
        PlayButton(track: track, playback: playback)
        PlaybackProgress(playback: playback)
      }
    }
    .foregroundStyle(.white)
    .padding(14)
  }
}

struct MediumView: View {
  let track: WidgetTrack
  let playback: EffectivePlayback?
  let side: [WidgetTrack]
  let sideTitle: String

  var body: some View {
    HStack(spacing: 14) {
      // Fits the 130 pt content height: art and button share the top row.
      VStack(alignment: .leading, spacing: 4) {
        HStack(alignment: .bottom, spacing: 6) {
          Artwork(file: track.artworkFile, size: 52)
          Spacer(minLength: 0)
          PlayButton(track: track, playback: playback)
        }
        Spacer(minLength: 0)
        Text(track.surahName).font(.headline).lineLimit(1)
        Text(track.reciterName).font(.caption).opacity(0.75).lineLimit(1)
        PlaybackProgress(playback: playback).padding(.top, 2)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      VStack(alignment: .leading, spacing: 6) {
        ListHeader(title: side.isEmpty ? nil : sideTitle)
        ForEach(side, id: \.self) { t in TrackRow(track: t, artSize: 28) }
        Spacer(minLength: 0)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
    .foregroundStyle(.white)
    .padding(14)
  }
}

struct LargeView: View {
  let track: WidgetTrack
  let playback: EffectivePlayback?
  let rows: [WidgetTrack]
  let rowsTitle: String

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      HStack(alignment: .top, spacing: 12) {
        Artwork(file: track.artworkFile, size: 76)
        VStack(alignment: .leading, spacing: 4) {
          Text(track.surahName).font(.title3.bold()).lineLimit(1)
          Text(track.reciterName).font(.subheadline).opacity(0.75).lineLimit(1)
        }
        .padding(.top, 6)
        Spacer(minLength: 0)
        BayaanLogo(size: 16)
      }
      HStack(spacing: 12) {
        PlayButton(track: track, playback: playback)
        PlaybackProgress(playback: playback)
      }
      Divider().overlay(.white.opacity(0.2))
      if !rows.isEmpty {
        Text(rowsTitle).font(.caption2.weight(.semibold)).opacity(0.6)
      }
      ForEach(rows, id: \.self) { t in TrackRow(track: t, artSize: 32) }
      Spacer(minLength: 0)
    }
    .foregroundStyle(.white)
    .padding(16)
  }
}

/// Side list title with the logo in the widget's top-right corner.
struct ListHeader: View {
  let title: String?
  var body: some View {
    HStack {
      if let title { Text(title).font(.caption2.weight(.semibold)).opacity(0.6) }
      Spacer(minLength: 0)
      BayaanLogo(size: 14)
    }
  }
}

struct TrackRow: View {
  let track: WidgetTrack
  let artSize: CGFloat

  var body: some View {
    Button(intent: PlayTrackIntent(surahId: track.surahId, reciterId: track.reciterId,
                                   rewayatId: track.rewayatId)) {
      HStack(spacing: 8) {
        Artwork(file: track.artworkFile, size: artSize)
        VStack(alignment: .leading, spacing: 1) {
          Text(track.surahName).font(.caption.weight(.semibold)).lineLimit(1)
          Text(track.reciterName).font(.caption2).opacity(0.7).lineLimit(1)
        }
      }
    }
    .buttonStyle(.plain)
    .disabled(track.isUserUpload || track.surahId == 0)
  }
}

struct EmptyStateView: View {
  var body: some View {
    VStack(spacing: 8) {
      BayaanLogo(size: 24)
      Text("Start listening").font(.caption.weight(.semibold))
    }
    .foregroundStyle(.white)
  }
}

// MARK: - Previews

// Inline copy of modules/bayaan-widgets/src/__fixtures__/snapshot.full.json.
private let previewFullSnapshotJSON = #"""
{
  "version": 1,
  "generatedAt": 1791460800000,
  "theme": "dark",
  "nowPlaying": {
    "track": {
      "surahId": 18,
      "surahName": "Al-Kahf",
      "reciterId": "r-alafasi",
      "reciterName": "Mishary Alafasi",
      "rewayatId": "rw-1",
      "artworkFile": "reciter-r-alafasi.jpg",
      "isUserUpload": false
    },
    "isPlaying": true,
    "positionSec": 120.5,
    "durationSec": 1800,
    "rate": 1
  },
  "upNext": [
    {
      "surahId": 36,
      "surahName": "Ya-Sin",
      "reciterId": "r-alafasi",
      "reciterName": "Mishary Alafasi",
      "rewayatId": "rw-1",
      "artworkFile": "reciter-r-alafasi.jpg",
      "isUserUpload": false
    }
  ],
  "recent": [],
  "defaultReciter": {
    "id": "r-alafasi",
    "name": "Mishary Alafasi",
    "artworkFile": "reciter-r-alafasi.jpg"
  },
  "reciterRecents": {},
  "lastRead": {
    "page": 293,
    "surahId": 18,
    "surahName": "Al-Kahf",
    "juz": 15,
    "openingText": "ٱلْحَمْدُ لِلَّهِ"
  },
  "tasbeeh": {
    "tasbeeh-subhanallah": {"count": 12, "target": 33, "day": "2026-10-08"}
  }
}
"""#

private let previewPlaying = WidgetSnapshot.decode(Data(previewFullSnapshotJSON.utf8))

#Preview("Small", as: .systemSmall) {
  ContinueListeningWidget()
} timeline: {
  ContinueListeningEntry(date: .now, snapshot: previewPlaying)
  ContinueListeningEntry(date: .now, snapshot: nil)
}

#Preview("Medium", as: .systemMedium) {
  ContinueListeningWidget()
} timeline: {
  ContinueListeningEntry(date: .now, snapshot: previewPlaying)
  ContinueListeningEntry(date: .now, snapshot: nil)
}

#Preview("Large", as: .systemLarge) {
  ContinueListeningWidget()
} timeline: {
  ContinueListeningEntry(date: .now, snapshot: previewPlaying)
  ContinueListeningEntry(date: .now, snapshot: nil)
}
