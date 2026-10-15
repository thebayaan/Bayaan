import CryptoKit
import UIKit

/// Threading: `peek` and `load` are called on main. Memory lookups are
/// synchronous. Disk reads, network, local file reads and downscaling run on a
/// utility queue; completions are delivered on main after the memory cache is
/// populated. Completions only fire for work that was actually performed, so
/// callers apply the image to their already-built item. The memory cache may
/// evict freely: nothing re-requests in a loop. In-flight and failure
/// bookkeeping is guarded by `lock`.
final class CarArtworkCache {
  static let shared = CarArtworkCache()

  private static let storedPixels: CGFloat = 256
  private static let retryAfter: TimeInterval = 60

  private let memory = NSCache<NSString, UIImage>()
  private let dir: URL
  private let session: URLSession
  private let work = DispatchQueue(label: "bayaan.car.artwork", qos: .utility, attributes: .concurrent)
  private let lock = NSLock()
  private var inFlight: [String: [(UIImage) -> Void]] = [:]
  private var failedAt: [String: Date] = [:]
  private static let defaultSurahBase = "https://cdn.thebayaan.com/assets/car/surah/"

  /// The snapshot's surah base when it is an https URL ending in "/", else Bayaan's CDN.
  /// Mirrors the JS normalizer and the Android provider. Main thread only.
  private var surahBase: String {
    guard let base = CarBridge.shared.snapshot?.surahArtworkBase,
      base.hasPrefix("https://"), base.hasSuffix("/"), base.count > "https://".count + 1,
      !base.contains("/../"),
      base.rangeOfCharacter(from: CharacterSet(charactersIn: "?#\\").union(.whitespacesAndNewlines)) == nil
    else { return Self.defaultSurahBase }
    return base
  }

  private init() {
    let base = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
    dir = base.appendingPathComponent("bayaan-car/artwork", isDirectory: true)
    try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    let config = URLSessionConfiguration.default
    config.timeoutIntervalForRequest = 15
    config.requestCachePolicy = .reloadIgnoringLocalCacheData
    session = URLSession(configuration: config)
    memory.totalCostLimit = 64 * 1024 * 1024
  }

  /// Memory hit or a drawable placeholder. Never starts any work.
  func peek(for artwork: CarArtwork, size: CGFloat, scale: CGFloat, style: UIUserInterfaceStyle) -> UIImage {
    switch source(for: artwork, style: style) {
    case .tile(let label, let hex):
      return tile(label: label, hex: hex, size: size, scale: scale)
    case .icon(let name, let hex, let light):
      return icon(name, hex: hex, light: light, size: size, scale: scale)
    case .remote(let key, _, let placeholder), .local(let key, _, let placeholder):
      if let hit = memory.object(forKey: Self.cacheKey(key, size, scale)) { return hit }
      return tile(label: placeholder.label, hex: placeholder.hex, size: size, scale: scale)
    }
  }

  /// Starts loading when the image is not in memory. `completion` fires on
  /// main with the real image, only if work was needed and succeeded.
  func load(
    for artwork: CarArtwork, size: CGFloat, scale: CGFloat, style: UIUserInterfaceStyle,
    completion: @escaping (UIImage) -> Void
  ) {
    switch source(for: artwork, style: style) {
    case .tile, .icon:
      return
    case .remote(let key, let url, _):
      guard let url else { return }
      start(key: key, size: size, scale: scale, completion: completion) { [weak self] file, done in
        if let data = try? Data(contentsOf: file), let cached = UIImage(data: data) {
          done(cached)
          return
        }
        self?.download(url) { fetched in
          guard let self, let fetched else {
            done(nil)
            return
          }
          let small = self.downscale(fetched, size: Self.storedPixels / scale, scale: scale)
          if let png = small.pngData() { try? png.write(to: file, options: .atomic) }
          done(small)
        }
      }
    case .local(let key, let path, _):
      start(key: key, size: size, scale: scale, completion: completion) { _, done in done(UIImage(contentsOfFile: path)) }
    }
  }

  /// Combined form: returns the placeholder or hit now, completion on main when the real image arrives.
  func image(
    for artwork: CarArtwork, size: CGFloat, scale: CGFloat, style: UIUserInterfaceStyle,
    completion: @escaping (UIImage) -> Void
  ) -> UIImage {
    let current = peek(for: artwork, size: size, scale: scale, style: style)
    load(for: artwork, size: size, scale: scale, style: style, completion: completion)
    return current
  }

  // MARK: Sources

  private struct Placeholder {
    let label: String
    let hex: String
  }

  private enum Source {
    case tile(label: String, hex: String)
    case icon(CarIconName, hex: String?, light: Bool)
    case remote(key: String, url: URL?, placeholder: Placeholder)
    case local(key: String, path: String, placeholder: Placeholder)
  }

