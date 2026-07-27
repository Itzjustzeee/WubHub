import UIKit
import WebKit

class KickWebViewController: UIViewController, WKNavigationDelegate, WKUIDelegate {
    private let url: URL
    private var webView: WKWebView!

    init(url: URL) {
        self.url = url
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) {
        return nil
    }

    override func viewDidLoad() {
        super.viewDidLoad()

        view.backgroundColor = .black

        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = false
        configuration.allowsAirPlayForMediaPlayback = true
        if #available(iOS 10.0, *) {
            configuration.mediaTypesRequiringUserActionForPlayback = []
        }

        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.backgroundColor = .black
        webView.isOpaque = false
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)

        NSLayoutConstraint.activate([
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.topAnchor.constraint(equalTo: view.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])

        webView.load(URLRequest(url: url))
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        updateOrientationLock(.landscape)
        setNeedsStatusBarAppearanceUpdate()
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        updateOrientationLock(.portrait)
    }

    override var supportedInterfaceOrientations: UIInterfaceOrientationMask {
        return .landscape
    }

    override var preferredInterfaceOrientationForPresentation: UIInterfaceOrientation {
        return .landscapeRight
    }

    override var prefersStatusBarHidden: Bool {
        return true
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        isolateKickVideo()
    }

    private func isolateKickVideo() {
        let script = """
        (function(){
          if(window.__wubhubKickCleaner){return;}
          window.__wubhubKickCleaner=true;
          window.__wubhubKickTheaterAttempts=0;
          try{var url=new URL(location.href);url.searchParams.set('theater','true');history.replaceState(null,'',url.toString());}catch(e){}
          var css='html,body{margin:0!important;padding:0!important;background:#000!important;overflow:hidden!important;}'
            +'header,footer,nav,[role="navigation"],[data-testid*="chat"],[class*="chat"],[class*="sidebar"],[class*="SideBar"],[class*="Header"],[class*="header"]{display:none!important;}'
            +'main,[role="main"]{width:100vw!important;max-width:none!important;margin:0!important;padding:0!important;background:#000!important;}'
            +'video{background:#000!important;}';
          var style=document.createElement('style');style.id='wubhub-kick-cleaner';style.textContent=css;document.head.appendChild(style);
          function textOf(el){return ((el.getAttribute('aria-label')||'')+' '+(el.getAttribute('title')||'')+' '+(el.textContent||'')).toLowerCase();}
          function enableTheater(){
            var buttons=Array.prototype.slice.call(document.querySelectorAll('button,[role="button"]'));
            var button=buttons.find(function(el){var text=textOf(el);return text.indexOf('theater')>-1||text.indexOf('theatre')>-1;});
            if(button&&button.getAttribute('aria-pressed')!=='true'&&button.getAttribute('data-state')!=='on'){button.click();}
          }
          function pressTheaterKey(){
            var targets=[window,document,document.documentElement,document.body,document.activeElement].filter(Boolean);
            var video=document.querySelector('video');if(video){targets.push(video);try{video.focus();}catch(e){}}
            targets.forEach(function(target){['keydown','keyup'].forEach(function(type){
              try{target.dispatchEvent(new KeyboardEvent(type,{key:'t',code:'KeyT',keyCode:84,which:84,bubbles:true,cancelable:true}));}catch(e){}
              try{target.dispatchEvent(new KeyboardEvent(type,{key:'T',code:'KeyT',keyCode:84,which:84,bubbles:true,cancelable:true,shiftKey:true}));}catch(e){}
            });});
          }
          function clean(){
            enableTheater();
            if(window.__wubhubKickTheaterAttempts<5){window.__wubhubKickTheaterAttempts+=1;pressTheaterKey();}
            var video=document.querySelector('video');
            if(!video){return;}
            video.muted=false;video.autoplay=true;video.playsInline=false;
            video.play().catch(function(){});
          }
          clean();setTimeout(clean,600);setTimeout(clean,1600);setTimeout(clean,3000);setTimeout(clean,5200);setInterval(function(){enableTheater();},2500);
        })();
        """

        webView.evaluateJavaScript(script)
    }

    private func updateOrientationLock(_ mask: UIInterfaceOrientationMask) {
        AppDelegate.orientationLock = mask

        if #available(iOS 16.0, *) {
            setNeedsUpdateOfSupportedInterfaceOrientations()
            view.window?.windowScene?.requestGeometryUpdate(.iOS(interfaceOrientations: mask))
        } else {
            UIViewController.attemptRotationToDeviceOrientation()
        }
    }
}
