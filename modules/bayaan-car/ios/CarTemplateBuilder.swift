import CarPlay
import CoreMedia
import UIKit

/// Main-thread only. Builds the four root tabs from `CarBridge.shared.snapshot`
/// and the pushed browse templates on demand.
final class CarTemplateBuilder {
  private weak var interfaceController: CPInterfaceController?
  private let style: () -> UIUserInterfaceStyle
  private let displayScale: () -> CGFloat
  private var builtStyle: UIUserInterfaceStyle?
  /// What each non-Home tab was last built from. Playback rebuilds the
  /// snapshot every 10% for Jump back in progress; only Home needs that, so
  /// the other tabs keep their rows (and scroll position) unless their own
  /// content or the light/dark style changed.
  private var tabSignatures: [ObjectIdentifier: String] = [:]
  /// Artwork loads registered while building, started only for items that
  /// survive `clamp`, then cleared.
  private var loaders: [ObjectIdentifier: () -> Void] = [:]
  private let homeTemplate = CPListTemplate(title: "Home", sections: [])
  private let libraryTemplate = CPListTemplate(title: "Library", sections: [])
  private let recitersTemplate = CPListTemplate(title: "Reciters", sections: [])
  private let surahsTemplate = CPListTemplate(title: "Surahs", sections: [])
  /// No title: a titled tab shows its title, an untitled one its system
  /// item's icon (the magnifier).
  private let searchTemplate = CPListTemplate(title: nil, sections: [])

  private static var emptyCopy: String { "Open \(CarBrand.name) on your phone to get started" }
  private static let nothingYet = "Nothing here yet"
  /// Recent plays under the Siri cell on the Search tab.
  private static let searchRecentCount = 6

  init(
    interfaceController: CPInterfaceController,
    style: @escaping () -> UIUserInterfaceStyle,
    displayScale: @escaping () -> CGFloat
  ) {
    self.interfaceController = interfaceController
    self.style = style
    self.displayScale = displayScale
    homeTemplate.tabTitle = "Home"
    homeTemplate.tabImage = UIImage(systemName: "house.fill")
    libraryTemplate.tabTitle = "Library"
    libraryTemplate.tabImage = UIImage(systemName: "books.vertical.fill")
    recitersTemplate.tabTitle = "Reciters"
    recitersTemplate.tabImage = UIImage(systemName: "person.2.fill")
    surahsTemplate.tabTitle = "Surahs"
    surahsTemplate.tabImage = UIImage(systemName: "list.number")
    // The search system item draws as CarPlay's detached search button. Its
    // first row is the Siri cell for audio apps, which opens Siri to play
    // something ("Al-Kahf by Mishary"), handled by BayaanCarSiri.
    searchTemplate.tabSystemItem = .search
    searchTemplate.assistantCellConfiguration = CPAssistantCellConfiguration(
      position: .top, visibility: .always, assistantAction: .playMedia)
  }

  func tabTemplates() -> [CPTemplate] {
    refresh()
    // Search only when the build has Siri, or its one action would lead
    // nowhere. Over the car's tab limit, Reciters gives way: favorites stay
    // in Library and on Home, and any reciter is a sentence away by voice.
    var tabs: [CPTemplate] = [homeTemplate, libraryTemplate, recitersTemplate, surahsTemplate]
    guard BayaanCarSiri.isSiriEnabled else { return Array(tabs.prefix(CPTabBarTemplate.maximumTabCount)) }
    tabs.append(searchTemplate)
    if tabs.count > CPTabBarTemplate.maximumTabCount { tabs.removeAll { $0 === recitersTemplate } }
    return Array(tabs.prefix(CPTabBarTemplate.maximumTabCount))
  }

  /// Called from `contentStyleDidChange` (and as a fallback when the scene
  /// becomes active). Rebuilds once if the car's light/dark style changed.
  func refreshIfStyleChanged() {
    guard let built = builtStyle, built != currentStyle else { return }
    refresh()
  }

