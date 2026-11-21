// targets/widgets/_shared/ReciterEntity.swift
// In _shared so the app (Siri, App Shortcuts) and the extension (Quick Surah,
// Pinned Reciter, Bedtime) resolve the same entity. iOS 17, like SurahEntity.
import AppIntents
import Foundation

@available(iOS 17.0, *)
struct ReciterEntity: AppEntity {
  static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Reciter")
  static var defaultQuery = ReciterEntityQuery()

  let id: String
  let name: String

  var displayRepresentation: DisplayRepresentation { DisplayRepresentation(title: "\(name)") }
}

@available(iOS 17.0, *)
struct ReciterEntityQuery: EntityStringQuery {
  private var reciters: [ReciterCatalog.Reciter] { ReciterCatalog.load() }

  // Unknown ids stay resolvable so the widget can say the reciter is unavailable.
  func entities(for identifiers: [String]) async throws -> [ReciterEntity] {
    let all = reciters
    return identifiers.map { id in
      all.first { $0.id == id }.map { ReciterEntity(id: $0.id, name: $0.name) }
        ?? ReciterEntity(id: id, name: "Unavailable reciter")
    }
  }

  func suggestedEntities() async throws -> [ReciterEntity] {
    reciters.map { ReciterEntity(id: $0.id, name: $0.name) }
  }

  func entities(matching string: String) async throws -> [ReciterEntity] {
    let q = string.lowercased()
    return reciters.filter { $0.name.lowercased().contains(q) }
      .map { ReciterEntity(id: $0.id, name: $0.name) }
  }
}

// @ai-start
/// The reciters in catalog.json. The app target cannot see WidgetCatalog
/// (targets/widgets/Support), so this decodes only the fields the entity needs.
enum ReciterCatalog {
  struct Reciter: Decodable {
    let id: String
    let name: String
  }

  private struct File: Decodable {
    let version: Int
    let reciters: [Reciter]
  }

  /// Matches WidgetCatalog.supportedVersion.
  static let supportedVersion = 1

  static func load() -> [Reciter] {
    guard let url = BayaanAppGroup.widgetsDir?.appendingPathComponent("catalog.json"),
          let data = try? Data(contentsOf: url),
          let file = try? JSONDecoder().decode(File.self, from: data),
          file.version == supportedVersion else { return [] }
    return file.reciters
  }
}
// @ai-end
