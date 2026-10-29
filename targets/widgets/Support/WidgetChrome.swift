// targets/widgets/Support/WidgetChrome.swift
import AppIntents
import SwiftUI
import WidgetKit

// @ai-start
/// The widget look (redesign 2026-10): three families share these tokens.
/// Listen widgets sit on a surah tint, Read widgets on paper or night, and
/// Remember widgets on ink or a time-of-day tint. `accent` marks the one
/// primary action in a widget.
// @ai-end
enum WidgetPalette {
  // @ai-start
  static let ink = Color(hex: 0x0B1E26)
  static let background = ink
  static let night = Color(hex: 0x071A22)
  static let paper = Color(hex: 0xF4F3EC)
  static let paperInk = Color(hex: 0x06151C)
  static let paperSecondary = Color(hex: 0x3A4A52)
  static let paperLabel = Color(hex: 0x6B5B3A)
  static let paperRule = Color(hex: 0xDCD8C8)
  static let gold = Color(hex: 0xD6BE8C)
  static let accent = Color(hex: 0x1F9D6B)
  static let bedtime = Color(hex: 0x10142B)
  static let moon = Color(hex: 0xE8D9A8)
  // @ai-end
  static let tile = Color.white.opacity(0.15)
  // @ai-start
  static let secondary = Color.white.opacity(0.8)
}

extension Color {
  init(hex: UInt32) {
    self.init(red: Double((hex >> 16) & 0xFF) / 255, green: Double((hex >> 8) & 0xFF) / 255,
              blue: Double(hex & 0xFF) / 255)
  }
}

/// A fixed color per surah: `base` for its tile, `deep` for the widget
/// background behind it. Uploads (surah 0) use ink.
enum SurahTint {
  private static let pairs: [(base: UInt32, deep: UInt32)] = [
    (0x1D6461, 0x0F2C2C), // teal
    (0x5645A1, 0x1E1838), // violet
    (0x273A6B, 0x101A30), // navy
    (0x9A4A2B, 0x2E1710), // clay
    (0x1F6B47, 0x0D2A1D), // green
    (0x6B2F5A, 0x2A1224), // plum
    (0x3B5566, 0x14212A), // slate
    (0x5F6332, 0x24260F), // olive
  ]

  private static func pair(_ surahId: Int) -> (base: UInt32, deep: UInt32)? {
    surahId > 0 ? pairs[(surahId - 1) % pairs.count] : nil
  }

  static func base(_ surahId: Int) -> Color { pair(surahId).map { Color(hex: $0.base) } ?? WidgetPalette.tile }
  static func deep(_ surahId: Int) -> Color { pair(surahId).map { Color(hex: $0.deep) } ?? WidgetPalette.ink }
}

/// Paper in light appearance, night in dark: the Read family.
struct ReadingStyle {
  let background: Color
  let primary: Color
  let secondary: Color
  let label: Color
  let rule: Color
  let buttonFill: Color
  let buttonGlyph: Color

  static func forScheme(_ scheme: ColorScheme) -> ReadingStyle {
    scheme == .dark
      ? ReadingStyle(background: WidgetPalette.night, primary: WidgetPalette.paper,
                     secondary: WidgetPalette.paper.opacity(0.82), label: WidgetPalette.gold,
                     rule: WidgetPalette.gold.opacity(0.35), buttonFill: WidgetPalette.gold,
                     buttonGlyph: WidgetPalette.night)
      : ReadingStyle(background: WidgetPalette.paper, primary: WidgetPalette.paperInk,
                     secondary: WidgetPalette.paperSecondary, label: WidgetPalette.paperLabel,
                     rule: WidgetPalette.paperRule, buttonFill: WidgetPalette.paperInk,
                     buttonGlyph: WidgetPalette.paper)
  }
}

/// Small caps label above a widget's content ("NOW PLAYING").
struct Eyebrow: View {
  let text: String
  var color: Color = WidgetPalette.secondary

  var body: some View {
    Text(text.uppercased())
      .font(.system(size: 10, weight: .heavy))
      .tracking(1)
      .foregroundStyle(color)
      .lineLimit(1)
  }
  // @ai-end
}