  private var currentStyle: UIUserInterfaceStyle { style() }
  private var scale: CGFloat {
    let value = displayScale()
    return value > 0 ? value : 2
  }

  func refresh() {
    builtStyle = currentStyle
    guard let snapshot = CarBridge.shared.snapshot else {
      [homeTemplate, libraryTemplate, recitersTemplate, surahsTemplate].forEach {
        $0.updateSections([emptyState(Self.emptyCopy)])
      }
      tabSignatures.removeAll()
      return
    }
    homeTemplate.updateSections(clamp(homeSections(snapshot)))
    let style = "#\(currentStyle.rawValue)"
    updateTab(libraryTemplate, signature: Self.librarySignature(snapshot) + style) { librarySections(snapshot) }
    updateTab(recitersTemplate, signature: Self.recitersSignature(snapshot) + style) { reciterSections(snapshot) }
    updateTab(surahsTemplate, signature: Self.surahsSignature(snapshot) + style) { surahSections(snapshot) }
    let recent = Self.searchRecent(snapshot)
    let recentSignature = recent.map { "\($0.id)|\($0.title)|\($0.subtitle ?? "")" }.joined(separator: "\n")
    updateTab(searchTemplate, signature: recentSignature + style) { searchSections(recent) }
  }

  private static func searchRecent(_ s: CarSnapshot) -> [CarItem] {
    Array((s.home.sections.first { $0.id == "jump-back-in" }?.items ?? []).prefix(searchRecentCount))
  }

  private func searchSections(_ recent: [CarItem]) -> [CPListSection] {
    recent.isEmpty ? [] : [CPListSection(items: recent.map(listItem), header: "Recent", sectionIndexTitle: nil)]
  }

  private func updateTab(_ template: CPListTemplate, signature: String, sections: () -> [CPListSection]) {
    let key = ObjectIdentifier(template)
    guard tabSignatures[key] != signature else { return }
    tabSignatures[key] = signature
    template.updateSections(clamp(sections()))
  }

  private static func librarySignature(_ s: CarSnapshot) -> String {
    s.library.map { "\($0.id)|\($0.title)|\($0.subtitle ?? "")|\($0.artwork)" }.joined(separator: "\n")
  }

  private static func recitersSignature(_ s: CarSnapshot) -> String {
    s.reciters.map { "\($0.id)|\($0.name)|\($0.isFavorite)|\($0.artwork)|\($0.rewayat.count)" }
      .joined(separator: "\n")
  }

  private static func surahsSignature(_ s: CarSnapshot) -> String {
    let juz = s.juz.map { "\($0.number):\($0.title ?? ""):\($0.surahIds)" }.joined(separator: ",")
    return juz + "|\(s.surahs.count)|\(s.surahArtworkBase ?? "")"
  }

  // MARK: Limits

  /// Enforces CarPlay's section and total item limits. An image row counts as one item.
  private func clamp(_ sections: [CPListSection]) -> [CPListSection] {
    let result = clampSections(sections)
    startArtwork(for: result)
    return result
  }

  private func emptyState(_ text: String) -> CPListSection {
    CPListSection(items: [CPListItem(text: text, detailText: nil)])
  }

  /// Starts artwork loads only for items that made it into a template.
  private func startArtwork(for sections: [CPListSection]) {
    let pending = loaders
    loaders.removeAll()
    for section in sections {
      for item in section.items {
        pending[ObjectIdentifier(item)]?()
      }
    }
  }

  private func clampSections(_ sections: [CPListSection]) -> [CPListSection] {
    var remaining = CPListTemplate.maximumItemCount
    var result: [CPListSection] = []
    for section in sections.prefix(CPListTemplate.maximumSectionCount) {
      guard remaining > 0 else { break }
      if section.items.count <= remaining {
        result.append(section)
        remaining -= section.items.count
        continue
      }
      result.append(CPListSection(
        items: Array(section.items.prefix(remaining)), header: section.header, sectionIndexTitle: section.sectionIndexTitle))
      remaining = 0
    }
    return result
  }

