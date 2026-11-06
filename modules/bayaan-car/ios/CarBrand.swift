// modules/bayaan-car/ios/CarBrand.swift
import Foundation

/// The app's display name for car copy, so a fork's car UI shows its own name
/// (RFC-021). Read from the main app's CFBundleDisplayName, then CFBundleName.
enum CarBrand {
  /// Used only when neither Info.plist key has a value.
  static let fallbackName = "Bayaan"

  static var name: String {
    for key in ["CFBundleDisplayName", "CFBundleName"] {
      if let value = Bundle.main.object(forInfoDictionaryKey: key) as? String {
        let trimmed = value.trimmingCharacters(in: .whitespaces)
        if !trimmed.isEmpty && !trimmed.hasPrefix("$(") { return trimmed }
      }
    }
    return fallbackName
  }
}
