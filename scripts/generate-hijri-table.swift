// scripts/generate-hijri-table.swift
// Writes the Umm al-Qura date for every local day number from 2026-01-01 to
// 2028-12-31, read at 12:00 UTC, as JSON on stdout. The TS, Swift and Kotlin
// rule tests all check against this table.
// Run: npm run generate:widget-vectors
import Foundation

var islamic = Calendar(identifier: .islamicUmmAlQura)
islamic.timeZone = TimeZone(identifier: "UTC")!
let from = 20454 // 2026-01-01
let to = 21549 // 2028-12-31
var rows: [String] = []
for day in from...to {
  let date = Date(timeIntervalSince1970: Double(day) * 86_400 + 43_200)
  let c = islamic.dateComponents([.year, .month, .day], from: date)
  rows.append("[\(c.year!),\(c.month!),\(c.day!)]")
}
// Anchor: 1 Ramadan 1447 is Wednesday 18 February 2026 (day 20502) in Umm al-Qura.
// If this fails, check the calendar identifier; do not edit the anchor without an official source.
precondition(rows[20502 - from] == "[1447,9,1]", "unexpected Umm al-Qura conversion: \(rows[20502 - from])")
print("{\"from\":\(from),\"rows\":[\(rows.joined(separator: ","))]}")
