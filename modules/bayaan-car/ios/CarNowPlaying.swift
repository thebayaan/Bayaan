import CarPlay
import MediaPlayer
import UIKit

/// Main-thread only. Owns the CarPlay Now Playing buttons, the Up Next and
/// album-artist (reciter) pushes, and the next/previous remote commands for
/// the lifetime of one CarPlay connection.
///
/// expo-audio never touches `changePlaybackRateCommand`, and touches
/// `nextTrackCommand` / `previousTrackCommand` only for a player that opted in
/// to track controls (our patch, adhkar only). JS turns those off on iOS in car
/// mode, which disables both commands, so `updateButtons` enables them again.
/// Otherwise expo-audio only toggles play, pause, position and skip
/// forward/backward, and with the skip commands disabled (JS car mode)
/// CarPlay shows next/previous instead.
///
/// The rate button's label comes from `MPRemoteCommandCenter`: CarPlay reads
/// it through an enabled `changePlaybackRateCommand` with supported rates.
/// Without that command the button reads "0x" and looks inert.
final class CarNowPlayingController: NSObject, CPNowPlayingTemplateObserver {
  private weak var interfaceController: CPInterfaceController?
  private let builder: CarTemplateBuilder
  private let commands = MPRemoteCommandCenter.shared()
  private var observer: NSObjectProtocol?
  private var nextTarget: Any?
  private var previousTarget: Any?
  private var repeatTarget: Any?
  private var rateTarget: Any?
  /// The rates the car cycles through (JS `nextRate`), ascending.
  private static let supportedRates: [NSNumber] = [0.75, 1, 1.25, 1.5]
  private var lovedShown: Bool?
  private var rateShown: Double?
  /// CarPlay audio apps may stack at most five templates (tab bar root included).
  private static let maxTemplateDepth = 5
  private var upNextTemplate: CPListTemplate?
  /// Queue identity and current index the Up Next list was built from.
  private var upNextKey: String?
  private var isPushing = false

  init(interfaceController: CPInterfaceController, builder: CarTemplateBuilder) {
    self.interfaceController = interfaceController
    self.builder = builder
    super.init()
    let template = CPNowPlayingTemplate.shared
    template.add(self)
    template.isUpNextButtonEnabled = true
    template.isAlbumArtistButtonEnabled = true
    template.upNextTitle = "Up Next"
    commands.nextTrackCommand.isEnabled = true
    commands.previousTrackCommand.isEnabled = true
    nextTarget = commands.nextTrackCommand.addTarget { _ in
      CarBridge.shared.send(transport: ["kind": "next"])
      return .success
    }
    previousTarget = commands.previousTrackCommand.addTarget { _ in
      CarBridge.shared.send(transport: ["kind": "previous"])
      return .success
    }
    // The repeat button's state comes from currentRepeatType; the command is
    // enabled with a no-op target so CarPlay treats it as available. The
    // button's own handler sends cycleRepeat to JS.
    commands.changeRepeatModeCommand.isEnabled = true
    repeatTarget = commands.changeRepeatModeCommand.addTarget { _ in .success }
    commands.changePlaybackRateCommand.supportedPlaybackRates = Self.supportedRates
    commands.changePlaybackRateCommand.isEnabled = true
    rateTarget = commands.changePlaybackRateCommand.addTarget { event in
      guard let event = event as? MPChangePlaybackRateCommandEvent else { return .commandFailed }
      CarBridge.shared.send(transport: ["kind": "rate", "value": Double(event.playbackRate)])
      return .success
    }
    disableSkipCommands()
    observer = NotificationCenter.default.addObserver(
      forName: CarBridge.nowPlayingDidChange, object: nil, queue: .main
    ) { [weak self] _ in
      self?.updateButtons()
      self?.refreshUpNext()
    }
    updateButtons()
  }

