package com.wubhub.app;

import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

public class KickHlsWebViewClient extends BridgeWebViewClient {
    public KickHlsWebViewClient(Bridge bridge) {
        super(bridge);
    }

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        Uri uri = request.getUrl();

        if (isKickHlsProxyRequest(uri)) {
            return proxyKickHlsRequest(uri);
        }

        return super.shouldInterceptRequest(view, request);
    }

    private boolean isKickHlsProxyRequest(Uri uri) {
        return uri != null
            && "localhost".equalsIgnoreCase(uri.getHost())
            && "/kick-hls".equals(uri.getPath());
    }

    private WebResourceResponse proxyKickHlsRequest(Uri uri) {
        String targetUrl = uri.getQueryParameter("url");

        if (!isAllowedKickHlsUrl(targetUrl)) {
            return textResponse(400, "Bad Request", "Invalid Kick HLS URL");
        }

        HttpURLConnection connection = null;

        try {
            connection = (HttpURLConnection) new URL(targetUrl).openConnection();
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(12000);
            connection.setReadTimeout(22000);
            connection.setRequestProperty("Origin", "https://kick.com");
            connection.setRequestProperty("Referer", "https://kick.com/paymoneywubby");
            connection.setRequestProperty("User-Agent", "WubHub");

            int statusCode = connection.getResponseCode();
            String reason = connection.getResponseMessage();
            String contentType = connection.getContentType();
            InputStream stream = statusCode >= 400 ? connection.getErrorStream() : connection.getInputStream();

            if (stream == null) {
                return textResponse(statusCode, reason, "");
            }

            byte[] responseBytes = readAllBytes(stream);
            boolean isPlaylist = targetUrl.contains(".m3u8")
                || (contentType != null && contentType.contains("mpegurl"));

            if (isPlaylist) {
                String playlist = rewritePlaylistUrls(new String(responseBytes, StandardCharsets.UTF_8));
                responseBytes = playlist.getBytes(StandardCharsets.UTF_8);
                contentType = "application/vnd.apple.mpegurl";
            }

            Map<String, String> headers = new HashMap<>();
            headers.put("Access-Control-Allow-Origin", "*");
            headers.put("Cache-Control", "no-store");

            return new WebResourceResponse(
                getMimeType(contentType, targetUrl),
                null,
                statusCode,
                reason != null ? reason : "OK",
                headers,
                new ByteArrayInputStream(responseBytes)
            );
        } catch (Exception error) {
            return textResponse(502, "Bad Gateway", "Kick HLS proxy failed: " + error.getMessage());
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }
    }

    private boolean isAllowedKickHlsUrl(String targetUrl) {
        return targetUrl != null && targetUrl.matches("^https://[^/]+\\.live-video\\.net/.*");
    }

    private String rewritePlaylistUrls(String playlist) throws Exception {
        StringBuilder rewritten = new StringBuilder();
        String[] lines = playlist.split("\\r?\\n", -1);

        for (String line : lines) {
            if (line.startsWith("https://") && isAllowedKickHlsUrl(line)) {
                rewritten.append("/kick-hls?url=");
                rewritten.append(URLEncoder.encode(line, StandardCharsets.UTF_8.name()));
            } else {
                rewritten.append(line);
            }

            rewritten.append("\n");
        }

        return rewritten.toString();
    }

    private String getMimeType(String contentType, String targetUrl) {
        if (targetUrl.contains(".m3u8")) {
            return "application/vnd.apple.mpegurl";
        }

        if (targetUrl.contains(".ts")) {
            return "video/mp2t";
        }

        if (contentType == null || contentType.isEmpty()) {
            return "application/octet-stream";
        }

        return contentType.split(";")[0];
    }

    private WebResourceResponse textResponse(int statusCode, String reason, String text) {
        Map<String, String> headers = new HashMap<>();
        headers.put("Access-Control-Allow-Origin", "*");
        headers.put("Cache-Control", "no-store");

        return new WebResourceResponse(
            "text/plain",
            "utf-8",
            statusCode,
            reason != null ? reason : "Error",
            headers,
            new ByteArrayInputStream(text.getBytes(StandardCharsets.UTF_8))
        );
    }

    private byte[] readAllBytes(InputStream inputStream) throws Exception {
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        byte[] buffer = new byte[16384];
        int bytesRead;

        while ((bytesRead = inputStream.read(buffer)) != -1) {
            outputStream.write(buffer, 0, bytesRead);
        }

        return outputStream.toByteArray();
    }
}
