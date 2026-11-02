// targets/widgets/Adhkar/AdhkarSessionView.swift
import AppIntents
import SwiftUI
import WidgetKit

/// Medium and large Adhkar: card through the session (spec 2026-10-12).
/// Buttons run intents; any other tap opens the adhkar screen at the current dhikr.
// @ai-start
/// Medium puts the "read the rest" hint in the controls row so the dhikr gets two lines.
/// Tinted by the time of day (AdhkarStyle).
// @ai-end
struct AdhkarSessionView: View {
  @Environment(\.widgetFamily) private var family
  let data: AdhkarPeriodData
  let session: AdhkarSession

  private var large: Bool { family == .systemLarge }
  private var style: AdhkarStyle { .forPeriod(data.period) } // @ai
  private var item: SessionDhikr? { data.items.indices.contains(session.index) ? data.items[session.index] : nil }

  var body: some View {
    VStack(alignment: .leading, spacing: large ? 10 : 6) {
      header
      if session.completed { completed } else if let item { card(item) }
    }
    // @ai-start
    .foregroundStyle(style.primary)
    .padding(.horizontal, 16)
    .padding(.vertical, large ? 16 : 14)
    // @ai-end
    .widgetURL(AppLinks.url(AdhkarSessionLogic.link(superId: data.superId, session: session, ids: data.items.map(\.id))))
  }

  private var header: some View {
    VStack(alignment: .leading, spacing: 8) { // @ai
      HStack(alignment: .firstTextBaseline, spacing: 8) {
        // @ai-start
        Image(systemName: style.symbol).font(.system(size: 14, weight: .bold)).foregroundStyle(style.accent)
        Text(data.title).font(.subheadline.weight(.heavy)).lineLimit(1)
        // @ai-end
        Spacer(minLength: 0)
        if !session.completed {
          // @ai-start
          Text("\(session.index + 1) of \(data.items.count)").font(.caption.weight(.bold))
            .foregroundStyle(style.secondary)
          // @ai-end
        }
      }
      // @ai-start
      // One segment per dhikr, filled up to the current one.
      HStack(spacing: 2) {
        ForEach(0..<data.items.count, id: \.self) { i in
          Capsule()
            .fill(session.completed || i < session.index ? style.accent : style.track)
            .frame(height: 4)
        }
      // @ai-end
      }
    }
  }

  @ViewBuilder
  private func card(_ item: SessionDhikr) -> some View {
    if large { largeCard(item) } else { mediumCard(item) }
  }

  private func mediumCard(_ item: SessionDhikr) -> some View {
    VStack(spacing: 6) {
      DhikrText(text: item.mediumText, size: 18, lines: 2).frame(maxWidth: .infinity, maxHeight: .infinity)
      controls(item, hint: item.mediumCut)
    }
  }

  private func largeCard(_ item: SessionDhikr) -> some View {
    VStack(alignment: .leading, spacing: 6) {
      Spacer(minLength: 0)
      DhikrText(text: item.largeText, size: 22, lines: 9).frame(maxWidth: .infinity)
      if let t = item.translation {
        Text(t).font(.caption).foregroundStyle(style.secondary).lineLimit(3) // @ai
      }
      if item.largeCut {
        Text("Read the rest in \(AppBrand.name) \u{2192}").font(.caption2.weight(.semibold)).foregroundStyle(style.secondary) // @ai
      }
      Spacer(minLength: 0)
      controls(item, hint: false)
    }
  }

