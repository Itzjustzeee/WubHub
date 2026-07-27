package com.wubhub.app;

import android.app.Activity;
import android.content.pm.ActivityInfo;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

public class KickWebViewActivity extends Activity {
    public static final String EXTRA_URL = "url";

    private WebView webView;
    private View fullscreenView;
    private WebChromeClient.CustomViewCallback fullscreenCallback;
    private final Handler handler = new Handler(Looper.getMainLooper());

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().setStatusBarColor(Color.BLACK);
        getWindow().setNavigationBarColor(Color.BLACK);
        enterImmersiveMode();
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.BLACK);
        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                isolateKickVideo();
                triggerKickTheaterShortcut();
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onShowCustomView(View view, CustomViewCallback callback) {
                showFullscreenVideo(view, callback);
            }

            @Override
            public void onHideCustomView() {
                hideFullscreenVideo();
            }
        });

        setContentView(webView, new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));

        String url = getIntent().getStringExtra(EXTRA_URL);
        webView.loadUrl(url != null ? url : "https://kick.com/paymoneywubby");
    }

    private void isolateKickVideo() {
        String script = "(function(){"
                + "if(window.__wubhubKickCleaner){return;}"
                + "window.__wubhubKickCleaner=true;"
                + "window.__wubhubKickTheaterAttempts=0;"
                + "try{var url=new URL(location.href);url.searchParams.set('theater','true');history.replaceState(null,'',url.toString());}catch(e){}"
                + "var css='html,body{margin:0!important;padding:0!important;background:#000!important;overflow:hidden!important;}'"
                + "+'header,footer,nav,[role=\"navigation\"],[data-testid*=\"chat\"],[class*=\"chat\"],[class*=\"sidebar\"],[class*=\"SideBar\"],[class*=\"Header\"],[class*=\"header\"]{display:none!important;}'"
                + "+'main,[role=\"main\"]{width:100vw!important;max-width:none!important;margin:0!important;padding:0!important;background:#000!important;}'"
                + "+'video{background:#000!important;}';"
                + "var style=document.createElement('style');style.id='wubhub-kick-cleaner';style.textContent=css;document.head.appendChild(style);"
                + "function textOf(el){return ((el.getAttribute('aria-label')||'')+' '+(el.getAttribute('title')||'')+' '+(el.textContent||'')).toLowerCase();}"
                + "function enableTheater(){"
                + "var buttons=Array.prototype.slice.call(document.querySelectorAll('button,[role=\"button\"]'));"
                + "var button=buttons.find(function(el){var text=textOf(el);return text.indexOf('theater')>-1||text.indexOf('theatre')>-1;});"
                + "if(button&&button.getAttribute('aria-pressed')!=='true'&&button.getAttribute('data-state')!=='on'){button.click();}"
                + "}"
                + "function pressTheaterKey(){"
                + "var targets=[window,document,document.documentElement,document.body,document.activeElement].filter(Boolean);"
                + "var video=document.querySelector('video');if(video){targets.push(video);try{video.focus();}catch(e){}}"
                + "targets.forEach(function(target){['keydown','keyup'].forEach(function(type){"
                + "try{target.dispatchEvent(new KeyboardEvent(type,{key:'t',code:'KeyT',keyCode:84,which:84,bubbles:true,cancelable:true}));}catch(e){}"
                + "try{target.dispatchEvent(new KeyboardEvent(type,{key:'T',code:'KeyT',keyCode:84,which:84,bubbles:true,cancelable:true,shiftKey:true}));}catch(e){}"
                + "});});"
                + "}"
                + "function clean(){"
                + "enableTheater();"
                + "if(window.__wubhubKickTheaterAttempts<5){window.__wubhubKickTheaterAttempts+=1;pressTheaterKey();}"
                + "var video=document.querySelector('video');"
                + "if(!video){return;}"
                + "video.muted=false;video.autoplay=true;video.playsInline=false;"
                + "video.play().catch(function(){});"
                + "}"
                + "clean();setTimeout(clean,600);setTimeout(clean,1600);setTimeout(clean,3000);setTimeout(clean,5200);setInterval(function(){enableTheater();},2500);"
                + "})();";
        webView.evaluateJavascript(script, null);
    }

    private void triggerKickTheaterShortcut() {
        handler.removeCallbacksAndMessages(null);
        long[] delays = {300, 900, 1800, 3200, 5200};
        for (long delay : delays) {
            handler.postDelayed(() -> {
                if (webView == null) {
                    return;
                }

                webView.requestFocus();
                tapPlayerArea();

                long eventTime = SystemClock.uptimeMillis();
                webView.dispatchKeyEvent(new KeyEvent(eventTime, eventTime, KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_T, 0));
                webView.dispatchKeyEvent(new KeyEvent(eventTime, SystemClock.uptimeMillis(), KeyEvent.ACTION_UP, KeyEvent.KEYCODE_T, 0));
            }, delay);
        }
    }

    private void tapPlayerArea() {
        if (webView == null || webView.getWidth() == 0 || webView.getHeight() == 0) {
            return;
        }

        long eventTime = SystemClock.uptimeMillis();
        float x = webView.getWidth() * 0.42f;
        float y = webView.getHeight() * 0.5f;
        webView.dispatchTouchEvent(MotionEvent.obtain(eventTime, eventTime, MotionEvent.ACTION_DOWN, x, y, 0));
        webView.dispatchTouchEvent(MotionEvent.obtain(eventTime, SystemClock.uptimeMillis(), MotionEvent.ACTION_UP, x, y, 0));
    }

    private void showFullscreenVideo(View view, WebChromeClient.CustomViewCallback callback) {
        if (fullscreenView != null) {
            callback.onCustomViewHidden();
            return;
        }

        fullscreenView = view;
        fullscreenCallback = callback;

        FrameLayout decor = (FrameLayout) getWindow().getDecorView();
        decor.addView(fullscreenView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
                Gravity.CENTER
        ));
        enterImmersiveMode();
    }

    private void hideFullscreenVideo() {
        if (fullscreenView == null) {
            return;
        }

        FrameLayout decor = (FrameLayout) getWindow().getDecorView();
        decor.removeView(fullscreenView);
        fullscreenView = null;

        if (fullscreenCallback != null) {
            fullscreenCallback.onCustomViewHidden();
            fullscreenCallback = null;
        }

        enterImmersiveMode();
    }

    private void enterImmersiveMode() {
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        );
    }

    @Override
    public void onBackPressed() {
        if (fullscreenView != null) {
            hideFullscreenVideo();
            return;
        }

        finish();
    }

    @Override
    protected void onDestroy() {
        hideFullscreenVideo();

        if (webView != null) {
            handler.removeCallbacksAndMessages(null);
            webView.destroy();
            webView = null;
        }

        super.onDestroy();
    }
}
