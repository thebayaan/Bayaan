import Foundation

enum CarVoiceKind {
  case item
  case playlist
}

/// One thing Siri can play: the play request JS runs (the same shape CarPlay
/// taps send) and how Siri should describe it.
struct CarVoiceMatch {
  let request: [String: Any]
  let identifier: String
  let title: String
  let artist: String?
  let kind: CarVoiceKind
}

/// Matches a Siri media search against the car snapshot. Pure functions of
/// the snapshot, so voice plays exactly what the car shows.
enum CarVoiceSearch {
  private static let reciterSeparators = [" recited by ", " read by ", " by ", " with ", " from "]
  private static let honorifics: Set<String> = ["sheikh", "shaykh", "shaikh", "imam", "qari", "al", "el", "ash", "as", "ad"]

  /// Folds case and diacritics, drops a leading "surah" / "the" and an Arabic
  /// article, and keeps letters and digits only: "Surat Al-Kahf" -> "kahf".
  static func normalize(_ text: String) -> String {
    var s = text.folding(options: [.diacriticInsensitive, .caseInsensitive, .widthInsensitive], locale: nil)
      .lowercased()
      .trimmingCharacters(in: .whitespacesAndNewlines)
    for prefix in ["surah ", "surat ", "suratul ", "sura ", "soorah ", "the "] where s.hasPrefix(prefix) {
      s.removeFirst(prefix.count)
      break
    }
    if let article = s.range(of: #"^(al|an|ar|as|at|ad|adh|ash|az|ul)[\s\-'’]+"#, options: .regularExpression) {
      s.removeSubrange(article)
    }
    if s.hasPrefix("ال") { s.removeFirst(2) }
    return String(s.unicodeScalars.filter { CharacterSet.alphanumerics.contains($0) })
  }

