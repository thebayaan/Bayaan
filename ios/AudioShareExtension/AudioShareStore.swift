import Foundation

public class AudioShareStore {
    public static let shared = AudioShareStore()

    // Audio file extensions we support
    private let audioExtensions = ["mp3", "m4a", "wav", "aac", "aiff", "flac", "ogg", "wma", "caf"]

    private init() {}

    /// Clears all audio files from the App Group container
    public func clearStoredFiles(groupName: String) {
        guard let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: groupName) else { return }

        let fileManager = FileManager.default
        guard let contents = try? fileManager.contentsOfDirectory(at: container, includingPropertiesForKeys: nil) else { return }

        for fileURL in contents {
            // Only delete audio files, not system files
            let ext = fileURL.pathExtension.lowercased()
            if audioExtensions.contains(ext) {
                try? fileManager.removeItem(at: fileURL)
            }
        }
    }

    /// Stores audio files to the given App Group container
    /// Returns the successfully stored file URLs
    @discardableResult
    public func storeFiles(urls: [URL], groupName: String) -> [URL] {
        guard let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: groupName) else {
            print("[AudioShareStore] Failed to get container for group: \(groupName)")
            return []
        }

        var storedURLs: [URL] = []
        let fileManager = FileManager.default

        for url in urls {
            // Validate the source file exists and is readable
            guard fileManager.fileExists(atPath: url.path) else {
                print("[AudioShareStore] Source file doesn't exist: \(url.path)")
                continue
            }

            // Check file size - skip empty files
            guard let attrs = try? fileManager.attributesOfItem(atPath: url.path),
                  let fileSize = attrs[.size] as? Int64,
                  fileSize > 0 else {
                print("[AudioShareStore] Source file is empty or unreadable: \(url.path)")
                continue
            }

            // Create a unique filename to avoid conflicts
            let originalName = url.lastPathComponent
            let ext = url.pathExtension.lowercased()
            let baseName = (originalName as NSString).deletingPathExtension

            // Use original name if it looks like a real filename, otherwise generate one
            let finalName: String
            if baseName.isEmpty || baseName.hasPrefix(".") || baseName.count < 2 {
                finalName = "audio_\(UUID().uuidString.prefix(8)).\(ext.isEmpty ? "m4a" : ext)"
            } else {
                finalName = originalName
            }

            let dest = container.appendingPathComponent(finalName)

            // Remove existing file if present
            if fileManager.fileExists(atPath: dest.path) {
                try? fileManager.removeItem(at: dest)
            }

            do {
                // Start accessing security-scoped resource if needed
                let accessing = url.startAccessingSecurityScopedResource()
                defer {
                    if accessing {
                        url.stopAccessingSecurityScopedResource()
                    }
                }

                try fileManager.copyItem(at: url, to: dest)

                // Verify the copy succeeded
                if fileManager.fileExists(atPath: dest.path),
                   let destAttrs = try? fileManager.attributesOfItem(atPath: dest.path),
                   let destSize = destAttrs[.size] as? Int64,
                   destSize > 0 {
                    storedURLs.append(dest)
                    print("[AudioShareStore] Successfully stored: \(finalName) (\(destSize) bytes)")
                } else {
                    print("[AudioShareStore] Copy verification failed for: \(finalName)")
                    try? fileManager.removeItem(at: dest)
                }
            } catch {
                print("[AudioShareStore] Failed to copy file \(originalName): \(error)")
            }
        }

        return storedURLs
    }

    /// Retrieves all stored audio files from the App Group container
    public func getStoredFiles(groupName: String) -> [URL] {
        guard let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: groupName) else {
            print("[AudioShareStore] Failed to get container for group: \(groupName)")
            return []
        }

        guard let contents = try? FileManager.default.contentsOfDirectory(at: container, includingPropertiesForKeys: [.fileSizeKey, .isRegularFileKey]) else {
            print("[AudioShareStore] Failed to read container contents")
            return []
        }

        // Filter to only audio files
        let audioFiles = contents.filter { url in
            let ext = url.pathExtension.lowercased()

            // Must be an audio extension
            guard audioExtensions.contains(ext) else { return false }

            // Must be a regular file (not directory) with size > 0
            guard let resourceValues = try? url.resourceValues(forKeys: [.fileSizeKey, .isRegularFileKey]),
                  resourceValues.isRegularFile == true,
                  let size = resourceValues.fileSize,
                  size > 0 else {
                return false
            }

            return true
        }

        print("[AudioShareStore] Found \(audioFiles.count) audio files in container")
        return audioFiles
    }
}
