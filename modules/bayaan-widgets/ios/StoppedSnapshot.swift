// @ai-generated
import Foundation

/// The widget snapshot (snapshot.json) as it must read once the app process
/// ends: the main player stopped at the position it had reached.
///
/// The app writes a new snapshot when playback changes, not on each tick, and
/// a force-quit stops the process before it can write a paused one. The
/// widgets then keep a "playing" snapshot until the track's computed end, and
/// show Pause for audio that no longer plays.
///
/// Returns nil when there is nothing to change: no snapshot, no track, or a
/// track that is not playing. Other keys stay as they are.
func stoppedSnapshotData(_ data: Data, nowMs: Double) -> Data? {
  guard var root = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
        var nowPlaying = root["nowPlaying"] as? [String: Any],
        (nowPlaying["isPlaying"] as? Bool) == true,
        let generatedAt = (root["generatedAt"] as? NSNumber)?.doubleValue,
        let position = (nowPlaying["positionSec"] as? NSNumber)?.doubleValue,
        let duration = (nowPlaying["durationSec"] as? NSNumber)?.doubleValue
  else { return nil }
  let rawRate = (nowPlaying["rate"] as? NSNumber)?.doubleValue ?? 1
  let rate = rawRate > 0 && rawRate.isFinite ? rawRate : 1
  // positionSec is the position at generatedAt; playback ran on until now.
  let reached = position + max(0, nowMs - generatedAt) / 1000 * rate
  nowPlaying["isPlaying"] = false
  nowPlaying["positionSec"] = min(max(reached, 0), max(duration, 0))
  root["nowPlaying"] = nowPlaying
  // Newer than any playback override a widget tap wrote before the quit.
  root["generatedAt"] = nowMs
  return try? JSONSerialization.data(withJSONObject: root)
}
