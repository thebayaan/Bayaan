// targets/widgets/Adhkar/AdhkarSessionView.swift
import AppIntents
import SwiftUI
import WidgetKit

/// Medium and large Adhkar: card through the session (spec 2026-10-12).
/// Buttons run intents; any other tap opens the adhkar screen at the current dhikr.
/// Medium has no progress bar and puts the "read the rest" hint in the controls row so the dhikr gets two lines.
struct AdhkarSessionView: View {
  @Environment(\.widgetFamily) private var family
  let data: AdhkarPeriodData
  let session: AdhkarSession

  private var large: Bool { family == .systemLarge }
  private var item: SessionDhikr? { data.items.indices.contains(session.index) ? data.items[session.index] : nil }

  var body: some View {
    VStack(alignment: .leading, spacing: large ? 10 : 6) {
      header
      if session.completed { completed } else if let item { card(item) }
    }
    .padding(large ? 16 : 12)
    .widgetURL(AppLinks.url(AdhkarSessionLogic.link(superId: data.superId, session: session, ids: data.items.map(\.id))))
  }

  private var header: some View {
    VStack(alignment: .leading, spacing: 6) {
      HStack(alignment: .firstTextBaseline, spacing: 8) {
        Text(data.title).font(.subheadline.weight(.bold)).lineLimit(1)
        Spacer(minLength: 0)
        if !session.completed {
          Text("\(session.index + 1) of \(data.items.count)").font(.caption2.weight(.semibold)).opacity(0.6)
        }
        BayaanLogo(size: 14)
      }
      if large {
        ProgressView(value: Double(session.completed ? data.items.count : session.index), total: Double(max(1, data.items.count)))
          .tint(.white)
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
        Text(t).font(.caption).opacity(0.75).lineLimit(3)
      }
      if item.largeCut {
        Text("Read the rest in \(AppBrand.name) \u{2192}").font(.caption2.weight(.semibold)).opacity(0.7)
      }
      Spacer(minLength: 0)
      controls(item, hint: false)
    }
  }

  private func controls(_ item: SessionDhikr, hint: Bool) -> some View {
    HStack(spacing: 12) {
      if session.index > 0 {
        RoundIntentButton(intent: AdhkarPrevIntent(), systemName: "chevron.left", label: "Previous")
      }
      RoundIntentButton( // @ai
        intent: PlayAdhkarIntent(superId: data.superId, dhikrId: item.id), systemName: "play.fill", label: "Listen") // @ai
      if hint {
        Text("Read the rest in \(AppBrand.name) \u{2192}").font(.caption2.weight(.semibold)).opacity(0.7)
          .lineLimit(1).minimumScaleFactor(0.8)
      }
      Spacer(minLength: 0)
      Button(intent: AdhkarCountIntent()) {
        AdhkarCounterRing(remaining: session.remaining, total: item.repeatCount, size: 34)
      }
      .buttonStyle(.plain)
      .accessibilityLabel(item.repeatCount > 1 ? "Count, \(session.remaining) left" : "Said once, next")
      RoundIntentButton(intent: AdhkarNextIntent(), systemName: "chevron.right", label: "Next")
    }
  }

  private var completed: some View {
    VStack(spacing: 8) {
      Spacer(minLength: 0)
      Image(systemName: "checkmark.circle.fill").font(.system(size: large ? 40 : 28))
      Text("\(data.title) completed").font(.subheadline.weight(.semibold))
      Button(intent: AdhkarRestartIntent()) {
        Text("Start again").font(.caption.weight(.bold)).padding(.horizontal, 12).padding(.vertical, 6)
          .background(WidgetPalette.tile, in: Capsule())
      }
      .buttonStyle(.plain)
      Spacer(minLength: 0)
    }
    .frame(maxWidth: .infinity)
  }
}

/// Small repetition ring: fills as you count, a check for a dhikr said once.
struct AdhkarCounterRing: View {
  let remaining: Int
  let total: Int
  let size: CGFloat

  var body: some View {
    ZStack {
      Circle().stroke(.white.opacity(0.2), lineWidth: 3)
      Circle().trim(from: 0, to: total > 1 ? CGFloat(total - remaining) / CGFloat(total) : 0)
        .stroke(.white, style: StrokeStyle(lineWidth: 3, lineCap: .round)).rotationEffect(.degrees(-90))
      if total > 1 {
        Text("\(remaining)").font(.system(size: size * 0.38, weight: .bold, design: .rounded)).minimumScaleFactor(0.5)
      } else {
        Image(systemName: "checkmark").font(.system(size: size * 0.38, weight: .bold))
      }
    }
    .frame(width: size, height: size)
  }
}