enum WidgetFonts {
  static func quran(_ size: CGFloat) -> Font { .custom("DigitalKhattNewMadinaRegular", size: size) }
  static func dhikr(_ size: CGFloat) -> Font { .custom("ScheherazadeNew-Regular", size: size) }
  static func surahGlyph(_ size: CGFloat) -> Font { .custom("icomoon", size: size) }
}

/// Cached artwork, kept full color on tinted Home Screens (iOS 18+).
struct CachedImage: View {
  let image: UIImage

  var body: some View {
    if #available(iOS 18.0, *) {
      Image(uiImage: image).resizable().widgetAccentedRenderingMode(.fullColor)
    } else {
      Image(uiImage: image).resizable()
    }
  }
}

/// The surah card when cached, else a generated tile. // @ai
struct SurahCard: View {
  let surah: StaticSurah?
  let size: CGFloat

  var body: some View {
    Group {
      if let surah, let image = SnapshotStore.artwork(surah.artworkFile) {
        CachedImage(image: image).aspectRatio(1, contentMode: .fill)
      } else {
        GeneratedSurahTile(surah: surah, size: size) // @ai
      }
    }
    .frame(width: size, height: size)
    .clipShape(RoundedRectangle(cornerRadius: size * 0.2, style: .continuous)) // @ai
    .overlay { TileKeyline(cornerRadius: size * 0.2) } // @ai
    .accessibilityLabel(surah?.name ?? "")
  }

  // @ai-start
  /// True when the cached card, which has the surah name printed on it, will show.
  static func showsName(_ surah: StaticSurah?) -> Bool {
    guard let surah else { return false }
    return SnapshotStore.artwork(surah.artworkFile) != nil
  }

  /// True when `file` is this surah's card and it is cached.
  static func showsName(file: String?, surahId: Int) -> Bool {
    guard let file, let surah = StaticData.surah(surahId), file == surah.artworkFile else { return false }
    return SnapshotStore.artwork(file) != nil
  }
  // @ai-end
}

// @ai-start
/// A hairline edge so dark cards stay distinct on dark widget backgrounds.
struct TileKeyline: View {
  let cornerRadius: CGFloat

  var body: some View {
    RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
      .strokeBorder(.white.opacity(0.18), lineWidth: 1)
  }
}
// @ai-end

// @ai-start
/// Stand-in artwork: the surah's tint, a faint starburst and the surah name
/// glyph, so a widget never shows an empty box before artwork is cached.
struct GeneratedSurahTile: View {
  let surah: StaticSurah?
  let size: CGFloat

  var body: some View {
    ZStack {
      SurahTint.base(surah?.id ?? 0)
      BayaanMark().fill(.white.opacity(0.14))
        .frame(width: size * 1.2, height: size)
        .offset(x: size * 0.32, y: size * 0.28)
      if let surah {
        if surah.glyph.isEmpty {
          Text(String(surah.id)).font(.system(size: size * 0.32, weight: .bold, design: .rounded))
        } else {
          Text(surah.glyph).font(WidgetFonts.surahGlyph(size * 0.46)).minimumScaleFactor(0.5)
        }
      }
    }
    .foregroundStyle(.white)
    .frame(width: size, height: size)
    .clipped()
  }
}

/// The reciter photo when cached, else initials on a violet tile. Fills its frame.
// @ai-end
struct ReciterPhoto: View {
  let file: String?
  let name: String

  var body: some View {
    if let image = SnapshotStore.artwork(file) {
      CachedImage(image: image).aspectRatio(contentMode: .fill)
    } else {
      ZStack {
        // @ai-start
        Color(hex: 0x5645A1)
        Text(WidgetLogic.initials(name)).font(.title2.weight(.heavy)).foregroundStyle(.white)
        // @ai-end
      }
    }
  }
}

/// Secondary round control (reset, previous, next). // @ai
struct RoundGlyph: View {
  let systemName: String
  var size: CGFloat = 32 // @ai

  var body: some View {
    Image(systemName: systemName)
      .font(.system(size: size * 0.38, weight: .bold)) // @ai
      .foregroundStyle(.white)
      // @ai-start
      .frame(width: size, height: size)
      .background(.white.opacity(0.14), in: Circle())
  }
}