  func tearDown() {
    CPNowPlayingTemplate.shared.remove(self)
    if let nextTarget { commands.nextTrackCommand.removeTarget(nextTarget) }
    if let previousTarget { commands.previousTrackCommand.removeTarget(previousTarget) }
    if let repeatTarget { commands.changeRepeatModeCommand.removeTarget(repeatTarget) }
    commands.changeRepeatModeCommand.isEnabled = false
    if let rateTarget { commands.changePlaybackRateCommand.removeTarget(rateTarget) }
    commands.changePlaybackRateCommand.isEnabled = false
    rateTarget = nil
    nextTarget = nil
    previousTarget = nil
    repeatTarget = nil
    commands.nextTrackCommand.isEnabled = false
    commands.previousTrackCommand.isEnabled = false
    if let observer { NotificationCenter.default.removeObserver(observer) }
    observer = nil
    upNextTemplate = nil
    upNextKey = nil
  }

  // MARK: Buttons

  private func updateButtons() {
    let np = CarBridge.shared.nowPlaying
    let loved = np?.isLoved == true
    let repeatMode = np?.repeatMode ?? "none"
    switch repeatMode {
    case "track": commands.changeRepeatModeCommand.currentRepeatType = .one
    case "queue": commands.changeRepeatModeCommand.currentRepeatType = .all
    default: commands.changeRepeatModeCommand.currentRepeatType = .off
    }
    // Any lock screen activation that slipped in before JS car mode must not
    // leave the 10s skip buttons in place of next/previous.
    disableSkipCommands()
    // The adhkar entry letting go of its track controls disables these.
    enableTrackCommands()
    if let np, np.rate > 0, np.rate != rateShown {
      rateShown = np.rate
      var info = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
      info[MPNowPlayingInfoPropertyDefaultPlaybackRate] = np.rate
      // expo-audio rewrites the live rate on its next tick; set it now so the
      // button label follows the tap without waiting for that tick.
      if np.isPlaying { info[MPNowPlayingInfoPropertyPlaybackRate] = np.rate }
      MPNowPlayingInfoCenter.default().nowPlayingInfo = info
    }
    // Only a loved change needs new buttons; repeat follows currentRepeatType.
    guard loved != lovedShown else { return }
    lovedShown = loved
    let rate = CPNowPlayingPlaybackRateButton { _ in
      CarBridge.shared.send(transport: ["kind": "cycleRate"])
    }
    let repeatButton = CPNowPlayingRepeatButton { _ in
      CarBridge.shared.send(transport: ["kind": "cycleRepeat"])
    }
    let loveImage = (UIImage(systemName: loved ? "heart.fill" : "heart") ?? UIImage())
      .withRenderingMode(.alwaysTemplate)
    let love = CPNowPlayingImageButton(image: loveImage) { _ in
      CarBridge.shared.send(transport: ["kind": "toggleLove"])
    }
    CPNowPlayingTemplate.shared.updateNowPlayingButtons([rate, repeatButton, love])
  }

  private func enableTrackCommands() {
    if !commands.nextTrackCommand.isEnabled { commands.nextTrackCommand.isEnabled = true }
    if !commands.previousTrackCommand.isEnabled { commands.previousTrackCommand.isEnabled = true }
  }

  /// JS car mode keeps these off on every lock screen activation; this covers
  /// the gap between the car connecting and JS applying car mode.
  private func disableSkipCommands() {
    if commands.skipForwardCommand.isEnabled { commands.skipForwardCommand.isEnabled = false }
    if commands.skipBackwardCommand.isEnabled { commands.skipBackwardCommand.isEnabled = false }
  }

  // MARK: Pushes

  /// True when a browse template may be pushed: Now Playing is on top and no
  /// push is already in flight.
  private func canPush() -> Bool {
    guard let ic = interfaceController, !isPushing else { return false }
    return ic.topTemplate === CPNowPlayingTemplate.shared
  }

  // MARK: CPNowPlayingTemplateObserver

