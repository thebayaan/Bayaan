import UIKit
import Social
import MobileCoreServices

open class ExpoAudioShareReceiverViewController: SLComposeServiceViewController {

    // Override these in your subclass
    open var appGroupName: String {
        return "group.com.bayaan.audioShare"
    }

    open var hostAppURLSchemes: [String] {
        return ["bayaan", "exp+bayaan"]
    }

    open var hostAppURLPath: String {
        return "audioShare"
    }

    private var didOpenHostApp = false

    private let statusLabel = UILabel()
    private let openButton = UIButton(type: .system)
    private let activityIndicator = UIActivityIndicatorView(style: .medium)

    override open func viewDidLoad() {
        super.viewDidLoad()
        configureUI()

        guard let item = extensionContext?.inputItems.first as? NSExtensionItem else {
            updateStatus(isProcessing: false, message: "No audio detected.")
            return
        }

        let group = DispatchGroup()
        var foundAudio = false

        for attachment in item.attachments ?? [] {
            if attachment.hasItemConformingToTypeIdentifier(kUTTypeAudio as String) {
                foundAudio = true
                group.enter()
                attachment.loadItem(forTypeIdentifier: kUTTypeAudio as String, options: nil) { [weak self] data, error in
                    defer { group.leave() }
                    guard let self = self else { return }

                    if let url = data as? URL {
                        // Store in App Group folder
                        AudioShareStore.shared.storeFiles(urls: [url], groupName: self.appGroupName)
                    }
                }
            }
        }

        if foundAudio {
            updateStatus(isProcessing: true, message: "Saving audio...")
            group.notify(queue: .main) { [weak self] in
                self?.updateStatus(isProcessing: false, message: "Audio ready.")
                self?.openButton.isEnabled = true
            }
        } else {
            updateStatus(isProcessing: false, message: "No audio detected.")
            openButton.isEnabled = true
        }
    }

    private func configureUI() {
        view.backgroundColor = .systemBackground

        statusLabel.translatesAutoresizingMaskIntoConstraints = false
        statusLabel.textAlignment = .center
        statusLabel.font = UIFont.systemFont(ofSize: 16, weight: .medium)
        statusLabel.textColor = .label
        statusLabel.text = "Preparing..."

        activityIndicator.translatesAutoresizingMaskIntoConstraints = false
        activityIndicator.hidesWhenStopped = true
        activityIndicator.startAnimating()

        openButton.translatesAutoresizingMaskIntoConstraints = false
        openButton.setTitle("Open Bayaan", for: .normal)
        openButton.titleLabel?.font = UIFont.systemFont(ofSize: 16, weight: .semibold)
        openButton.isEnabled = false
        openButton.addTarget(self, action: #selector(handleOpenButton), for: .touchUpInside)

        let stack = UIStackView(arrangedSubviews: [activityIndicator, statusLabel, openButton])
        stack.translatesAutoresizingMaskIntoConstraints = false
        stack.axis = .vertical
        stack.alignment = .center
        stack.spacing = 12

        view.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            stack.leadingAnchor.constraint(greaterThanOrEqualTo: view.leadingAnchor, constant: 24),
            stack.trailingAnchor.constraint(lessThanOrEqualTo: view.trailingAnchor, constant: -24),
        ])
    }

    private func updateStatus(isProcessing: Bool, message: String) {
        statusLabel.text = message
        if isProcessing {
            activityIndicator.startAnimating()
        } else {
            activityIndicator.stopAnimating()
        }
    }

    @objc private func handleOpenButton() {
        openHostApp()
    }

    private func openHostApp() {
        guard !didOpenHostApp else { return }
        didOpenHostApp = true

        DispatchQueue.main.async {
            self.openHostApp(using: self.hostAppURLSchemes, index: 0)
        }
    }

    private func openHostApp(using schemes: [String], index: Int) {
        guard index < schemes.count else {
            self.extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
            return
        }

        let scheme = schemes[index]
        if let url = URL(string: "\(scheme)://\(self.hostAppURLPath)") {
            self.extensionContext?.open(url, completionHandler: { success in
                if success {
                    self.extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
                } else {
                    self.openHostApp(using: schemes, index: index + 1)
                }
            })
        } else {
            self.openHostApp(using: schemes, index: index + 1)
        }
    }

    override open func isContentValid() -> Bool { return true }
    override open func didSelectPost() {}
    override open func configurationItems() -> [Any]! { return [] }
}

// Storyboard entry point. Must match MainInterface.storyboard customClass.
final class ShareViewController: ExpoAudioShareReceiverViewController {}