/// The one primary action in a widget: a solid accent circle, 44 pt by default.
struct PrimaryGlyph: View {
  let systemName: String
  var size: CGFloat = 44
  var fill: Color = WidgetPalette.accent
  var glyph: Color = .white

  var body: some View {
    Image(systemName: systemName)
      .font(.system(size: size * 0.38, weight: .bold))
      .foregroundStyle(glyph)
      .frame(width: size, height: size)
      .background(fill, in: Circle())
      // @ai-end
  }
}

struct RoundIntentButton<I: AppIntent>: View {
  let intent: I
  let systemName: String
  let label: String
  // @ai-start
  var size: CGFloat = 32

  var body: some View {
    Button(intent: intent) { RoundGlyph(systemName: systemName, size: size) }
      .buttonStyle(.plain)
      .accessibilityLabel(label)
  }
}

struct PrimaryIntentButton<I: AppIntent>: View {
  let intent: I
  let systemName: String
  let label: String
  var size: CGFloat = 44
  // @ai-end

  var body: some View {
    Button(intent: intent) { PrimaryGlyph(systemName: systemName, size: size) } // @ai
      .buttonStyle(.plain)
      .accessibilityLabel(label)
  }
}

// @ai-start
/// The track that is playing right now, from the snapshot and any newer tap
/// override; nil when paused or stopped. Lets any widget show pause.
enum PlayingNow {
  static func track(at date: Date = .now) -> WidgetTrack? {
    guard let s = SnapshotStore.load(), let np = s.nowPlaying else { return nil }
    let p = EffectivePlayback(nowPlaying: np, generatedAt: s.generatedAt,
                              override: PlaybackOverrideStore.read(), now: date)
    return p.isPlaying ? np.track : nil
  }

  /// A nil reciter matches any reciter (the widget plays the default one).
  static func matches(_ track: WidgetTrack?, surahId: Int, reciterId: String?) -> Bool {
    guard let track else { return false }
    return track.surahId == surahId && (reciterId == nil || track.reciterId == reciterId)
  }
}

/// Runs `play` normally, or `pause` when its target is what is playing.
struct PlayOrPauseButton<I: AppIntent, P: AppIntent, Content: View>: View {
  let playing: Bool
  let play: I
  let pause: P
  let label: String
  @ViewBuilder let content: (_ playing: Bool) -> Content

  var body: some View {
    Group {
      if playing {
        Button(intent: pause) { content(true) }
      } else {
        Button(intent: play) { content(false) }
      }
    }
    .buttonStyle(.plain)
    .accessibilityLabel(playing ? "Pause" : label)
  }
}

extension PlayOrPauseButton where P == SetPlaybackIntent {
  /// Pauses the main player.
  init(playing: Bool, play: I, label: String, @ViewBuilder content: @escaping (_ playing: Bool) -> Content) {
    self.init(playing: playing, play: play, pause: SetPlaybackIntent(playing: false), label: label, content: content)
  }
}

/// Dims a playing tile and centers a pause glyph on it, so no corner badge
/// covers the card's printed name or calligraphy.
struct PlayingTileOverlay: View {
  let size: CGFloat

  var body: some View {
    ZStack {
      Color.black.opacity(0.42)
      PrimaryGlyph(systemName: "pause.fill", size: max(24, size * 0.4))
    }
    .clipShape(RoundedRectangle(cornerRadius: size * 0.2, style: .continuous))
  }
}

/// One line of text that drops leading words before it would cut letters,
/// e.g. "Mishary Alafasi" becomes "Alafasi".
struct FittingName: View {
  let name: String

  private var options: [String] {
    let words = name.split(separator: " ")
    guard words.count > 1 else { return [name] }
    return (0..<words.count).map { words[$0...].joined(separator: " ") }
  }

  var body: some View {
    ViewThatFits(in: .horizontal) {
      ForEach(options, id: \.self) { Text($0).lineLimit(1).fixedSize(horizontal: true, vertical: false) }
      Text(name).lineLimit(1).minimumScaleFactor(0.8)
    }
  }
}
// @ai-end