  private func controls(_ item: SessionDhikr, hint: Bool) -> some View {
    HStack(spacing: 8) { // @ai
      if session.index > 0 {
        // @ai-start
        Button(intent: AdhkarPrevIntent()) { roundGlyph("chevron.left") }
          .buttonStyle(.plain)
          .accessibilityLabel("Previous")
        // @ai-end
      }
      // @ai-start
      // Plays the period's adhkar audio from this dhikr, even with the app closed; pauses while it plays.
      PlayOrPauseButton(playing: AdhkarPlaybackState.isPlaying(superId: data.superId, snapshot: SnapshotStore.load()),
                        play: PlayAdhkarIntent(superId: data.superId, dhikrId: item.id),
                        pause: SetAdhkarPlaybackIntent(playing: false), label: "Listen") { roundGlyph($0 ? "pause.fill" : "play.fill") }
      // @ai-end
      Button(intent: AdhkarCountIntent()) {
        // @ai-start
        HStack(spacing: 6) {
          AdhkarCounterRing(remaining: session.remaining, total: item.repeatCount, size: 22,
                            color: style.onAccent, track: style.onAccent.opacity(0.3))
          Text(item.repeatCount > 1 ? "Count" : "Done").font(.footnote.weight(.heavy))
        }
        .foregroundStyle(style.onAccent)
        .padding(.leading, 6)
        .padding(.trailing, 14)
        .frame(height: 34)
        .background(style.accent, in: Capsule())
        // @ai-end
      }
      .buttonStyle(.plain)
      .accessibilityLabel(item.repeatCount > 1 ? "Count, \(session.remaining) left" : "Said once, next")
      // @ai-start
      if hint {
        Text("Read the rest in \(AppBrand.name) \u{2192}").font(.caption2.weight(.semibold))
          .foregroundStyle(style.secondary).lineLimit(1).minimumScaleFactor(0.8)
      }
      Spacer(minLength: 0)
      Button(intent: AdhkarNextIntent()) { roundGlyph("chevron.right") }
        .buttonStyle(.plain)
        .accessibilityLabel("Next")
      // @ai-end
    }
  }

  // @ai-start
  private func roundGlyph(_ systemName: String) -> some View {
    Image(systemName: systemName)
      .font(.system(size: 13, weight: .bold))
      .foregroundStyle(style.primary)
      .frame(width: 34, height: 34)
      .overlay(Circle().stroke(style.track, lineWidth: 1))
  }

  // @ai-end
  private var completed: some View {
    VStack(spacing: 8) {
      Spacer(minLength: 0)
      // @ai-start
      Image(systemName: "checkmark.circle.fill").font(.system(size: large ? 40 : 28)).foregroundStyle(style.accent)
      Text("\(data.title) completed").font(.subheadline.weight(.bold))
      // @ai-end
      Button(intent: AdhkarRestartIntent()) {
        Text("Start again").font(.caption.weight(.bold)).padding(.horizontal, 12).padding(.vertical, 6)
          .overlay(Capsule().stroke(style.track, lineWidth: 1)) // @ai
      }
      .buttonStyle(.plain)
      Spacer(minLength: 0)
    }
    .frame(maxWidth: .infinity)
  }
}

// @ai-start
/// Morning adhkar sit on dawn paper, evening adhkar on dusk ink.
struct AdhkarStyle {
  let background: Color
  let primary: Color
  let secondary: Color
  let accent: Color
  let onAccent: Color
  let track: Color
  let symbol: String

  static func forPeriod(_ period: String) -> AdhkarStyle {
    period == "morning"
      ? AdhkarStyle(background: Color(hex: 0xF6EBD6), primary: Color(hex: 0x2A1D0C),
                    secondary: Color(hex: 0x5C4630), accent: Color(hex: 0xB4532A), onAccent: .white,
                    track: Color(hex: 0xD9C6A2), symbol: "sun.max.fill")
      : AdhkarStyle(background: Color(hex: 0x141A36), primary: Color(hex: 0xEEF0FF),
                    secondary: Color(hex: 0xEEF0FF).opacity(0.8), accent: Color(hex: 0xC4B5FF),
                    onAccent: Color(hex: 0x141A36), track: Color(hex: 0xEEF0FF).opacity(0.22),
                    symbol: "moon.fill")
  }
}

// @ai-end
/// Small repetition ring: fills as you count, a check for a dhikr said once.
struct AdhkarCounterRing: View {
  let remaining: Int
  let total: Int
  let size: CGFloat
  // @ai-start
  var color: Color = .white
  var track: Color = .white.opacity(0.2)
  // @ai-end

  var body: some View {
    ZStack {
      Circle().stroke(track, lineWidth: 2.5) // @ai
      Circle().trim(from: 0, to: total > 1 ? CGFloat(total - remaining) / CGFloat(total) : 0)
        .stroke(color, style: StrokeStyle(lineWidth: 2.5, lineCap: .round)).rotationEffect(.degrees(-90)) // @ai
      if total > 1 {
        Text("\(remaining)").font(.system(size: size * 0.45, weight: .bold, design: .rounded)).minimumScaleFactor(0.5) // @ai
      } else {
        Image(systemName: "checkmark").font(.system(size: size * 0.42, weight: .bold)) // @ai
      }
    }
    .foregroundStyle(color) // @ai
    .frame(width: size, height: size)
  }
}
