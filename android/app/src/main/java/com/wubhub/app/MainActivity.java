package com.wubhub.app;

import android.app.Dialog;
import android.app.UiModeManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.net.Uri;
import android.os.Bundle;
import android.os.Build;
import android.os.Message;
import android.view.Window;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeVodPlugin.class);
        registerPlugin(NativeKickPlugin.class);
        registerPlugin(NativeOrientationPlugin.class);
        registerPlugin(NativeBackgroundLivePlugin.class);
        registerPlugin(NativeExternalPlugin.class);
        registerPlugin(NativeChatAuthPlugin.class);
        registerPlugin(NativePlatformPlugin.class);
        super.onCreate(savedInstanceState);
        configureEmbeddedAuthCookies();
        configureEmbeddedAuthPopups();
    }

    private void configureEmbeddedAuthCookies() {
        WebView webView = getBridge().getWebView();
        configureAuthWebView(webView);
    }

    private void configureAuthWebView(WebView webView) {
        WebSettings settings = webView.getSettings();

        CookieManager.getInstance().setAcceptCookie(true);
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setSupportMultipleWindows(true);
        settings.setUseWideViewPort(true);
        settings.setMediaPlaybackRequiresUserGesture(false);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        }
    }

    private void configureEmbeddedAuthPopups() {
        getBridge().getWebView().setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
                String requestedUrl = view.getHitTestResult() == null ? null : view.getHitTestResult().getExtra();
                String sourceUrl = view.getUrl();
                boolean isChatPopup = isChatAuthUrl(requestedUrl) || isChatAuthUrl(sourceUrl);

                if (!isChatPopup && requestedUrl != null) {
                    if (requestedUrl != null) {
                        openExternalUrl(requestedUrl);
                        return true;
                    }

                    return false;
                }

                if (requestedUrl != null && !isChatAuthUrl(requestedUrl)) {
                    openExternalUrl(requestedUrl);
                    return true;
                }

                WebView popupWebView = new WebView(MainActivity.this);
                configureAuthWebView(popupWebView);

                Dialog dialog = new Dialog(MainActivity.this);
                dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);
                dialog.setContentView(popupWebView);
                dialog.setOnDismissListener((dismissedDialog) -> {
                    CookieManager.getInstance().flush();
                    popupWebView.destroy();
                });

                Window window = dialog.getWindow();
                if (window != null) {
                    window.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT);
                }

                popupWebView.setWebViewClient(new WebViewClient() {
                    @Override
                    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                        String url = request.getUrl().toString();

                        if (isChatAuthUrl(url)) {
                            return false;
                        }

                        openExternalUrl(url);
                        dialog.dismiss();
                        return true;
                    }

                    @Override
                    public boolean shouldOverrideUrlLoading(WebView view, String url) {
                        if (isChatAuthUrl(url)) {
                            return false;
                        }

                        openExternalUrl(url);
                        dialog.dismiss();
                        return true;
                    }
                });

                popupWebView.setWebChromeClient(new WebChromeClient() {
                    @Override
                    public void onCloseWindow(WebView window) {
                        dialog.dismiss();
                    }
                });

                dialog.show();

                Window shownWindow = dialog.getWindow();
                if (shownWindow != null) {
                    shownWindow.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT);
                }

                WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
                transport.setWebView(popupWebView);
                resultMsg.sendToTarget();
                return true;
            }
        });
    }

    private boolean isChatAuthUrl(String url) {
        if (url == null) {
            return false;
        }

        Uri uri = Uri.parse(url);
        String host = uri.getHost();

        if (host == null) {
            return false;
        }

        return host.equals("kick.com")
            || host.endsWith(".kick.com")
            || host.equals("kick.cx")
            || host.endsWith(".kick.cx")
            || host.equals("chat.kick.cx")
            || host.endsWith(".chat.kick.cx")
            || host.equals("twitch.tv")
            || host.endsWith(".twitch.tv");
    }

    private boolean isTelevision() {
        UiModeManager uiModeManager = (UiModeManager) getSystemService(Context.UI_MODE_SERVICE);
        PackageManager packageManager = getPackageManager();
        boolean uiModeTelevision = uiModeManager != null
            && uiModeManager.getCurrentModeType() == Configuration.UI_MODE_TYPE_TELEVISION;
        boolean hasLeanback = packageManager.hasSystemFeature(PackageManager.FEATURE_LEANBACK);
        boolean hasTelevision = packageManager.hasSystemFeature(PackageManager.FEATURE_TELEVISION);
        boolean hasTouchscreen = packageManager.hasSystemFeature(PackageManager.FEATURE_TOUCHSCREEN);

        return uiModeTelevision || hasLeanback || hasTelevision || !hasTouchscreen;
    }

    private void openExternalUrl(String url) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            startActivity(intent);
        } catch (Exception ignored) {
            // If Android cannot resolve the URL, leave the popup closed.
        }
    }
}
