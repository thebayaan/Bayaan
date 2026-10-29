// targets/widgets/ContinueListening/ContinueListeningViews.swift
import AppIntents
import SwiftUI
import WidgetKit

private let deepLinkPlayer = AppLinks.url("player")!


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
          // @ai-start
          MediumView(track: track, playback: entry.playback, date: entry.date,
                     next: sideList(limit: 1).first, nextTitle: sideTitle)
          // @ai-end
        default:
          LargeView(track: track, playback: entry.playback, date: entry.date, rows: sideList(limit: 4), // @ai
                    rowsTitle: sideTitle)
        }
      } else {
        EmptyStateView()
      }
    }
    // @ai-start
    // Tinted by the surah, so each recitation has its own color.
    .containerBackground(for: .widget) { SurahTint.deep(current?.surahId ?? 0) }
    // @ai-end
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

// @ai-start
/// "Now playing", "Paused" or, with nothing loaded, "Continue listening".
private func eyebrow(_ playback: EffectivePlayback?) -> String {
  guard let playback else { return "Continue listening" }
  return playback.isPlaying ? "Now playing" : "Paused"
}

// @ai-end
struct Artwork: View {
  let file: String?
  var surahId: Int = 0 // @ai
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
        GeneratedSurahTile(surah: StaticData.surah(surahId), size: size) // @ai
      }
    }
    .aspectRatio(1, contentMode: .fill)
    .frame(width: size, height: size)
    .clipShape(RoundedRectangle(cornerRadius: size * 0.16, style: .continuous))
    .overlay { TileKeyline(cornerRadius: size * 0.16) } // @ai
  }
}

// @ai-start
/// Artwork that fills the whole small widget; the generated tile puts the
/// surah glyph in the top corner so the titles below stay clear.
struct ArtworkFill: View {
  let track: WidgetTrack
  /// Moves cached art up so its printed title clears the controls below.
  var lift: CGFloat = 0

  // Overlays on a flexible base, so neither the art nor the starburst can
  // size the widget wider than its frame.
  var body: some View {
    if let image = SnapshotStore.artwork(track.artworkFile) {
      SurahTint.deep(track.surahId)
        .overlay { CachedImage(image: image).aspectRatio(contentMode: .fill).offset(y: -lift) }
        .clipped()
    } else {
      SurahTint.base(track.surahId)
        .overlay(alignment: .topTrailing) {
          BayaanMark().fill(.white.opacity(0.14))
            .frame(width: 210, height: 175)
            .offset(x: 54, y: -26)
        }
        .overlay(alignment: .topTrailing) {
          if let surah = StaticData.surah(track.surahId), !surah.glyph.isEmpty {
            Text(surah.glyph).font(WidgetFonts.surahGlyph(40)).foregroundStyle(.white).padding(14)
          }
        }
        .clipped()
    }
  }
}

// @ai-end
/// Primary play/pause button. With nothing loaded (the hero is a recent item or
/// the surah of the day), it starts that track.
struct PlayButton: View {
  let track: WidgetTrack
  let playback: EffectivePlayback?
  var size: CGFloat = 44 // @ai

  var body: some View {
    if let playback {
      Button(intent: SetPlaybackIntent(playing: !playback.isPlaying)) {
        PrimaryGlyph(systemName: playback.isPlaying ? "pause.fill" : "play.fill", size: size) // @ai
      }
      .buttonStyle(.plain)
      .accessibilityLabel(playback.isPlaying ? "Pause" : "Play")
    } else if !track.isUserUpload && track.surahId != 0 {
      Button(intent: PlayTrackIntent(surahId: track.surahId, reciterId: track.reciterId,
                                     rewayatId: track.rewayatId)) {
        PrimaryGlyph(systemName: "play.fill", size: size) // @ai
      }
      .buttonStyle(.plain)
      .accessibilityLabel("Play")
    }
  }
} // @ai

// @ai-start
/// Play button inside a progress ring (small widget). The ring animates from
/// the snapshot while playing, like PlaybackProgress.
struct PlayRingButton: View {
  let track: WidgetTrack
  let playback: EffectivePlayback?

  var body: some View {
    ZStack {
      if let p = playback, p.durationSec > 0 {
        Circle().stroke(.white.opacity(0.28), lineWidth: 3)
        if p.isPlaying {
          ProgressView(timerInterval: p.trackStart...p.end, countsDown: false) {
            EmptyView()
          } currentValueLabel: {
            EmptyView()
          }
          .progressViewStyle(.circular)
          .tint(.white)
        } else {
          Circle()
            .trim(from: 0, to: p.positionSec / p.durationSec)
            .stroke(.white, style: StrokeStyle(lineWidth: 3, lineCap: .round))
            .rotationEffect(.degrees(-90))
        }
      }
      PlayButton(track: track, playback: playback, size: 36)
    }
    .frame(width: 46, height: 46)
// @ai-end
  }
}

// @ai-start
/// Thin bar on a faint track, visible even at 0%. Animates from the snapshot
/// while playing, so no timeline reloads are needed.
// @ai-end
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
      .background(Capsule().fill(.white.opacity(0.2))) // @ai
      .clipShape(Capsule())
    }
  }
}

// @ai-start
/// Remaining time under the bar: a live countdown while playing.
struct TimeLeft: View {
  let playback: EffectivePlayback?
  let date: Date

  var body: some View {
    if let p = playback, p.durationSec > 0 {
      Group {
        if p.isPlaying {
          // A timer Text takes all offered width, so it needs a fixed frame.
          Text(timerInterval: date...p.end, countsDown: true)
            .multilineTextAlignment(.trailing)
            .frame(width: 60, alignment: .trailing)
        } else {
          Text(WidgetLogic.minutesLeftLabel(p.remainingWallSec)).lineLimit(1).fixedSize()
        }
      }
      .font(.caption2.weight(.semibold).monospacedDigit())
      .foregroundStyle(WidgetPalette.secondary)
      .frame(maxWidth: .infinity, alignment: .trailing)
    }
  }
}

