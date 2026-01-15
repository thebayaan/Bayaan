import UIKit
import UniformTypeIdentifiers
import MobileCoreServices

/// Base Share Extension view controller for receiving shared audio files.
/// Subclass this and override the configuration properties for your app.
open class ExpoAudioShareReceiverViewController: UIViewController {

    // MARK: - Configuration Properties (Override in subclass)

    /// App Group identifier for shared file storage. Must match your app's entitlements.
    open var appGroupName: String {
        return "group.com.bayaan.audioShare"
    }

    /// URL schemes to try when opening the host app. First successful scheme is used.
    open var hostAppURLSchemes: [String] {
        return ["bayaan", "exp+bayaan"]
    }

    /// Path component for the deep link URL (e.g., "audioShare" for "myapp://audioShare")
    open var hostAppURLPath: String {
        return "audioShare"
    }

    // MARK: - Private Properties

    private var didOpenHostApp = false
    private let statusLabel = UILabel()
    private let openButton = UIButton(type: .system)
    private let activityIndicator = UIActivityIndicatorView(style: .large)
    private let containerView = UIView()

    // MARK: - Lifecycle

    override open func viewDidLoad() {
        super.viewDidLoad()
        configureUI()
        processSharedItems()
    }

    // MARK: - UI Configuration