  /// Name words without honorifics or articles: "Sheikh Mishary Al-Afasy" ->
  /// ["mishary", "afasy"].
  static func tokens(_ text: String) -> [String] {
    text.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: nil)
      .lowercased()
      .components(separatedBy: CharacterSet.alphanumerics.inverted)
      .flatMap { word -> [String] in
        // "alafasy" and "al-afasy" should meet: split a glued article off.
        if word.count > 4, word.hasPrefix("al") { return [String(word.dropFirst(2))] }
        return [word]
      }
      .filter { !$0.isEmpty && !honorifics.contains($0) }
  }

  /// Spelling-insensitive form for English transliterations: "Yaseen" and
  /// "Ya-Sin" -> "yasin", "Baqara" and "Al-Baqarah" -> "baqara".
  static func phonetic(_ normalized: String) -> String {
    var s = normalized
    for (from, to) in [("ee", "i"), ("ii", "i"), ("oo", "u"), ("ou", "u"), ("uu", "u"), ("aa", "a"), ("'", "")] {
      s = s.replacingOccurrences(of: from, with: to)
    }
    var collapsed = ""
    for ch in s where collapsed.last != ch { collapsed.append(ch) }
    if collapsed.count > 3, collapsed.hasSuffix("h") { collapsed.removeLast() }
    return collapsed
  }

  static func distance(_ a: String, _ b: String) -> Int {
    let a = Array(a), b = Array(b)
    if a.isEmpty { return b.count }
    if b.isEmpty { return a.count }
    var previous = Array(0...b.count)
    for i in 1...a.count {
      var current = [i] + Array(repeating: 0, count: b.count)
      for j in 1...b.count {
        current[j] = min(
          previous[j] + 1,
          current[j - 1] + 1,
          previous[j - 1] + (a[i - 1] == b[j - 1] ? 0 : 1))
      }
      previous = current
    }
    return previous[b.count]
  }

  /// Close enough for speech: one edit for short names, two for longer ones.
  static func isNear(_ a: String, _ b: String) -> Bool {
    guard min(a.count, b.count) >= 4 else { return false }
    return distance(a, b) <= (max(a.count, b.count) >= 8 ? 2 : 1)
  }

  static func surahScore(_ query: String, _ surah: CarSurah) -> Int {
    let q = normalize(query)
    guard !q.isEmpty else { return 0 }
    if q == String(surah.id) { return 100 }
    let names = [normalize(surah.name), normalize(surah.nameArabic)]
    if names.contains(q) { return 100 }
    let translation = normalize(surah.translation)
    if q == translation { return 95 }
    if names.contains(where: { phonetic($0) == phonetic(q) }) { return 90 }
    if names.contains(where: { isNear($0, q) }) { return 85 }
    if q.count >= 4, names.contains(where: { $0.hasPrefix(q) || $0.contains(q) }) { return 75 }
    if isNear(translation, q) { return 70 }
    return 0
  }

  static func reciterScore(_ query: String, _ reciter: CarReciter) -> Int {
    let q = normalize(query)
    let name = normalize(reciter.name)
    guard !q.isEmpty else { return 0 }
    if q == name { return 100 }
    let queryTokens = tokens(query)
    let nameTokens = tokens(reciter.name)
    guard !queryTokens.isEmpty else { return 0 }
    let allFound = queryTokens.allSatisfy { qt in nameTokens.contains { $0 == qt || isNear($0, qt) } }
    if allFound { return queryTokens.count > 1 ? 90 : 80 }
    if q.count >= 4, name.contains(q) { return 75 }
    let someFound = queryTokens.contains { qt in qt.count >= 4 && nameTokens.contains { $0 == qt || isNear($0, qt) } }
    return someFound ? 60 : 0
  }

  static func listScore(_ query: String, _ list: CarList) -> Int {
    var q = normalize(query)
    if q.count > 4, q.hasPrefix("my") { q.removeFirst(2) }
    let title = normalize(list.title)
    guard !q.isEmpty else { return 0 }
    if q == title { return 100 }
    let aliases: [String: [String]] = [
      "loved": ["liked", "likes", "favorites", "favourites", "lovedsurahs", "lovedones", "hearts"],
      "downloads": ["downloaded", "offline", "downloadedsurahs"],
      "uploads": ["recitations", "recordings", "uploaded"],
    ]
    if aliases[list.id]?.contains(q) == true { return 95 }
    if isNear(title, q) { return 85 }
    if q.count >= 5, title.hasPrefix(q) { return 70 }
    return 0
  }

  /// "kahf by mishary" -> ("kahf", "mishary").
  static func splitReciter(_ text: String) -> (String, String?) {
    let lower = text.lowercased()
    for separator in reciterSeparators {
      if let range = lower.range(of: separator) {
        let head = String(text[text.startIndex..<range.lowerBound])
        let tail = String(text[range.upperBound...])
        if !head.trimmingCharacters(in: .whitespaces).isEmpty { return (head, tail) }
      }
    }
    return (text, nil)
  }

  static func bestReciter(_ query: String, in snapshot: CarSnapshot) -> CarReciter? {
    let scored = snapshot.reciters
      .map { ($0, reciterScore(query, $0)) }
      .filter { $0.1 >= 60 }
    // Ties go to favourites, then the snapshot (catalogue) order.
    return scored.max { a, b in
      if a.1 != b.1 { return a.1 < b.1 }
      return !a.0.isFavorite && b.0.isFavorite
    }?.0
  }

  /// The reciter's rewayah that has `surahId`, preferring the fullest.
  static func rewayah(_ reciter: CarReciter, for surahId: Int) -> CarRewayah? {
    reciter.rewayat
      .filter { $0.surahIds.contains(surahId) }
      .max { $0.surahIds.count < $1.surahIds.count }
  }

  static func surahMatch(_ surah: CarSurah, preferred: CarReciter?, in snapshot: CarSnapshot) -> CarVoiceMatch? {
    var candidates: [CarReciter] = []
    if let preferred { candidates.append(preferred) }
    if let top = snapshot.reciters.first(where: { $0.id == snapshot.topReciterId }) { candidates.append(top) }
    candidates += snapshot.reciters.filter { $0.isFavorite }
    candidates += snapshot.reciters
    for reciter in candidates {
      guard let rewayah = rewayah(reciter, for: surah.id) else { continue }
      return CarVoiceMatch(
        request: ["kind": "surah", "reciterId": reciter.id, "rewayatId": rewayah.id, "surahId": surah.id],
        identifier: "surah:\(reciter.id):\(rewayah.id):\(surah.id)",
        title: surah.name,
        artist: reciter.name,
        kind: .item)
    }
    return nil
  }

  static func listMatch(_ list: CarList, shuffle: Bool) -> CarVoiceMatch? {
    guard let first = list.items.first, case .play(let raw) = first.action else { return nil }
    var request = raw.value
    request["startIndex"] = 0
    if shuffle, request["kind"] as? String == "loved" { request["shuffle"] = true }
    return CarVoiceMatch(
      request: request,
      identifier: "list:\(list.id)",
      title: list.title,
      artist: nil,
      kind: .playlist)
  }

  static func jumpBackIn(_ snapshot: CarSnapshot) -> [CarItem] {
    snapshot.home.sections.first { $0.id == "jump-back-in" }?.items ?? []
  }

  /// A reciter alone: their latest Jump back in entry, else their first surah.
  static func reciterMatch(_ reciter: CarReciter, in snapshot: CarSnapshot) -> CarVoiceMatch? {
    for item in jumpBackIn(snapshot) where item.subtitle == reciter.name {
      if case .play(let raw) = item.action {
        return CarVoiceMatch(
          request: raw.value, identifier: "recent:\(item.id)", title: item.title, artist: reciter.name, kind: .item)
      }
    }
    guard let rewayah = reciter.rewayat.max(by: { $0.surahIds.count < $1.surahIds.count }),
      let surahId = rewayah.surahIds.min(),
      let surah = snapshot.surahs.first(where: { $0.id == surahId })
    else { return nil }
    return surahMatch(surah, preferred: reciter, in: snapshot)
  }

  static func resumeMatch(_ snapshot: CarSnapshot) -> CarVoiceMatch? {
    guard let first = jumpBackIn(snapshot).first else { return nil }
    return CarVoiceMatch(
      request: ["kind": "resume"], identifier: "resume", title: first.title, artist: first.subtitle, kind: .item)
  }

  /// Best match first. Empty when nothing in the snapshot fits.
  static func search(
    mediaName: String?,
    artistName: String?,
    wantsPlaylist: Bool,
    shuffle: Bool,
    in snapshot: CarSnapshot
  ) -> [CarVoiceMatch] {
    let trimmedName = mediaName?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    var name = trimmedName
    var artist = artistName?.trimmingCharacters(in: .whitespacesAndNewlines)
    if artist?.isEmpty ?? true, !name.isEmpty {
      let (head, tail) = splitReciter(name)
      name = head.trimmingCharacters(in: .whitespaces)
      artist = tail?.trimmingCharacters(in: .whitespaces)
    }
    let reciter = artist.flatMap { $0.isEmpty ? nil : bestReciter($0, in: snapshot) }

    if name.isEmpty {
      if let reciter, let match = reciterMatch(reciter, in: snapshot) { return [match] }
      if let match = resumeMatch(snapshot) { return [match] }
      return []
    }

    let lists = snapshot.lists.values
      .map { ($0, listScore(name, $0)) }
      .filter { $0.1 >= 70 }
      .sorted { $0.1 > $1.1 }
    let surahs = snapshot.surahs
      .map { ($0, surahScore(name, $0)) }
      .filter { $0.1 >= 70 }
      .sorted { $0.1 > $1.1 }

    var results: [CarVoiceMatch] = []
    let preferLists = wantsPlaylist || (lists.first?.1 ?? 0) > (surahs.first?.1 ?? 0)
    let listResults = lists.compactMap { listMatch($0.0, shuffle: shuffle) }
    let surahResults = surahs.prefix(3).compactMap { surahMatch($0.0, preferred: reciter, in: snapshot) }
    results += preferLists ? listResults + surahResults : surahResults + listResults

    // "Play Mishary": the name was a reciter, not a surah or playlist.
    if results.isEmpty, artist == nil, let spoken = bestReciter(name, in: snapshot),
      let match = reciterMatch(spoken, in: snapshot)
    {
      results.append(match)
    }
    return Array(results.prefix(5))
  }
}
