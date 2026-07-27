import Capacitor
import Foundation

@objc(NativeKickPlugin)
class NativeKickPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "NativeKickPlugin"
    let jsName = "NativeKick"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "open", returnType: CAPPluginReturnPromise)
    ]

    @objc func open(_ call: CAPPluginCall) {
        guard let urlString = call.getString("url"), let url = URL(string: urlString) else {
            call.reject("Must provide a valid URL")
            return
        }

        DispatchQueue.main.async { [weak self] in
            let viewController = KickWebViewController(url: url)
            viewController.modalPresentationStyle = .fullScreen
            self?.bridge?.viewController?.present(viewController, animated: true) {
                call.resolve()
            }
        }
    }
}
