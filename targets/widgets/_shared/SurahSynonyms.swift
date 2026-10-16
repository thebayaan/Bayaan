// targets/widgets/_shared/SurahSynonyms.swift
import Foundation

/// Spoken variants of a surah name for Siri: "Al-Kahf" gives "Al Kahf",
/// "Kahf", "Surah Al-Kahf" and the English name. Order kept, duplicates dropped.
enum SurahSynonyms {
  static func of(name: String, translatedName: String) -> [String] {
    let spaced = name.replacingOccurrences(of: "-", with: " ")
    var bare = name
    if let article = name.range(of: "^A[a-z]{1,2}-", options: .regularExpression) {
      bare = String(name[article.upperBound...])
    }
    var seen = Set<String>()
    return [name, spaced, bare, "Surah \(name)", translatedName]
      .filter { !$0.isEmpty && seen.insert($0).inserted }
  }
}
