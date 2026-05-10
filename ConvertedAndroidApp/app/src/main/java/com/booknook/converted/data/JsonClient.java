package com.booknook.converted.data;

import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONTokener;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public class JsonClient {
    private final String baseUrl;

    public JsonClient(String baseUrl) {
        this.baseUrl = trimTrailingSlash(baseUrl);
    }

    public Object request(String path, String method, JSONObject body) throws Exception {
        URL url = new URL(path.startsWith("http") ? path : baseUrl + path);
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setConnectTimeout(18000);
        connection.setReadTimeout(30000);
        connection.setRequestMethod(method);
        connection.setRequestProperty("Accept", "application/json");
        connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");

        if (body != null) {
            connection.setDoOutput(true);
            try (BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(connection.getOutputStream(), StandardCharsets.UTF_8))) {
                writer.write(body.toString());
            }
        }

        int status = connection.getResponseCode();
        InputStream stream = status >= 200 && status < 300
                ? connection.getInputStream()
                : connection.getErrorStream();
        String raw = readAll(stream);
        Object payload = raw.isEmpty() ? new JSONObject() : new JSONTokener(raw).nextValue();

        if (status < 200 || status >= 300) {
            String message = "Request failed: " + status;
            if (payload instanceof JSONObject) {
                message = ((JSONObject) payload).optString("error", message);
            }
            throw new Exception(message);
        }

        return payload;
    }

    public JSONObject getObject(String path) throws Exception {
        Object payload = request(path, "GET", null);
        return payload instanceof JSONObject ? (JSONObject) payload : new JSONObject();
    }

    public JSONArray getArray(String path) throws Exception {
        Object payload = request(path, "GET", null);
        return payload instanceof JSONArray ? (JSONArray) payload : new JSONArray();
    }

    public JSONObject postObject(String path, JSONObject body) throws Exception {
        Object payload = request(path, "POST", body);
        return payload instanceof JSONObject ? (JSONObject) payload : new JSONObject();
    }

    public JSONObject patchObject(String path, JSONObject body) throws Exception {
        Object payload = request(path, "PATCH", body);
        return payload instanceof JSONObject ? (JSONObject) payload : new JSONObject();
    }

    public void delete(String path) throws Exception {
        request(path, "DELETE", null);
    }

    private static String readAll(InputStream stream) throws Exception {
        if (stream == null) return "";
        StringBuilder builder = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                builder.append(line);
            }
        }
        return builder.toString();
    }

    private static String trimTrailingSlash(String value) {
        if (value.endsWith("/")) return value.substring(0, value.length() - 1);
        return value;
    }
}