// @ai-end
struct SmallView: View {
  let track: WidgetTrack
  let playback: EffectivePlayback?

  var body: some View {
    // @ai-start
    // A cached card already prints the surah name, so only the reciter is added.
    let cardNamed = SurahCard.showsName(file: track.artworkFile, surahId: track.surahId)
    ZStack(alignment: .bottom) {
      ArtworkFill(track: track, lift: cardNamed ? 22 : 0)
      LinearGradient(stops: [.init(color: SurahTint.deep(track.surahId).opacity(0), location: cardNamed ? 0.66 : 0.5),
                             .init(color: SurahTint.deep(track.surahId).opacity(0.95), location: cardNamed ? 0.84 : 1)],
                     startPoint: .top, endPoint: .bottom)
      HStack(alignment: .bottom, spacing: 8) {
        VStack(alignment: .leading, spacing: 1) {
          if !cardNamed {
            Text(track.surahName).font(.system(size: 16, weight: .heavy)).lineLimit(1)
          }
          FittingName(name: track.reciterName).font(.caption.weight(.medium)).foregroundStyle(WidgetPalette.secondary)
        }
    // @ai-end
        Spacer(minLength: 0)
        PlayRingButton(track: track, playback: playback) // @ai
      }
      .padding(12) // @ai
    }
    .foregroundStyle(.white)
  }
}

struct MediumView: View {
  let track: WidgetTrack
  let playback: EffectivePlayback?
  // @ai-start
  let date: Date
  let next: WidgetTrack?
  let nextTitle: String
  // @ai-end

  var body: some View {
    HStack(spacing: 14) {
      // @ai-start
      Artwork(file: track.artworkFile, surahId: track.surahId, size: 138)
      VStack(alignment: .leading, spacing: 0) {
        Eyebrow(text: eyebrow(playback))
        Text(track.surahName).font(.system(size: 20, weight: .heavy)).lineLimit(1).padding(.top, 3)
        Text(track.reciterName).font(.footnote.weight(.medium)).foregroundStyle(WidgetPalette.secondary)
          .lineLimit(1)
        Spacer(minLength: 0)
        HStack(spacing: 10) {
      // @ai-end
          PlayButton(track: track, playback: playback)
          // @ai-start
          if let next {
            VStack(alignment: .leading, spacing: 1) {
              Text(nextTitle).font(.caption2.weight(.semibold)).foregroundStyle(WidgetPalette.secondary)
              Text(next.surahName).font(.caption.weight(.bold)).lineLimit(1)
            }
          }
          Spacer(minLength: 0)
        }
        if playback != nil {
          PlaybackProgress(playback: playback).padding(.top, 8)
          TimeLeft(playback: playback, date: date).padding(.top, 3)
          // @ai-end
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
    .foregroundStyle(.white)
    .padding(16) // @ai
  }
}

struct LargeView: View {
  let track: WidgetTrack
  let playback: EffectivePlayback?
  let date: Date // @ai
  let rows: [WidgetTrack]
  let rowsTitle: String

  var body: some View {
    // @ai-start
    VStack(alignment: .leading, spacing: 0) {
      HStack(spacing: 14) {
        Artwork(file: track.artworkFile, surahId: track.surahId, size: 96)
        VStack(alignment: .leading, spacing: 0) {
          Eyebrow(text: eyebrow(playback))
          Text(track.surahName).font(.system(size: 22, weight: .heavy)).lineLimit(1).padding(.top, 2)
          Text(track.reciterName).font(.footnote.weight(.medium)).foregroundStyle(WidgetPalette.secondary)
            .lineLimit(1)
          Spacer(minLength: 0)
          PlayButton(track: track, playback: playback)
    // @ai-end
        }
        Spacer(minLength: 0)
      }
      // @ai-start
      .frame(height: 96)
      if playback != nil {
        PlaybackProgress(playback: playback).padding(.top, 16)
        TimeLeft(playback: playback, date: date).padding(.top, 4)
      // @ai-end
      }
      if !rows.isEmpty {
        // @ai-start
        Rectangle().fill(.white.opacity(0.14)).frame(height: 1).padding(.top, 12)
        Eyebrow(text: rowsTitle).padding(.top, 12)
        VStack(alignment: .leading, spacing: 6) {
          ForEach(rows, id: \.self) { t in TrackRow(track: t, artSize: 40) }
        }
        .padding(.top, 8)
        // @ai-end
      }
      Spacer(minLength: 0)
    }
    .foregroundStyle(.white)
    .padding(18) // @ai
  }
}

struct TrackRow: View {
  let track: WidgetTrack
  let artSize: CGFloat

  var body: some View {
    Button(intent: PlayTrackIntent(surahId: track.surahId, reciterId: track.reciterId,
                                   rewayatId: track.rewayatId)) {
      // @ai-start
      HStack(spacing: 10) {
        Artwork(file: track.artworkFile, surahId: track.surahId, size: artSize)
      // @ai-end
        VStack(alignment: .leading, spacing: 1) {
          // @ai-start
          Text(track.surahName).font(.subheadline.weight(.bold)).lineLimit(1)
          Text(track.reciterName).font(.caption.weight(.medium)).foregroundStyle(WidgetPalette.secondary)
            .lineLimit(1)
          // @ai-end
        }
        // @ai-start
        Spacer(minLength: 0)
        Image(systemName: "play.fill").font(.system(size: 13, weight: .bold)).opacity(0.8)
        // @ai-end
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
      Text("Start listening").font(.caption.weight(.bold)) // @ai
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