  func nowPlayingTemplateUpNextButtonTapped(_ nowPlayingTemplate: CPNowPlayingTemplate) {
    guard let ic = interfaceController, canPush(), let np = CarBridge.shared.nowPlaying else { return }
    if let existing = upNextTemplate, ic.templates.contains(where: { $0 === existing }) { return }
    let template = builder.listTemplate(title: "Up Next", sections: upNextSections(np))
    upNextKey = Self.upNextKey(np)
    upNextTemplate = template
    isPushing = true
    let push: () -> Void = { [weak self] in
      ic.pushTemplate(template, animated: true) { _, _ in self?.isPushing = false }
    }
    // Deep in Library (list, reciter, rewayah, surahs, Now Playing) one more
    // template would pass the limit: restart from the tab root instead.
    guard ic.templates.count + 1 > Self.maxTemplateDepth else {
      push()
      return
    }
    ic.popToRootTemplate(animated: false) { _, _ in
      ic.pushTemplate(CPNowPlayingTemplate.shared, animated: false) { _, _ in push() }
    }
  }

  private static func upNextKey(_ np: CarNowPlaying) -> String {
    np.queue.map { "\($0.title)|\($0.subtitle)" }.joined(separator: "\n") + "#\(np.currentIndex)"
  }

  /// Keeps a visible Up Next list in step with skips and queue changes.
  private func refreshUpNext() {
    guard let template = upNextTemplate, let np = CarBridge.shared.nowPlaying,
      interfaceController?.templates.contains(where: { $0 === template }) == true
    else { return }
    let key = Self.upNextKey(np)
    guard key != upNextKey else { return }
    upNextKey = key
    builder.update(template, sections: upNextSections(np))
  }

  /// Like Apple Music: the current item, then what plays next.
  private func upNextSections(_ np: CarNowPlaying) -> [CPListSection] {
    let count = np.queue.count
    guard count > 0 else { return [CPListSection(items: [CPListItem(text: "Nothing here yet", detailText: nil)])] }
    let current = min(max(np.currentIndex, 0), count - 1)
    let end = min(count, current + CPListTemplate.maximumItemCount)
    let row = { (index: Int) -> CPListItem in
      let entry = np.queue[index]
      let item = CPListItem(text: entry.title, detailText: entry.subtitle, image: nil)
      if let surahId = entry.surahId { self.builder.setArtwork(item, .surah(surahId)) }
      item.isPlaying = index == current
      item.playingIndicatorLocation = .trailing
      item.handler = { [weak self] _, completion in
        CarBridge.shared.send(transport: ["kind": "jumpTo", "index": index])
        self?.popToNowPlaying()
        completion()
      }
      return item
    }
    var sections = [CPListSection(items: [row(current)], header: "Now playing", sectionIndexTitle: nil)]
    if current + 1 < end {
      sections.append(CPListSection(items: (current + 1..<end).map(row), header: "Next", sectionIndexTitle: nil))
    }
    return sections
  }

  func nowPlayingTemplateAlbumArtistButtonTapped(_ nowPlayingTemplate: CPNowPlayingTemplate) {
    guard let ic = interfaceController, canPush(), let reciterId = CarBridge.shared.nowPlaying?.reciterId,
      let reciter = CarBridge.shared.snapshot?.reciters.first(where: { $0.id == reciterId })
    else { return }
    // The reciter's picker or list is already in the stack: go back to it.
    if let existing = ic.templates.first(where: { ($0 as? CPListTemplate)?.title == reciter.name }) {
      ic.pop(to: existing, animated: true, completion: nil)
      return
    }
    // Reuses the Reciters tab flow: rewayah picker for multi-rewayah reciters,
    // surah list otherwise. Playing a surah pops back to Now Playing.
    let needed = reciter.rewayat.count > 1 ? 2 : 1
    isPushing = true
    let push: () -> Void = { [weak self] in
      guard let self else { return }
      self.builder.pushReciter(reciterId) { [weak self] in self?.isPushing = false }
    }
    if ic.templates.count + needed > Self.maxTemplateDepth {
      ic.popToRootTemplate(animated: false) { _, _ in push() }
      return
    }
    push()
  }

  private func popToNowPlaying() {
    guard let ic = interfaceController else { return }
    let nowPlaying = CPNowPlayingTemplate.shared
    guard ic.templates.contains(where: { $0 === nowPlaying }), ic.topTemplate !== nowPlaying else { return }
    ic.pop(to: nowPlaying, animated: true, completion: nil)
  }
}
