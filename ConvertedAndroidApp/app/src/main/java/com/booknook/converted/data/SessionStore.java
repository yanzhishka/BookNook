package com.booknook.converted.data;

import android.content.Context;
import android.content.SharedPreferences;

public class SessionStore {
    private static final String PREFS = "bnook_native";
    private static final String SESSION_KEY = "bnook_local_user_id";
    private static final String TAB_KEY = "bnook_active_tab";
    private static final String THEME_KEY = "bnook_theme";
    private static final String READER_FONT_SIZE = "bnook_reader_font_size";
    private static final String READER_FONT = "bnook_reader_font_family";
    private static final String READER_THEME = "bnook_reader_theme";

    private final SharedPreferences prefs;

    public SessionStore(Context context) {
        prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public String getUserId() {
        return prefs.getString(SESSION_KEY, null);
    }

    public void saveUserId(String userId) {
        prefs.edit().putString(SESSION_KEY, userId).apply();
    }

    public void clearUserId() {
        prefs.edit().remove(SESSION_KEY).remove(TAB_KEY).apply();
    }

    public String getActiveTab() {
        return prefs.getString(TAB_KEY, "home");
    }

    public void saveActiveTab(String tab) {
        prefs.edit().putString(TAB_KEY, tab).apply();
    }

    public boolean isDarkTheme() {
        return "dark".equals(prefs.getString(THEME_KEY, "light"));
    }

    public void saveDarkTheme(boolean dark) {
        prefs.edit().putString(THEME_KEY, dark ? "dark" : "light").apply();
    }

    public int getReaderFontSize() {
        return prefs.getInt(READER_FONT_SIZE, 22);
    }

    public void saveReaderFontSize(int size) {
        prefs.edit().putInt(READER_FONT_SIZE, size).apply();
    }

    public String getReaderFont() {
        return prefs.getString(READER_FONT, "serif");
    }

    public void saveReaderFont(String value) {
        prefs.edit().putString(READER_FONT, value).apply();
    }

    public String getReaderTheme() {
        return prefs.getString(READER_THEME, "parchment");
    }

    public void saveReaderTheme(String value) {
        prefs.edit().putString(READER_THEME, value).apply();
    }
}
