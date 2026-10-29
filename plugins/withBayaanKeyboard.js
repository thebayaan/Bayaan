// @ai-generated
const {withAppDelegate, createRunOncePlugin} = require('expo/config-plugins');

/**
 * iPad keyboard shortcuts (modules/bayaan-keyboard, ipad-standards §7.3).
 * The shortcuts live in the main menu, which UIKit builds by asking the
 * app delegate, and a press is sent up the responder chain to it. So the
 * app delegate forwards both to the module's KeyCommandCenter.
 */

const START_MARKER = '// @bayaan-keyboard start';
const END_MARKER = '// @bayaan-keyboard end';

// The end of application(_:didFinishLaunchingWithOptions:). The block goes
// right after it, so its place doesn't depend on the order plugins run in.
const BLOCK_ANCHOR =
  '    return super.application(application, didFinishLaunchingWithOptions: launchOptions)\n  }\n';
const IMPORT_ANCHOR = 'import ReactAppDependencyProvider\n';
const IMPORT_LINE = 'internal import BayaanKeyboard\n';

const BLOCK = `
  ${START_MARKER}
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
  ${END_MARKER}
`;

function addKeyboardToAppDelegate(src) {
  if (src.includes(START_MARKER)) return src;
  if (!src.includes(BLOCK_ANCHOR)) {
    throw new Error(
      '[withBayaanKeyboard] AppDelegate didFinishLaunching return not found. Update BLOCK_ANCHOR for this Expo SDK.',
    );
  }
  if (!src.includes(IMPORT_ANCHOR)) {
    throw new Error(
      '[withBayaanKeyboard] AppDelegate "import ReactAppDependencyProvider" not found. Update IMPORT_ANCHOR for this Expo SDK.',
    );
  }
  let out = src.replace(BLOCK_ANCHOR, BLOCK_ANCHOR + BLOCK);
  if (!out.includes(IMPORT_LINE)) {
    out = out.replace(IMPORT_ANCHOR, IMPORT_LINE + IMPORT_ANCHOR);
  }
  return out;
}

function withBayaanKeyboard(config) {
  return withAppDelegate(config, cfg => {
    cfg.modResults.contents = addKeyboardToAppDelegate(cfg.modResults.contents);
    return cfg;
  });
}

module.exports = createRunOncePlugin(
  withBayaanKeyboard,
  'withBayaanKeyboard',
  '1.0.0',
);
module.exports.addKeyboardToAppDelegate = addKeyboardToAppDelegate;
