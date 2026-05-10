package com.booknook.converted.ui;

import android.content.Context;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.view.View;
import android.widget.TextView;

public final class Design {
    public static final int STONE_50 = Color.rgb(252, 250, 247);
    public static final int STONE_100 = Color.rgb(245, 245, 244);
    public static final int STONE_200 = Color.rgb(231, 229, 228);
    public static final int STONE_300 = Color.rgb(214, 211, 209);
    public static final int STONE_400 = Color.rgb(168, 162, 158);
    public static final int STONE_500 = Color.rgb(120, 113, 108);
    public static final int STONE_700 = Color.rgb(68, 64, 60);
    public static final int STONE_800 = Color.rgb(41, 37, 36);
    public static final int STONE_900 = Color.rgb(28, 25, 23);
    public static final int STONE_950 = Color.rgb(12, 10, 9);
    public static final int AMBER = Color.rgb(245, 158, 11);
    public static final int ORANGE = Color.rgb(249, 115, 22);
    public static final int ROSE = Color.rgb(244, 63, 94);
    public static final int EMERALD = Color.rgb(16, 185, 129);

    private Design() {
    }

    public static int dp(Context context, float value) {
        return Math.round(value * context.getResources().getDisplayMetrics().density);
    }

    public static GradientDrawable rounded(int color, float radiusDp, Context context) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(color);
        drawable.setCornerRadius(dp(context, radiusDp));
        return drawable;
    }

    public static GradientDrawable stroke(int fill, int stroke, float radiusDp, float widthDp, Context context) {
        GradientDrawable drawable = rounded(fill, radiusDp, context);
        drawable.setStroke(dp(context, widthDp), stroke);
        return drawable;
    }

    public static GradientDrawable gradient(int start, int end, float radiusDp, Context context) {
        GradientDrawable drawable = new GradientDrawable(GradientDrawable.Orientation.TL_BR, new int[]{start, end});
        drawable.setCornerRadius(dp(context, radiusDp));
        return drawable;
    }

    public static TextView text(Context context, String value, float sp, int color, int style) {
        TextView view = new TextView(context);
        view.setText(value);
        view.setTextSize(sp);
        view.setTextColor(color);
        view.setTypeface(Typeface.DEFAULT, style);
        view.setIncludeFontPadding(true);
        return view;
    }

    public static TextView label(Context context, String value, boolean dark) {
        TextView view = text(context, value.toUpperCase(), 10, dark ? STONE_400 : STONE_500, Typeface.BOLD);
        view.setLetterSpacing(0.16f);
        return view;
    }

    public static TextView chip(Context context, String value, boolean active, boolean dark) {
        TextView view = text(context, value, 11, active ? (dark ? STONE_900 : Color.WHITE) : STONE_400, Typeface.BOLD);
        view.setGravity(Gravity.CENTER);
        view.setLetterSpacing(0.12f);
        view.setAllCaps(true);
        int bg = active ? (dark ? Color.WHITE : STONE_900) : Color.TRANSPARENT;
        view.setBackground(rounded(bg, 14, context));
        view.setPadding(dp(context, 16), dp(context, 10), dp(context, 16), dp(context, 10));
        return view;
    }

    public static void pressAnimation(View view) {
        view.setOnTouchListener((v, event) -> {
            switch (event.getActionMasked()) {
                case android.view.MotionEvent.ACTION_DOWN:
                    v.animate().scaleX(0.97f).scaleY(0.97f).setDuration(80).start();
                    break;
                case android.view.MotionEvent.ACTION_CANCEL:
                case android.view.MotionEvent.ACTION_UP:
                    v.animate().scaleX(1f).scaleY(1f).setDuration(140).start();
                    break;
                default:
                    break;
            }
            return false;
        });
    }

    public static int pageBackground(boolean dark) {
        return dark ? STONE_950 : STONE_50;
    }

    public static int cardBackground(boolean dark) {
        return dark ? STONE_900 : Color.WHITE;
    }

    public static int textColor(boolean dark) {
        return dark ? STONE_100 : STONE_900;
    }

    public static int mutedText(boolean dark) {
        return dark ? STONE_400 : STONE_500;
    }
}
