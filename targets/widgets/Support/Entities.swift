// targets/widgets/Support/Entities.swift
// SurahEntity and ReciterEntity live in _shared (the app needs them for Siri).
import AppIntents
import Foundation

struct DhikrEntity: AppEntity {
  static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Dhikr")
  static var defaultQuery = DhikrEntityQuery()

  let id: String
  let arabic: String
  let translation: String?

  var displayRepresentation: DisplayRepresentation {
    DisplayRepresentation(title: "\(translation ?? arabic)", subtitle: "\(arabic)")
  }

  init(_ dhikr: WidgetCatalogDhikr) {
    id = dhikr.id
    arabic = dhikr.arabic
    translation = dhikr.translation
  }
}

struct DhikrEntityQuery: EntityStringQuery {
  private var adhkar: [WidgetCatalogDhikr] { CatalogStore.load()?.adhkar ?? [] }

  func entities(for identifiers: [String]) async throws -> [DhikrEntity] {
    let all = adhkar
    return identifiers.compactMap { id in all.first { $0.id == id }.map(DhikrEntity.init) }
  }

  func suggestedEntities() async throws -> [DhikrEntity] { adhkar.map(DhikrEntity.init) }

  func entities(matching string: String) async throws -> [DhikrEntity] {
    let q = string.lowercased()
    return adhkar.filter {
      $0.arabic.contains(string) || ($0.translation?.lowercased().contains(q) ?? false)
    }.map(DhikrEntity.init)
  }
}
