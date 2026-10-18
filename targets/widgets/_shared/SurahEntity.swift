// targets/widgets/_shared/SurahEntity.swift
// In _shared so the app (Siri, App Shortcuts) and the extension (Quick Surah,
// Play Surah control) resolve the same entity. iOS 17, like every intent using it.
import AppIntents
import Foundation

@available(iOS 17.0, *)
struct SurahEntity: AppEntity {
  static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Surah")
  static var defaultQuery = SurahEntityQuery()
  /// Al-Kahf: what the Play Surah control plays until a surah is chosen.
  static var fallback: SurahEntity { SurahEntity(SurahCatalog.all[17]) }

  let id: Int
  let name: String
  let translatedName: String

  var displayRepresentation: DisplayRepresentation {
    DisplayRepresentation(
      title: "\(name)",
      subtitle: "\(id) · \(translatedName)",
      synonyms: SurahSynonyms.of(name: name, translatedName: translatedName).map { "\($0)" })
  }

  init(_ surah: SurahName) {
    id = surah.id
    name = surah.name
    translatedName = surah.translatedName
  }
}

@available(iOS 17.0, *)
struct SurahEntityQuery: EntityStringQuery {
  func entities(for identifiers: [Int]) async throws -> [SurahEntity] {
    identifiers.compactMap { SurahCatalog.surah($0).map(SurahEntity.init) }
  }

  func suggestedEntities() async throws -> [SurahEntity] {
    SurahCatalog.all.map(SurahEntity.init)
  }

  func entities(matching string: String) async throws -> [SurahEntity] {
    let q = string.lowercased().trimmingCharacters(in: .whitespaces)
    return SurahCatalog.all.filter { surah in
      String(surah.id) == q
        || SurahSynonyms.of(name: surah.name, translatedName: surah.translatedName)
          .contains { $0.lowercased().contains(q) }
    }.map(SurahEntity.init)
  }
}
