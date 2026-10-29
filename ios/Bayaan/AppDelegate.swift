internal import Expo
import React
import Intents
internal import BayaanCar
internal import BayaanKeyboard
import ReactAppDependencyProvider

@main
class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

#if os(iOS) || os(tvOS)
    // @bayaan-car scene bridge start
    BayaanCarSceneBridge.shared.configure(
      start: { hostWindow, extra in
        let merged = (launchOptions ?? [:]).merging(extra) { _, new in new }
        factory.startReactNative(withModuleName: "main", in: hostWindow, launchOptions: merged)
      },
      onWindow: { [weak self] hostWindow in self?.window = hostWindow })
    // @bayaan-car scene bridge end
#endif

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  // @bayaan-keyboard start
  // iPad keyboard shortcuts: the main menu lists them (menu bar and the
  // ⌘-hold overlay), and a press comes back here up the responder chain.
  override func buildMenu(with builder: UIMenuBuilder) {
    super.buildMenu(with: builder)
    KeyCommandCenter.shared.buildMenu(with: builder)
  }

  override func canPerformAction(_ action: Selector, withSender sender: Any?) -> Bool {
    if action == KeyCommandCenter.action {
      return KeyCommandCenter.shared.canPerform(sender)
    }
    return super.canPerformAction(action, withSender: sender)
  }

  @objc func bayaanKeyCommand(_ sender: UIKeyCommand) {
    KeyCommandCenter.shared.perform(sender)
  }
  // @bayaan-keyboard end

  // @bayaan-car siri start
  func application(_ application: UIApplication, handlerFor intent: INIntent) -> Any? {
    return BayaanCarSiri.handler(for: intent)
  }

  func application(
    _ application: UIApplication,
    handle intent: INIntent,
    completionHandler: @escaping (INIntentResponse) -> Void
  ) {
    BayaanCarSiri.handle(intent, completion: completionHandler)
  }
  // @bayaan-car siri end

  // Linking API
  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }

  // Universal Links
  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  // Extension point for config-plugins

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    // needed to return the correct URL for expo-dev-client.
    bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
