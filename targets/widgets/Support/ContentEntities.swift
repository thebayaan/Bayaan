// targets/widgets/Support/ContentEntities.swift
import AppIntents
import Foundation

/// Library Shelf source: Downloads, or one playlist from content.json.
struct LibrarySourceEntity: AppEntity {
  static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Library")
  static var defaultQuery = LibrarySourceQuery()

  let id: String
  let title: String

  var displayRepresentation: DisplayRepresentation { DisplayRepresentation(title: "\(title)") }

  static let downloads = LibrarySourceEntity(id: ContentResolvers.downloadsSourceId, title: "Downloads")
}

struct LibrarySourceQuery: EntityQuery {
  private func all() -> [LibrarySourceEntity] {
    [.downloads] + (ContentStore.load()?.playlists ?? []).map {
      LibrarySourceEntity(id: ContentResolvers.playlistPrefix + $0.id, title: $0.name)
    }
  }

  // Unknown ids stay resolvable so the widget can say the playlist is gone.
  func entities(for identifiers: [String]) async throws -> [LibrarySourceEntity] {
    let list = all()
    return identifiers.map { id in
      list.first { $0.id == id } ?? LibrarySourceEntity(id: id, title: "Unavailable playlist")
    }
  }

  func suggestedEntities() async throws -> [LibrarySourceEntity] { all() }

  func defaultResult() async -> LibrarySourceEntity? { .downloads }
}

enum SleepMinutesOption: String, AppEnum {
  case m15 = "15", m30 = "30", m45 = "45", m60 = "60"

  static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Sleep timer")
  static var caseDisplayRepresentations: [SleepMinutesOption: DisplayRepresentation] = [
    .m15: "15 minutes", .m30: "30 minutes", .m45: "45 minutes", .m60: "60 minutes",
  ]

  var minutes: Int { Int(rawValue) ?? 30 }
}

/// Raw values match WIDGET_AMBIENT_SOUNDS in commands.ts; off sends null.
enum AmbientOption: String, AppEnum {
  case off, rain, forest, ocean, stream, thunder, fireplace, wind

  static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Ambient sound")
  static var caseDisplayRepresentations: [AmbientOption: DisplayRepresentation] = [
    .off: "Off", .rain: "Rain", .forest: "Forest", .ocean: "Ocean", .stream: "Stream",
    .thunder: "Thunder", .fireplace: "Fireplace", .wind: "Wind",
  ]

  var commandValue: String? { self == .off ? nil : rawValue }
  var label: String? { self == .off ? nil : rawValue.prefix(1).uppercased() + rawValue.dropFirst() }
}
