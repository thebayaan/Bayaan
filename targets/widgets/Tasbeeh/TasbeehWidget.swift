// targets/widgets/Tasbeeh/TasbeehWidget.swift
import AppIntents
import SwiftUI
import WidgetKit

/// +1 without opening the app: a plain AppIntent runs in the extension.
struct IncrementTasbeehIntent: AppIntent {
  static var title: LocalizedStringResource = "Count Dhikr"
  static var isDiscoverable = false

  @Parameter(title: "Dhikr") var dhikrId: String

  init() {}

  init(dhikrId: String) {
    self.dhikrId = dhikrId
  }

  func perform() async throws -> some IntentResult {
    PendingTasbeehStore.add(dhikrId: dhikrId, reset: false)
    return .result()
  }
}

struct ResetTasbeehIntent: AppIntent {
  static var title: LocalizedStringResource = "Reset Dhikr"
  static var isDiscoverable = false

  @Parameter(title: "Dhikr") var dhikrId: String

  init() {}

  init(dhikrId: String) {
    self.dhikrId = dhikrId
  }

  func perform() async throws -> some IntentResult {
    PendingTasbeehStore.add(dhikrId: dhikrId, reset: true)
    return .result()
  }
}

struct TasbeehConfigIntent: WidgetConfigurationIntent {
  static var title: LocalizedStringResource = "Tasbeeh"
  static var description = IntentDescription("Count a dhikr from the Home Screen.")
  /// سُبْحَانَ اللَّهِ وَبِحَمْدِهِ, 100 times (DEFAULT_TASBEEH_DHIKR_ID in buildCatalog.ts).
  static let defaultDhikrId = "91"

  @Parameter(title: "Dhikr") var dhikr: DhikrEntity?
}

struct TasbeehEntry: TimelineEntry {
  let date: Date
  let dhikr: WidgetCatalogDhikr?
  let count: Int
}

struct TasbeehProvider: AppIntentTimelineProvider {
  func placeholder(in context: Context) -> TasbeehEntry {
    TasbeehEntry(date: .now, dhikr: nil, count: 0)
  }

  func snapshot(for configuration: TasbeehConfigIntent, in context: Context) async -> TasbeehEntry {
    entry(for: configuration, at: .now)
  }

  // A second entry at midnight shows the new day's count (0) without a reload.
  func timeline(for configuration: TasbeehConfigIntent, in context: Context) async -> Timeline<TasbeehEntry> {
    let now = Date.now
    let midnight = WidgetLogic.nextMidnight(after: now)
    return Timeline(entries: [entry(for: configuration, at: now), entry(for: configuration, at: midnight)],
                    policy: .atEnd)
  }

  private func entry(for configuration: TasbeehConfigIntent, at date: Date) -> TasbeehEntry {
    let catalog = CatalogStore.load()
    let dhikr = catalog?.dhikr(configuration.dhikr?.id ?? TasbeehConfigIntent.defaultDhikrId)
      ?? catalog?.dhikr(TasbeehConfigIntent.defaultDhikrId)
    guard let dhikr else { return TasbeehEntry(date: date, dhikr: nil, count: 0) }
    let count = WidgetLogic.tasbeehDisplayCount(
      entry: SnapshotStore.load()?.tasbeeh[dhikr.id], pending: PendingTasbeehStore.read(),
      dhikrId: dhikr.id, today: WidgetLogic.localDayKey(date))
    return TasbeehEntry(date: date, dhikr: dhikr, count: count)
  }
}

struct TasbeehWidget: Widget {
  let kind = "Tasbeeh"

  var body: some WidgetConfiguration {
    AppIntentConfiguration(kind: kind, intent: TasbeehConfigIntent.self, provider: TasbeehProvider()) { entry in
      TasbeehView(entry: entry)
    }
    .configurationDisplayName("Tasbeeh")
    .description("Count a dhikr without opening the app.")
    .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular])
    .contentMarginsDisabled()
  }
}

// @ai-start
/// A ring of 33 beads, filled in the accent as the count grows (a target of
/// 100 fills one bead per three counts or so), with the count in the middle.
// @ai-end
struct TasbeehRing: View {
  static let beads = 33 // @ai
  let count: Int
  let target: Int
  let size: CGFloat
  // @ai-start
  var label: String? = nil

  private var filled: Int {
    Int((WidgetLogic.tasbeehProgress(count: count, target: target) * Double(Self.beads)).rounded(.down))
  }
  // @ai-end

  var body: some View {
    // @ai-start
    let bead = size * 0.056
    let radius = Double(size / 2 - bead)
    // @ai-end
    ZStack {
      // @ai-start
      ForEach(0..<Self.beads, id: \.self) { i in
        let angle = (-90 + Double(i) * 360 / Double(Self.beads)) * .pi / 180
        Circle()
          .fill(i < filled ? WidgetPalette.accent : .white.opacity(0.2))
          .frame(width: bead, height: bead)
          .offset(x: CGFloat(radius * cos(angle)), y: CGFloat(radius * sin(angle)))
      }
      // @ai-end
      VStack(spacing: 0) {
        // @ai-start
        if let label {
          Text(label)
            .font(WidgetFonts.dhikr(size * 0.1))
            .lineLimit(1)
            .minimumScaleFactor(0.5)
            .environment(\.layoutDirection, .rightToLeft)
        }
        Text("\(count)").font(.system(size: size * 0.24, weight: .heavy, design: .rounded)).minimumScaleFactor(0.5)
        Text("of \(target)").font(.system(size: size * 0.08, weight: .semibold)).foregroundStyle(WidgetPalette.secondary)
        // @ai-end
      }
      .frame(width: size * 0.66) // @ai
    }
    .frame(width: size, height: size)
  }
}

