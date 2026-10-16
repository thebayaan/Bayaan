// targets/widgets/SnapshotStore.swift
import SwiftUI
import UIKit

enum SnapshotStore {
  static func load() -> WidgetSnapshot? {
    guard let url = BayaanAppGroup.widgetsDir?.appendingPathComponent("snapshot.json"),
          let data = try? Data(contentsOf: url) else { return nil }
    return WidgetSnapshot.decode(data)
  }

  static func artwork(_ file: String?) -> UIImage? {
    guard let file, let dir = BayaanAppGroup.widgetsDir else { return nil }
    return UIImage(contentsOfFile: dir.appendingPathComponent("artwork/\(file)").path)
  }
}
