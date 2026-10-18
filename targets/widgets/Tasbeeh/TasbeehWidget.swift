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

struct TasbeehRing: View {
  let count: Int
  let target: Int
  let size: CGFloat

  var body: some View {
    ZStack {
      Circle().stroke(.white.opacity(0.2), lineWidth: 5)
      Circle()
        .trim(from: 0, to: WidgetLogic.tasbeehProgress(count: count, target: target))
        .stroke(.white, style: StrokeStyle(lineWidth: 5, lineCap: .round))
        .rotationEffect(.degrees(-90))
      VStack(spacing: 0) {
        Text("\(count)").font(.system(size: size * 0.3, weight: .bold, design: .rounded)).minimumScaleFactor(0.5)
        Text("/ \(target)").font(.system(size: size * 0.13, weight: .medium)).opacity(0.6)
      }
      .padding(8)
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

  private func small(_ dhikr: WidgetCatalogDhikr) -> some View {
    Button(intent: IncrementTasbeehIntent(dhikrId: dhikr.id)) {
      VStack(spacing: 4) {
        HStack { Spacer(minLength: 0); BayaanLogo(size: 12) }
        dhikrText(dhikr, size: 17, alignment: .center)
        Spacer(minLength: 0)
        TasbeehRing(count: entry.count, target: dhikr.repeatCount, size: 64)
      }
      .padding(12)
      .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    .buttonStyle(.plain)
    .accessibilityLabel("Count, \(entry.count) of \(dhikr.repeatCount)")
  }

  private func medium(_ dhikr: WidgetCatalogDhikr) -> some View {
    HStack(spacing: 14) {
      Button(intent: IncrementTasbeehIntent(dhikrId: dhikr.id)) {
        TasbeehRing(count: entry.count, target: dhikr.repeatCount, size: 100)
      }
      .buttonStyle(.plain)
      .accessibilityLabel("Count, \(entry.count) of \(dhikr.repeatCount)")
      VStack(alignment: .trailing, spacing: 6) {
        HStack {
          RoundIntentButton(intent: ResetTasbeehIntent(dhikrId: dhikr.id), systemName: "arrow.counterclockwise", label: "Reset")
          Spacer(minLength: 0)
          BayaanLogo(size: 14)
        }
        Spacer(minLength: 0)
        dhikrText(dhikr, size: 20, alignment: .trailing)
          .frame(maxWidth: .infinity, alignment: .trailing)
        if let translation = dhikr.translation {
          Text(translation).font(.caption2).opacity(0.7).lineLimit(2).multilineTextAlignment(.trailing)
        }
      }
      .frame(maxWidth: .infinity)
    }
    .padding(14)
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