  func listTemplate(title: String, sections: [CPListSection]) -> CPListTemplate {
    CPListTemplate(title: title, sections: clamp(sections))
  }

  /// Replaces a pushed list's rows, clamped and with their artwork started.
  func update(_ template: CPListTemplate, sections: [CPListSection]) {
    template.updateSections(clamp(sections))
  }

  private func peek(_ art: CarArtwork, size: CGFloat) -> UIImage {
    CarArtworkCache.shared.peek(for: art, size: size, scale: scale, style: currentStyle)
  }

  /// Gives `item` a placeholder (or cached image) now and updates that same
  /// item in place when the real image arrives. Never rebuilds templates.
  func setArtwork(_ item: CPListItem, _ art: CarArtwork) {
    let size = CPListItem.maximumImageSize.width
    item.setImage(peek(art, size: size))
    let (scale, style) = (self.scale, currentStyle)
    loaders[ObjectIdentifier(item)] = { [weak item] in
      CarArtworkCache.shared.load(for: art, size: size, scale: scale, style: style) { image in
        item?.setImage(image)
      }
    }
  }

  // MARK: Home

  private func homeSections(_ s: CarSnapshot) -> [CPListSection] {
    var sections: [CPListSection] = []
    for section in s.home.sections where !section.items.isEmpty {
      switch section.style {
      case "circles", "cards":
        sections.append(CPListSection(items: [homeImageRow(section)]))
      default:
        let header = section.title.isEmpty ? nil : section.title
        sections.append(CPListSection(items: section.items.map(listItem), header: header, sectionIndexTitle: nil))
      }
    }
    if sections.isEmpty {
      sections.append(emptyState(Self.nothingYet))
    }
    return sections
  }

  private static var hasDetailsHeader: Bool {
    if #available(iOS 26.4, *) { return true }
    return false
  }

