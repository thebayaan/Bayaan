import Foundation

func carDebugLog(_ message: @autoclosure () -> String) {
  #if DEBUG
  NSLog("[BayaanCar] %@", message())
  #endif
}

/// Decodes one array element without failing the whole array.
private struct Failable<T: Decodable>: Decodable {
  let value: T?
  init(from decoder: Decoder) throws {
    value = try? T(from: decoder)
  }
}

extension KeyedDecodingContainer {
  /// Decodes an array, skipping elements that fail to decode.
  func decodeLossy<T: Decodable>(_ type: [T].Type, forKey key: Key) throws -> [T] {
    let all = try decode([Failable<T>].self, forKey: key)
    let kept = all.compactMap { $0.value }
    if kept.count != all.count {
      carDebugLog("skipped \(all.count - kept.count) malformed \(T.self) in \(key.stringValue)")
    }
    return kept
  }

  func decodeLossyDict<T: Decodable>(_ type: [String: T].Type, forKey key: Key) throws -> [String: T] {
    let all = try decode([String: Failable<T>].self, forKey: key)
    let kept = all.compactMapValues { $0.value }
    if kept.count != all.count {
      carDebugLog("skipped \(all.count - kept.count) malformed \(T.self) in \(key.stringValue)")
    }
    return kept
  }
}

/// Bundled icon tiles. Only these names ever reach the resource lookup.
enum CarIconName: String {
  case loved, playlists, downloads, uploads, reciters, random, playlist
}

enum CarArtwork: Decodable {
  case surah(Int)
  case url(String)
  case asset(String)
  case monogram(label: String, hex: String)
  case color(label: String, hex: String)
  case icon(CarIconName, hex: String?)

  private enum Keys: String, CodingKey { case kind, surahId, url, uri, label, hex, name }

  init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: Keys.self)
    switch try c.decode(String.self, forKey: .kind) {
    case "surah": self = .surah(try c.decode(Int.self, forKey: .surahId))
    case "url": self = .url(try c.decode(String.self, forKey: .url))
    case "asset": self = .asset(try c.decode(String.self, forKey: .uri))
    case "monogram":
      self = .monogram(label: try c.decode(String.self, forKey: .label), hex: try c.decode(String.self, forKey: .hex))
    case "color":
      self = .color(label: try c.decode(String.self, forKey: .label), hex: try c.decode(String.self, forKey: .hex))
    case "icon":
      guard let name = CarIconName(rawValue: try c.decode(String.self, forKey: .name)) else {
        carDebugLog("unknown icon name, using neutral fallback")
        self = .color(label: "", hex: "#333333")
        return
      }
      self = .icon(name, hex: try? c.decodeIfPresent(String.self, forKey: .hex))
    default:
      carDebugLog("unknown artwork kind, using neutral fallback")
      self = .color(label: "", hex: "#333333")
    }
  }
}

/// Requests stay as raw JSON objects: native never interprets them, it only
/// forwards them to JS.
struct RawJSON: Decodable {
  let value: [String: Any]
  init(from decoder: Decoder) throws {
    let any = try AnyDecodable(from: decoder).value
    value = (any as? [String: Any]) ?? [:]
  }
}

struct AnyDecodable: Decodable {
  let value: Any
  init(from decoder: Decoder) throws {
    let c = try decoder.singleValueContainer()
    if let v = try? c.decode(Bool.self) { value = v }
    else if let v = try? c.decode(Int.self) { value = v }
    else if let v = try? c.decode(Double.self) { value = v }
    else if let v = try? c.decode(String.self) { value = v }
    else if let v = try? c.decode([String: AnyDecodable].self) { value = v.mapValues { $0.value } }
    else if let v = try? c.decode([AnyDecodable].self) { value = v.map { $0.value } }
    else { value = NSNull() }
  }
}

enum CarItemAction: Decodable {
  case play(RawJSON)
  case browseList(String)
  case browseReciter(String)
  case browseSurahReciters(Int)

  private enum Keys: String, CodingKey { case kind, request, target }
  private enum TargetKeys: String, CodingKey { case kind, listId, reciterId, surahId }

  init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: Keys.self)
    let kind = try c.decode(String.self, forKey: .kind)
    if kind == "play" {
      self = .play(try c.decode(RawJSON.self, forKey: .request))
      return
    }
    guard kind == "browse" else {
      throw DecodingError.dataCorruptedError(forKey: .kind, in: c, debugDescription: "unknown action kind")
    }
    let t = try c.nestedContainer(keyedBy: TargetKeys.self, forKey: .target)
    switch try t.decode(String.self, forKey: .kind) {
    case "reciter": self = .browseReciter(try t.decode(String.self, forKey: .reciterId))
    case "surahReciters": self = .browseSurahReciters(try t.decode(Int.self, forKey: .surahId))
    case "list": self = .browseList(try t.decode(String.self, forKey: .listId))
    default:
      throw DecodingError.dataCorruptedError(forKey: .kind, in: t, debugDescription: "unknown target kind")
    }
  }
}

struct CarItem: Decodable {
  let id: String
  let title: String
  let subtitle: String?
  let artwork: CarArtwork
  let progress: Double?
  let duration: Double?
  let isDownloaded: Bool?
  let action: CarItemAction
}