struct TasbeehView: View {
  @Environment(\.widgetFamily) private var family
  let entry: TasbeehEntry

  var body: some View {
    Group {
      if let dhikr = entry.dhikr {
        switch family {
        case .accessoryCircular: circular(dhikr)
        case .systemSmall: small(dhikr)
        default: medium(dhikr)
        }
      } else {
        if family == .accessoryCircular {
          BayaanLogo(size: 20)
        } else {
          VStack(spacing: 6) {
            BayaanLogo(size: 20)
            Text("Open \(AppBrand.name) to set up Tasbeeh").font(.caption.weight(.semibold)).multilineTextAlignment(.center)
          }
          .padding(12)
        }
      }
    }
    .foregroundStyle(.white)
    .containerBackground(for: .widget) {
      if family == .accessoryCircular { AccessoryWidgetBackground() } else { WidgetPalette.background }
    }
    .widgetURL(AppLinks.url("adhkar"))
  }

  private func dhikrText(_ dhikr: WidgetCatalogDhikr, size: CGFloat, alignment: TextAlignment) -> some View {
    Text(dhikr.arabic)
      .font(WidgetFonts.dhikr(size))
      .multilineTextAlignment(alignment)
      .lineLimit(2)
      .minimumScaleFactor(0.6)
      .environment(\.layoutDirection, .rightToLeft)
  }

  // Lock Screen: no buttons, the tap opens the adhkar screen.
  private func circular(_ dhikr: WidgetCatalogDhikr) -> some View {
    Gauge(value: WidgetLogic.tasbeehProgress(count: entry.count, target: dhikr.repeatCount)) {
      EmptyView()
    } currentValueLabel: {
      Text("\(entry.count)").font(.system(.body, design: .rounded).weight(.bold)).minimumScaleFactor(0.5)
    }
    .gaugeStyle(.accessoryCircularCapacity)
  }

  // The whole widget counts. // @ai
  private func small(_ dhikr: WidgetCatalogDhikr) -> some View {
    Button(intent: IncrementTasbeehIntent(dhikrId: dhikr.id)) {
      // @ai-start
      TasbeehRing(count: entry.count, target: dhikr.repeatCount, size: 142, label: dhikr.arabic)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
      // @ai-end
    }
    .buttonStyle(.plain)
    .accessibilityLabel("Count, \(entry.count) of \(dhikr.repeatCount)")
  }

  private func medium(_ dhikr: WidgetCatalogDhikr) -> some View {
    HStack(spacing: 16) { // @ai
      Button(intent: IncrementTasbeehIntent(dhikrId: dhikr.id)) {
        TasbeehRing(count: entry.count, target: dhikr.repeatCount, size: 142) // @ai
      }
      .buttonStyle(.plain)
      .accessibilityLabel("Count, \(entry.count) of \(dhikr.repeatCount)")
      // @ai-start
      VStack(alignment: .trailing, spacing: 4) {
        dhikrText(dhikr, size: 24, alignment: .trailing)
      // @ai-end
          .frame(maxWidth: .infinity, alignment: .trailing)
        if let translation = dhikr.translation {
          // @ai-start
          Text(translation).font(.caption.weight(.medium)).foregroundStyle(WidgetPalette.secondary)
            .lineLimit(2).multilineTextAlignment(.trailing)
        }
        Spacer(minLength: 0)
        HStack {
          Text("Tap the beads to count").font(.caption2.weight(.semibold)).foregroundStyle(WidgetPalette.secondary)
            .lineLimit(1).minimumScaleFactor(0.8)
          Spacer(minLength: 4)
          RoundIntentButton(intent: ResetTasbeehIntent(dhikrId: dhikr.id), systemName: "arrow.counterclockwise",
                            label: "Reset", size: 36)
          // @ai-end
        }
      }
      .frame(maxWidth: .infinity)
    }
    // @ai-start
    .padding(.leading, 14)
    .padding(.trailing, 18)
    .padding(.vertical, 14)
    // @ai-end
  }
}

#Preview("Small", as: .systemSmall) {
  TasbeehWidget()
} timeline: {
  TasbeehEntry(date: .now, dhikr: WidgetCatalogDhikr(id: "91", arabic: "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ", translation: "How perfect Allah is and I praise Him.", repeatCount: 100), count: 42)
  TasbeehEntry(date: .now, dhikr: nil, count: 0)
}

#Preview("Medium", as: .systemMedium) {
  TasbeehWidget()
} timeline: {
  TasbeehEntry(date: .now, dhikr: WidgetCatalogDhikr(id: "91", arabic: "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ", translation: "How perfect Allah is and I praise Him.", repeatCount: 100), count: 100)
}

#Preview("Lock Screen", as: .accessoryCircular) {
  TasbeehWidget()
} timeline: {
  TasbeehEntry(date: .now, dhikr: WidgetCatalogDhikr(id: "33", arabic: "سُبْحانَ رَبِّيَ الْعَظِيمِ", translation: nil, repeatCount: 3), count: 2)
}
