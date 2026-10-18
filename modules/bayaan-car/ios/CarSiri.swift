import Foundation
import Intents
import UIKit

/// SiriKit "play" support. Matching runs on the snapshot; playback runs in JS
/// through the same queued play request path as CarPlay, so a cold Siri
/// launch plays once React is ready.
@objc public final class BayaanCarSiri: NSObject, INPlayMediaIntentHandling {
  @objc public static let shared = BayaanCarSiri()

  @objc public static func handler(for intent: INIntent) -> Any? {
    intent is INPlayMediaIntent ? shared : nil
  }

  private static func matches(for intent: INPlayMediaIntent) -> [CarVoiceMatch] {
    guard let snapshot = CarBridge.shared.loadSnapshotIfNeeded() else { return [] }
    let search = intent.mediaSearch
    return CarVoiceSearch.search(
      mediaName: search?.mediaName,
      artistName: search?.artistName,
      wantsPlaylist: search?.mediaType == .playlist,
      shuffle: intent.playShuffled == true,
      in: snapshot)
  }

  private static func mediaItem(_ match: CarVoiceMatch) -> INMediaItem {
    INMediaItem(
      identifier: match.identifier,
      title: match.title,
      type: match.kind == .playlist ? .playlist : .song,
      artwork: nil,
      artist: match.artist)
  }

  /// Runs on Siri's queue; the snapshot lives on main.
  private static func onMain<T>(_ work: () -> T) -> T {
    Thread.isMainThread ? work() : DispatchQueue.main.sync(execute: work)
  }

  public func resolveMediaItems(
    for intent: INPlayMediaIntent,
    with completion: @escaping ([INPlayMediaMediaItemResolutionResult]) -> Void
  ) {
    let found = Self.onMain { Self.matches(for: intent) }
    guard let best = found.first else {
      completion([INPlayMediaMediaItemResolutionResult(mediaItemResolutionResult: .unsupported())])
      return
    }
    completion(INPlayMediaMediaItemResolutionResult.successes(with: [Self.mediaItem(best)]))
  }

  public func handle(intent: INPlayMediaIntent, completion: @escaping (INPlayMediaIntentResponse) -> Void) {
    // .handleInApp launches (or wakes) the app in the background and calls
    // the app delegate's application(_:handle:completionHandler:).
    completion(INPlayMediaIntentResponse(code: .handleInApp, userActivity: nil))
  }

  /// Called from the app delegate for a `.handleInApp` response.
  @objc public static func handle(_ intent: INIntent, completion: @escaping (INIntentResponse) -> Void) {
    guard let play = intent as? INPlayMediaIntent else {
      completion(INPlayMediaIntentResponse(code: .failure, userActivity: nil))
      return
    }
    DispatchQueue.main.async {
      // A background Siri launch has no scene yet; React must still boot.
      BayaanCarSceneBridge.shared.ensureStarted()
      let found = matches(for: play)
      let selected = play.mediaItems?.first?.identifier
      let match = found.first { $0.identifier == selected } ?? found.first
      guard let match else {
        completion(INPlayMediaIntentResponse(code: .failureUnknownMediaType, userActivity: nil))
        return
      }
      CarBridge.shared.send(play: match.request)
      completion(INPlayMediaIntentResponse(code: .success, userActivity: nil))
    }
  }

  /// Tells Siri which names belong to Bayaan (reciters, playlists) and that
  /// this is a library app, so "play ... on Bayaan" routes here.
  private static var donatedKey = ""

  /// INVocabulary raises an uncatchable exception (and the app aborts) when
  /// the build lacks the Siri entitlement, e.g. `siri: false` in the plugin
  /// or a team without the capability. Donate only when Siri is declared in
  /// Info.plist and, on development and ad hoc builds, the embedded profile
  /// grants it. App Store builds carry no profile; there the plugin adds the
  /// entitlement together with the Info.plist keys.
  static let isSiriEnabled: Bool = {
    let intents = Bundle.main.object(forInfoDictionaryKey: "INIntentsSupported") as? [String] ?? []
    guard intents.contains("INPlayMediaIntent") else { return false }
    guard let url = Bundle.main.url(forResource: "embedded", withExtension: "mobileprovision") else { return true }
    return provisionGrantsSiri(url)
  }()

  private static func provisionGrantsSiri(_ url: URL) -> Bool {
    // The profile is a signed envelope around a plist.
    guard let data = try? Data(contentsOf: url),
          let start = data.range(of: Data("<?xml".utf8)),
          let end = data.range(of: Data("</plist>".utf8), in: start.lowerBound..<data.endIndex),
          let plist = try? PropertyListSerialization.propertyList(
            from: data.subdata(in: start.lowerBound..<end.upperBound), format: nil
          ) as? [String: Any],
          let entitlements = plist["Entitlements"] as? [String: Any]
    else { return false }
    return entitlements["com.apple.developer.siri"] as? Bool == true
  }

  static func donateVocabulary(_ snapshot: CarSnapshot) {
    guard isSiriEnabled else { return }
    let key = (snapshot.reciters.map(\.name) + snapshot.lists.values.map(\.title)).joined(separator: "|")
    guard key != donatedKey else { return }
    donatedKey = key
    let reciters = NSOrderedSet(array: snapshot.reciters.filter { $0.isFavorite }.map(\.name)
      + snapshot.reciters.prefix(100).map(\.name))
    INVocabulary.shared().setVocabularyStrings(reciters, of: .mediaMusicArtistName)
    let playlists = NSOrderedSet(array: snapshot.lists.values.map(\.title))
    INVocabulary.shared().setVocabularyStrings(playlists, of: .mediaPlaylistTitle)
    let context = INMediaUserContext()
    context.numberOfLibraryItems = snapshot.surahs.count
    context.becomeCurrent()
  }
}