  private func homeImageRow(_ section: CarSection) -> CPListImageRowItem {
    if #available(iOS 26.0, *) {
      return elementImageRow(title: section.title, items: section.items, circular: section.style == "circles")
    }
    return imageRow(title: section.title, items: section.items)
  }

  /// iOS 26+ element based row. Each element's `image` is assigned in place when
  /// the real artwork arrives (`updateImages:` is unsupported on iOS 26).
  @available(iOS 26.0, *)
  private func elementImageRow(title: String, items: [CarItem], circular: Bool) -> CPListImageRowItem {
    let limited = Array(items.prefix(CPMaximumNumberOfGridImages))
    let size =
      circular
      ? CPListImageRowItemImageGridElement.maximumImageSize.width
      : CPListImageRowItemCardElement.maximumImageSize.width
    let row: CPListImageRowItem
    if circular {
      let elements = limited.map {
        CPListImageRowItemImageGridElement(
          image: peek($0.artwork, size: size), imageShape: .circular, title: $0.title, accessorySymbolName: nil)
      }
      row = CPListImageRowItem(text: title, imageGridElements: elements, allowsMultipleLines: false)
    } else {
      let elements = limited.map {
        CPListImageRowItemCardElement(
          image: peek($0.artwork, size: size), showsImageFullHeight: false, title: $0.title, subtitle: $0.subtitle,
          tintColor: nil)
      }
      row = CPListImageRowItem(text: title, cardElements: elements, allowsMultipleLines: false)
    }
    let (scale, style) = (self.scale, currentStyle)
    loaders[ObjectIdentifier(row)] = { [weak row] in
      var pending: [Int: UIImage] = [:]
      var flushScheduled = false
      for (index, item) in limited.enumerated() {
        CarArtworkCache.shared.load(for: item.artwork, size: size, scale: scale, style: style) { image in
          guard let row else { return }
          pending[index] = image
          guard !flushScheduled else { return }
          flushScheduled = true
          // Elements have no update hook, so the array is reassigned (one
          // reassignment per run-loop turn) to make the row repaint.
          DispatchQueue.main.async { [weak row] in
            flushScheduled = false
            guard let row else { return }
            let elements = row.elements
            for (i, img) in pending where elements.indices.contains(i) { elements[i].image = img }
            pending.removeAll()
            row.elements = elements
          }
        }
      }
    }
    row.listImageRowHandler = { [weak self] _, index, completion in
      if limited.indices.contains(index) { self?.perform(limited[index]) }
      completion()
    }
    row.handler = { _, completion in completion() }
    return row
  }

  private func imageRow(title: String, items: [CarItem]) -> CPListImageRowItem {
    let limited = Array(items.prefix(CPMaximumNumberOfGridImages))
    let size = CPListImageRowItem.maximumImageSize.width
    var images = limited.map { peek($0.artwork, size: size) }
    let row = CPListImageRowItem(text: title, images: images)
    let (scale, style) = (self.scale, currentStyle)
    loaders[ObjectIdentifier(row)] = { [weak row] in
      for (index, item) in limited.enumerated() {
        CarArtworkCache.shared.load(for: item.artwork, size: size, scale: scale, style: style) { image in
          guard let row, images.indices.contains(index) else { return }
          images[index] = image
          row.update(images)
        }
      }
    }
    row.listImageRowHandler = { [weak self] _, index, completion in
      if limited.indices.contains(index) { self?.perform(limited[index]) }
      completion()
    }
    row.handler = { _, completion in completion() }
    return row
  }

  // MARK: Library

  private func librarySections(_ s: CarSnapshot) -> [CPListSection] {
    if s.library.isEmpty {
      return [emptyState(Self.nothingYet)]
    }
    return [CPListSection(items: s.library.map(listItem))]
  }

  // MARK: Generic items

  private func listItem(_ item: CarItem) -> CPListItem {
    let row = CPListItem(text: item.title, detailText: item.subtitle, image: nil)
    setArtwork(row, item.artwork)
    if let progress = item.progress { setProgress(row, min(max(progress, 0), 1), duration: item.duration) }
    if case .play = item.action {} else { row.accessoryType = .disclosureIndicator }
    row.handler = { [weak self] _, completion in
      self?.perform(item)
      completion()
    }
    return row
  }

  /// `playbackProgress` alone drew no bar on an iOS 26 device, so 26.4+ also
  /// gets a `playbackConfiguration` when the length is known.
  private func setProgress(_ row: CPListItem, _ fraction: Double, duration: Double?) {
    row.playbackProgress = CGFloat(fraction)
    guard #available(iOS 26.4, *), let duration, duration > 0 else { return }
    row.playbackConfiguration = CPPlaybackConfiguration(
      preferredPresentation: .audio,
      playbackAction: .play,
      elapsedTime: CMTime(seconds: fraction * duration, preferredTimescale: 600),
      duration: CMTime(seconds: duration, preferredTimescale: 600)
    )
  }

  private func perform(_ item: CarItem) {
    switch item.action {
    case .play(let raw): play(raw.value)
    case .browseList(let id): pushList(id)
    case .browseReciter(let id): pushReciter(id)
    case .browseSurahReciters(let id): pushSurahReciters(id)
    }
  }

  private func play(_ request: [String: Any]) {
    CarBridge.shared.send(play: request)
    guard let ic = interfaceController else { return }
    let nowPlaying = CPNowPlayingTemplate.shared
    if ic.templates.contains(where: { $0 === nowPlaying }) {
      if ic.topTemplate !== nowPlaying { ic.pop(to: nowPlaying, animated: true, completion: nil) }
      return
    }
    ic.pushTemplate(nowPlaying, animated: true, completion: nil)
  }

  private func pushList(_ id: String) {
    guard let list = CarBridge.shared.snapshot?.lists[id] else { return }
    let items = list.items.isEmpty ? [CPListItem(text: Self.nothingYet, detailText: nil)] : list.items.map(listItem)
    interfaceController?.pushTemplate(
      listTemplate(title: list.title, sections: [CPListSection(items: items)]), animated: true, completion: nil)
  }

  // MARK: Reciters

  private func reciterSections(_ s: CarSnapshot) -> [CPListSection] {
    let favorites = s.reciters.filter { $0.isFavorite }
    let others = s.reciters.filter { !$0.isFavorite }
    var sections: [CPListSection] = []
    if !favorites.isEmpty {
      sections.append(CPListSection(items: favorites.map(reciterItem), header: "Favorite reciters", sectionIndexTitle: nil))
    }
    if !others.isEmpty {
      sections.append(CPListSection(items: others.map(reciterItem), header: "All reciters", sectionIndexTitle: nil))
    }
    return sections
  }

  private func reciterItem(_ r: CarReciter) -> CPListItem {
    let item = CPListItem(
      text: r.name, detailText: r.rewayat.count > 1 ? "\(r.rewayat.count) rewayat" : nil, image: nil)
    setArtwork(item, r.artwork)
    item.accessoryType = .disclosureIndicator
    item.handler = { [weak self] _, completion in
      self?.pushReciter(r.id)
      completion()
    }
    return item
  }

  /// `completion` runs once the template is on screen, or immediately when
  /// nothing could be pushed.
  func pushReciter(_ id: String, completion: (() -> Void)? = nil) {
    guard let reciter = CarBridge.shared.snapshot?.reciters.first(where: { $0.id == id }) else {
      completion?()
      return
    }
    if reciter.rewayat.count == 1, let only = reciter.rewayat.first {
      pushRewayah(reciter, only, completion: completion)
      return
    }
    let items = reciter.rewayat.map { w -> CPListItem in
      let item = CPListItem(text: w.name, detailText: "\(w.surahIds.count) surahs")
      item.accessoryType = .disclosureIndicator
      item.handler = { [weak self] _, completion in
        self?.pushRewayah(reciter, w)
        completion()
      }
      return item
    }
    let shown = items.isEmpty ? [CPListItem(text: Self.nothingYet, detailText: nil)] : items
    push(listTemplate(title: reciter.name, sections: [CPListSection(items: shown)]), completion: completion)
  }

  private func push(_ template: CPTemplate, completion: (() -> Void)?) {
    guard let ic = interfaceController else {
      completion?()
      return
    }
    ic.pushTemplate(template, animated: true) { _, _ in completion?() }
  }

  private func pushRewayah(_ reciter: CarReciter, _ rewayah: CarRewayah, completion: (() -> Void)? = nil) {
    guard let s = CarBridge.shared.snapshot else {
      completion?()
      return
    }
    let downloaded = Set(s.downloadedKeys)
    let byId = Dictionary(s.surahs.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
    let items = rewayah.surahIds.compactMap { sid -> CPListItem? in
      guard let surah = byId[sid] else { return nil }
      let isDownloaded = downloaded.contains("\(reciter.id):\(rewayah.id):\(sid)")
      let item = CPListItem(
        text: "\(sid). \(surah.name)",
        detailText: isDownloaded ? "\(surah.translation) · Downloaded" : surah.translation,
        image: nil)
      setArtwork(item, .surah(sid))
      item.handler = { [weak self] _, completion in
        self?.play(["kind": "surah", "reciterId": reciter.id, "rewayatId": rewayah.id, "surahId": sid])
        completion()
      }
      return item
    }
    var rows = items
    if !rows.isEmpty, !Self.hasDetailsHeader {
      // No details header before iOS 26.4: show the reciter as an inert first row.
      let card = CPListItem(text: reciter.name, detailText: rewayah.name, image: nil)
      setArtwork(card, reciter.artwork)
      card.handler = { _, completion in completion() }
      rows.insert(card, at: 0)
    }
    let shown = rows.isEmpty ? [CPListItem(text: Self.nothingYet, detailText: nil)] : rows
    let template = listTemplate(title: reciter.name, sections: [CPListSection(items: shown)])
    if #available(iOS 26.4, *) { template.listHeader = reciterHeader(reciter, rewayah, template: template) }
    push(template, completion: completion)
  }

  /// iOS 26.4+ large reciter card above the surah list. The thumbnail image is
  /// assigned in place when the artwork arrives.
  @available(iOS 26.4, *)
  private func reciterHeader(
    _ reciter: CarReciter, _ rewayah: CarRewayah, template: CPListTemplate
  ) -> CPListTemplateDetailsHeader {
    // @ai-start
    // The card-element size is available in the supported Xcode 26 SDK.
    // CPThumbnailImage.maximumImageSize requires the iOS 27 SDK to compile.
    let size = CPListImageRowItemCardElement.maximumImageSize.width
    // @ai-end
    let thumbnail = CPThumbnailImage(image: peek(reciter.artwork, size: size))
    let header = CPListTemplateDetailsHeader(
      thumbnail: thumbnail, title: reciter.name, subtitle: rewayah.name, actionButtons: [])
    CarArtworkCache.shared.load(for: reciter.artwork, size: size, scale: scale, style: currentStyle) {
      [weak template, weak header] image in
      guard let template, let header else { return }
      // The header has no update hook; reassigning it is the live update path.
      header.thumbnail = CPThumbnailImage(image: image)
      template.listHeader = header
    }
    return header
  }

  // MARK: Surahs

  /// One section per juz (each surah under the juz it starts in), so the list
  /// doubles as the Juz view.
  private func surahSections(_ s: CarSnapshot) -> [CPListSection] {
    let byId = Dictionary(s.surahs.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
    return s.juz.compactMap { juz -> CPListSection? in
      let rows = juz.surahIds.compactMap { byId[$0] }.map(surahRow)
      guard !rows.isEmpty else { return nil }
      return CPListSection(items: rows, header: juz.title ?? "Juz \(juz.number)", sectionIndexTitle: "\(juz.number)")
    }
  }

  private func surahRow(_ surah: CarSurah) -> CPListItem {
    let item = CPListItem(text: "\(surah.id). \(surah.name)", detailText: surah.translation, image: nil)
    setArtwork(item, .surah(surah.id))
    item.accessoryType = .disclosureIndicator
    item.handler = { [weak self] _, completion in
      self?.pushSurahReciters(surah.id)
      completion()
    }
    return item
  }

  private func pushSurahReciters(_ surahId: Int) {
    guard let s = CarBridge.shared.snapshot, let surah = s.surahs.first(where: { $0.id == surahId }) else { return }
    var items: [CPListItem] = []
    if let topId = s.topReciterId,
      let top = s.reciters.first(where: { $0.id == topId }),
      let rewayah = top.rewayat.first(where: { $0.surahIds.contains(surahId) })
    {
      let row = CPListItem(
        text: "Play with \(top.name)", detailText: rewayah.name, image: UIImage(systemName: "play.circle.fill"))
      row.handler = { [weak self] _, completion in
        self?.play(["kind": "surah", "reciterId": top.id, "rewayatId": rewayah.id, "surahId": surahId])
        completion()
      }
      items.append(row)
    }
    let choices = s.reciters.compactMap { r -> CPListItem? in
      guard let rewayah = r.rewayat.first(where: { $0.surahIds.contains(surahId) }) else { return nil }
      let item = CPListItem(text: r.name, detailText: r.rewayat.count > 1 ? rewayah.name : nil, image: nil)
      setArtwork(item, r.artwork)
      item.handler = { [weak self] _, completion in
        self?.play(["kind": "surah", "reciterId": r.id, "rewayatId": rewayah.id, "surahId": surahId])
        completion()
      }
      return item
    }
    var sections: [CPListSection] = []
    if !items.isEmpty { sections.append(CPListSection(items: items)) }
    if !choices.isEmpty { sections.append(CPListSection(items: choices, header: "Choose reciter", sectionIndexTitle: nil)) }
    if sections.isEmpty { sections.append(emptyState(Self.nothingYet)) }
    interfaceController?.pushTemplate(listTemplate(title: surah.name, sections: sections), animated: true, completion: nil)
  }
}
