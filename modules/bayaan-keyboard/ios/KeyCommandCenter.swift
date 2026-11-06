import UIKit

/// iPad keyboard shortcuts (ipad-standards §7.3).
///
/// JS sends the shortcuts that apply right now (`setCommands`). They go in the
/// main menu, so the iPadOS menu bar and the ⌘-hold overlay list them, and a
/// press is sent back to JS by id. The app delegate forwards `buildMenu`,
/// `canPerformAction` and the `bayaanKeyCommand:` action here (see
/// plugins/withBayaanKeyboard.js).
///
/// Threading: all state is read and written on the main queue. `setCommands`
/// is called from the JS thread and hops to main.
public final class KeyCommandCenter {
  public static let shared = KeyCommandCenter()

  /// The action every shortcut sends up the responder chain.
  public static let action = NSSelectorFromString("bayaanKeyCommand:")

  struct Menu: Decodable, Equatable {
    let id: String
    let title: String
  }

  struct Command: Decodable, Equatable {
    let id: String
    let title: String
    /// A character, or "space", "left", "right", "up", "down", "escape".
    let input: String
    /// Any of "command", "shift", "alternate", "control".
    let modifiers: [String]
    let menu: String
    let enabled: Bool
    let repeatable: Bool

    /// What the menu shows. A change to any of it rebuilds the menu; a change
    /// to `enabled` alone doesn't need to.
    var shape: [String] { [id, title, input, modifiers.joined(separator: "+"), menu, "\(repeatable)"] }

    /// Without ⌘ or ⌃ the keys can also type (Space, ⌥Space) or move the
    /// cursor (the arrows). These win over the system's own handling, so the
    /// reader's arrows turn pages, and they stand aside while a text field
    /// is being edited.
    var typesText: Bool {
      input != "escape" && !modifiers.contains("command") && !modifiers.contains("control")
    }
  }

  struct Payload: Decodable {
    let menus: [Menu]
    let commands: [Command]
  }

  private var menus: [Menu] = []
  private var commands: [Command] = []
  private var send: ((String) -> Void)?
  private var owner: UUID?

  private init() {}

  private var isSupported: Bool {
    UIDevice.current.userInterfaceIdiom == .pad
  }

  // MARK: - JS side

  /// The emitter belongs to one module instance, so a late `detach` from an
  /// old instance after a reload can't clear the new one's.
  func attach(owner: UUID, send: @escaping (String) -> Void) {
    DispatchQueue.main.async {
      self.owner = owner
      self.send = send
    }
  }

  func detach(owner: UUID) {
    DispatchQueue.main.async {
      guard self.owner == owner else { return }
      self.owner = nil
      self.send = nil
      self.update(menus: [], commands: [])
    }
  }

  func setCommands(json: String) {
    guard
      let data = json.data(using: .utf8),
      let payload = try? JSONDecoder().decode(Payload.self, from: data)
    else { return }
    DispatchQueue.main.async {
      self.update(menus: payload.menus, commands: payload.commands)
    }
  }

  private func update(menus: [Menu], commands: [Command]) {
    let rebuild = menus != self.menus || commands.map(\.shape) != self.commands.map(\.shape)
    self.menus = menus
    self.commands = commands
    if rebuild && isSupported {
      UIMenuSystem.main.setNeedsRebuild()
    }
  }

  // MARK: - App delegate side

  public func buildMenu(with builder: UIMenuBuilder) {
    guard isSupported, builder.system == .main, !commands.isEmpty else { return }
    // ⌘F is search here, not the system's Find.
    if builder.menu(for: .find) != nil,
       commands.contains(where: { $0.input == "f" && $0.modifiers == ["command"] }) {
      builder.remove(menu: .find)
    }
    for menu in menus {
      let children = commands.filter { $0.menu == menu.id }.map(keyCommand)
      if children.isEmpty { continue }
      let element = UIMenu(
        title: menu.title,
        identifier: UIMenu.Identifier("com.bayaan.keyboard.\(menu.id)"),
        children: children)
      if builder.menu(for: .window) != nil {
        builder.insertSibling(element, beforeMenu: .window)
      } else {
        builder.insertChild(element, atEndOfMenu: .root)
      }
    }
  }

  public func canPerform(_ sender: Any?) -> Bool {
    guard let command = command(for: sender), command.enabled else { return false }
    return !(command.typesText && Self.isEditingText())
  }

  public func perform(_ sender: Any?) {
    guard canPerform(sender), let id = command(for: sender)?.id else { return }
    send?(id)
  }

  // MARK: - Helpers

  private func command(for sender: Any?) -> Command? {
    guard let id = (sender as? UIKeyCommand)?.propertyList as? String else { return nil }
    return commands.first { $0.id == id }
  }

  private func keyCommand(_ command: Command) -> UIKeyCommand {
    let key = UIKeyCommand(
      title: command.title,
      action: Self.action,
      input: Self.input(command.input),
      modifierFlags: Self.flags(command.modifiers),
      propertyList: command.id)
    key.wantsPriorityOverSystemBehavior = command.typesText
    key.repeatBehavior = command.repeatable ? .repeatable : .nonRepeatable
    return key
  }

  private static func input(_ name: String) -> String {
    switch name {
    case "space": return " "
    case "left": return UIKeyCommand.inputLeftArrow
    case "right": return UIKeyCommand.inputRightArrow
    case "up": return UIKeyCommand.inputUpArrow
    case "down": return UIKeyCommand.inputDownArrow
    case "escape": return UIKeyCommand.inputEscape
    default: return name
    }
  }

  private static func flags(_ names: [String]) -> UIKeyModifierFlags {
    var flags: UIKeyModifierFlags = []
    for name in names {
      switch name {
      case "command": flags.insert(.command)
      case "shift": flags.insert(.shift)
      case "alternate": flags.insert(.alternate)
      case "control": flags.insert(.control)
      default: break
      }
    }
    return flags
  }

  /// True while a text field or text view is first responder.
  private static func isEditingText() -> Bool {
    FirstResponderProbe.current() is UITextInput
  }
}

/// Finds the first responder by sending it an action with no target.
private enum FirstResponderProbe {
  static weak var found: UIResponder?

  static func current() -> UIResponder? {
    found = nil
    UIApplication.shared.sendAction(
      #selector(UIResponder.bayaanKeyboardProbe(_:)), to: nil, from: nil, for: nil)
    return found
  }
}

extension UIResponder {
  @objc fileprivate func bayaanKeyboardProbe(_ sender: Any?) {
    FirstResponderProbe.found = self
  }
}