  private func source(for artwork: CarArtwork, style: UIUserInterfaceStyle) -> Source {
    let neutral = Placeholder(label: "", hex: "#374151")
    switch artwork {
    case .monogram(let label, let hex), .color(let label, let hex):
      return .tile(label: label, hex: hex)
    case .icon(let name, let hex):
      return .icon(name, hex: hex, light: style == .light)
    case .surah(let id):
      let suffix = style == .light ? "-light" : ""
      return .remote(
        key: "surah-\(Self.digest(surahBase))-\(id)\(suffix)", url: URL(string: "\(surahBase)\(id)\(suffix).png"),
        placeholder: Placeholder(label: "\(id)", hex: "#1F2937"))
    case .url(let string):
      return .remote(key: "url-\(Self.digest(string))", url: URL(string: string), placeholder: neutral)
    case .asset(let uri):
      if uri.hasPrefix("http") {
        return .remote(key: "asset-\(Self.digest(uri))", url: URL(string: uri), placeholder: neutral)
      }
      let path = uri.hasPrefix("file://") ? (URL(string: uri)?.path ?? String(uri.dropFirst(7))) : uri
      return .local(key: "local-\(Self.digest(uri))", path: path, placeholder: neutral)
    }
  }

  // MARK: Loading

  private static func cacheKey(_ key: String, _ size: CGFloat, _ scale: CGFloat) -> NSString {
    "\(key)@\(Int(size))x\(Int(scale))" as NSString
  }

  /// Dedupes by key+size, skips recently failed keys, runs `produce` off main.
  /// `produce` receives the disk file for this key and returns the full-size image.
  private func start(
    key: String, size: CGFloat, scale: CGFloat, completion: @escaping (UIImage) -> Void,
    produce: @escaping (URL, @escaping (UIImage?) -> Void) -> Void
  ) {
    let cacheKey = Self.cacheKey(key, size, scale)
    // A concurrent load may have finished between the caller's peek and now.
    if let hit = memory.object(forKey: cacheKey) {
      DispatchQueue.main.async { completion(hit) }
      return
    }
    let flightKey = cacheKey as String
    lock.lock()
    if let failed = failedAt[key], Date().timeIntervalSince(failed) < Self.retryAfter {
      lock.unlock()
      return
    }
    if inFlight[flightKey] != nil {
      inFlight[flightKey]?.append(completion)
      lock.unlock()
      return
    }
    inFlight[flightKey] = [completion]
    lock.unlock()

    let file = dir.appendingPathComponent("\(key).png")
    work.async { [weak self] in
      produce(file) { full in
        guard let self else { return }
        guard let full else {
          self.lock.lock()
          self.inFlight.removeValue(forKey: flightKey)
          self.failedAt[key] = Date()
          self.lock.unlock()
          return
        }
        let image = self.downscale(full, size: size, scale: scale)
        self.memory.setObject(image, forKey: cacheKey, cost: Int(size * scale * size * scale * 4))
        self.lock.lock()
        let waiting = self.inFlight.removeValue(forKey: flightKey) ?? []
        self.failedAt.removeValue(forKey: key)
        self.lock.unlock()
        DispatchQueue.main.async { waiting.forEach { $0(image) } }
      }
    }
  }

  private func download(_ url: URL, done: @escaping (UIImage?) -> Void) {
    session.dataTask(with: url) { data, response, _ in
      guard (response as? HTTPURLResponse)?.statusCode == 200, let data else {
        done(nil)
        return
      }
      done(UIImage(data: data))
    }.resume()
  }

  // MARK: Drawing

  /// Aspect-fill into a square so wide source art is not stretched.
  private func downscale(_ image: UIImage, size: CGFloat, scale: CGFloat) -> UIImage {
    let format = UIGraphicsImageRendererFormat()
    format.scale = scale
    format.opaque = false
    let target = CGSize(width: size, height: size)
    let source = image.size
    guard source.width > 0, source.height > 0 else { return image }
    let factor = max(target.width / source.width, target.height / source.height)
    let drawn = CGSize(width: source.width * factor, height: source.height * factor)
    let origin = CGPoint(x: (target.width - drawn.width) / 2, y: (target.height - drawn.height) / 2)
    return UIGraphicsImageRenderer(size: target, format: format).image { _ in
      image.draw(in: CGRect(origin: origin, size: drawn))
    }
  }

