package com.booknook.converted.ui;

import android.animation.ValueAnimator;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RadialGradient;
import android.graphics.Shader;
import android.view.View;
import android.view.animation.LinearInterpolator;

public class AuroraView extends View {
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private boolean dark;
    private float phase;

    public AuroraView(Context context) {
        super(context);
        ValueAnimator animator = ValueAnimator.ofFloat(0f, 1f);
        animator.setDuration(25000);
        animator.setRepeatCount(ValueAnimator.INFINITE);
        animator.setInterpolator(new LinearInterpolator());
        animator.addUpdateListener(valueAnimator -> {
            phase = (float) valueAnimator.getAnimatedValue();
            invalidate();
        });
        animator.start();
    }

    public void setDark(boolean dark) {
        this.dark = dark;
        invalidate();
    }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        canvas.drawColor(dark ? Design.STONE_950 : Design.STONE_50);
        float w = getWidth();
        float h = getHeight();
        drawBlob(canvas, w * (-0.1f + 0.08f * phase), h * (0.02f + 0.08f * phase), w * 0.75f, Design.AMBER, dark ? 42 : 58);
        drawBlob(canvas, w * (0.7f - 0.05f * phase), h * (0.65f - 0.04f * phase), w * 0.68f, Design.ROSE, dark ? 32 : 48);
        drawBlob(canvas, w * (0.45f + 0.05f * phase), h * (0.25f + 0.04f * phase), w * 0.55f, Color.rgb(59, 130, 246), dark ? 28 : 40);
    }

    private void drawBlob(Canvas canvas, float cx, float cy, float radius, int color, int alpha) {
        int transparent = Color.argb(0, Color.red(color), Color.green(color), Color.blue(color));
        int center = Color.argb(alpha, Color.red(color), Color.green(color), Color.blue(color));
        paint.setShader(new RadialGradient(cx, cy, radius, center, transparent, Shader.TileMode.CLAMP));
        canvas.drawCircle(cx, cy, radius, paint);
        paint.setShader(null);
    }
}
