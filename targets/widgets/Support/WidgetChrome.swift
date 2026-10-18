// targets/widgets/Support/WidgetChrome.swift
import AppIntents
import SwiftUI
import WidgetKit

/// The Continue Listening look, shared by every Phase 1b widget.
enum WidgetPalette {
  // Fixed near-black in both appearances (Continue Listening keeps its own
  // private copy of the same value).
  static let background = Color(red: 0x1C / 255, green: 0x1C / 255, blue: 0x1E / 255)
  static let tile = Color.white.opacity(0.15)
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

/// The surah card when cached, else a dark tile with the number and name.
struct SurahCard: View {
  let surah: StaticSurah?
  let size: CGFloat

  var body: some View {
    Group {
      if let surah, let image = SnapshotStore.artwork(surah.artworkFile) {
        CachedImage(image: image).aspectRatio(1, contentMode: .fill)
      } else {
        ZStack {
          WidgetPalette.tile
          VStack(spacing: 1) {
            Text(surah.map { String($0.id) } ?? "")
              .font(.system(size: size * 0.32, weight: .bold, design: .rounded))
            if size >= 44, let surah {
              Text(surah.name).font(.system(size: 9, weight: .semibold))
                .lineLimit(1).minimumScaleFactor(0.7).padding(.horizontal, 3)
            }
          }
          .foregroundStyle(.white)
        }
      }
    }
    .frame(width: size, height: size)
    .clipShape(RoundedRectangle(cornerRadius: size * 0.16, style: .continuous))
    .accessibilityLabel(surah?.name ?? "")
  }
}

/// The reciter photo when cached, else initials on a dark tile. Fills its frame.
struct ReciterPhoto: View {
  let file: String?
  let name: String

  var body: some View {
    if let image = SnapshotStore.artwork(file) {
      CachedImage(image: image).aspectRatio(contentMode: .fill)
    } else {
      ZStack {
        WidgetPalette.tile
        Text(WidgetLogic.initials(name)).font(.title2.bold()).foregroundStyle(.white)
      }
    }
  }
}

/// The 30 pt round glyph of Continue Listening's play button.
struct RoundGlyph: View {
  let systemName: String

  var body: some View {
    Image(systemName: systemName)
      .font(.system(size: 12, weight: .bold))
      .foregroundStyle(.white)
      .frame(width: 30, height: 30)
      .background(.white.opacity(0.18), in: Circle())
  }
}

struct RoundIntentButton<I: AppIntent>: View {
  let intent: I
  let systemName: String
  let label: String

  var body: some View {
    Button(intent: intent) { RoundGlyph(systemName: systemName) }
      .buttonStyle(.plain)
      .accessibilityLabel(label)
  }
}