  private func tile(label: String, hex: String, size: CGFloat, scale: CGFloat) -> UIImage {
    let key = "tile-\(label)-\(hex)@\(Int(size))x\(Int(scale))" as NSString
    if let hit = memory.object(forKey: key) { return hit }
    let format = UIGraphicsImageRendererFormat()
    format.scale = scale
    format.opaque = true
    let rect = CGRect(x: 0, y: 0, width: size, height: size)
    let image = UIGraphicsImageRenderer(size: rect.size, format: format).image { ctx in
      UIColor(hex: hex).setFill()
      ctx.fill(rect)
      let text = String(label.prefix(3))
      if text.isEmpty {
        // No label: draw a quiet symbol instead of a blank tile.
        let config = UIImage.SymbolConfiguration(pointSize: size * 0.4, weight: .regular)
        if let symbol = UIImage(systemName: "book.closed.fill", withConfiguration: config)?
          .withTintColor(UIColor.white.withAlphaComponent(0.6), renderingMode: .alwaysOriginal)
        {
          symbol.draw(at: CGPoint(x: (size - symbol.size.width) / 2, y: (size - symbol.size.height) / 2))
        }
        return
      }
      let attrs: [NSAttributedString.Key: Any] = [
        .font: UIFont.systemFont(ofSize: size * 0.3, weight: .semibold),
        .foregroundColor: UIColor.white,
      ]
      let textSize = (text as NSString).size(withAttributes: attrs)
      (text as NSString).draw(
        at: CGPoint(x: (size - textSize.width) / 2, y: (size - textSize.height) / 2), withAttributes: attrs)
    }
    memory.setObject(image, forKey: key)
    return image
  }

  // MARK: Icon tiles

  /// Collection screen tile: 12pt corners on a 46pt square.
  private static let iconCornerRatio: CGFloat = 12 / 46
  /// Used when a playlist colour is missing or malformed (the app's playlist colour).
  private static let defaultPlaylistHex = "#6366F1"
  private static let hexPattern = try? NSRegularExpression(pattern: "^#[0-9A-Fa-f]{6}$")

  /// The resource bundle the podspec builds from `icons/`. With a static
  /// framework it is copied into the app bundle.
  private static let iconBundle: Bundle? = {
    for candidate in [Bundle(for: CarArtworkCache.self), Bundle.main] {
      if let url = candidate.url(forResource: "BayaanCarIcons", withExtension: "bundle"), let bundle = Bundle(url: url) {
        return bundle
      }
    }
    return nil
  }()

  private static func validHex(_ hex: String?) -> String {
    guard let hex, let pattern = hexPattern,
      pattern.firstMatch(in: hex, range: NSRange(hex.startIndex..., in: hex)) != nil
    else { return defaultPlaylistHex }
    return hex
  }

  /// Bundled tiles are drawn as is (light or dark variant). A playlist tile is
  /// its own colour with the white playlist glyph on top. Falls back to a
  /// plain tile when the bundle is missing.
  private func icon(_ name: CarIconName, hex: String?, light: Bool, size: CGFloat, scale: CGFloat) -> UIImage {
    let color = name == .playlist ? Self.validHex(hex) : ""
    let variant = name == .playlist ? color : (light ? "light" : "dark")
    let key = "icon-\(name.rawValue)-\(variant)@\(Int(size))x\(Int(scale))" as NSString
    if let hit = memory.object(forKey: key) { return hit }
    let resource = name == .playlist ? "car_icon_playlist_glyph" : "car_icon_\(name.rawValue)\(light ? "_light" : "")"
    guard let source = UIImage(named: resource, in: Self.iconBundle, compatibleWith: nil) else {
      carDebugLog("missing icon tile \(resource)")
      return tile(label: "", hex: name == .playlist ? color : "#374151", size: size, scale: scale)
    }
    let format = UIGraphicsImageRendererFormat()
    format.scale = scale
    format.opaque = false
    let rect = CGRect(x: 0, y: 0, width: size, height: size)
    let image = UIGraphicsImageRenderer(size: rect.size, format: format).image { _ in
      if name == .playlist {
        UIColor(hex: color).setFill()
        UIBezierPath(roundedRect: rect, cornerRadius: size * Self.iconCornerRatio).fill()
      }
      source.draw(in: rect)
    }
    memory.setObject(image, forKey: key)
    return image
  }

  private static func digest(_ string: String) -> String {
    SHA256.hash(data: Data(string.utf8)).prefix(12).map { String(format: "%02x", $0) }.joined()
  }
}

extension UIColor {
  convenience init(hex: String) {
    let cleaned = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
    var value: UInt64 = 0
    Scanner(string: cleaned).scanHexInt64(&value)
    self.init(
      red: CGFloat((value >> 16) & 0xFF) / 255,
      green: CGFloat((value >> 8) & 0xFF) / 255,
      blue: CGFloat(value & 0xFF) / 255,
      alpha: 1)
  }
}
