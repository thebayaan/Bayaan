import Foundation

public class AudioShareStore {
    public static let shared = AudioShareStore()
    
    private init() {}
    
    /// Stores audio files to the given App Group container
    public func storeFiles(urls: [URL], groupName: String) {
        guard let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: groupName) else { return }
        
        for url in urls {
            let dest = container.appendingPathComponent(url.lastPathComponent)
            
            // Remove existing file if present
            if FileManager.default.fileExists(atPath: dest.path) {
                try? FileManager.default.removeItem(at: dest)
            }
            
            do {
                try FileManager.default.copyItem(at: url, to: dest)
            } catch {
                print("Failed to copy file \(url.lastPathComponent): \(error)")
            }
        }
    }
    
    /// Retrieves all stored audio files from the App Group container
    public func getStoredFiles(groupName: String) -> [URL] {
        guard let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: groupName) else { return [] }
        
        return (try? FileManager.default.contentsOfDirectory(at: container, includingPropertiesForKeys: nil)) ?? []
    }
}


