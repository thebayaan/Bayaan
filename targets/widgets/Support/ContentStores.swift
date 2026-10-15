// targets/widgets/Support/ContentStores.swift
import Foundation

enum ContentStore {
  static func load() -> WidgetContent? {
    guard let url = BayaanAppGroup.widgetsDir?.appendingPathComponent("content.json"),
          let data = try? Data(contentsOf: url) else { return nil }
    return WidgetContent.decode(data)
  }
}

/// adhkar-periods.json and occasions.json bundled in the extension.
enum ContentStaticData {
  static let adhkar: AdhkarPeriods? = load("adhkar-periods")
  static let occasions: OccasionData? = load("occasions")

  private static func load<T: Decodable>(_ name: String) -> T? {
    guard let url = Bundle.main.url(forResource: name, withExtension: "json"),
          let data = try? Data(contentsOf: url) else { return nil }
    return try? JSONDecoder().decode(T.self, from: data)
  }
}
