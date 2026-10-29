import ExpoModulesCore

public class BayaanKeyboardModule: Module {
  private let ownerId = UUID()

  public func definition() -> ModuleDefinition {
    Name("BayaanKeyboard")
    Events("onKeyCommand")

    OnCreate {
      KeyCommandCenter.shared.attach(owner: ownerId) { [weak self] id in
        self?.sendEvent("onKeyCommand", ["id": id])
      }
    }

    OnDestroy {
      KeyCommandCenter.shared.detach(owner: ownerId)
    }

    Function("setCommands") { (json: String) in
      KeyCommandCenter.shared.setCommands(json: json)
    }
  }
}
