// targets/widgets/_shared/PlaybackResume.swift
import Foundation

enum ResumeAction: Equatable {
  case setPlaying
  case playTrack(surahId: Int, reciterId: String, rewayatId: String?)
  case nothing
}

/// What "Resume Bayaan" does: resume the loaded track, else start the most
/// recent surah, else the suggestion Continue Listening shows (upNext).
/// Uploads are skipped because a playTrack command cannot address them.
enum PlaybackResume {
  static func action(for snapshot: WidgetSnapshot?) -> ResumeAction {
    guard let snapshot else { return .nothing }
    if snapshot.nowPlaying != nil { return .setPlaying }
    guard let track = (snapshot.recent + snapshot.upNext)
      .first(where: { !$0.isUserUpload && $0.surahId > 0 }) else { return .nothing }
    return .playTrack(surahId: track.surahId, reciterId: track.reciterId, rewayatId: track.rewayatId)
  }
}
