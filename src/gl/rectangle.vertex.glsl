precision mediump float;

@import ./includes/xdomain;
@import ./includes/sampleTransition;

attribute float y;
attribute vec4 color;
attribute lowp float opacity;

varying vec4 vColor;


void main(void) {
    float normalizedX = normalizeX();
    float translatedY = transit(normalizedX, y)[0];

    vec2 ndc = vec2(normalizedX, 1.0 - translatedY) * 2.0 - 1.0;

    gl_Position = vec4(ndc, 0.0, 1.0);

    vColor = vec4(color.rgb * opacity, opacity);
}