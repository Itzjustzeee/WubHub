import Capacitor
import Foundation

@objc(NativeVodPlugin)
class NativeVodPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "NativeVodPlugin"
    let jsName = "NativeVod"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "open", returnType: CAPPluginReturnPromise)
    ]

    @objc func open(_ call: CAPPluginCall) {
        guard let urlString = call.getString("url"), let url = URL(string: urlString) else {
            call.reject("Must provide a valid URL")
            return
        }

        DispatchQueue.main.async { [weak self] in
            let viewController = VodWebViewController(url: url)
            let navigationController = UINavigationController(rootViewController: viewController)
            navigationController.modalPresentationStyle = .fullScreen
            self?.bridge?.viewController?.present(navigationController, animated: true) {
                call.resolve()
            }
        }
    }
}
