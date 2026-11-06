// targets/widgets/LockScreen/ListeningAccessoryWidget.swift
import SwiftUI
import WidgetKit

/// Lock Screen listening accessories. Reuses Continue Listening's provider,
/// so it follows the same snapshot, override and track-end entries.
struct ListeningAccessoryWidget: Widget {
  let kind = "ListeningAccessory"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: ContinueListeningProvider()) { entry in
      ListeningAccessoryView(entry: entry)
    }
    .configurationDisplayName("Now Listening")
    .description("Your recitation on the Lock Screen.")
    .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline])
  }
}

struct ListeningAccessoryView: View {
  @Environment(\.widgetFamily) private var family
  let entry: ContinueListeningEntry

  private var track: WidgetTrack? {
    entry.snapshot?.nowPlaying?.track ?? entry.snapshot?.recent.first
  }

  var body: some View {
    content
      .containerBackground(for: .widget) {
        if family == .accessoryCircular { AccessoryWidgetBackground() } else { Color.clear }
      }
      .widgetURL(AppLinks.url("player"))
  }

  @ViewBuilder private var content: some View {
    switch family {
    case .accessoryCircular: circular
    case .accessoryRectangular: rectangular
    default: inline
    }
  }

  @ViewBuilder private func glyph(_ track: WidgetTrack) -> some View {
    if let surah = StaticData.surah(track.surahId), !track.isUserUpload {
      Text(surah.glyph).font(WidgetFonts.surahGlyph(22)).minimumScaleFactor(0.5)
    } else {
      Image(systemName: "waveform")
    }
  }

  @ViewBuilder private var circular: some View {
    if let track, let p = entry.playback, p.durationSec > 0 {
      if p.isPlaying {
        ProgressView(timerInterval: p.trackStart...p.end, countsDown: false) {
          EmptyView()
        } currentValueLabel: {
          glyph(track)
        }
        .progressViewStyle(.circular)
      } else {
        Gauge(value: p.positionSec, in: 0...p.durationSec) {
          EmptyView()
        } currentValueLabel: {
          glyph(track)
        }
        .gaugeStyle(.accessoryCircularCapacity)
      }
    } else if let track {
      glyph(track)
    } else {
      BayaanLogo(size: 18)
    }
  }

  @ViewBuilder private var rectangular: some View {
    if let track {
      VStack(alignment: .leading, spacing: 1) {
        Text(track.surahName).font(.headline).lineLimit(1).widgetAccentable()
        Text(track.reciterName).font(.caption).lineLimit(1)
        if let p = entry.playback {
          timeLeft(p).font(.caption).monospacedDigit()
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    } else {
      VStack(alignment: .leading) {
        Text(AppBrand.name).font(.headline)
        Text("Start listening").font(.caption)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
  }

  @ViewBuilder private var inline: some View {
    if let track, let p = entry.playback {
      if p.isPlaying {
        Text("\(track.surahName) · \(Text(timerInterval: entry.date...p.end, countsDown: true))")
      } else {
        Text("\(track.surahName) · \(WidgetLogic.minutesLeftLabel(p.remainingWallSec))")
      }
    } else if let track {
      Text(track.surahName)
    } else {
      Text(AppBrand.name)
    }
  }

  // Live countdown while playing (static text cannot update without reloads).
  @ViewBuilder private func timeLeft(_ p: EffectivePlayback) -> some View {
    if p.isPlaying {
      Text(timerInterval: entry.date...p.end, countsDown: true)
    } else {
      Text(WidgetLogic.minutesLeftLabel(p.remainingWallSec))
    }
  }
}

// Paused sample: 600 of 1800 seconds into Al-Kahf.
private let accessoryPreviewSnapshot = WidgetSnapshot.decode(Data(#"""
{"version":1,"generatedAt":1791460800000,"theme":"dark","nowPlaying":{"track":{"surahId":18,"surahName":"Al-Kahf","reciterId":"r","reciterName":"Mishary Alafasi","rewayatId":null,"artworkFile":null,"isUserUpload":false},"isPlaying":false,"positionSec":600,"durationSec":1800,"rate":1},"upNext":[],"recent":[],"defaultReciter":null,"reciterRecents":{},"lastRead":null,"tasbeeh":{}}
"""#.utf8))

#Preview("Circular", as: .accessoryCircular) {
  ListeningAccessoryWidget()
} timeline: {
  ContinueListeningEntry(date: .now, snapshot: accessoryPreviewSnapshot)
  ContinueListeningEntry(date: .now, snapshot: nil)
}

#Preview("Rectangular", as: .accessoryRectangular) {
  ListeningAccessoryWidget()
} timeline: {
  ContinueListeningEntry(date: .now, snapshot: accessoryPreviewSnapshot)
  ContinueListeningEntry(date: .now, snapshot: nil)
}

#Preview("Inline", as: .accessoryInline) {
  ListeningAccessoryWidget()
} timeline: {
  ContinueListeningEntry(date: .now, snapshot: accessoryPreviewSnapshot)
}