    private func configureUI() {
        view.backgroundColor = UIColor.black.withAlphaComponent(0.4)

        // Container card
        containerView.backgroundColor = .systemBackground
        containerView.layer.cornerRadius = 16
        containerView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(containerView)

        // Activity indicator
        activityIndicator.translatesAutoresizingMaskIntoConstraints = false
        activityIndicator.hidesWhenStopped = true
        activityIndicator.color = .gray
        activityIndicator.startAnimating()
        containerView.addSubview(activityIndicator)

        // Status label
        statusLabel.translatesAutoresizingMaskIntoConstraints = false
        statusLabel.textAlignment = .center
        statusLabel.font = UIFont.systemFont(ofSize: 17, weight: .medium)
        statusLabel.textColor = .label
        statusLabel.text = "Preparing..."
        statusLabel.numberOfLines = 0
        containerView.addSubview(statusLabel)

        // Open button
        openButton.translatesAutoresizingMaskIntoConstraints = false
        openButton.setTitle("Open Bayaan", for: .normal)
        openButton.titleLabel?.font = UIFont.systemFont(ofSize: 17, weight: .semibold)
        openButton.backgroundColor = .systemBlue
        openButton.setTitleColor(.white, for: .normal)
        openButton.layer.cornerRadius = 12
        openButton.isHidden = true
        openButton.addTarget(self, action: #selector(handleOpenButton), for: .touchUpInside)
        containerView.addSubview(openButton)

        // Cancel button
        let cancelButton = UIButton(type: .system)
        cancelButton.translatesAutoresizingMaskIntoConstraints = false
        cancelButton.setTitle("Cancel", for: .normal)
        cancelButton.titleLabel?.font = UIFont.systemFont(ofSize: 15)
        cancelButton.addTarget(self, action: #selector(handleCancelButton), for: .touchUpInside)
        containerView.addSubview(cancelButton)

        NSLayoutConstraint.activate([
            containerView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            containerView.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            containerView.widthAnchor.constraint(equalToConstant: 280),
            containerView.heightAnchor.constraint(greaterThanOrEqualToConstant: 200),

            activityIndicator.centerXAnchor.constraint(equalTo: containerView.centerXAnchor),
            activityIndicator.topAnchor.constraint(equalTo: containerView.topAnchor, constant: 30),

            statusLabel.topAnchor.constraint(equalTo: activityIndicator.bottomAnchor, constant: 16),
            statusLabel.leadingAnchor.constraint(equalTo: containerView.leadingAnchor, constant: 20),
            statusLabel.trailingAnchor.constraint(equalTo: containerView.trailingAnchor, constant: -20),

            openButton.topAnchor.constraint(equalTo: statusLabel.bottomAnchor, constant: 20),
            openButton.leadingAnchor.constraint(equalTo: containerView.leadingAnchor, constant: 20),
            openButton.trailingAnchor.constraint(equalTo: containerView.trailingAnchor, constant: -20),
            openButton.heightAnchor.constraint(equalToConstant: 50),

            cancelButton.topAnchor.constraint(equalTo: openButton.bottomAnchor, constant: 12),
            cancelButton.centerXAnchor.constraint(equalTo: containerView.centerXAnchor),
            cancelButton.bottomAnchor.constraint(equalTo: containerView.bottomAnchor, constant: -20),
        ])
    }

    private func updateStatus(isProcessing: Bool, message: String) {
        DispatchQueue.main.async {
            self.statusLabel.text = message
            if isProcessing {
                self.activityIndicator.startAnimating()
                self.openButton.isHidden = true
            } else {
                self.activityIndicator.stopAnimating()
                self.openButton.isHidden = false
            }
        }
    }

    // MARK: - Shared Item Processing

    private func processSharedItems() {
        guard let extensionContext = extensionContext,
              let inputItems = extensionContext.inputItems as? [NSExtensionItem],
              let item = inputItems.first else {
            updateStatus(isProcessing: false, message: "No items to share.")
            return
        }

        let group = DispatchGroup()
        var foundAudio = false
        var storedFiles: [URL] = []

        for attachment in item.attachments ?? [] {
            // Check for audio types
            let audioTypes = [
                UTType.audio.identifier,
                UTType.mp3.identifier,
                UTType.mpeg4Audio.identifier,
                UTType.wav.identifier,
                "public.audio",
                "com.apple.m4a-audio",
                kUTTypeAudio as String,
                kUTTypeMP3 as String,
                kUTTypeMPEG4Audio as String
            ]

            for typeId in audioTypes {
                if attachment.hasItemConformingToTypeIdentifier(typeId) {
                    foundAudio = true
                    group.enter()

                    attachment.loadItem(forTypeIdentifier: typeId, options: nil) { [weak self] data, error in
                        defer { group.leave() }
                        guard let self = self else { return }

                        if let error = error {
                            print("[ShareExtension] Error loading item: \(error)")
                            return
                        }

                        var fileURL: URL?

                        if let url = data as? URL {
                            fileURL = url
                        } else if let data = data as? Data {
                            // Save data to temp file
                            let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent("shared_audio_\(UUID().uuidString).m4a")
                            do {
                                try data.write(to: tempURL)
                                fileURL = tempURL
                            } catch {
                                print("[ShareExtension] Failed to write data: \(error)")
                            }
                        }

                        if let url = fileURL {
                            AudioShareStore.shared.storeFiles(urls: [url], groupName: self.appGroupName)
                            storedFiles.append(url)
                        }
                    }
                    break // Found a matching type, no need to check others
                }
            }
        }

        if foundAudio {
            updateStatus(isProcessing: true, message: "Saving audio...")
            group.notify(queue: .main) { [weak self] in
                guard let self = self else { return }
                if storedFiles.isEmpty {
                    self.updateStatus(isProcessing: false, message: "Failed to save audio.")
                } else {
                    self.updateStatus(isProcessing: false, message: "Audio ready!")
                }
            }
        } else {
            updateStatus(isProcessing: false, message: "No audio files found.")
        }
    }

    // MARK: - Actions

    @objc private func handleOpenButton() {
        openHostApp()
    }

    @objc private func handleCancelButton() {
        extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
    }

    private func openHostApp() {
        guard !didOpenHostApp else { return }
        didOpenHostApp = true

        openHostApp(using: hostAppURLSchemes, index: 0)
    }

    private func openHostApp(using schemes: [String], index: Int) {
        guard index < schemes.count else {
            // No scheme worked, just complete the extension
            extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
            return
        }

        let scheme = schemes[index]
        let urlString = hostAppURLPath.isEmpty ? "\(scheme)://" : "\(scheme)://\(hostAppURLPath)"

        guard let url = URL(string: urlString) else {
            openHostApp(using: schemes, index: index + 1)
            return
        }

        // Use the responder chain to open URL (works in extensions)
        var responder: UIResponder? = self
        while responder != nil {
            if let application = responder as? UIApplication {
                application.open(url, options: [:]) { success in
                    if success {
                        self.extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
                    } else {
                        self.openHostApp(using: schemes, index: index + 1)
                    }
                }
                return
            }
            responder = responder?.next
        }

        // Fallback: try using openURL selector
        let selector = sel_registerName("openURL:")
        responder = self
        while responder != nil {
            if responder!.responds(to: selector) {
                responder!.perform(selector, with: url)
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                    self.extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
                }
                return
            }
            responder = responder?.next
        }

        // If nothing worked, try next scheme
        openHostApp(using: schemes, index: index + 1)
    }
}


// Storyboard entry point
final class ShareViewController: ExpoAudioShareReceiverViewController {}
