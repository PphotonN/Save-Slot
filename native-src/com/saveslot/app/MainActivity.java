package com.saveslot.app;

import android.app.Activity;
import android.content.Context;
import android.os.Bundle;
import android.os.Vibrator;
import android.view.HapticFeedbackConstants;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;

public final class MainActivity extends Activity {
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(1);

        webView = new WebView(this);
        webView.setHapticFeedbackEnabled(true);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        webView.addJavascriptInterface(new HapticsBridge(this, webView), "SaveSlotNative");
        webView.loadUrl("file:///android_asset/index.html");
        setContentView(webView);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    public static final class HapticsBridge {
        private final Context context;
        private final View view;

        HapticsBridge(Context context, View view) {
            this.context = context;
            this.view = view;
        }

        @JavascriptInterface
        public void insert() {
            view.post(new Runnable() {
                @Override public void run() {
                    click(HapticFeedbackConstants.KEYBOARD_TAP, 11L);
                    view.postDelayed(new Runnable() {
                        @Override public void run() {
                            click(HapticFeedbackConstants.VIRTUAL_KEY, 18L);
                        }
                    }, 52L);
                }
            });
        }

        @JavascriptInterface
        public void eject() {
            view.post(new Runnable() {
                @Override public void run() {
                    click(HapticFeedbackConstants.KEYBOARD_TAP, 13L);
                }
            });
        }

        @JavascriptInterface
        public void tap() {
            view.post(new Runnable() {
                @Override public void run() {
                    click(HapticFeedbackConstants.KEYBOARD_TAP, 10L);
                }
            });
        }

        private void click(int constant, long fallbackDurationMs) {
            boolean handled = false;
            try {
                handled = view.performHapticFeedback(constant, HapticFeedbackConstants.FLAG_IGNORE_VIEW_SETTING);
            } catch (Throwable ignored) {}
            if (!handled) {
                try {
                    Vibrator vibrator = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
                    if (vibrator != null && vibrator.hasVibrator()) {
                        vibrator.vibrate(fallbackDurationMs);
                    }
                } catch (Throwable ignored) {}
            }
        }
    }
}