struct CarSection: Decodable {
  let id: String
  let title: String
  let style: String
  let items: [CarItem]

  private enum Keys: String, CodingKey { case id, title, style, items }
  init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: Keys.self)
    id = try c.decode(String.self, forKey: .id)
    title = try c.decode(String.self, forKey: .title)
    style = try c.decode(String.self, forKey: .style)
    items = try c.decodeLossy([CarItem].self, forKey: .items)
  }
}

struct CarList: Decodable {
  let id: String
  let title: String
  let items: [CarItem]

  private enum Keys: String, CodingKey { case id, title, items }
  init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: Keys.self)
    id = try c.decode(String.self, forKey: .id)
    title = try c.decode(String.self, forKey: .title)
    items = try c.decodeLossy([CarItem].self, forKey: .items)
  }
}

struct CarRewayah: Decodable {
  let id: String
  let name: String
  let style: String
  let surahIds: [Int]
}

struct CarReciter: Decodable {
  let id: String
  let name: String
  let artwork: CarArtwork
  let isFavorite: Bool
  let rewayat: [CarRewayah]

  private enum Keys: String, CodingKey { case id, name, artwork, isFavorite, rewayat }
  init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: Keys.self)
    id = try c.decode(String.self, forKey: .id)
    name = try c.decode(String.self, forKey: .name)
    artwork = try c.decode(CarArtwork.self, forKey: .artwork)
    isFavorite = try c.decode(Bool.self, forKey: .isFavorite)
    rewayat = try c.decodeLossy([CarRewayah].self, forKey: .rewayat)
  }
}

struct CarSurah: Decodable {
  let id: Int
  let name: String
  let nameArabic: String
  let translation: String
  let versesCount: Int
}

struct CarHome: Decodable {
  let sections: [CarSection]

  private enum Keys: String, CodingKey { case sections }
  init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: Keys.self)
    sections = try c.decodeLossy([CarSection].self, forKey: .sections)
  }
}

struct CarJuz: Decodable {
  let number: Int
  let title: String?
  let surahIds: [Int]
}

struct CarSnapshot: Decodable {
  let version: Int
  let generatedAt: String?
  let topReciterId: String?
  let home: CarHome
  let library: [CarItem]
  let lists: [String: CarList]
  let reciters: [CarReciter]
  let surahs: [CarSurah]
  let juz: [CarJuz]
  let downloadedKeys: [String]
  let surahArtworkBase: String?

  private enum Keys: String, CodingKey {
    case version, generatedAt, topReciterId, home, library, lists, reciters, surahs, juz, downloadedKeys
    case surahArtworkBase
  }
  init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: Keys.self)
    version = try c.decode(Int.self, forKey: .version)
    generatedAt = try c.decodeIfPresent(String.self, forKey: .generatedAt)
    topReciterId = try c.decodeIfPresent(String.self, forKey: .topReciterId)
    home = try c.decode(CarHome.self, forKey: .home)
    library = try c.decodeLossy([CarItem].self, forKey: .library)
    lists = try c.decodeLossyDict([String: CarList].self, forKey: .lists)
    reciters = try c.decodeLossy([CarReciter].self, forKey: .reciters)
    surahs = try c.decodeLossy([CarSurah].self, forKey: .surahs)
    juz = try c.decodeLossy([CarJuz].self, forKey: .juz)
    downloadedKeys = try c.decode([String].self, forKey: .downloadedKeys)
    surahArtworkBase = try? c.decodeIfPresent(String.self, forKey: .surahArtworkBase)
  }
}

struct CarQueueEntry: Decodable {
  let title: String
  let subtitle: String
  let surahId: Int?
}

struct CarNowPlaying: Decodable {
  let title: String
  let subtitle: String
  let reciterId: String?
  let surahId: Int?
  let isPlaying: Bool
  let position: Double
  let duration: Double
  let rate: Double
  let repeatMode: String
  let isLoved: Bool
  let artwork: CarArtwork?
  let queue: [CarQueueEntry]
  let currentIndex: Int

  private enum Keys: String, CodingKey {
    case title, subtitle, reciterId, surahId, isPlaying, position, duration, rate, repeatMode, isLoved, artwork, queue, currentIndex
  }
  init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: Keys.self)
    title = try c.decode(String.self, forKey: .title)
    subtitle = try c.decode(String.self, forKey: .subtitle)
    reciterId = try c.decodeIfPresent(String.self, forKey: .reciterId)
    surahId = try c.decodeIfPresent(Int.self, forKey: .surahId)
    isPlaying = try c.decode(Bool.self, forKey: .isPlaying)
    position = try c.decode(Double.self, forKey: .position)
    duration = try c.decode(Double.self, forKey: .duration)
    rate = try c.decode(Double.self, forKey: .rate)
    repeatMode = try c.decode(String.self, forKey: .repeatMode)
    isLoved = try c.decode(Bool.self, forKey: .isLoved)
    artwork = try? c.decodeIfPresent(CarArtwork.self, forKey: .artwork)
    queue = try c.decodeLossy([CarQueueEntry].self, forKey: .queue)
    currentIndex = try c.decode(Int.self, forKey: .currentIndex)
  }
}
